import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { refundBalance } from "@/lib/refund-balance";
import { eq, sql, and } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { orders, refunds, auditLogs, users, diningTables, shifts, drawerMovements } from "@/db/schema";
import { pinDigest, verifyPassword } from "@/lib/auth";
import { reverseStockForOrder } from "@/lib/inventory-deduction";
import { ApiError, assertNotThrottled, recordFailedAttempt, secureRoute } from "@/lib/api";
import { moneyCents } from "@/lib/money";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
export const POST = secureRoute(async (req, { params }) => {
  const actor = requestContext.getStore()!.user!;
  // Only managers, the owner and accountants may request a refund (owner
  // directive, Oct 2026). The manager PIN below remains the authorisation;
  // this gate decides who may ask at all. Cashiers no longer reach this
  // handler, so the check runs before any money validation or throttling.
  if (!ROLE_PERMISSIONS[actor.role]?.canIssueRefunds) throw new ApiError(403, "Your role cannot request refunds");
  const orderId = Number((await params).id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new ApiError(400, "Invalid order ID");
  const { amount, reason, managerPin, returnStock, cashAmount, momoAmount, idempotencyKey } = await req.json();
  const cents = moneyCents(amount);
  if (typeof reason !== "string" || !reason.trim() || reason.length > 500) throw new ApiError(400, "Refund reason required (maximum 500 characters)");
  if (returnStock !== undefined && typeof returnStock !== "boolean") throw new ApiError(400, "returnStock must be boolean");
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 128) throw new ApiError(400, "A stable refund idempotencyKey (8–128 characters) is required");
  const cash = moneyCents(cashAmount, true), momo = moneyCents(momoAmount, true);
  if (cash + momo !== cents) throw new ApiError(400, "Cash and MoMo refunds must equal the refund amount exactly");
  const fingerprint = createHash("sha256").update(JSON.stringify({ orderId, cents, cash, momo, reason: reason.trim(), returnStock: !!returnStock })).digest("hex");
  // Serialize retries before any order/shift mutation. PIN is never persisted in the fingerprint.
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`refund:${actor.branchId}:${idempotencyKey}`}, 0))`);
  const [replay] = await db.select().from(refunds).where(eq(refunds.idempotencyKey, idempotencyKey));
  if (replay) {
    if (replay.requestFingerprint !== fingerprint) throw new ApiError(409, "Refund key already used for different details");
    return NextResponse.json({ success: true, refund: replay, duplicate: true });
  }
  // Only wrong manager PINs are counted; a refund that is approved is never throttled.
  const refundKey = `refund:branch:${actor.branchId}`;
  await assertNotThrottled(refundKey);
  if (typeof managerPin !== "string" || !/^\d{4,8}$/.test(managerPin)) {
    await recordFailedAttempt(refundKey);
    throw new ApiError(403, "Manager PIN required");
  }
  // RLS restricts approval to managers in the caller's branch.
  const [manager] = await db.select().from(users).where(eq(users.pinLookup, pinDigest(managerPin)));
  if (!manager?.isActive || !["super_admin", "manager"].includes(manager.role) || !manager.pin || !verifyPassword(managerPin, manager.pin)) {
    await recordFailedAttempt(refundKey);
    throw new ApiError(403, "Invalid manager approval");
  }
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new ApiError(404, "Order not found");
  const balance = await refundBalance(orderId);
  const refunded = balance.refunded;
  const paid = moneyCents(order.paidAmount, true);
  if (balance.unallocated || balance.cashPaid + balance.momoPaid !== paid) throw new ApiError(409, "Historical tender ledger requires reconciliation before further refunds");
  if (cents > paid - refunded || order.status === "refunded") throw new ApiError(409, "Refund exceeds remaining refundable balance");
  if (cash > balance.cash || momo > balance.momo) throw new ApiError(409, "Refund exceeds remaining original cash/MoMo tender");
  const full = refunded + cents === paid;
  if (returnStock && !full) throw new ApiError(400, "Stock can only be returned when all collected funds have been refunded");
  // Lock the operator's own open shift, not the historical sale's shift and
  // not a colleague's: cash handed back comes out of this operator's float.
  const [shift] = await db.select().from(shifts).where(and(eq(shifts.status, "open"), eq(shifts.userId, actor.id))).for("update");
  if (cash > 0 && !shift) throw new ApiError(409, "Open your shift before recording a cash refund");
  const [refund] = await db.insert(refunds).values({ orderId, amount: (cents / 100).toFixed(2), cashAmount: (cash / 100).toFixed(2), momoAmount: (momo / 100).toFixed(2),
    shiftId: shift?.id ?? null, idempotencyKey, requestFingerprint: fingerprint, reason: reason.trim(), authorizedBy: manager.id, stockReturned: !!returnStock }).returning();
  if (cash > 0 && shift) {
    await db.insert(drawerMovements).values({ shiftId: shift.id, refundId: refund.id, kind: "refund", amount: refund.cashAmount!, reason: reason.trim(), createdBy: actor.id });
    await db.update(shifts).set({ cashPayouts: ((moneyCents(shift.cashPayouts || "0", true) + cash) / 100).toFixed(2) }).where(eq(shifts.id, shift.id));
  }
  await db.update(orders).set({ status: full ? "refunded" : order.status, paymentStatus: full ? "refunded" : "partially_refunded", updatedAt: new Date() }).where(eq(orders.id, orderId));
  if (returnStock && order.stockDeducted) await reverseStockForOrder(orderId, order.orderNumber, [], actor.id);
  if (full && order.tableId) await db.update(diningTables).set({ status: "cleaning", currentOrderId: null }).where(eq(diningTables.currentOrderId, orderId));
  await db.insert(auditLogs).values({ userId: actor.id, userName: actor.name, action: "order_refunded", entityType: "order", entityId: String(orderId),
    details: `Refund GH₵${refund.amount}; manager ${manager.id}; full=${full}; stockReturned=${!!returnStock}; ${reason.trim()}` });
  // paidAmount remains the gross collected amount; refunds are a separate ledger.
  return NextResponse.json({ success: true, refund });
}, "canViewOrderHistory");

export const GET = secureRoute(async (_req, { params }) => {
  const actor = requestContext.getStore()!.user!;
  if (!ROLE_PERMISSIONS[actor.role]?.canIssueRefunds) throw new ApiError(403, "Your role cannot request refunds");
  const orderId = Number((await params).id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new ApiError(400, "Invalid order ID");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new ApiError(404, "Order not found");
  const balance = await refundBalance(orderId);
  return NextResponse.json({
    cashRemaining: (balance.cash / 100).toFixed(2), momoRemaining: (balance.momo / 100).toFixed(2),
    refundableAmount: ((moneyCents(order.paidAmount, true) - balance.refunded) / 100).toFixed(2),
    requiresReconciliation: balance.unallocated || balance.cashPaid + balance.momoPaid !== moneyCents(order.paidAmount, true),
  });
}, "canViewOrderHistory");
