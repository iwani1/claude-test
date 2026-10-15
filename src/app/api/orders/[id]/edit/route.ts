import { secureRoute, ApiError } from "@/lib/api";
import { ROLE_PERMISSIONS, type UserRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import { orders, orderItems, diningTables, kitchenTickets, menuItems, modifierOptions, refunds } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { resyncStockForOrder } from "@/lib/inventory-deduction";
import { loadBillingConfig, priceOrder, fromCents } from "@/lib/pricing";
import { toCents } from "@/lib/pricing-core";

/**
 * Re-pricing of a saved order — owner-only in full, with one till carve-out:
 * staff working the POS may sync the ITEMS of a bill that is still open
 * (an order reopened from the kitchen queue to add items or settle), while
 * money-only edits and settled bills stay with the owner.
 *
 * The bill is recomputed with the same `priceOrder` the till uses, from menu
 * prices in the database — the browser never sets a price. Whatever the owner
 * changes, the after-effects are kept consistent:
 *
 *   - recipe stock is re-synced (old deduction reversed from the ledger, new
 *     lines deducted with today's recipes);
 *   - the open kitchen docket is refreshed so the kitchen cooks the corrected
 *     order;
 *   - a paid order is never silently repriced: money already collected stays
 *     as it is, and the response reports the balance to collect or refund, so
 *     the difference is settled visibly against the drawer;
 *   - refunded orders cannot be re-priced (their refund ledger was settled
 *     against the old total) — notes and customer details still work.
 *
 * Per the owner's decision, an edit leaves no audit entry; the order itself
 * shows its new contents.
 */
async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = requestContext.getStore()!.user!;
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new ApiError(400, "Invalid order id");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
  if (!order) throw new ApiError(404, "Order not found");

  const body = await req.json();
  const hasItems = Array.isArray(body.items);
  const hasMoney = body.discountAmount !== undefined || body.discountPercent !== undefined || body.tipAmount !== undefined;
  const reprice = hasItems || hasMoney;

  // The full editor stays owner-only, but the till has one legitimate need:
  // an order sent to the kitchen is reopened to add items or to settle, and
  // that means pushing the ticket's lines back through here. Till staff may
  // do exactly that — sync the ITEMS of a bill that is still open — and
  // nothing more: no money-only edits, no settled or cancelled bills, and
  // the discount already on the bill cannot move (discounts need a manager,
  // exactly as when the order was first rung).
  const perms = ROLE_PERMISSIONS[actor.role as UserRole];
  if (!perms?.canEditOrders) {
    const billStillOpen =
      ["unpaid", "partially_paid"].includes(order.paymentStatus) &&
      !["cancelled", "refunded"].includes(order.status);
    const discountMoved =
      (body.discountAmount !== undefined && toCents(body.discountAmount) !== toCents(order.discountAmount)) ||
      (body.discountPercent !== undefined && Number(body.discountPercent || 0) !== 0);
    if (!perms?.canAccessPos || !hasItems || !billStillOpen || discountMoved) {
      throw new ApiError(403, "Only the owner can edit an order this way. Till staff can add items to an open, unpaid bill from the POS.");
    }
  }

  // Refunds are a separate ledger (orders.paid_amount stays gross), so read that
  // ledger rather than a display field: once money has gone back to the guest,
  // re-pricing the bill would rewrite history the drawer already recorded.
  const refundRows = await db.select().from(refunds).where(eq(refunds.orderId, orderId));
  const refundedCents = refundRows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  if (reprice && refundedCents > 0) {
    throw new ApiError(409, "This order has refunds against it, so it cannot be re-priced. Customer details and notes can still be changed.");
  }

  // --- Order type / room -----------------------------------------------------
  const allowedOrderTypes = ["dine_in", "room_service", "takeaway", "delivery"];
  const orderType = body.orderType !== undefined ? String(body.orderType).toLowerCase() : order.orderType;
  if (!allowedOrderTypes.includes(orderType)) throw new ApiError(400, "Choose Dine-in, Room Service, Takeaway, or Delivery.");
  const roomNumber = orderType === "room_service" ? String(body.roomNumber ?? order.roomNumber ?? "").trim().slice(0, 20) : null;
  if (orderType === "room_service" && !roomNumber) throw new ApiError(400, "Room number is required for room-service orders.");

  // --- Table assignment (dine-in only) ---------------------------------------
  const requestedTable = body.tableId !== undefined ? (body.tableId ? Number(body.tableId) : null) : order.tableId;
  const nextTableId = orderType === "dine_in" ? requestedTable : null;
  if (nextTableId && nextTableId !== order.tableId) {
    const [table] = await db.select().from(diningTables).where(eq(diningTables.id, nextTableId)).limit(1).for("update");
    if (!table) throw new ApiError(404, "Table not found");
  }

  // --- Non-financial fields --------------------------------------------------
  const customerName = String(body.customerName ?? order.customerName ?? "Walk-in Guest").slice(0, 120);
  const customerPhone = String(body.customerPhone ?? order.customerPhone ?? "").slice(0, 40);
  const notes = String(body.notes ?? order.notes ?? "").slice(0, 2000);

  // --- Lines ------------------------------------------------------------------
  let resolvedLines: {
    menuItemId: number;
    itemName: string;
    quantity: number;
    unitPriceCents: number;
    modifierCents: number;
    costPrice: string;
    station: string;
    modifiers: any[];
    specialInstructions: string;
  }[] = [];

  if (reprice) {
    const source = hasItems
      ? (body.items as any[])
      : (await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))).map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          modifiers: (line.modifiers as any[] | null)?.map((m: any) => ({ id: m?.id })) || [],
          specialInstructions: line.specialInstructions || "",
        }));

    if (!Array.isArray(source) || source.length === 0 || source.length > 100) {
      throw new ApiError(400, "Order must contain at least one item");
    }
    for (const it of source) {
      if (!Number.isSafeInteger(Number(it.quantity)) || Number(it.quantity) < 1 || Number(it.quantity) > 1000) {
        throw new ApiError(400, "Quantity must be an integer between 1 and 1000");
      }
    }

    const requestedMenuIds = source.map((it) => Number(it.menuItemId)).filter((n) => Number.isFinite(n));
    if (requestedMenuIds.length !== source.length) throw new ApiError(400, "Every order line needs a valid menu item.");

    const dbMenuItems = await db.select().from(menuItems).where(inArray(menuItems.id, requestedMenuIds));

    const requestedOptionIds = new Set<number>();
    for (const it of source) {
      for (const m of it.modifiers || []) {
        const optId = Number(m?.id);
        if (Number.isFinite(optId)) requestedOptionIds.add(optId);
      }
    }
    const dbOptions = requestedOptionIds.size
      ? await db.select().from(modifierOptions).where(inArray(modifierOptions.id, [...requestedOptionIds]))
      : [];
    const optionById = new Map(dbOptions.map((o) => [o.id, o]));

    resolvedLines = source.map((it) => {
      const menuRow = dbMenuItems.find((m) => m.id === Number(it.menuItemId));
      if (!menuRow || !menuRow.isAvailable) throw new ApiError(400, `Menu item ${it.menuItemId} is not available`);
      let modifierCents = 0;
      const verifiedMods: any[] = [];
      for (const m of it.modifiers || []) {
        const opt = optionById.get(Number(m?.id));
        if (!opt) continue;
        modifierCents += Math.round(Number(opt.priceDelta || 0) * 100);
        verifiedMods.push({ id: opt.id, modifierId: opt.modifierId, name: opt.name, optionName: opt.name, priceDelta: opt.priceDelta });
      }
      return {
        menuItemId: menuRow.id,
        itemName: menuRow.name,
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 0)),
        unitPriceCents: Math.round(Number(menuRow.price) * 100) + modifierCents,
        modifierCents,
        costPrice: menuRow.costPrice || "0.00",
        station: menuRow.station || "kitchen",
        modifiers: verifiedMods,
        specialInstructions: String(it.specialInstructions || "").slice(0, 500),
      };
    });
  }

  // --- Money ------------------------------------------------------------------
  const config = await loadBillingConfig();
  const isComp = order.isComplimentary === true;

  let subtotal = order.subtotal;
  let taxAmount = order.taxAmount;
  let roomCharge = order.roomCharge;
  let discountAmount = order.discountAmount;
  let discountReason = order.discountReason || "";
  let tipAmount = order.tipAmount;
  let totalAmount = order.totalAmount;
  let compValue = String(order.compValue ?? "0.00");
  let totalCents = toCents(order.totalAmount);

  if (reprice) {
    const pricing = priceOrder({
      lines: resolvedLines.map((l) => ({
        unitPrice: fromCents(l.unitPriceCents - l.modifierCents),
        modifierTotal: fromCents(l.modifierCents),
        quantity: l.quantity,
      })),
      orderType,
      discountCents: body.discountAmount !== undefined ? Math.round(Number(body.discountAmount || 0) * 100) : 0,
      discountPercent: Number(body.discountPercent || 0),
      tipCents: Math.round(Number(body.tipAmount || 0) * 100),
      isComplimentary: isComp,
      config,
    });

    subtotal = fromCents(pricing.subtotalCents);
    taxAmount = fromCents(pricing.taxCents);
    roomCharge = fromCents(pricing.roomChargeCents);
    discountAmount = fromCents(pricing.discountCents);
    tipAmount = fromCents(pricing.tipCents);
    totalAmount = fromCents(pricing.totalCents);
    totalCents = pricing.totalCents;
    compValue = isComp ? fromCents(pricing.compValueCents) : "0.00";
    if (body.discountReason !== undefined) discountReason = String(body.discountReason || "").slice(0, 200);
  }

  // --- Payment state: never silent, always reported ---------------------------
  // Money actually in hand: what was taken, less anything handed back.
  const collectedCents = toCents(order.paidAmount) - refundedCents;
  const dueCents = totalCents - collectedCents;
  const paymentStatus = isComp
    ? "paid"
    : collectedCents <= 0
      ? "unpaid"
      : collectedCents >= totalCents
        ? "paid"
        : "partially_paid";
  // An order that now owes money cannot stay "completed" — reopen it so the
  // balance is collected instead of forgotten.
  const status = dueCents > 0 && collectedCents > 0 && order.status === "completed" ? "confirmed" : order.status;

  // An order can never hold more money than its bill (both this route and the
  // database's order_money_check refuse it). Money already banked on this bill
  // cannot be edited away, and it cannot be refunded-then-repriced either:
  // a refund permanently locks re-pricing above. So the honest answer is to
  // refuse, and say exactly what the cashier can do instead.
  if (dueCents < 0) {
    throw new ApiError(
      409,
      `GH₵${fromCents(collectedCents)} has already been collected on this order, which is more than the new total of GH₵${fromCents(totalCents)}. An order can never hold more money than its bill, so save as edited isn't possible. Either raise the total to at least GH₵${fromCents(collectedCents)}, or refund this order and ring up the corrected bill.`
    );
  }

  // Stock first, in its own transaction: if the shelf cannot cover the edited
  // lines, the whole edit stops here with nothing written.
  if (reprice && hasItems) {
    await resyncStockForOrder(
      orderId,
      order.orderNumber,
      resolvedLines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
      actor.id
    );
  }

  const [updated] = await db
    .update(orders)
    .set({
      orderType,
      roomNumber,
      tableId: nextTableId,
      customerName,
      customerPhone,
      notes,
      // Money state is only rewritten when the bill is actually re-priced.
      // A details-only save (the refunded-order case) must not touch it: the
      // refund ledger owns payment_status then, and clearing the "refunded"
      // marker would let the till take money the order can no longer hold.
      ...(reprice
        ? { subtotal, taxAmount, roomCharge, discountAmount, discountReason, tipAmount, totalAmount, compValue, paymentStatus, status }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  // --- Table transitions -------------------------------------------------------
  if (order.tableId && order.tableId !== nextTableId) {
    await db
      .update(diningTables)
      .set({ currentOrderId: null, status: "available" })
      .where(eq(diningTables.currentOrderId, orderId));
  }
  if (nextTableId && nextTableId !== order.tableId) {
    await db.update(diningTables).set({ status: "occupied", currentOrderId: orderId }).where(eq(diningTables.id, nextTableId));
  }

  // --- Lines + kitchen docket + stock ------------------------------------------
  if (reprice && hasItems) {
    const itemStatus = ["completed", "served", "cancelled"].includes(order.status) ? "served" : "preparing";
    // One truth per order: replace the old lines outright.
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    const inserted: any[] = [];
    for (const line of resolvedLines) {
      const [row] = await db
        .insert(orderItems)
        .values({
          orderId,
          menuItemId: line.menuItemId,
          itemName: line.itemName,
          quantity: line.quantity,
          unitPrice: fromCents(line.unitPriceCents),
          totalPrice: fromCents(line.unitPriceCents * line.quantity),
          costPrice: String(line.costPrice || "0.00"),
          modifiers: line.modifiers,
          specialInstructions: line.specialInstructions,
          itemStatus,
          station: line.station || "kitchen",
        })
        .returning();
      inserted.push(row);
    }

    // The kitchen must cook the corrected order, not the old one: refresh the
    // newest open docket, or open one if none is live.
    if (!["completed", "cancelled"].includes(order.status)) {
      const ticketItems = inserted.map((ci) => ({
        id: ci.id,
        name: ci.itemName,
        qty: ci.quantity,
        modifiers: ci.modifiers,
        notes: ci.specialInstructions,
        station: ci.station,
      }));
      const [latest] = await db
        .select()
        .from(kitchenTickets)
        .where(eq(kitchenTickets.orderId, orderId))
        .orderBy(desc(kitchenTickets.id))
        .limit(1);
      if (latest && ["pending", "preparing", "ready"].includes(latest.status)) {
        await db
          .update(kitchenTickets)
          .set({ items: ticketItems, status: "preparing", startedAt: new Date() })
          .where(eq(kitchenTickets.id, latest.id));
      } else if (!latest) {
        await db.insert(kitchenTickets).values({
          orderId,
          ticketNumber: `K-${String(order.orderNumber).slice(-4)}`,
          station: "kitchen",
          status: "preparing",
          items: ticketItems,
          startedAt: new Date(),
        });
      }
    }

  }

  return NextResponse.json({
    success: true,
    order: updated,
    collected: fromCents(collectedCents),
    refunded: fromCents(refundedCents),
    total: fromCents(totalCents),
    balanceDue: dueCents > 0 ? fromCents(dueCents) : "0.00",
    refundDue: dueCents < 0 ? fromCents(-dueCents) : "0.00",
  });
}

export const PATCH = secureRoute(handlePATCH, "canAccessPos");
