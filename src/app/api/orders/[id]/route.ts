import { secureRoute, ApiError } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, diningTables, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
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
