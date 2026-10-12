import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import {
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  ingredients,
  stockMovements,
  goodsReceipts,
  auditLogs,
} from "@/db/schema";
import { requirePermission } from "@/lib/guard";
import { desc, eq } from "drizzle-orm";

async function handleGET() {
  try {
    const pos = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
    const sups = await db.select().from(suppliers);
    const items = await db.select().from(purchaseOrderItems);
    const ingList = await db.select().from(ingredients);

    const enrichedPOs = pos.map((po) => {
      const sup = sups.find((s) => s.id === po.supplierId);
      const poItems = items
        .filter((it) => it.purchaseOrderId === po.id)
        .map((it) => {
          const ing = ingList.find((i) => i.id === it.ingredientId);
          return {
            ...it,
            ingredientName: ing?.name || "Unknown",
          };
        });

      return {
        ...po,
        supplierName: sup?.name || "Unknown",
        items: poItems,
      };
    });

    return NextResponse.json({ purchaseOrders: enrichedPOs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const guard = await requirePermission("canModifyInventory", "POST /api/purchasing/orders");
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { supplierId, branchId, items, notes, expectedDeliveryDate } = body;
    const createdById = guard.user.id;

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json({ error: "Supplier and line items are required" }, { status: 400 });
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    let subtotal = 0;
    for (const it of items) {
      subtotal += Number(it.orderedQuantity) * Number(it.unitPrice);
    }

    const [newPO] = await db
      .insert(purchaseOrders)
      .values({
        poNumber,
        supplierId: Number(supplierId),
        branchId: requestContext.getStore()!.user!.branchId,
        createdById: Number(createdById || 1),
        status: "ordered",
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        notes: notes || "",
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      })
      .returning();

    for (const it of items) {
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId: newPO.id,
        ingredientId: Number(it.ingredientId),
        orderedQuantity: String(it.orderedQuantity),
        receivedQuantity: "0.000",
        unitPrice: String(it.unitPrice),
        totalPrice: (Number(it.orderedQuantity) * Number(it.unitPrice)).toFixed(2),
        unit: it.unit || "pcs",
      });
    }

    await db.insert(auditLogs).values({
      action: "purchase_order_created",
      entityType: "inventory",
      entityId: String(newPO.id),
      details: `Created Purchase Order ${newPO.poNumber} ($${newPO.total})`,
    });

    return NextResponse.json({ success: true, purchaseOrder: newPO });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePATCH(req: Request) {
  try {
    // Receiving goods writes directly into live stock, so it is permission-gated.
    const guard = await requirePermission("canModifyInventory", "PATCH /api/purchasing/orders");
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { purchaseOrderId, action, receivedItems, invoiceNumber } = body;
    const receivedBy = guard.user.id;

    if (action === "receive_goods") {
      if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
        return NextResponse.json({ error: "Nothing was entered against this delivery." }, { status: 400 });
      }

      // Receiving writes straight into live stock, so it happens in one
      // transaction against a locked purchase order:
      //   - a PO can only be received once (a double tap or a retry after a
      //     slow response would otherwise add the delivery to stock twice),
      //   - every line must belong to *this* PO,
      //   - the same line twice in one payload is refused rather than counted twice,
      //   - stock, ledger lines, the GRN and the audit entry commit together.
      const outcome = await db.transaction(async (tx) => {
        const [po] = await tx
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, Number(purchaseOrderId)))
          .limit(1)
          .for("update");

        if (!po) return { error: "Purchase Order not found", status: 404 };
        if (po.status === "received") {
          return {
            error: `PO ${po.poNumber} was already received. Reverse the stock by adjustment instead of receiving it again.`,
            status: 409,
          };
        }

        const seenLines = new Set<number>();
        const seenIngredients = new Set<number>();
        for (const item of receivedItems) {
          const poItemId = Number(item.poItemId);
          const ingredientId = Number(item.ingredientId);
          const qty = Number(item.receivedQuantity);
          if (!Number.isFinite(qty) || qty < 0) {
            return { error: "Received quantities must be zero or more.", status: 400 };
          }
          if (seenLines.has(poItemId) || seenIngredients.has(ingredientId)) {
            return { error: "The same delivery line appears twice. Enter each item once.", status: 400 };
          }
          seenLines.add(poItemId);
          seenIngredients.add(ingredientId);

          const [line] = await tx
            .select()
            .from(purchaseOrderItems)
            .where(eq(purchaseOrderItems.id, poItemId))
            .limit(1);
          if (!line || line.purchaseOrderId !== po.id) {
            return { error: "A received line does not belong to this purchase order.", status: 400 };
          }
        }

        for (const item of receivedItems) {
          const qtyReceived = Number(item.receivedQuantity);
          if (qtyReceived <= 0) continue;

          const [ing] = await tx
            .select()
            .from(ingredients)
            .where(eq(ingredients.id, Number(item.ingredientId)))
            .limit(1)
            .for("update");

          if (!ing) {
            return { error: "One of the received items is not in Ingredient Stock.", status: 400 };
          }

          const prev = Number(ing.currentStock);
          const next = prev + qtyReceived;

          await tx
            .update(ingredients)
            .set({
              currentStock: next.toFixed(3),
              costPerUnit: item.unitPrice ? String(item.unitPrice) : ing.costPerUnit,
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, ing.id));

          await tx.insert(stockMovements).values({
            ingredientId: ing.id,
            movementType: "purchase_receipt",
            quantityDelta: qtyReceived.toFixed(3),
            previousStock: prev.toFixed(3),
            newStock: next.toFixed(3),
            referenceId: po.poNumber,
            unitCost: item.unitPrice ? String(item.unitPrice) : ing.costPerUnit,
            reason: `Goods received from PO ${po.poNumber}`,
            createdById: receivedBy || 1,
          });

          await tx
            .update(purchaseOrderItems)
            .set({ receivedQuantity: String(qtyReceived) })
            .where(eq(purchaseOrderItems.id, Number(item.poItemId)));
        }

        const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
        await tx.insert(goodsReceipts).values({
          grnNumber,
          purchaseOrderId: po.id,
          receivedBy: receivedBy || 1,
          invoiceNumber: invoiceNumber || "",
          itemsReceived: receivedItems,
        });

        const [updatedPO] = await tx
          .update(purchaseOrders)
          .set({ status: "received", receivedAt: new Date() })
          .where(eq(purchaseOrders.id, po.id))
          .returning();

        await tx.insert(auditLogs).values({
          action: "goods_receipt_processed",
          entityType: "inventory",
          entityId: String(po.id),
          details: `Processed GRN ${grnNumber} for PO ${po.poNumber}. Stock automatically updated.`,
        });

        return { ok: true as const, purchaseOrder: updatedPO, grnNumber };
      });

      if ("error" in outcome) {
        return NextResponse.json({ error: outcome.error }, { status: outcome.status });
      }
      return NextResponse.json({ success: true, purchaseOrder: outcome.purchaseOrder, grnNumber: outcome.grnNumber });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canModifyInventory");

export const POST = secureRoute(handlePOST, "canModifyInventory");

export const PATCH = secureRoute(handlePATCH, "canModifyInventory");
