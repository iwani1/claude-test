import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { orders, refunds, auditLogs, users, diningTables } from "@/db/schema";
import { pinDigest, verifyPassword } from "@/lib/auth";
import { reverseStockForOrder } from "@/lib/inventory-deduction";
import { ApiError, rateLimit, secureRoute } from "@/lib/api";
import { moneyCents } from "@/lib/money";
export const POST = secureRoute(async (req, { params }) => {
  const actor = requestContext.getStore()!.user!;
  const orderId = Number((await params).id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new ApiError(400, "Invalid order ID");
  const { amount, reason, managerPin, returnStock } = await req.json();
  const cents = moneyCents(amount);
  if (typeof reason !== "string" || !reason.trim() || reason.length > 500) throw new ApiError(400, "Refund reason required (maximum 500 characters)");
  if (returnStock !== undefined && typeof returnStock !== "boolean") throw new ApiError(400, "returnStock must be boolean");
  await rateLimit(`refund:branch:${actor.branchId}`);
  if (typeof managerPin !== "string" || !/^\d{4,8}$/.test(managerPin)) throw new ApiError(403, "Manager PIN required");
  // RLS restricts approval to managers in the caller's branch.
  const [manager] = await db.select().from(users).where(eq(users.pinLookup, pinDigest(managerPin)));
  if (!manager?.isActive || !["super_admin", "manager"].includes(manager.role) || !manager.pin || !verifyPassword(managerPin, manager.pin)) throw new ApiError(403, "Invalid manager approval");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new ApiError(404, "Order not found");
  const previous = await db.select().from(refunds).where(eq(refunds.orderId, orderId));
  const refunded = previous.reduce((sum, row) => sum + moneyCents(row.amount), 0);
  const paid = moneyCents(order.paidAmount, true);
  if (cents > paid - refunded || order.status === "refunded") throw new ApiError(409, "Refund exceeds remaining refundable balance");
  const full = refunded + cents === paid;
  if (returnStock && !full) throw new ApiError(400, "Stock can only be returned when all collected funds have been refunded");
  const [refund] = await db.insert(refunds).values({ orderId, amount: (cents / 100).toFixed(2), reason: reason.trim(), authorizedBy: manager.id, stockReturned: !!returnStock }).returning();
  await db.update(orders).set({ status: full ? "refunded" : order.status, paymentStatus: full ? "refunded" : "partially_refunded", updatedAt: new Date() }).where(eq(orders.id, orderId));
  if (returnStock && order.stockDeducted) await reverseStockForOrder(orderId, order.orderNumber, [], actor.id);
  if (full && order.tableId) await db.update(diningTables).set({ status: "cleaning", currentOrderId: null }).where(eq(diningTables.currentOrderId, orderId));
  await db.insert(auditLogs).values({ userId: actor.id, userName: actor.name, action: "order_refunded", entityType: "order", entityId: String(orderId),
    details: `Refund GH₵${refund.amount}; manager ${manager.id}; full=${full}; stockReturned=${!!returnStock}; ${reason.trim()}` });
  // paidAmount remains the gross collected amount; refunds are a separate ledger.
  return NextResponse.json({ success: true, refund });
}, "canAccessPos");
