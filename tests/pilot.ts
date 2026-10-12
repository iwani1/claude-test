/** Synthetic one-register shift. This does not certify payment networks/printers. */
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";
const admin = new Pool({ connectionString: process.env.TEST_ADMIN_URL });
let cookie = "";
let checks = 0;
function check(actual: unknown, expected: unknown, label: string) {
  assert.deepEqual(actual, expected, label); checks++; console.log(`PASS pilot: ${label}`);
}
async function api(path: string, body?: unknown) {
  if (path.endsWith("/refund") && body && typeof body === "object") {
    const value = body as Record<string, unknown>;
    body = { cashAmount: value.amount, momoAmount: "0.00", idempotencyKey: randomUUID(), ...value };
  }
  const response = await fetch(`http://127.0.0.1:3100/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(data)}`);
  if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie")!.split(";")[0];
  return data;
}
async function main() {
  await api("auth/login", { email: "user1@test.invalid", password: "Test-password-only-123!" });
  const startingStock = Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock);
  const { shift } = await api("shifts", { action: "open_shift", openingCash: "200.00", notes: "Synthetic pilot" });
  const { order: dineIn } = await api("orders", { idempotencyKey: "pilot-dine-in-001", orderType: "dine_in", tableId: 1, items: [{ menuItemId: 1, quantity: 2 }] });
  check(dineIn.totalAmount, "20.00", "dine-in server total");
  const tickets = await api("kds");
  check(tickets.tickets.some((ticket: any) => ticket.orderId === dineIn.id), true, "kitchen ticket created (physical print remains manual)");
  await api(`orders/${dineIn.id}/pay`, { paymentMethod: "split", amount: "20.00", cashAmount: "8.00", momoAmount: "12.00", cashTendered: "10.00" });
  check((await admin.query("SELECT status FROM dining_tables WHERE id=1")).rows[0].status, "available", "settlement releases dining table");
  const { order: takeaway } = await api("orders", { idempotencyKey: "pilot-takeaway-001", orderType: "takeaway", items: [{ menuItemId: 1, quantity: 1 }] });
  const paid = await api(`orders/${takeaway.id}/pay`, { paymentMethod: "cash", amount: "10.00", cashTendered: "20.00" });
  check(paid.changeGiven, "10.00", "cash change calculated");
  await api(`orders/${takeaway.id}/refund`, { amount: "2.00", managerPin: "1111", reason: "Pilot partial refund" });
  await api(`orders/${takeaway.id}/refund`, { amount: "8.00", managerPin: "1111", reason: "Pilot final refund", returnStock: true });
  check(Number((await admin.query("SELECT sum(amount) AS total FROM refunds WHERE order_id=$1", [takeaway.id])).rows[0].total), 10, "partial + final refunds total collected amount");
  check((await admin.query("SELECT count(*)::int AS count FROM drawer_movements WHERE shift_id=$1 AND kind='refund'", [shift.id])).rows[0].count, 2, "both cash refunds automatically create linked drawer outflows");
  await api("shifts", { action: "cash_payout", shiftId: shift.id, amount: "3.00", reason: "Pilot petty cash" });
  const state = (await api("shifts")).activeShift;
  check(state.totalSales, "30.00", "gross tender recorded");
  check(state.totalCashSales, "18.00", "cash receipts exclude change");
  check(state.totalCardSales, "12.00", "MoMo receipts tracked separately");
  const closed = await api("shifts", { action: "close_shift", shiftId: shift.id, actualClosingCash: "205.00" });
  check(closed.difference, "0.00", "drawer reconciles: 200 + 18 - 10 - 3 = 205");
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock), startingStock - 4, "only unrefunded dine-in stock remains consumed");
  const page = await api("orders?limit=50");
  check(page.orders.length > 0 && typeof page.total === "number" && page.total >= page.orders.length, true, "orders history lists pages with a total count");
  check((await api("orders?from=2000-01-01&to=2000-01-02")).orders.length, 0, "orders history honours date range filters");
  check((await api("orders?limit=1&offset=1")).orders.length, 1, "orders history pagination offset works");
  const offline = { idempotencyKey: "pilot-offline-001", orderType: "takeaway", items: [{ menuItemId: 1, quantity: 1 }], paidAmount: 0, paymentStatus: "unpaid" };
  check((await api("sync/offline", { offlineOrders: [offline] })).syncedCount, 1, "offline order replay accepted");
  check((await api("sync/offline", { offlineOrders: [offline] })).duplicateCount, 1, "offline replay retry is deduplicated");
  console.log(`\n${checks} synthetic shift/pilot checks passed. No physical payment, printer, or backup test was performed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => admin.end());
