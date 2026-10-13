import { db } from "@/db";
import { payments, refunds } from "@/db/schema";
import { eq } from "drizzle-orm";
import { moneyCents } from "./money";
export async function refundBalance(orderId: number) {
  const collected = await db.select().from(payments).where(eq(payments.orderId, orderId));
  const returned = await db.select().from(refunds).where(eq(refunds.orderId, orderId));
  const total = (method: string) => collected.filter(p => p.status === "completed" && p.paymentMethod === method)
    .reduce((sum, p) => sum + moneyCents(p.amount), 0);
  const cashPaid = total("cash"), momoPaid = total("momo");
  const refunded = returned.reduce((sum, r) => sum + moneyCents(r.amount), 0);
  const unallocated = returned.some(r => r.cashAmount === null || r.momoAmount === null);
  const cash = cashPaid - returned.reduce((sum, r) => sum + moneyCents(r.cashAmount ?? "0", true), 0);
  const momo = momoPaid - returned.reduce((sum, r) => sum + moneyCents(r.momoAmount ?? "0", true), 0);
  return { cash, momo, refunded, cashPaid, momoPaid, unallocated };
}
