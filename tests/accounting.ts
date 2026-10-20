import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
const admin = new Pool({ connectionString: process.env.TEST_ADMIN_URL });
let cookie = "", checks = 0;
function check(condition: unknown, label: string) { assert.ok(condition, label); checks++; console.log(`PASS accounting: ${label}`); }
async function request(path: string, body?: unknown, session = cookie) {
  const res = await fetch(`http://127.0.0.1:3100/api/${path}`, { method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Cookie: session }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, data: await res.json(), cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "" };
}
async function ok(path: string, body?: unknown) { const r = await request(path, body); assert.equal(r.status, 200, `${path}: ${JSON.stringify(r.data)}`); return r.data; }
const refund = (amount: string, cash: string, momo: string, extra = {}) => ({ amount, cashAmount: cash, momoAmount: momo, idempotencyKey: randomUUID(), reason: "Accounting acceptance", managerPin: "1111", ...extra });
async function sale() { return (await ok("orders", { orderType: "takeaway", idempotencyKey: randomUUID(), items: [{ menuItemId: 1, quantity: 1 }] })).order; }
async function main() {
  // Reset only test throttles between independent suites, never application enforcement.
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'refund:%'");
  cookie = (await request("auth/login", { email: "user1@test.invalid", password: "Test-password-only-123!" })).cookie;
  const order = await sale();
  check((await request(`orders/${order.id}/pay`, { paymentMethod: "cash", amount: "10.00" })).status === 409, "payment needs an open shift");
  check((await request("shifts", { action: "open_shift", openingCash: "-1" })).status === 400, "negative float rejected");
  const shiftA = (await ok("shifts", { action: "open_shift", openingCash: "100.00" })).shift;
  await ok(`orders/${order.id}/pay`, { paymentMethod: "split", amount: "10.00", cashAmount: "6.00", momoAmount: "4.00" });
  const path = `orders/${order.id}/refund`;
  check((await request(path, { amount: "1", cashAmount: "1", momoAmount: "0", managerPin: "1111", reason: "No stable key" })).status === 400, "refund requires stable retry key");
  check((await request(path, refund("2", "1", "0"))).status === 400, "tender allocation must equal refund");
  check((await request(path, refund("7", "7", "0"))).status === 409, "cannot refund MoMo collections as cash");
  const payload = refund("5", "3", "2");
  const responses = await Promise.all([request(path, payload), request(path, payload)]);
  check(responses.every(r => r.status === 200) && responses.filter(r => r.data.duplicate).length === 1, "concurrent refund retry replays one result");
  check((await admin.query("SELECT count(*)::int AS n FROM drawer_movements WHERE refund_id=$1", [responses[0].data.refund.id])).rows[0].n === 1, "one uniquely linked cash drawer movement");
  check((await ok("shifts")).activeShift.cashPayouts === "3.00", "cash drawer only debited cash portion");
  check((await request(path, { ...payload, reason: "Different payload" })).status === 409, "same key cannot change refund details");
  check((await request("shifts", { action: "cash_payout", shiftId: shiftA.id, amount: "3", reason: "duplicate refund", refundId: responses[0].data.refund.id })).status === 400, "manual payout cannot claim an already linked refund");
  check((await request("shifts", { action: "cash_payout", shiftId: shiftA.id, amount: "-1", reason: "bad" })).status === 400, "negative payout rejected");
  const limits = await ok(path);
  check(limits.cashRemaining === "3.00" && limits.momoRemaining === "2.00" && limits.refundableAmount === "5.00", "UI gets remaining tender caps after partial refund");
  const closedA = await ok("shifts", { action: "close_shift", shiftId: shiftA.id, actualClosingCash: "103.00" });
  check(closedA.difference === "0.00", "split payment/refund reconciles first shift");
  check((await request(path, refund("1", "1", "0"))).status === 409, "cash refund without open drawer rejected");
  const momoRefund = await ok(path, refund("2", "0", "2"));
  check(momoRefund.refund.shiftId === null, "MoMo-only refund works without a cash drawer");
  check((await admin.query("SELECT cash_payouts FROM shifts WHERE id=$1", [shiftA.id])).rows[0].cash_payouts === "3.00", "MoMo refund does not mutate closed shift");
  const shiftB = (await ok("shifts", { action: "open_shift", openingCash: "50.00" })).shift;
  const final = await ok(path, refund("3", "3", "0"));
  check(final.refund.shiftId === shiftB.id, "refund of older sale debits current shift, not original shift");
  check((await ok("shifts")).activeShift.cashPayouts === "3.00", "later drawer reflects old-sale cash refund");
  check((await ok("shifts", { action: "close_shift", shiftId: shiftB.id, actualClosingCash: "47.00" })).difference === "0.00", "later refund-only shift closes correctly");
  check((await request("shifts", { action: "cash_payout", shiftId: shiftB.id, amount: "1", reason: "Closed" })).status === 409, "closed shift rejects payout");
  check((await request("shifts", { action: "close_shift", shiftId: shiftB.id, actualClosingCash: "0" })).status === 409, "closed reconciliation cannot be rewritten");
  // Refund/close races must serialize against the same open drawer row.
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'refund:%'");
  const shiftC = (await ok("shifts", { action: "open_shift", openingCash: "100" })).shift;
  const raceOrder = await sale();
  await ok(`orders/${raceOrder.id}/pay`, { paymentMethod: "cash", amount: "10" });
  const race = await Promise.all([
    request(`orders/${raceOrder.id}/refund`, refund("10", "10", "0")),
    request("shifts", { action: "close_shift", shiftId: shiftC.id, actualClosingCash: "100" }),
  ]);
  const finalShift = (await admin.query("SELECT * FROM shifts WHERE id=$1", [shiftC.id])).rows[0];
  check(race[1].status === 200 && [200,409].includes(race[0].status), "close/refund race either includes refund or rejects it");
  check(Number(finalShift.expected_closing_cash) === Number(finalShift.opening_cash) + Number(finalShift.total_cash_sales) - Number(finalShift.cash_payouts), "closed drawer expectation cannot become stale after racing refund");
  // Rebase fixture dates for a controlled, event-date report test (disposable DB only).
  await admin.query("UPDATE payments SET created_at='2000-01-01'; UPDATE refunds SET created_at='2000-01-01'; UPDATE orders SET created_at='2000-01-01'");
  await admin.query("UPDATE refunds SET created_at=now() WHERE order_id=$1", [order.id]);
  // Historical unknown tender: keep unallocated instead of inventing cash/MoMo.
  const legacyOrder = await sale();
  await admin.query("UPDATE orders SET paid_amount=10, payment_status='paid', created_at='2000-01-01' WHERE id=$1", [legacyOrder.id]);
  await admin.query("INSERT INTO payments(branch_id,order_id,amount,payment_method,processed_by,created_at) VALUES(1,$1,10,'cash',1,'2000-01-01')", [legacyOrder.id]);
  await admin.query("INSERT INTO refunds(branch_id,order_id,amount,reason,authorized_by,created_at) VALUES(1,$1,2,'Legacy unknown tender',1,date_trunc('day',now() AT TIME ZONE 'UTC'))", [legacyOrder.id]);
  check((await request(`orders/${legacyOrder.id}/refund`, refund("1", "1", "0"))).status === 409, "unallocated historical refunds require reconciliation");
  await admin.query("INSERT INTO payments(branch_id,order_id,amount,payment_method,status,processed_by,created_at) VALUES(1,$1,99,'cash','failed',1,now()),(1,$1,88,'cash','completed',1,now()+interval '1 day')", [legacyOrder.id]);
  const report = await ok("reports?timeframe=today");
  check(report.summary.grossCollections === "0.00" && report.summary.totalRefunds === "12.00" && report.summary.netCollections === "-12.00", "today includes old-sale refunds, excludes old/future/failed collections");
  check(report.summary.cashRefunds === "6.00" && report.summary.momoRefunds === "4.00" && report.summary.unallocatedRefunds === "2.00", "refund allocation report separates legacy unknown tender");
  const csv = await ok("integrations", { action: "export_accounting", format: "xero", timeframe: "today" });
  const records = csv.csvContent.split("\r\n").slice(1).map((line: string) => line.split(","));
  check(records.length === 4 && records.reduce((sum: number, row: string[]) => sum + Number(row[7]), 0) === -12, "CSV event totals match dashboard selected timeframe");
  check((await request("reports?timeframe=invalid")).status === 400, "invalid report timeframe rejected");
  // A selected date range covers whole Ghana days; picking today for both
  // ends must agree with the Today preset exactly.
  const todayStr = new Date().toISOString().slice(0, 10);
  const customToday = await ok(`reports?timeframe=custom&start=${todayStr}&end=${todayStr}`);
  check(customToday.summary.totalRefunds === "12.00" && customToday.summary.netCollections === "-12.00", "custom range for today matches the Today preset");
  check(customToday.window.start?.startsWith(todayStr) && customToday.window.endExclusive?.startsWith(new Date(Date.parse(todayStr) + 86400000).toISOString().slice(0, 10)), "custom range window is the selected day through midnight");
  const yesterdayStr = new Date(Date.parse(todayStr) - 86400000).toISOString().slice(0, 10);
  check((await ok(`reports?timeframe=custom&start=${yesterdayStr}&end=${yesterdayStr}`)).summary.totalRefunds === "0.00", "custom range for yesterday excludes today's refunds");
  const customCsv = await ok("integrations", { action: "export_accounting", format: "xero", timeframe: "custom", start: todayStr, end: todayStr });
  check(customCsv.csvContent.split("\r\n").slice(1).length === 4, "CSV export follows the selected custom range");
  check((await request("reports?timeframe=custom&start=2026-02-31&end=2026-03-01")).status === 400, "impossible custom date rejected");
  check((await request(`reports?timeframe=custom&start=${todayStr}`)).status === 400, "custom range needs both dates");
  check((await request("reports?timeframe=custom&start=2026-03-02&end=2026-03-01")).status === 400, "custom range with start after end rejected");
  check((await request("integrations", { action: "export_accounting", format: "xero", timeframe: "custom", start: "not-a-date", end: todayStr })).status === 400, "CSV export validates the custom range too");
  const otherCookie = (await request("auth/login", { email: "user8@test.invalid", password: "Test-password-only-123!" })).cookie;
  check((await request(path, undefined, otherCookie)).status === 404, "other branch cannot inspect refundable balances");
  check((await request("reports?timeframe=today", undefined, otherCookie)).data.summary.totalRefunds === "0.00", "collection reports remain branch-isolated");
  console.log(`\n${checks} accounting checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => admin.end());
