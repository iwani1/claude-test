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
      const [po] = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, Number(purchaseOrderId)))
        .limit(1);

      if (!po) {
        return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
      }

      // Update inventory quantities for each received item
      for (const item of receivedItems) {
        const qtyReceived = Number(item.receivedQuantity);
        if (qtyReceived <= 0) continue;

        const [ing] = await db
          .select()
          .from(ingredients)
          .where(eq(ingredients.id, Number(item.ingredientId)))
          .limit(1);

        if (ing) {
          const prev = Number(ing.currentStock);
          const next = prev + qtyReceived;

          await db
            .update(ingredients)
            .set({
              currentStock: next.toFixed(3),
              costPerUnit: item.unitPrice ? String(item.unitPrice) : ing.costPerUnit,
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, ing.id));

          // Log stock movement
          await db.insert(stockMovements).values({
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

          // Update PO item received quantity
          await db
            .update(purchaseOrderItems)
            .set({ receivedQuantity: String(qtyReceived) })
            .where(eq(purchaseOrderItems.id, Number(item.poItemId)));
        }
      }

      // Record Goods Receipt Note
      const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
      await db.insert(goodsReceipts).values({
        grnNumber,
        purchaseOrderId: po.id,
        receivedBy: receivedBy || 1,
        invoiceNumber: invoiceNumber || "",
        itemsReceived: receivedItems,
      });

      // Update PO status to received
      const [updatedPO] = await db
        .update(purchaseOrders)
        .set({
          status: "received",
          receivedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, po.id))
        .returning();

      await db.insert(auditLogs).values({
        action: "goods_receipt_processed",
        entityType: "inventory",
        entityId: String(po.id),
        details: `Processed GRN ${grnNumber} for PO ${po.poNumber}. Stock automatically updated.`,
      });

      return NextResponse.json({ success: true, purchaseOrder: updatedPO, grnNumber });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canModifyInventory");

export const POST = secureRoute(handlePOST, "canModifyInventory");

export const PATCH = secureRoute(handlePATCH, "canModifyInventory");
