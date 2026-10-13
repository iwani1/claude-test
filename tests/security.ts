import assert from "node:assert/strict";
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { createToken, verifyToken } from "../src/lib/auth";
const base = "http://127.0.0.1:3100";
const admin = new Pool({ connectionString: process.env.TEST_ADMIN_URL });
let checks = 0;
function check(condition: unknown, message: string) { assert.ok(condition, message); checks++; console.log(`PASS ${message}`); }
async function request(path: string, method = "GET", body?: unknown, cookie = "", headers: Record<string,string> = {}) {
  if (path.endsWith("/refund") && method === "POST" && body && typeof body === "object") {
    const value = body as Record<string, unknown>;
    body = { cashAmount: value.amount, momoAmount: "0.00", idempotencyKey: randomUUID(), ...value };
  }
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  return { status: response.status, body: result, cookie: response.headers.get("set-cookie")?.split(";")[0] || "", headers: response.headers };
}
async function login(id: number) {
  const response = await request("/api/auth/login", "POST", { email: `user${id}@test.invalid`, password: "Test-password-only-123!" });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  check(response.headers.get("set-cookie")?.includes("Secure") && response.headers.get("set-cookie")?.includes("HttpOnly"), `login ${id} uses production Secure/HttpOnly cookies`);
  check(!response.body.token, `login ${id} does not expose session token in JSON`);
  return response.cookie;
}
async function routes(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) files.push(...await routes(path)); else if (item.name === "route.ts") files.push(path);
  }
  return files;
}
const order = (key: string, extra = {}) => ({ idempotencyKey: key, orderType: "takeaway", items: [{ menuItemId: 1, quantity: 1 }], ...extra });
async function main() {
  await (await import("./offline-storage")).testOfflineStorage();
  for (const path of await routes("src/app/api")) {
    if (path.includes("/auth/login/") || path.includes("/health/")) continue;
    const source = await readFile(path, "utf8");
    const url = path.replace("src/app", "").replace("/route.ts", "").replace("[id]", "1");
    for (const match of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) =/g)) {
      const res = await request(url, match[1], match[1] === "GET" ? undefined : {});
      check(res.status === 401, `anonymous ${match[1]} ${url} denied (${res.status})`);
    }
  }
  const anon = await request("/api/menu");
  check(anon.status === 401 && anon.headers.get("cache-control") === "no-store", "refusals are uncacheable, so a repaired system cannot look broken");
  const owner = await login(1), manager = await login(2), cashier = await login(3), accountant = await login(4), other = await login(7), otherOwner = await login(8), otherTenant = await login(9);
  check((await request("/api/shifts", "POST", { action: "open_shift", openingCash: "100.00" }, owner)).status === 200, "security fixture opens register");
  check((await request("/api/auth/login", "POST", { email: "user6@test.invalid", password: "Test-password-only-123!" })).status === 401, "kitchen account cannot log in");
  check((await request("/api/reports", "GET", undefined, cashier)).status === 403, "cashier cannot read reports");
  check((await request("/api/orders", "POST", order("accountant-denied"), accountant)).status === 403, "accountant cannot create sales");
  check((await request("/api/menu", "POST", { name: "Bad", categoryId: 1, price: 1 }, cashier)).status === 403, "cashier cannot modify menu");
  const staff = await request("/api/staff", "GET", undefined, manager);
  check(staff.status === 200 && staff.body.staff.every((u: any) => u.branchId === 1 && !('pin' in u) && !('passwordHash' in u) && !('pinLookup' in u)), "staff list scoped and credentials redacted");
  check((await request("/api/staff", "POST", { action: "create_employee", name: "Escalation", email: "escalate@test.invalid", role: "super_admin", password: "Long-enough-password" }, manager)).status === 403, "manager cannot create owner");
  check((await request("/api/staff", "POST", { action: "update_pin", userId: 1, pin: "9876" }, manager)).status === 403, "manager cannot change owner PIN");
  check((await request("/api/staff", "POST", { action: "create_employee", name: "No password", email: "nopass@test.invalid", role: "cashier" }, owner)).status === 400, "no default staff password");
  const pwStaff = await request("/api/staff", "POST", { action: "create_employee", name: "Password Test", email: "pwtest@test.invalid", role: "cashier", password: "Initial-password-123!" }, owner);
  check(pwStaff.status === 200, "owner creates employee for password reset");
  const pwLogin = await request("/api/auth/login", "POST", { email: "pwtest@test.invalid", password: "Initial-password-123!" });
  check(pwLogin.status === 200, "password test employee can log in");
  check((await request("/api/staff", "POST", { action: "reset_password", userId: pwStaff.body.employee.id, password: "short" }, owner)).status === 400, "password reset rejects short password");
  check((await request("/api/staff", "POST", { action: "reset_password", userId: 1, password: "Manager-cannot-reset-123!" }, manager)).status === 403, "manager cannot reset owner password");
  check((await request("/api/staff", "POST", { action: "reset_password", userId: pwStaff.body.employee.id, password: "Rotated-password-123!" }, owner)).status === 200, "owner resets staff password");
  check((await request("/api/auth/me", "GET", undefined, pwLogin.cookie)).status === 401, "password reset revokes existing sessions");
  check((await request("/api/auth/login", "POST", { email: "pwtest@test.invalid", password: "Rotated-password-123!" })).status === 200, "login works with rotated password");
  check((await request("/api/auth/login", "POST", { email: "pwtest@test.invalid", password: "Initial-password-123!" })).status >= 400, "old password rejected after reset");
  const pinStaff = await request("/api/staff", "POST", { action: "create_employee", name: "PIN Test", email: "pintest@test.invalid", role: "cashier", password: "Pin-test-password-123!", pin: "4455" }, owner);
  check(pinStaff.status === 200, "owner creates employee with quick POS PIN");
  const pinLogin = await request("/api/auth/login", "POST", { email: "pintest@test.invalid", password: "Pin-test-password-123!" });
  const switch1 = await request("/api/auth/switch-pin", "POST", { pin: "4455" }, pinLogin.cookie);
  check(switch1.status === 200 && switch1.body.user.id === pinStaff.body.employee.id, "quick PIN switch activates the PIN owner");
  check((await request("/api/staff", "POST", { action: "update_pin", userId: pinStaff.body.employee.id, pin: "6677" }, owner)).status === 200, "owner updates staff PIN");
  check((await request("/api/auth/me", "GET", undefined, pinLogin.cookie)).status === 401, "PIN change revokes existing sessions of that account");
  const pinLogin2 = await request("/api/auth/login", "POST", { email: "pintest@test.invalid", password: "Pin-test-password-123!" });
  check(pinLogin2.status === 200, "employee signs in again after PIN change");
  check((await request("/api/auth/switch-pin", "POST", { pin: "4455" }, pinLogin2.cookie)).status === 401, "old PIN rejected after update");
  const switch2 = await request("/api/auth/switch-pin", "POST", { pin: "6677" }, pinLogin2.cookie);
  check(switch2.status === 200 && switch2.body.user.id === pinStaff.body.employee.id, "updated PIN works for quick switch");
  const dup = await request("/api/staff", "POST", { action: "update_pin", userId: pwStaff.body.employee.id, pin: "6677" }, owner);
  check(dup.status === 409 && /already used/i.test(dup.body.error), "duplicate branch PIN rejected with clear message");
  const dupCreate = await request("/api/staff", "POST", { action: "create_employee", name: "Dup PIN", email: "duppin@test.invalid", role: "cashier", password: "Dup-pin-password-123!", pin: "6677" }, owner);
  check(dupCreate.status === 409 && /already used/i.test(dupCreate.body.error), "employee creation rejects duplicate PIN with clear message");
  const dupEmail = await request("/api/staff", "POST", { action: "create_employee", name: "Dup Email", email: "pintest@test.invalid", role: "cashier", password: "Dup-email-password-123!" }, owner);
  check(dupEmail.status === 409 && /already registered/i.test(dupEmail.body.error), "duplicate email rejected with clear message");
  const pinPad = await request("/api/auth/login", "POST", { pin: "6677" });
  check(pinPad.status === 400 && /email and password/i.test(pinPad.body.error), "login-screen PIN pad explains email/password is required when PIN login is disabled");
  const menu = await request("/api/menu", "GET", undefined, other);
  check(menu.body.items.length === 1 && menu.body.items[0].id === 2, "menu isolated between branches of same restaurant");
  const tenantMenu = await request("/api/menu", "GET", undefined, otherTenant);
  check(tenantMenu.body.items.length === 1 && tenantMenu.body.items[0].id === 3, "menu isolated across restaurants");
  const malicious = await request("/api/menu", "POST", { name: "Cross-reference", categoryId: 1, price: "5" }, otherOwner);
  check(malicious.status >= 400, "cross-branch category reference rejected");
  check((await request("/api/orders", "POST", order("cross-branch-create", { branchId: 2 }), cashier)).status === 403, "client cannot choose another branch");
  check((await request("/api/orders", "POST", order("cross-menu-create", { items: [{ menuItemId: 2, quantity: 1 }] }), cashier)).status === 400, "cannot sell another branch's item");
  const repeated = await Promise.all([1,2].map(() => request("/api/orders", "POST", order("concurrent-order-1", { totalAmount: "0.01" }), cashier)));
  check(repeated.every(r => r.status === 200) && repeated[0].body.order.id === repeated[1].body.order.id, "concurrent idempotent order creation returns one order");
  const id = repeated[0].body.order.id;
  check(Number(repeated[0].body.order.totalAmount) === 10, "server ignores tampered prices");
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock) === 98, "concurrent order deducted stock once");
  check((await request("/api/orders", "POST", order("concurrent-order-1", { items: [{ menuItemId: 1, quantity: 2 }] }), cashier)).status === 409, "idempotency key cannot identify a different payload");

  // Owner-only permanent delete. Nobody below owner may reach the handler,
  // another branch cannot even see the order, and a denied attempt must
  // leave the order exactly where it was.
  const stockBeforeTarget = Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock);
  const deleteTarget = await request("/api/orders", "POST", order("delete-permission-target"), owner);
  const deleteTargetId = deleteTarget.body.order.id;
  check((await request(`/api/orders/${deleteTargetId}`, "DELETE", {}, cashier)).status === 403, "cashier cannot delete orders");
  check((await request(`/api/orders/${deleteTargetId}`, "DELETE", {}, manager)).status === 403, "manager cannot delete orders (owner only)");
  check((await request(`/api/orders/${deleteTargetId}`, "DELETE", {}, accountant)).status === 403, "accountant cannot delete orders");
  check((await request(`/api/orders/${deleteTargetId}`, "DELETE", {}, otherOwner)).status === 404, "another branch's owner cannot delete this branch's order");
  check((await admin.query("SELECT count(*)::int AS c FROM orders WHERE id=$1", [deleteTargetId])).rows[0].c === 1, "denied deletes leave the order untouched");
  check((await request(`/api/orders/${deleteTargetId}`, "DELETE", {}, owner)).status === 200, "owner deletes the order");
  check((await admin.query("SELECT count(*)::int AS c FROM orders WHERE id=$1", [deleteTargetId])).rows[0].c === 0, "deleted order row is gone");
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock) === stockBeforeTarget, "deleting the order returns its stock");
  check((await request(`/api/orders/${id}`, "GET", undefined, other)).status === 404, "cross-branch direct order lookup denied");
  check((await request(`/api/orders/${id}/pay`, "POST", { paymentMethod: "cash", amount: "10" }, other)).status === 404, "cross-branch payment denied");
  const pay = await Promise.all([1,2].map(() => request(`/api/orders/${id}/pay`, "POST", { paymentMethod: "split", amount: "10", cashAmount: "4", momoAmount: "6" }, cashier)));
  check(pay.filter(r => r.status === 200).length === 1 && pay.filter(r => r.status === 409).length === 1, "concurrent payments cannot overpay");
  check(Number((await admin.query("SELECT sum(amount) AS amount FROM payments WHERE order_id=$1", [id])).rows[0].amount) === 10, "split payment ledger equals sale total");
  for (const amount of ["-1", "0", "NaN", "0.001", "1e2"]) check((await request(`/api/orders/${id}/refund`, "POST", { amount, reason: "Test", managerPin: "2222" }, cashier)).status === 400, `refund rejects ${amount}`);
  check((await request(`/api/orders/${id}/refund`, "POST", { amount: "1", reason: "Test", managerPin: "8888" }, cashier)).status === 403, "other-branch manager cannot authorize refund");
  check((await request(`/api/orders/${id}/refund`, "POST", { amount: "4", reason: "Partial", managerPin: "2222", returnStock: true }, cashier)).status === 400, "partial refund cannot restore all stock");
  const partial = await request(`/api/orders/${id}/refund`, "POST", { amount: "4", reason: "Partial", managerPin: "2222" }, cashier);
  check(partial.status === 200, "partial refund succeeds");
  check((await admin.query("SELECT payment_status FROM orders WHERE id=$1", [id])).rows[0].payment_status === "partially_refunded", "partial refund preserves distinct state");
  // Change recipe after sale: restoration must use original ledger.
  await admin.query("UPDATE recipe_ingredients SET quantity=9 WHERE recipe_id=1");
  const refund = await Promise.all([1,2].map(() => request(`/api/orders/${id}/refund`, "POST", { amount: "6", cashAmount: "0.00", momoAmount: "6.00", reason: "Remaining", managerPin: "2222", returnStock: true }, cashier)));
  check(refund.filter(r => r.status === 200).length === 1 && refund.filter(r => r.status === 409).length === 1, "concurrent final refunds cannot over-refund");
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock) === 100, "stock restored once using original deduction, not changed recipe");

  // Owner-only editing of a saved order: nobody else reaches the handler,
  // another branch cannot see it, and the browser never sets a price.
  const editTarget = await request("/api/orders", "POST", order("edit-permission-target"), owner);
  const editTargetId = editTarget.body.order.id;
  const recipeQty = Number((await admin.query("SELECT quantity FROM recipe_ingredients WHERE recipe_id=1")).rows[0].quantity);
  const stockAfterEditTarget = Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock);
  check((await request(`/api/orders/${editTargetId}/edit`, "PATCH", { tipAmount: "1.00" }, cashier)).status === 403, "cashier cannot edit orders");
  check((await request(`/api/orders/${editTargetId}/edit`, "PATCH", { tipAmount: "1.00" }, manager)).status === 403, "manager cannot edit orders (owner only)");
  check((await request(`/api/orders/${editTargetId}/edit`, "PATCH", { tipAmount: "1.00" }, otherOwner)).status === 404, "another branch's owner cannot edit this branch's order");
  const tampered = await request(`/api/orders/${editTargetId}/edit`, "PATCH", { items: [{ menuItemId: 1, quantity: 3, unitPrice: "0.01" }], discountAmount: 0, discountPercent: 0, tipAmount: 0 }, owner);
  check(tampered.status === 200, "owner edits the saved order");
  check(tampered.body.order.totalAmount === "30.00", "edit prices the bill from the menu, ignoring client prices");
  check(Number((await admin.query("SELECT unit_price FROM order_items WHERE order_id=$1", [editTargetId])).rows[0].unit_price) === 10, "edited line keeps the menu price");
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock) === stockAfterEditTarget - 2 * recipeQty, "edit re-syncs recipe stock to the new quantities");
  check((await request(`/api/orders/${id}/edit`, "PATCH", { items: [{ menuItemId: 1, quantity: 1 }] }, owner)).status === 409, "refunded orders cannot be re-priced");
  check((await request(`/api/orders/${editTargetId}`, "DELETE", {}, owner)).status === 200, "edit probe order cleaned up");
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock) === stockAfterEditTarget + recipeQty, "cleanup returns the stock the probe used");
  await admin.query("UPDATE recipe_ingredients SET quantity=2 WHERE recipe_id=1");
  // A failed second item in a batch must roll back the entire first order.
  const batch = await request("/api/sync/offline", "POST", { offlineOrders: [order("offline-rollback-1"), order("offline-rollback-2", { items: [{ menuItemId: 9999, quantity: 1 }] })] }, cashier);
  check(batch.status === 400 && (await admin.query("SELECT id FROM orders WHERE idempotency_key='offline-rollback-1'")).rowCount === 0, "offline batch error rolls back earlier orders");
  check(Number((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock) === 100, "offline rollback includes inventory");
  check((await request("/api/sync/offline", "POST", { offlineOrders: [order("offline-fake-paid", { paidAmount: "10", paymentStatus: "paid" })] }, cashier)).status === 400, "offline client cannot invent paid orders");
  const sync = await Promise.all([1,2].map(() => request("/api/sync/offline", "POST", { offlineOrders: [order("offline-concurrent-1")] }, cashier)));
  check(sync.every(r => r.status === 200) && sync.reduce((n,r) => n+r.body.syncedCount,0) === 1 && sync.reduce((n,r) => n+r.body.duplicateCount,0) === 1, "offline concurrent replay counts one new order and one duplicate");
  // Inject a late database failure: no money/stock/order changes may survive.
  const faultOrder = await request("/api/orders", "POST", order("refund-fault-order"), cashier);
  const faultId = faultOrder.body.order.id;
  await request(`/api/orders/${faultId}/pay`, "POST", { paymentMethod: "cash", amount: "10" }, cashier);
  const beforeFaultPayouts = (await admin.query("SELECT cash_payouts FROM shifts WHERE branch_id=1 AND status='open'")).rows[0].cash_payouts;
  const beforeFaultStock = (await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock;
  await admin.query(`CREATE FUNCTION test_refund_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'order_refunded' THEN RAISE EXCEPTION 'Injected late audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_refund_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_refund_fault();`);
  const fault = await request(`/api/orders/${faultId}/refund`, "POST", { amount: "10", reason: "Failure injection", managerPin: "2222", returnStock: true }, cashier);
  check(fault.status === 500 && !JSON.stringify(fault.body).includes("Injected"), "late refund failure returns no database internals");
  check((await admin.query("SELECT id FROM refunds WHERE order_id=$1", [faultId])).rowCount === 0, "failed refund rolls back refund ledger");
  check((await admin.query("SELECT payment_status FROM orders WHERE id=$1", [faultId])).rows[0].payment_status === "paid", "failed refund rolls back order state");
  check((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock === beforeFaultStock, "failed refund rolls back stock restoration");
  check((await admin.query("SELECT cash_payouts FROM shifts WHERE branch_id=1 AND status='open'")).rows[0].cash_payouts === beforeFaultPayouts, "failed refund rolls back drawer aggregate");
  check((await admin.query("SELECT dm.id FROM drawer_movements dm JOIN refunds r ON r.id=dm.refund_id WHERE r.order_id=$1", [faultId])).rowCount === 0, "failed refund leaves no drawer movement");
  await admin.query("DROP TRIGGER test_refund_fault ON audit_logs; DROP FUNCTION test_refund_fault()");
  const branchWrites = await Promise.all([
    request("/api/orders", "POST", order("branch-one-parallel"), cashier),
    request("/api/orders", "POST", order("branch-two-parallel", { items: [{ menuItemId: 2, quantity: 1 }] }), other),
  ]);
  check(branchWrites[0].body.order.branchId === 1 && branchWrites[1].body.order.branchId === 2, "parallel requests do not leak branch context");
  check((await request("/api/staff", "POST", { action: "toggle_active", userId: 7, isActive: false }, owner)).status === 404, "owner cannot change staff in another branch");

  // Removing a staff account: the owner takes away the ability to sign in, the
  // roster stops showing the account, and the sales that person made keep the
  // name of whoever took the money — Postgres will not let the row go while
  // orders point at it, and erasing those orders would shrink the books.
  // Runs late: the sale below moves ingredient stock, and the checks above
  // assert absolute stock levels.
  const removable = await request("/api/staff", "POST", { action: "create_employee", name: "Removal Test", email: "removeme@test.invalid", role: "cashier", password: "Removal-test-password-123!", pin: "8383" }, owner);
  check(removable.status === 200, "owner creates the employee who will be removed");
  const removableId = removable.body.employee.id;
  const removableLogin = await request("/api/auth/login", "POST", { email: "removeme@test.invalid", password: "Removal-test-password-123!" });
  check((await request("/api/orders", "POST", order("removal-sale"), removableLogin.cookie)).status === 200, "the employee rings up a sale before being removed");
  check((await request("/api/staff", "POST", { action: "delete_user", userId: removableId }, manager)).status === 403, "a manager cannot remove a staff account");
  check((await request("/api/staff", "POST", { action: "delete_user", userId: 1 }, owner)).status === 400, "the owner cannot remove their own account");
  const removed = await request("/api/staff", "POST", { action: "delete_user", userId: removableId }, owner);
  check(removed.status === 200 && removed.body.success === true, `owner removes a staff account (${removed.status})`);
  const roster = await request("/api/staff", "GET", undefined, owner);
  check(!roster.body.staff.some((u: any) => u.id === removableId), "the removed account leaves the staff list");
  const removedRow = (await admin.query("SELECT name, email, is_active, deleted_at FROM users WHERE id = $1", [removableId])).rows[0];
  check(removedRow.name === "Removal Test" && removedRow.is_active === false && removedRow.deleted_at !== null, "the row stays for the money trail: name kept, access flags set");
  check(/@deleted\.invalid$/.test(removedRow.email), "the login address is moved off the removed account");
  check(Number((await admin.query("SELECT count(*)::int AS c FROM orders WHERE user_id = $1", [removableId])).rows[0].c) === 1, "their sale is still in the books");
  check((await request("/api/auth/me", "GET", undefined, removableLogin.cookie)).status === 401, "removal signs the account out immediately");
  check((await request("/api/auth/login", "POST", { email: "removeme@test.invalid", password: "Removal-test-password-123!" })).status === 401, "the removed account can never sign in again");
  check(Number((await admin.query("SELECT count(*)::int AS c FROM audit_logs WHERE action = 'delete_user' AND entity_id = $1", [String(removableId)])).rows[0].c) >= 1, "the removal is recorded in the activity log");
  check((await request("/api/staff", "POST", { action: "delete_user", userId: removableId }, owner)).status === 409, "removing the same account twice is refused");
  check((await request("/api/staff", "POST", { action: "create_employee", name: "Rehired Test", email: "removeme@test.invalid", role: "cashier", password: "Rehire-password-123!", pin: "8383" }, owner)).status === 200, "the freed email and PIN can be used by a new account");
  check((await request("/api/health")).status === 200, "public health endpoint works without scoped data access");
  check((await request("/api/orders", "POST", order("bad-origin"), cashier, { Origin: "https://attacker.invalid" })).status === 403, "cross-origin mutation rejected");
  const signed = createToken({ id: 3, sessionVersion: 0 });
  check(verifyToken(signed)?.id === 3 && verifyToken(signed + "tampered") === null, "token verification rejects tampering");
  const data = Buffer.from(JSON.stringify({ id: 3, version: 0, iat: 1, exp: 2 })).toString("base64url");
  const expired = `${data}.${createHmac("sha256", process.env.AUTH_SECRET!).update(data).digest("base64url")}`;
  check((await request("/api/menu", "GET", undefined, `pos_session=${expired}`)).status === 401, "server rejects correctly signed expired token");
  await admin.query("UPDATE users SET role='accountant' WHERE id=3");
  check((await request("/api/orders", "GET", undefined, cashier)).status === 403, "existing token immediately reflects role downgrade");
  await admin.query("UPDATE users SET is_active=false WHERE id=3");
  check((await request("/api/menu", "GET", undefined, cashier)).status === 401, "deactivated user loses existing session access");
  check((await request("/api/auth/logout", "POST", {}, manager)).status === 200, "logout succeeds");
  check((await request("/api/menu", "GET", undefined, manager)).status === 401, "copied session is revoked by logout");
  let limited = 0;
  for (let i=0; i<11; i++) limited = (await request("/api/auth/login", "POST", { email: "unknown@test.invalid", password: "wrong" })).status;
  check(limited === 429, "login throttling persists across failed request rollbacks");
  const runtime = new Pool({ connectionString: process.env.DATABASE_URL });
  try { check((await runtime.query("SELECT * FROM orders")).rowCount === 0, "runtime DB connection without request scope sees no orders"); } finally { await runtime.end(); }
  // --- A database that has not been migrated must say so, not fail randomly --
  // Order deletion once answered a bare "Request failed" for hours because the
  // code expected a column the database did not have yet. The app now names the
  // missing update, and /api/health reports it, so a stale environment is
  // diagnosable from the first request instead of from a log hunt.
  const beforeDrift = await request("/api/orders", "POST", order("drift-probe"), owner);
  check(beforeDrift.status === 200, "order created before the drift");
  const driftId = beforeDrift.body.order.id;
  await admin.query("ALTER TABLE payments DROP COLUMN idempotency_key, DROP COLUMN request_fingerprint");
  check((await request("/api/menu", "GET", undefined, owner)).status === 200, "a stale database does not stop the venue trading");
  const driftSale = await request("/api/orders", "POST", order("drift-sale"), owner);
  check(driftSale.status === 200, "a sale still rings up while a payment column is missing");
  const driftedDelete = await request(`/api/orders/${driftId}`, "DELETE", {}, owner);
  check(driftedDelete.status === 503, `the work that needs the missing column answers 503, not a mystery 500 (${driftedDelete.status})`);
  check(/idempotency_key/.test(String(driftedDelete.body.error)) && /db:migrate/.test(String(driftedDelete.body.error)), "the refusal names the missing column and the command that fixes it");
  check(driftedDelete.headers.get("cache-control") === "no-store", "and the 503 itself is never cached");
  const driftedHealth = await request("/api/health");
  check(driftedHealth.status === 503 && driftedHealth.body.reason === "schema-behind" && (driftedHealth.body.missing || []).includes("payments.idempotency_key"), "health reports the schema gap for the deploy gate and the operator");
  await admin.query(await readFile("migrations/0004_payment_idempotency.sql", "utf8"));
  check((await request("/api/health")).status === 200, "running the migration returns the app to healthy");
  check((await request(`/api/orders/${driftId}`, "DELETE", {}, owner)).status === 200, "and the work that was refused now succeeds");
  check((await request(`/api/orders/${driftSale.body.order.id}`, "DELETE", {}, owner)).status === 200, "the sale rung up during the drift erases too");
  check(Number((await admin.query("SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='payments' AND column_name='idempotency_key'")).rows[0].c) === 1, "the re-applied migration restored the column");
  const shift = (await request("/api/shifts", "GET", undefined, owner)).body.activeShift;
  const expected = Number(shift.openingCash) + Number(shift.totalCashSales) - Number(shift.cashPayouts);
  check((await request("/api/shifts", "POST", { action: "close_shift", shiftId: shift.id, actualClosingCash: expected.toFixed(2) }, owner)).status === 200, "security fixture closes register");
  console.log(`\n${checks} security checks passed against disposable PostgreSQL.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => admin.end());
