import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ApiError } from "./api";
export function reportWindow(timeframe: string, now = new Date()) {
  if (!["all", "today", "7days", "30days"].includes(timeframe)) throw new ApiError(400, "Invalid timeframe");
  const end = now;
  const start = timeframe === "all" ? null : timeframe === "today"
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    : new Date(now.getTime() - (timeframe === "7days" ? 7 : 30) * 86400000);
  return { start, end };
}
export type ReportWindow = ReturnType<typeof reportWindow>;
// One SQL statement gives both ledgers the same PostgreSQL snapshot. Dates are
// transaction dates, not order dates: a refund today for an old sale is shown today.
function eventQuery(window: ReportWindow) {
  const lower = window.start ?? new Date("1970-01-01T00:00:00Z");
  return sql`
    select 'payment'::text as kind, id, order_id, shift_id, created_at, amount,
      case when payment_method='cash' then amount else 0 end as cash,
      case when payment_method='momo' then amount else 0 end as momo,
      case when payment_method not in ('cash','momo') then amount else 0 end as unallocated
    from payments where status='completed' and created_at >= ${lower.toISOString()}::timestamp and created_at < ${window.end.toISOString()}::timestamp
    union all
    select 'refund', id, order_id, shift_id, created_at, amount,
      coalesce(cash_amount,0), coalesce(momo_amount,0),
      case when cash_amount is null or momo_amount is null then amount else 0 end
    from refunds where created_at >= ${lower.toISOString()}::timestamp and created_at < ${window.end.toISOString()}::timestamp`;
}
export async function collectionSummary(window: ReportWindow) {
  const result = await db.execute(sql`select
    coalesce(sum(amount) filter(where kind='payment'),0)::text as gross,
    coalesce(sum(amount) filter(where kind='refund'),0)::text as refunded,
    coalesce(sum(cash) filter(where kind='payment'),0)::text as cash_in,
    coalesce(sum(momo) filter(where kind='payment'),0)::text as momo_in,
    coalesce(sum(unallocated) filter(where kind='payment'),0)::text as other_in,
    coalesce(sum(cash) filter(where kind='refund'),0)::text as cash_out,
    coalesce(sum(momo) filter(where kind='refund'),0)::text as momo_out,
    coalesce(sum(unallocated) filter(where kind='refund'),0)::text as unknown_out,
    (coalesce(sum(amount) filter(where kind='payment'),0)-coalesce(sum(amount) filter(where kind='refund'),0))::text as net
    from (${eventQuery(window)}) events`);
  const r = result.rows[0];
  const amount = (key: string) => Number(r[key]).toFixed(2);
  return { grossCollections: amount("gross"), totalRefunds: amount("refunded"), netCollections: amount("net"),
    cashCollections: amount("cash_in"), momoCollections: amount("momo_in"), otherCollections: amount("other_in"),
    cashRefunds: amount("cash_out"), momoRefunds: amount("momo_out"), unallocatedRefunds: amount("unknown_out") };
}
export async function collectionEvents(window: ReportWindow) {
  const result = await db.execute(sql`select * from (${eventQuery(window)}) events order by created_at, kind, id limit 10001`);
  if (result.rows.length > 10000) throw new ApiError(413, "Export exceeds 10,000 events; choose a shorter timeframe");
  return result.rows;
}
