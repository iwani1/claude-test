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
/** Owner-edit endpoint is a PATCH; api() only posts. */
async function patch(path: string, body: unknown) {
  const result = await raw(path, "PATCH", body);
  assert.equal(result.status, 200, `${path}: ${JSON.stringify(result.data)}`);
  return result.data;
}
/** Raw request for the cases whose whole point is a non-200 answer. */
async function raw(path: string, method: string, body?: unknown, asCookie = cookie) {
  const response = await fetch(`http://127.0.0.1:3100/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: asCookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
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

  // --- Owner-only order erasure ------------------------------------------
  // The owner asked for orders to vanish completely. What the system still
  // guarantees: only owner role may do it, other branches cannot see it,
  // the order's children die with it, its stock comes back, and the shift
  // totals roll back so the drawer never shows money for a sale that no
  // longer exists.
  const stockBeforeDelete = Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock);
  const { order: doomed } = await api("orders", { idempotencyKey: "pilot-delete-001", orderType: "takeaway", items: [{ menuItemId: 1, quantity: 1 }] });
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock), stockBeforeDelete - 2, "deletion target consumed recipe stock");
  check((await raw(`orders/${doomed.id}`, "DELETE")).status, 200, "owner deletes the order");
  check((await raw(`orders/${doomed.id}`, "GET")).status, 404, "deleted order is gone from the API");
  check(Number((await admin.query("SELECT count(*)::int AS c FROM order_items WHERE order_id=$1", [doomed.id])).rows[0].c), 0, "order lines erased with the order");
  check(Number((await admin.query("SELECT count(*)::int AS c FROM kitchen_tickets WHERE order_id=$1", [doomed.id])).rows[0].c), 0, "kitchen tickets erased with the order");
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock), stockBeforeDelete, "stock returns to inventory after deletion");
  check((await raw(`orders/${doomed.id}`, "DELETE")).status, 404, "deleting an already-deleted order is a clean 404");
  check(Number((await admin.query("SELECT count(*)::int AS c FROM audit_logs WHERE entity_type='order' AND entity_id=$1", [String(doomed.id)])).rows[0].c), 0, "no audit trace of the erased order");

  // --- Paid order deletion rolls the shift maths back ---------------------
  const { shift: rollbackShift } = await api("shifts", { action: "open_shift", openingCash: "50.00", notes: "Delete-rollback probe" });
  const { order: paidDoomed } = await api("orders", { idempotencyKey: "pilot-delete-002", orderType: "takeaway", items: [{ menuItemId: 1, quantity: 1 }] });
  await api(`orders/${paidDoomed.id}/pay`, { paymentMethod: "cash", amount: "10.00", cashTendered: "10.00" });
  check((await api("shifts")).activeShift.totalSales, "10.00", "rollback probe recorded the sale on the shift");
  check((await raw(`orders/${paidDoomed.id}`, "DELETE")).status, 200, "owner deletes a paid order");
  const rolledBack = (await api("shifts")).activeShift;
  check(rolledBack.totalSales, "0.00", "shift sales total rolled back after deletion");
  check(rolledBack.totalCashSales, "0.00", "shift cash total rolled back after deletion");
  check(Number((await admin.query("SELECT count(*)::int AS c FROM payments WHERE order_id=$1", [paidDoomed.id])).rows[0].c), 0, "payments erased with the order");
  const rollbackClose = await api("shifts", { action: "close_shift", shiftId: rollbackShift.id, actualClosingCash: "50.00" });
  check(rollbackClose.difference, "0.00", "drawer still reconciles after the deleted sale");

  // --- Owner-only order editing ------------------------------------------
  const stock = async () => Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock);
  const recipeQty = Number((await admin.query("SELECT quantity FROM recipe_ingredients WHERE recipe_id=1")).rows[0].quantity);
  const editStockStart = Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock);
  const { order: editable } = await api("orders", { idempotencyKey: "pilot-edit-001", orderType: "takeaway", items: [{ menuItemId: 1, quantity: 1 }] });
  const edited = await patch(`orders/${editable.id}/edit`, { items: [{ menuItemId: 1, quantity: 2 }], discountAmount: 0, discountPercent: 0, tipAmount: 0 });
  check(edited.order.totalAmount, "20.00", "owner re-prices an unpaid order to the new quantity");
  check(await stock(), editStockStart - 2 * recipeQty, "edit re-syncs recipe stock to the edited lines");
  const docket = (await admin.query("SELECT items FROM kitchen_tickets WHERE order_id=$1 ORDER BY id DESC LIMIT 1", [editable.id])).rows[0];
  check(Number(docket.items[0].qty), 2, "open kitchen docket shows the corrected quantity");

  const { shift: editShift } = await api("shifts", { action: "open_shift", openingCash: "30.00", notes: "Edit-balance probe" });
  await api(`orders/${editable.id}/pay`, { paymentMethod: "cash", amount: "20.00", cashTendered: "20.00" });
  const up = await patch(`orders/${editable.id}/edit`, { items: [{ menuItemId: 1, quantity: 3 }], discountAmount: 0, discountPercent: 0, tipAmount: 0 });
  check(up.balanceDue, "10.00", "editing a paid order up reports the balance to collect");
  check(up.order.paymentStatus, "partially_paid", "an order with a balance is marked partially paid");
  check(up.order.status, "confirmed", "a completed order reopens when it owes money");
  await api(`orders/${editable.id}/pay`, { paymentMethod: "cash", amount: "10.00", cashTendered: "10.00" });
  const tooLow = await raw(`orders/${editable.id}/edit`, "PATCH", { items: [{ menuItemId: 1, quantity: 1 }], discountAmount: 0, discountPercent: 0, tipAmount: 0 });
  check(tooLow.status, 409, "an edit below the money already collected is refused, not silently accepted");
  check(String(tooLow.data.error).includes("GH₵30.00 has already been collected"), true, "the refusal names the GH₵30.00 already collected");
  check(String(tooLow.data.error).includes("refund this order"), true, "the refusal says what the cashier can do instead");
  const afterRefusal = await api(`orders/${editable.id}`);
  check(afterRefusal.order.totalAmount, "30.00", "a refused edit changes nothing on the bill");
  check(await stock(), editStockStart - 3 * recipeQty, "a refused edit touches no stock");
  check((await raw(`orders/${editable.id}`, "DELETE")).status, 200, "edit probe order cleaned up");
  check(await stock(), editStockStart, "cleanup returns every bottle the probe used");
  const editClose = await api("shifts", { action: "close_shift", shiftId: editShift.id, actualClosingCash: "30.00" });
  check(editClose.difference, "0.00", "the edit probe leaves the drawer reconciled");

  // --- Stock comes back by net, not by gross ----------------------------------
  // An order that was edited before it was cancelled must return what it still
  // holds. Summing the original deduction plus the edited one would hand back
  // stock the shelf never had.
  const { order: cancelProbe } = await api("orders", { idempotencyKey: "pilot-edit-cancel-001", orderType: "takeaway", items: [{ menuItemId: 1, quantity: 1 }] });
  check(await stock(), editStockStart - recipeQty, "cancel probe holds one portion");
  await patch(`orders/${cancelProbe.id}/edit`, { items: [{ menuItemId: 1, quantity: 3 }], discountAmount: 0, discountPercent: 0, tipAmount: 0 });
  check(await stock(), editStockStart - 3 * recipeQty, "the edited cancel probe holds three portions");
  await patch(`orders/${cancelProbe.id}`, { status: "cancelled", returnStockOnCancel: true });
  check(await stock(), editStockStart, "cancelling an edited order returns exactly what it held");
  check((await raw(`orders/${cancelProbe.id}`, "DELETE")).status, 200, "cancel probe order erased");
  check(await stock(), editStockStart, "erasing a fully returned order moves no stock again");

  // --- A retried tender must not take the money twice -------------------------
  // The dangerous path is not a gateway timeout: it is a cashier tapping Pay,
  // the answer being lost, and the tender being entered again. A partial
  // payment is the case a balance check alone cannot catch.
  const { shift: retryShift } = await api("shifts", { action: "open_shift", openingCash: "20.00", notes: "Tender-retry probe" });
  const { order: retryOrder } = await api("orders", {
    idempotencyKey: "pilot-pay-retry-001",
    orderType: "takeaway",
    items: [{ menuItemId: 1, quantity: 4 }],
  });
  check(retryOrder.totalAmount, "40.00", "retry probe bills four portions");
  const partial = { amount: "10.00", paymentMethod: "cash", cashTendered: "10.00", idempotencyKey: "pilot-pay-same-key-001" };
  const firstTender = await api(`orders/${retryOrder.id}/pay`, partial);
  check(firstTender.order.paidAmount, "10.00", "the first tender lands on the bill once");
  const replayed = await api(`orders/${retryOrder.id}/pay`, partial);
  check(replayed.success, true, "the retried tender answers success instead of failing");
  check(replayed.replayed, true, "and is reported as a replay");
  check(replayed.order.paidAmount, "10.00", "the retry does not take the money a second time");
  const changedAmount = await raw(`orders/${retryOrder.id}/pay`, "POST", { ...partial, amount: "5.00" });
  check(changedAmount.status, 409, "the same key with a different amount is refused, not replayed");
  const retryPayments = await admin.query("select amount from payments where order_id=$1 order by id", [retryOrder.id]);
  check(retryPayments.rows.map((r: any) => r.amount), ["10.00"], "exactly one payment row exists for the retry probe");
  check((await raw(`orders/${retryOrder.id}`, "DELETE")).status, 200, "retry probe order erased");
  const retryClose = await api("shifts", { action: "close_shift", shiftId: retryShift.id, actualClosingCash: "20.00" });
  check(retryClose.difference, "0.00", "the drawer reconciles after the erased probe");

  // --- Receiving one delivery twice ------------------------------------------
  // Receiving writes straight into live stock, so a second receive of the same
  // purchase order would inflate the shelf.
  let supplierId = Number((await admin.query("select id from suppliers order by id limit 1")).rows[0]?.id ?? 0);
  if (!supplierId) {
    const createdSupplier = await api("purchasing/suppliers", { name: "Pilot Supplier", contactPerson: "Pilot", phone: "000000000" });
    supplierId = Number(createdSupplier.supplier?.id ?? createdSupplier.id);
  }
  const { purchaseOrder: po } = await api("purchasing/orders", {
    supplierId,
    items: [{ ingredientId: 1, orderedQuantity: 5, unitPrice: "2.00" }],
  });
  // A PO number once came from the millisecond clock and repeated about every
  // 16 minutes, so a busy business would start getting 409s on PO creation.
  check(/^PO-\d{8}-[0-9A-F]{8}$/.test(po.poNumber), true, "purchase orders get a dated, random PO number");
  const poItemId = Number((await admin.query("select id from purchase_order_items where purchase_order_id=$1 order by id limit 1", [po.id])).rows[0].id);
  const receiveBody = {
    purchaseOrderId: po.id,
    action: "receive_goods",
    receivedItems: [{ poItemId, ingredientId: 1, receivedQuantity: 5, unitPrice: "2.00" }],
  };
  check(await stock(), editStockStart, "the purchase probe starts from known stock");
  check((await patch("purchasing/orders", receiveBody)).success, true, "goods are received once");
  check(await stock(), editStockStart + 5, "and land in stock once");
  check(/^GRN-\d{8}-[0-9A-F]{8}$/.test(String((await admin.query("select grn_number from goods_receipts where purchase_order_id=$1", [po.id])).rows[0]?.grn_number)), true, "the goods receipt gets a dated, random GRN number");
  const receiveAgain = await raw("purchasing/orders", "PATCH", receiveBody);
  check(receiveAgain.status, 409, "receiving the same purchase order again is refused");
  check(await stock(), editStockStart + 5, "and the shelf does not double-count the delivery");
  const duplicateLine = await raw("purchasing/orders", "PATCH", {
    purchaseOrderId: po.id,
    action: "receive_goods",
    receivedItems: [
      { poItemId, ingredientId: 1, receivedQuantity: 1 },
      { poItemId, ingredientId: 1, receivedQuantity: 1 },
    ],
  });
  check(duplicateLine.status === 409 || duplicateLine.status === 400, true, "a second receive attempt is refused either way");

  // --- A stock adjustment floors at zero without lying in the ledger ----------
  const overshoot = await api("inventory", {
    action: "adjust_stock",
    ingredientId: 1,
    delta: -(editStockStart + 5 + 1000),
    movementType: "waste_spoilage",
    reason: "Pilot overshoot",
  });
  check(overshoot.success, true, "an oversized waste adjustment is accepted");
  check(await stock(), 0, "stock floors at zero rather than going negative");
  const overshootLedger = await admin.query(
    "select quantity_delta, new_stock from stock_movements where ingredient_id=1 order by id desc limit 1"
  );
  check(Number(overshootLedger.rows[0].new_stock), 0, "the ledger records the stock the shelf now has");
  check(Number(overshootLedger.rows[0].quantity_delta), -(editStockStart + 5), "and only the quantity that actually moved");
  const zeroDelta = await raw("inventory", "POST", { action: "adjust_stock", ingredientId: 1, delta: 0 });
  check(zeroDelta.status, 400, "a zero adjustment is refused instead of writing a no-op ledger line");
  await admin.query("update ingredients set current_stock=$1 where id=1", [editStockStart.toFixed(3)]);
  check(await stock(), editStockStart, "stock restored for anything that follows");

  // --- Erasing an order must also erase what it took out of the drawer -------
  // A cash refund is an outflow: it is carried on the shifts.cash_payouts total,
  // which is what the close formula subtracts. Erase the order but leave that
  // total behind and the drawer reconciles short by exactly the refunded
  // amount — and can never be closed flat again.
  const { shift: erasedRefundShift } = await api("shifts", { action: "open_shift", openingCash: "0.00", notes: "Erased-refund probe" });
  const { order: erasedRefundOrder } = await api("orders", {
    idempotencyKey: "pilot-erase-refund-001",
    orderType: "takeaway",
    items: [{ menuItemId: 1, quantity: 1 }],
  });
  await api(`orders/${erasedRefundOrder.id}/pay`, { paymentMethod: "cash", amount: "5.00", cashTendered: "5.00" });
  await api(`orders/${erasedRefundOrder.id}/refund`, {
    amount: "2.00", cashAmount: "2.00", momoAmount: "0.00", managerPin: "1111",
    reason: "Erased-refund probe", idempotencyKey: "pilot-erase-refund-r-001",
  });
  const withRefund = (await api("shifts")).activeShift;
  check(withRefund.cashPayouts, "2.00", "a cash refund shows in the drawer outflows");
  check(withRefund.cashRefunds, "2.00", "and in the refund movement total");
  check((await raw(`orders/${erasedRefundOrder.id}`, "DELETE")).status, 200, "the refunded order is erased");
  const afterErase = (await api("shifts")).activeShift;
  check(afterErase.cashPayouts, "0.00", "erasing it takes the refund back out of the drawer outflows");
  check(afterErase.cashRefunds, "0.00", "and leaves no refund movement behind");
  check(afterErase.totalSales, "0.00", "and no sale behind either");
  const erasedClose = await api("shifts", { action: "close_shift", shiftId: erasedRefundShift.id, actualClosingCash: "0.00" });
  check(erasedClose.difference, "0.00", "the drawer still closes flat after an erased sale and refund");
  check(await stock(), editStockStart, "and the erased order returned its stock");

  console.log(`\n${checks} synthetic shift/pilot checks passed. No physical payment, printer, or backup test was performed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => admin.end());
