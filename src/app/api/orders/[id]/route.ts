import { secureRoute, ApiError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, diningTables, auditLogs, stockMovements, ingredients, refunds, payments, kitchenTickets, shifts, drawerMovements } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { toCents, fromCents } from "@/lib/pricing-core";
import { reverseStockForOrder } from "@/lib/inventory-deduction";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = Number(id);

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    return NextResponse.json({ order: { ...order, items } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = Number(id);
    const body = await req.json();
    const { status, discountAmount, discountReason, tipAmount, notes, returnStockOnCancel } = body;

    const [existingOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (discountAmount !== undefined || tipAmount !== undefined) return NextResponse.json({ error: "Financial adjustments require a new bill; paid orders must use refunds" }, { status: 400 });
    if (status !== undefined && !["confirmed", "preparing", "ready", "served", "cancelled"].includes(status)) return NextResponse.json({ error: "Invalid fulfillment status" }, { status: 400 });
    if (["cancelled", "refunded"].includes(existingOrder.status) || existingOrder.paymentStatus.includes("refunded")) return NextResponse.json({ error: "Order is closed" }, { status: 409 });
    if (status === "cancelled" && Number(existingOrder.paidAmount) > 0) return NextResponse.json({ error: "Refund collected payments before cancellation" }, { status: 409 });
    const updates = { updatedAt: new Date(), ...(status !== undefined ? { status } : {}), ...(typeof notes === "string" ? { notes: notes.slice(0, 2000) } : {}) };

    const [updatedOrder] = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, orderId))
      .returning();

    // If order was cancelled and returnStock is requested, reverse the recipe deduction
    if (status === "cancelled" && returnStockOnCancel && existingOrder.stockDeducted) {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      await reverseStockForOrder(
        orderId,
        existingOrder.orderNumber,
        items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
      );
    }

    // Release table if cancelled or completed
    if ((status === "completed" || status === "cancelled") && existingOrder.tableId) {
      await db
        .update(diningTables)
        .set({ status: "cleaning", currentOrderId: null })
        .where(eq(diningTables.id, existingOrder.tableId));
    }

    await db.insert(auditLogs).values({
      action: "order_updated",
      entityType: "order",
      entityId: String(orderId),
      details: `Order ${existingOrder.orderNumber} updated. Status: ${status || existingOrder.status}`,
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canAccessPos");

export const PATCH = secureRoute(handlePATCH, "canAccessPos");

/* ------------------------------------------------------------------
 * DELETE — owner-only hard erase.
 *
 * The owner asked for orders to disappear completely: no soft-delete flag,
 * no archive row, no audit entry, any time. What this handler still
 * guarantees is internal consistency, so the rest of the system never
 * shows impossible numbers afterwards:
 *   - stock the order deducted is given back, and its ledger rows removed;
 *   - the table it was holding is released;
 *   - payments, refunds (+ their drawer movements), kitchen tickets and
 *     line items are erased with it, children before parents;
 *   - the shift's stored sales/cash/MoMo totals are rolled back so the
 *     drawer maths matches the sales that remain;
 *   - audit entries pointing at the order are swept.
 * ------------------------------------------------------------------ */
async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new ApiError(400, "Invalid order id");

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
  if (!order) throw new ApiError(404, "Order not found");

  // 1. Stock: give back the net deduction, then erase the order's ledger rows.
  const ledgerReference = or(
    eq(stockMovements.referenceId, order.orderNumber),
    eq(stockMovements.referenceId, `REF-${order.orderNumber}`)
  );
  const movements = await db.select().from(stockMovements).where(ledgerReference);
  const netByIngredient = new Map<number, number>();
  for (const movement of movements) {
    netByIngredient.set(movement.ingredientId, (netByIngredient.get(movement.ingredientId) || 0) + Number(movement.quantityDelta));
  }
  for (const ingredientId of [...netByIngredient.keys()].sort((a, b) => a - b)) {
    const net = netByIngredient.get(ingredientId) ?? 0;
    if (net >= 0) continue; // already netted out (cancel/refund restored it earlier)
    const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1).for("update");
    if (!ingredient) continue;
    const restored = Number(ingredient.currentStock) - net; // net is negative
    await db.update(ingredients).set({ currentStock: restored.toFixed(3), updatedAt: new Date() }).where(eq(ingredients.id, ingredientId));
  }
  if (movements.length > 0) await db.delete(stockMovements).where(ledgerReference);

  // 2. Release the table if this order was holding it.
  if (order.tableId) {
    const [table] = await db.select().from(diningTables).where(eq(diningTables.id, order.tableId)).limit(1).for("update");
    if (table && table.currentOrderId === orderId) {
      await db
        .update(diningTables)
        .set({ currentOrderId: null, ...(table.status === "occupied" ? { status: "available" } : {}) })
        .where(eq(diningTables.id, table.id));
    }
  }

  // 3. Roll back the shift's stored totals for the payments being erased.
  const orderPayments = await db.select().from(payments).where(eq(payments.orderId, orderId));
  const shiftDelta = new Map<number, { sales: number; cash: number; momo: number }>();
  for (const payment of orderPayments) {
    if (payment.shiftId == null) continue;
    const entry = shiftDelta.get(payment.shiftId) ?? { sales: 0, cash: 0, momo: 0 };
    const cents = toCents(payment.amount);
    entry.sales += cents;
    if (payment.paymentMethod === "cash") entry.cash += cents;
    if (payment.paymentMethod === "momo") entry.momo += cents;
    shiftDelta.set(payment.shiftId, entry);
  }
  for (const [shiftId, delta] of shiftDelta) {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1).for("update");
    if (!shift) continue;
    await db
      .update(shifts)
      .set({
        totalSales: fromCents(Math.max(0, toCents(shift.totalSales || 0) - delta.sales)),
        totalCashSales: fromCents(Math.max(0, toCents(shift.totalCashSales || 0) - delta.cash)),
        totalCardSales: fromCents(Math.max(0, toCents(shift.totalCardSales || 0) - delta.momo)),
      })
      .where(eq(shifts.id, shiftId));
  }

  // 4. Erase the order's records — children before parents.
  const orderRefunds = await db.select({ id: refunds.id }).from(refunds).where(eq(refunds.orderId, orderId));
  if (orderRefunds.length > 0) {
    await db.delete(drawerMovements).where(inArray(drawerMovements.refundId, orderRefunds.map((refund) => refund.id)));
  }
  await db.delete(refunds).where(eq(refunds.orderId, orderId));
  await db.delete(payments).where(eq(payments.orderId, orderId));
  await db.delete(kitchenTickets).where(eq(kitchenTickets.orderId, orderId));
  await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));

  // 5. Sweep audit entries that point at this order (owner chose no trace).
  await db.delete(auditLogs).where(and(eq(auditLogs.entityType, "order"), eq(auditLogs.entityId, String(orderId))));

  return NextResponse.json({ success: true, deleted: order.orderNumber });
}

export const DELETE = secureRoute(handleDELETE, "canDeleteOrders");
