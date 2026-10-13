import { ApiError, isDatabaseFailure } from "@/lib/api";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import {
  orders,
  orderItems,
  kitchenTickets,
  diningTables,
  auditLogs,
  menuItems,
  modifierOptions,
  applicationSettings,
} from "@/db/schema";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { deductStockForOrder } from "@/lib/inventory-deduction";
import { requireSession } from "@/lib/guard";
import { hideCost, maySeeCost } from "@/lib/cost-visibility";
import { loadBillingConfig, priceOrder, fromCents } from "@/lib/pricing";

/** Settings key: "false" from the seed until the owner saves a VAT rate. */
export const TAX_RATE_CONFIRMED = "tax_rate_confirmed";

export async function createOrder(req: Request) {
  try {
    const guard = await requireSession();
    if (!guard.ok) return guard.response;

    // A new installation is seeded with its VAT rate unconfirmed. No sale may be
    // rung up until the owner has saved the rate in Settings.
    const [unconfirmedTax] = await db.select({ id: applicationSettings.id }).from(applicationSettings)
      .where(and(eq(applicationSettings.key, TAX_RATE_CONFIRMED), eq(applicationSettings.value, "false"))).limit(1);
    if (unconfirmedTax) return NextResponse.json({ error: "Save the VAT rate in Settings before selling." }, { status: 409 });

    const body = await req.json();
    const {
      branchId,
      tableId,
      roomNumber,
      customerName,
      customerPhone,
      orderType,
      discountAmount,
      discountPercent,
      discountReason,
      tipAmount,
      notes,
      items,
      idempotencyKey,
      sendToKitchen,
      isComplimentary,
      complimentaryReason,
    } = body;

    // The owning cashier is taken from the verified session so an order can
    // never be attributed to another employee by tampering with the payload.
    const userId = guard.user.id;

    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return NextResponse.json({ error: "Order must contain at least one item" }, { status: 400 });
    }

    const normalizedOrderType = String(orderType || "dine_in").toLowerCase();
    const allowedOrderTypes = ["dine_in", "room_service", "takeaway", "delivery"];
    if (!allowedOrderTypes.includes(normalizedOrderType)) {
      return NextResponse.json({ error: "Choose Dine-in, Room Service, Takeaway, or Delivery." }, { status: 400 });
    }
    if (normalizedOrderType === "room_service" && !String(roomNumber || "").trim()) {
      return NextResponse.json({ error: "Room number is required for room-service orders." }, { status: 400 });
    }

    // ---------------------------------------------------------------------
    // Price the bill on the server. The client's own subtotal/tax/total are
    // deliberately ignored: the dine-in room charge is mandatory revenue and
    // VAT must be consistent, so neither can be set by the browser.
    // ---------------------------------------------------------------------
    if (branchId !== undefined && Number(branchId) !== guard.user.branchId) throw new ApiError(403, "Branch access denied");
    if (items.some((it: any) => !Number.isSafeInteger(it.quantity) || it.quantity < 1 || it.quantity > 1000)) throw new ApiError(400, "Quantity must be an integer between 1 and 1000");
    if (tableId) {
      const [table] = await db.select().from(diningTables).where(eq(diningTables.id, Number(tableId))).for("update");
      if (!table) throw new ApiError(404, "Table not found");
      if (normalizedOrderType === "dine_in" && table.currentOrderId) {
        const [open] = await db.select({ status: orders.status, paymentStatus: orders.paymentStatus })
          .from(orders).where(eq(orders.id, table.currentOrderId)).limit(1);
        if (open && !(["cancelled", "refunded"].includes(open.status)) && !(["paid", "refunded"].includes(open.paymentStatus))) {
          throw new ApiError(409, "This table already has an open order. Add the items to that order instead.");
        }
      }
    }
    for (const value of [discountAmount, discountPercent, tipAmount]) {
      if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new ApiError(400, "Invalid discount or tip");
    }
    if ((isComplimentary || Number(discountAmount) > 0 || Number(discountPercent) > 0) && !["manager", "super_admin"].includes(guard.user.role)) throw new ApiError(403, "Manager approval required for discounts and complimentary orders");
    const fingerprint = createHash("sha256").update(JSON.stringify({ items, tableId: tableId || null, orderType: normalizedOrderType, roomNumber, customerName, customerPhone, discountAmount, discountPercent, tipAmount, isComplimentary, sendToKitchen })).digest("hex");
    if (idempotencyKey !== undefined && (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 128)) throw new ApiError(400, "Idempotency key must contain 8–128 characters");
    if (idempotencyKey) {
      // Serialize only retries of the same key; the unique index is the final backstop.
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${guard.user.branchId}:${idempotencyKey}`}, 0))`);
      const [existing] = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey));
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) throw new ApiError(409, "Idempotency key was already used for a different order");
        return NextResponse.json({ success: true, order: existing, duplicate: true });
      }
    }
    const config = await loadBillingConfig();

    const wantsComp = isComplimentary === true || isComplimentary === "true";
    if (wantsComp && normalizedOrderType !== "room_service") {
      return NextResponse.json(
        { error: "Complimentary breakfast is available only for room-service orders." },
        { status: 400 }
      );
    }
    if (wantsComp && !config.compBreakfastEnabled) {
      return NextResponse.json(
        { error: "Complimentary breakfast is currently disabled in settings." },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------------
    // Resolve authoritative prices from the menu database.
    //
    // The browser's unitPrice is never trusted: a modified client could
    // otherwise understate the bill. Base prices come from menu_items and
    // modifier surcharges are validated against modifier_options, so the only
    // thing the client controls is WHICH items/options and HOW MANY.
    // ---------------------------------------------------------------------
    const requestedMenuIds = items
      .map((it: any) => Number(it.menuItemId))
      .filter((n: number) => Number.isFinite(n));
    if (requestedMenuIds.length !== items.length) {
      return NextResponse.json({ error: "Every order line needs a valid menu item." }, { status: 400 });
    }

    const dbMenuItems = await db
      .select()
      .from(menuItems)
      .where(inArray(menuItems.id, requestedMenuIds));

    // Collect every modifier option id the client claims was chosen.
    const requestedOptionIds = new Set<number>();
    for (const it of items) {
      for (const m of it.modifiers || []) {
        const optId = Number(m?.id);
        if (Number.isFinite(optId)) requestedOptionIds.add(optId);
      }
    }
    const dbOptions = requestedOptionIds.size
      ? await db
          .select()
          .from(modifierOptions)
          .where(inArray(modifierOptions.id, [...requestedOptionIds]))
      : [];
    const optionById = new Map(dbOptions.map((o) => [o.id, o]));

    interface ResolvedLine {
      menuItemId: number;
      itemName: string;
      quantity: number;
      basePriceCents: number;
      modifierCents: number;
      unitPriceCents: number;
      costPrice: string;
      station: string;
      modifiers: any[];
      specialInstructions: string;
    }

    const resolvedLines: ResolvedLine[] = items.map((it: any) => {
      const menuRow = dbMenuItems.find((m) => m.id === Number(it.menuItemId));
      if (!menuRow || !menuRow.isAvailable) {
        throw Object.assign(new Error(`Menu item ${it.menuItemId} no longer exists`), {
          statusCode: 400,
        });
      }

      // Modifier surcharges are taken from the database, not the payload.
      let modifierCents = 0;
      const verifiedMods: any[] = [];
      for (const m of it.modifiers || []) {
        const opt = optionById.get(Number(m?.id));
        if (!opt) continue; // ignore unknown/tampered option ids
        modifierCents += Math.round(Number(opt.priceDelta || 0) * 100);
        verifiedMods.push({
          id: opt.id,
          modifierId: opt.modifierId,
          name: opt.name,
          optionName: opt.name,
          priceDelta: opt.priceDelta,
        });
      }

      const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));

      return {
        menuItemId: menuRow.id,
        itemName: menuRow.name,
        quantity: qty,
        basePriceCents: Math.round(Number(menuRow.price) * 100),
        modifierCents,
        unitPriceCents: Math.round(Number(menuRow.price) * 100) + modifierCents,
        costPrice: menuRow.costPrice || "0.00",
        station: menuRow.station || "kitchen",
        modifiers: verifiedMods,
        specialInstructions: String(it.specialInstructions || "").slice(0, 500),
      };
    });

    const invalidLine = resolvedLines.find((l) => l.quantity <= 0);
    if (invalidLine) {
      return NextResponse.json({ error: "Each order line needs a quantity of at least 1." }, { status: 400 });
    }

    const pricing = priceOrder({
      lines: resolvedLines.map((l) => ({
        unitPrice: fromCents(l.basePriceCents),
        modifierTotal: fromCents(l.modifierCents),
        quantity: l.quantity,
      })),
      orderType: normalizedOrderType,
      discountCents: Math.round(Number(discountAmount || 0) * 100),
      discountPercent: Number(discountPercent || 0),
      tipCents: Math.round(Number(tipAmount || 0) * 100),
      isComplimentary: wantsComp,
      config,
    });

    const subtotal = fromCents(pricing.subtotalCents);
    const taxAmount = fromCents(pricing.taxCents);
    const serviceCharge = "0.00";
    const roomCharge = fromCents(pricing.roomChargeCents);
    const totalAmount = fromCents(pricing.totalCents);

    // Generate unique order number
    const orderNumber = `ORD-${randomUUID()}`;

    // A complimentary order has nothing to collect, so it is settled at once.
    // It is still fully tracked: stock is deducted and a docket is printed.
    const isComp = pricing.isComplimentary;

    const [newOrder] = await db
      .insert(orders)
      .values({
        orderNumber,
        branchId: requestContext.getStore()!.user!.branchId,
        tableId: normalizedOrderType === "dine_in" && tableId ? Number(tableId) : null,
        roomNumber: normalizedOrderType === "room_service" ? String(roomNumber).trim().slice(0, 20) : null,
        userId: userId || 1,
        customerName: customerName || "Walk-in Guest",
        customerPhone: customerPhone || "",
        orderType: normalizedOrderType,
        status: sendToKitchen !== false ? "preparing" : "draft",
        subtotal,
        taxAmount,
        serviceCharge,
        roomCharge,
        discountAmount: fromCents(pricing.discountCents),
        discountReason: isComp
          ? complimentaryReason || "Complimentary breakfast"
          : discountReason || "",
        tipAmount: fromCents(pricing.tipCents),
        totalAmount,
        paidAmount: isComp ? totalAmount : "0.00",
        paymentStatus: isComp ? "paid" : "unpaid",
        isComplimentary: isComp,
        complimentaryReason: isComp ? complimentaryReason || "Complimentary breakfast" : null,
        compValue: fromCents(pricing.compValueCents),
        complimentaryApprovedBy: isComp ? userId : null,
        notes: notes || "",
        idempotencyKey: idempotencyKey || null,
        requestFingerprint: fingerprint,
        stockDeducted: false,
      })
      .returning();

    // Insert order items using the server-resolved prices. Line totals are
    // recomputed here so they always agree with the priced bill above.
    const createdItems = [];
    for (const line of resolvedLines) {
      const [insertedItem] = await db
        .insert(orderItems)
        .values({
          orderId: newOrder.id,
          menuItemId: line.menuItemId,
          itemName: line.itemName,
          quantity: line.quantity,
          unitPrice: fromCents(line.unitPriceCents),
          totalPrice: fromCents(line.unitPriceCents * line.quantity),
          costPrice: String(line.costPrice || "0.00"),
          modifiers: line.modifiers,
          specialInstructions: line.specialInstructions,
          itemStatus: "preparing",
          station: line.station || "kitchen",
        })
        .returning();
      createdItems.push(insertedItem);
    }

    // If dine-in, update table status to occupied
    if (normalizedOrderType === "dine_in" && tableId) {
      await db
        .update(diningTables)
        .set({
          status: "occupied",
          currentOrderId: newOrder.id,
        })
        .where(eq(diningTables.id, Number(tableId)));
    }

    // Create Kitchen Ticket if sendToKitchen
    if (sendToKitchen !== false) {
      const ticketItems = createdItems.map((ci) => ({
        id: ci.id,
        name: ci.itemName,
        qty: ci.quantity,
        modifiers: ci.modifiers,
        notes: ci.specialInstructions,
        station: ci.station,
      }));

      await db.insert(kitchenTickets).values({
        orderId: newOrder.id,
        ticketNumber: `K-${orderNumber.slice(-4)}`,
        station: "kitchen",
        status: "preparing",
        items: ticketItems,
        startedAt: new Date(),
      });
    }

    // Automatically trigger recipe-based ingredient deduction.
    // This runs for complimentary orders too: the food was genuinely consumed,
    // so stock must fall and the kitchen must still be told to cook it.
    await deductStockForOrder(
      newOrder.id,
      newOrder.orderNumber,
      resolvedLines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
      userId
    );

    // Audit log — the operator is the signed-in employee, not the guest.
    // Complimentary orders get their own action so management can review
    // every GH₵0 bill as a distinct, searchable event.
    const chargeNote = isComp
      ? `COMPLIMENTARY (${complimentaryReason || "breakfast"}), retail value GH₵${fromCents(pricing.compValueCents)}`
      : pricing.roomChargeCents > 0
        ? `incl. GH₵${roomCharge} dine-in room charge`
        : "no room charge (not dine-in)";

    await db.insert(auditLogs).values({
      userId,
      userName: guard.user.name,
      action: isComp ? "complimentary_order_created" : "order_created",
      entityType: "order",
      entityId: String(newOrder.id),
      details:
        `Created order ${newOrder.orderNumber} (GH₵${newOrder.totalAmount}, ${resolvedLines.length} lines) ` +
        `for guest "${customerName || "Walk-in Guest"}" via ${orderType || "dine_in"} — ${chargeNote}`,
    });

    return NextResponse.json({
      success: true,
      order: {
        ...newOrder,
        items: createdItems.map((line) => hideCost(line, maySeeCost(guard.user))),
      },
    });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    // Validation failures thrown while resolving menu prices are client errors.
    if (err instanceof ApiError) throw err;
    if (err?.statusCode === 400) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Order create error:", err);
    return NextResponse.json({ error: "Could not create the order. Please try again." }, { status: 500 });
  }
}
