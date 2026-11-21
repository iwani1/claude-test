import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { createToken, verifyToken, hashPassword, verifyPassword, hashPasswordAsync, verifyPasswordAsync, pinDigest } from "../src/lib/auth";
import { pbkdf2Sync } from "node:crypto";
import { databaseUnreachableMessage } from "../src/lib/schema-guard";
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
const counter = async (key: string) => Number((await admin.query("SELECT count FROM auth_attempts WHERE key=$1 AND reset_at > now()", [key])).rows[0]?.count ?? 0);
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
  const owner = await login(1), manager = await login(2), cashier = await login(3), accountant = await login(4), inventory = await login(5), other = await login(7), otherOwner = await login(8), otherTenant = await login(9);
  check((await request("/api/shifts", "POST", { action: "open_shift", openingCash: "100.00" }, owner)).status === 200, "security fixture opens register");
  check((await request("/api/auth/login", "POST", { email: "user6@test.invalid", password: "Test-password-only-123!" })).status === 401, "kitchen account cannot log in");
  check((await request("/api/reports", "GET", undefined, cashier)).status === 403, "cashier cannot read reports");
  check((await request("/api/orders", "POST", order("accountant-denied"), accountant)).status === 403, "accountant cannot create sales");
  // --- Read-only finance pass -------------------------------------------------
  // Accountant / Finance reads the money trail and touches none of it. The tabs
  // used to be offered on "can see reports" while the APIs behind them demanded
  // till access, so finance opened screens that answered 403 and dashboard
  // panels that swallowed the 403 printed zeros as fact.
  const financeSale = await request("/api/orders", "POST", order("finance-read-probe"), owner);
  check(financeSale.status === 200, "owner rings up the sale the finance checks read");
  const financeOrderId = financeSale.body.order.id;
  const financeList = await request("/api/orders?limit=5", "GET", undefined, accountant);
  check(financeList.status === 200 && Array.isArray(financeList.body.orders), "accountant reads order history");
  check((await request(`/api/orders/${financeOrderId}`, "GET", undefined, accountant)).status === 200, "accountant opens a single receipt");
  check((await request(`/api/orders/${financeOrderId}`, "PATCH", { notes: "adjusted" }, accountant)).status === 403, "accountant cannot modify an order");
  check((await request(`/api/orders/${financeOrderId}/edit`, "PATCH", {}, accountant)).status === 403, "accountant cannot re-price an order");
  check((await request(`/api/orders/${financeOrderId}/pay`, "POST", { amount: "1.00", method: "cash" }, accountant)).status === 403, "accountant cannot take a payment");
  check((await request(`/api/orders/${financeOrderId}/refund`, "GET", undefined, accountant)).status === 200, "accountant can load refundable balances");
  check((await request(`/api/orders/${financeOrderId}/refund`, "GET", undefined, cashier)).status === 403, "cashier cannot load refundable balances");
  check((await request(`/api/orders/${financeOrderId}/refund`, "POST", { amount: "1.00", reason: "no", managerPin: "222222" }, cashier)).status === 403, "cashier cannot request refunds");
  check((await request(`/api/orders/${financeOrderId}`, "DELETE", {}, accountant)).status === 403, "accountant cannot erase an order");
  const financeDrawer = await request("/api/shifts", "GET", undefined, accountant);
  check(financeDrawer.status === 200 && "activeShift" in financeDrawer.body, "accountant reads the drawer ledger");
  check((await request("/api/shifts", "POST", { action: "open_shift", openingCash: "10.00" }, accountant)).status === 403, "accountant cannot open a shift");
  check((await request("/api/orders?limit=5", "GET", undefined, inventory)).status === 403, "order history is not handed to every report role");
  // Reports are aggregate, but the audit log and the payment export list every payment and refund.
  check((await request("/api/reports", "GET", undefined, inventory)).status === 200, "inventory officer still reads aggregate reports");
  check((await request("/api/audit-logs?limit=5", "GET", undefined, inventory)).status === 403, "inventory officer cannot read the audit log");
  check((await request("/api/integrations", "POST", { action: "export_accounting", format: "quickbooks", timeframe: "all" }, inventory)).status === 403, "inventory officer cannot export payments and refunds");
  check((await request("/api/audit-logs?limit=5", "GET", undefined, accountant)).status === 200, "accountant reads the audit log");
  check((await request("/api/integrations", "POST", { action: "export_accounting", format: "quickbooks", timeframe: "all" }, accountant)).status === 200, "accountant exports the reconciliation");
  check((await request("/api/audit-logs?limit=5", "GET", undefined, manager)).status === 200, "manager reads the audit log");
  check((await request("/api/audit-logs?limit=5", "GET", undefined, cashier)).status === 403, "cashier cannot read the audit log");
  // Both audit histories filter on the server: a day includes midnight through
  // 23:59:59 Ghana time, while pagination reaches older records in that range.
  const auditDates = ["2025-04-09 23:59:59", "2025-04-10 00:00:00", "2025-04-10 23:59:59", "2025-04-11 00:00:00"];
  const auditIds: number[] = [], countIds: number[] = [];
  for (const date of auditDates) {
    const event = await admin.query("INSERT INTO audit_logs(branch_id,user_id,user_name,action,entity_type,details,created_at) VALUES(1,1,'Test super_admin','range_probe','system','Date range test',$1::timestamp) RETURNING id", [date]);
    auditIds.push(event.rows[0].id);
    const count = await admin.query("INSERT INTO stock_counts(branch_id,conducted_by,status,items,notes,count_date) VALUES(1,1,'completed',$1::jsonb,'Date range test',$2::timestamp) RETURNING id", [JSON.stringify([{ ingredientId: 1, name: "Rice", systemStock: 100, physicalStock: 97, diff: -3, costDiff: "-7.50" }]), date]);
    countIds.push(count.rows[0].id);
  }
  await admin.query("INSERT INTO audit_logs(branch_id,user_id,user_name,action,entity_type,created_at) VALUES(2,7,'Other branch','range_probe','system','2025-04-10'::timestamp)");
  await admin.query("INSERT INTO stock_counts(branch_id,conducted_by,status,items,count_date) VALUES(2,7,'completed','[]'::jsonb,'2025-04-10'::timestamp)");
  const auditDay = "?from=2025-04-10&to=2025-04-10&limit=1";
  const auditFirst = await request(`/api/audit-logs${auditDay}`, "GET", undefined, owner);
  const auditSecond = await request(`/api/audit-logs${auditDay}&offset=1`, "GET", undefined, owner);
  check(auditFirst.status === 200 && auditFirst.body.logs.length === 1 && auditFirst.body.logs[0].id === auditIds[2] && auditFirst.body.hasMore === true, "audit range includes the full end day and exposes the next page");
  check(auditSecond.status === 200 && auditSecond.body.logs.length === 1 && auditSecond.body.logs[0].id === auditIds[1] && auditSecond.body.hasMore === false, "audit page two reaches the start-day boundary but not another branch");
  check((await request(`/api/audit-logs${auditDay}&offset=2`, "GET", undefined, owner)).body.logs.length === 0, "audit pages stop at the selected day's end");
  check((await request("/api/audit-logs?from=2025-04-10", "GET", undefined, owner)).status === 400 &&
    (await request("/api/audit-logs?from=2025-02-30&to=2025-02-30", "GET", undefined, owner)).status === 400 &&
    (await request("/api/audit-logs?from=2025-04-11&to=2025-04-10", "GET", undefined, owner)).status === 400 &&
    (await request("/api/audit-logs?offset=-1", "GET", undefined, owner)).status === 400, "audit range and pagination reject incomplete, impossible, reversed or negative dates/offsets");
  const countDay = "?from=2025-04-10&to=2025-04-10&limit=1";
  const countFirst = await request(`/api/inventory/counts${countDay}`, "GET", undefined, inventory);
  const countSecond = await request(`/api/inventory/counts${countDay}&offset=1`, "GET", undefined, inventory);
  check(countFirst.status === 200 && countFirst.body.counts.length === 1 && countFirst.body.counts[0].id === countIds[2] && countFirst.body.hasMore === true && countFirst.body.counts[0].conductedByName === "Test super_admin", "stock count range includes end-day boundary, staff name and next page");
  check(countSecond.status === 200 && countSecond.body.counts.length === 1 && countSecond.body.counts[0].id === countIds[1] && countSecond.body.hasMore === false, "stock count page two reaches start-day boundary, no other branch");
  check((await request(`/api/inventory/counts${countDay}&offset=2`, "GET", undefined, inventory)).body.counts.length === 0, "stock count range excludes other dates and branches");
  check((await request("/api/inventory/counts?from=2025-04-10", "GET", undefined, owner)).status === 400 &&
    (await request("/api/inventory/counts?from=2025-02-30&to=2025-02-30", "GET", undefined, inventory)).status === 400 &&
    (await request("/api/inventory/counts?from=2025-04-11&to=2025-04-10", "GET", undefined, inventory)).status === 400 &&
    (await request("/api/inventory/counts?offset=abc", "GET", undefined, inventory)).status === 400, "stock count range and pagination reject invalid input");
  check((await request(`/api/inventory/counts${countDay}`, "GET", undefined, accountant)).status === 403, "finance cannot read private stock count history");
  // The movement ledger must search beyond the latest 50 rows, include the
  // whole selected Ghana day, and never show another branch's stock history.
  const movementIds: number[] = [];
  for (const date of auditDates) {
    const movement = await admin.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,previous_stock,new_stock,reason,created_at) VALUES(1,1,'adjustment',0.001,100,100.001,'Ledger date test',$1::timestamp) RETURNING id", [date]);
    movementIds.push(movement.rows[0].id);
  }
  const otherBranchMovement = await admin.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,previous_stock,new_stock,created_at) VALUES(2,2,'adjustment',0.001,100,100.001,'2025-04-10 12:00:00'::timestamp) RETURNING id");
  const otherTenantMovement = await admin.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,previous_stock,new_stock,created_at) VALUES(3,3,'adjustment',0.001,100,100.001,'2025-04-10 12:00:00'::timestamp) RETURNING id");
  // All 51 have identical timestamps to exercise the ID tie-break across pages.
  const newerMovements = await admin.query("INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,previous_stock,new_stock,created_at) SELECT 1,1,'adjustment',0.001,100,100.001,'2025-05-01 12:00:00'::timestamp FROM generate_series(1,51) RETURNING id");
  const movementDay = "?from=2025-04-10&to=2025-04-10&limit=1";
  const movementFirst = await request(`/api/inventory/movements${movementDay}`, "GET", undefined, owner);
  const movementSecond = await request(`/api/inventory/movements${movementDay}&offset=1`, "GET", undefined, inventory);
  check(movementFirst.status === 200 && movementFirst.body.movements.length === 1 && movementFirst.body.movements[0].id === movementIds[2] && movementFirst.body.hasMore === true && movementFirst.headers.get("cache-control") === "no-store", "stock movement range includes the end day and has an uncacheable next page");
  check(movementSecond.status === 200 && movementSecond.body.movements.length === 1 && movementSecond.body.movements[0].id === movementIds[1] && movementSecond.body.hasMore === false, "stock movement page two reaches start-day midnight without other branches");
  check((await request(`/api/inventory/movements${movementDay}&offset=2`, "GET", undefined, owner)).body.movements.length === 0, "stock movement range excludes the preceding and following day");
  const allMovementDates = await request("/api/inventory/movements?from=2025-04-09&to=2025-04-11&limit=10", "GET", undefined, owner);
  check(allMovementDates.status === 200 && JSON.stringify(allMovementDates.body.movements.map((m: any) => m.id)) === JSON.stringify([...movementIds].reverse()), "stock movement range includes both boundary days and only this branch");
  const recentMovements = await request("/api/inventory/movements?limit=50", "GET", undefined, owner);
  check(recentMovements.status === 200 && recentMovements.body.movements.length === 50 && recentMovements.body.hasMore === true && recentMovements.body.movements.every((m: any) => !movementIds.includes(m.id)), "older stock movements fall outside the initial latest-50 page");
  const newerFirst = await request("/api/inventory/movements?from=2025-05-01&to=2025-05-01&limit=50", "GET", undefined, owner);
  const newerSecond = await request("/api/inventory/movements?from=2025-05-01&to=2025-05-01&limit=50&offset=50", "GET", undefined, owner);
  check(newerFirst.status === 200 && newerFirst.body.movements.length === 50 && newerFirst.body.movements[0].id === newerMovements.rows[50].id && newerFirst.body.hasMore === true, "movement pages sort newest first with a stable ID tie-break");
  check(newerSecond.status === 200 && newerSecond.body.movements.length === 1 && newerSecond.body.movements[0].id === newerMovements.rows[0].id && newerSecond.body.hasMore === false, "load-more reaches movement 51 without duplicate rows");
  check((await request(`/api/inventory/movements${movementDay}`, "GET", undefined, otherOwner)).body.movements[0]?.id === otherBranchMovement.rows[0].id &&
    (await request(`/api/inventory/movements${movementDay}`, "GET", undefined, otherTenant)).body.movements[0]?.id === otherTenantMovement.rows[0].id, "each branch and tenant reads only its own movement ledger");
  check((await request(`/api/inventory/movements${movementDay}`, "GET", undefined, cashier)).status === 403 &&
    (await request(`/api/inventory/movements${movementDay}`, "GET", undefined, accountant)).status === 403, "cashier and finance cannot read private stock movement history");
  check((await request("/api/inventory/movements?from=2025-04-10", "GET", undefined, owner)).status === 400 &&
    (await request("/api/inventory/movements?from=2025-02-30&to=2025-02-30", "GET", undefined, inventory)).status === 400 &&
    (await request("/api/inventory/movements?from=2025-04-11&to=2025-04-10", "GET", undefined, owner)).status === 400 &&
    (await request("/api/inventory/movements?offset=-1", "GET", undefined, owner)).status === 400 &&
    (await request("/api/inventory/movements?offset=abc", "GET", undefined, inventory)).status === 400, "stock movement dates and pagination reject incomplete, impossible, reversed and invalid input");
  // Cost price belongs to whoever runs the menu or the books. Cashiers see sale prices only.
  const hasCost = (rows: any[]) => rows.some(r => "costPrice" in r);
  const cashierMenu = await request("/api/menu", "GET", undefined, cashier);
  check(cashierMenu.status === 200 && cashierMenu.body.items.length > 0 && !hasCost(cashierMenu.body.items), "cashier's menu carries no cost price");
  check(hasCost((await request("/api/menu", "GET", undefined, owner)).body.items), "owner's menu carries cost price");
  check(hasCost((await request("/api/menu", "GET", undefined, inventory)).body.items), "inventory officer's menu carries cost price");
  const cashierOrder = await request(`/api/orders/${financeOrderId}`, "GET", undefined, cashier);
  check(cashierOrder.status === 200 && cashierOrder.body.order.items.length > 0 && !hasCost(cashierOrder.body.order.items), "cashier's order history carries no cost price");
  check(hasCost((await request(`/api/orders/${financeOrderId}`, "GET", undefined, owner)).body.order.items), "owner's order carries cost price");
  check(!hasCost((await request("/api/orders?limit=5", "GET", undefined, cashier)).body.orders.flatMap((o: any) => o.items)), "cashier's order list carries no cost price");
  check(typeof cashierOrder.body.order.userName === "string" && cashierOrder.body.order.userName.length > 0, "an opened order names the staff member who created it");
  check((await request("/api/orders?limit=5", "GET", undefined, cashier)).body.orders.every((o: any) => typeof o.userName === "string" && o.userName.length > 0), "order history names who created each order");
  const costProbe = await request("/api/orders", "POST", order("cost-probe"), cashier);
  check(costProbe.status === 200 && costProbe.body.order.items.length > 0 && !hasCost(costProbe.body.order.items), "the sale a cashier rings up returns no cost price");
  check((await request(`/api/orders/${costProbe.body.order.id}`, "DELETE", {}, owner)).status === 200, "the cost probe sale erases cleanly");
  // The audit page size is capped; a malformed value falls back to the default.
  const hugePage = await request("/api/audit-logs?limit=100000", "GET", undefined, owner);
  check(hugePage.status === 200 && hugePage.body.logs.length <= 500, "the audit log page is capped at 500 rows");
  check((await request("/api/audit-logs?limit=abc", "GET", undefined, owner)).status === 200, "a malformed audit page size falls back to the default");
  // Settings: only known keys can be written, and a refused request writes nothing.
  const strangeSetting = await request("/api/settings", "POST", { settingsData: { not_a_setting: "x" } }, owner);
  check(strangeSetting.status === 400 && /not_a_setting/.test(String(strangeSetting.body.error)), "an unknown setting key is refused");
  check((await admin.query("SELECT count(*)::int AS n FROM application_settings WHERE key='not_a_setting'")).rows[0].n === 0, "the refused setting is not written");
  check((await request("/api/settings", "POST", { settingsData: { tax_rate_confirmed: "false" } }, owner)).status === 400, "the VAT confirmation cannot be switched off by hand");
  check((await request("/api/settings", "POST", { settingsData: { currency_symbol: "GH₵" } }, owner)).status === 200, "a known setting key is still saved");
  // A new restaurant defaults to Ghana cedis, not US dollars.
  const currencyDefaults = (await admin.query("SELECT column_name, column_default FROM information_schema.columns WHERE table_name='restaurants' AND column_name IN ('currency','currency_symbol')")).rows;
  check(currencyDefaults.length === 2 && currencyDefaults.every((c: any) => /GHS|GH₵/.test(String(c.column_default))), "new restaurants default to GHS and GH₵");
  // Staff read only the till settings; the owner keeps the full record.
  const staffView = (await request("/api/settings", "GET", undefined, cashier)).body;
  check(staffView.restaurant && !("taxNumber" in staffView.restaurant) && !("email" in staffView.restaurant) && !("phone" in staffView.restaurant) && !("address" in staffView.restaurant) && !("momo_merchant_number" in staffView.settings) && staffView.branches.length === 0, "cashiers do not read contact, registration or payment-number settings");
  const ownerView = (await request("/api/settings", "GET", undefined, owner)).body;
  check("taxNumber" in ownerView.restaurant && Array.isArray(ownerView.branches), "the owner still reads the full settings record");
  // One table, one open dine-in order: a second order is refused rather than overwriting the first.
  const firstDine = await request("/api/orders", "POST", { idempotencyKey: "dine-first-0001", orderType: "dine_in", tableId: 1, items: [{ menuItemId: 1, quantity: 1 }] }, cashier);
  const secondDine = await request("/api/orders", "POST", { idempotencyKey: "dine-second-0002", orderType: "dine_in", tableId: 1, items: [{ menuItemId: 1, quantity: 1 }] }, cashier);
  check(firstDine.body.success === true && secondDine.status === 409, "a second dine-in order on an occupied table is refused");
  if (firstDine.body.order?.id) await request(`/api/orders/${firstDine.body.order.id}`, "DELETE", {}, owner);
  // The probe sale rang up stock, so erase it before the absolute stock checks
  // below — deletion returns exactly what the order consumed.
  check((await request(`/api/orders/${financeOrderId}`, "DELETE", {}, owner)).status === 200, "the finance probe sale erases cleanly, leaving fixture stock untouched");
  check((await request("/api/menu", "POST", { name: "Bad", categoryId: 1, price: 1 }, cashier)).status === 403, "cashier cannot modify menu");
  // Menu removal archives: the dish leaves every menu list at once, a sold
  // dish's history is untouched, and the Deleted view can bring it back.
  const deletable = await request("/api/menu", "POST", { name: "Delete Me Dish", categoryId: 1, price: "12.50" }, owner);
  check(deletable.status === 200 && deletable.body.item?.id > 0, "owner creates a menu item to remove");
  // --- N8: photos travel as links, not inline in the menu list ---------------
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const photoDataUrl = `data:image/png;base64,${pngBase64}`;
  const photoDish = await request("/api/menu", "POST", { name: "Photo Dish", categoryId: 1, price: "9.00", imageUrl: photoDataUrl }, owner);
  check(photoDish.status === 200, "owner adds a dish with an uploaded photo");
  const photoId = photoDish.body.item.id;
  const menuForTill = await request("/api/menu", "GET", undefined, cashier);
  const listedPhoto = menuForTill.body.items.find((i: { id: number }) => i.id === photoId)?.imageUrl as string;
  check(/^\/api\/menu\/\d+\/photo\?v=/.test(listedPhoto) && !JSON.stringify(menuForTill.body).includes("data:image"), "N8: the menu list links photos instead of carrying them inline");
  const photoRes = await fetch(base + listedPhoto, { headers: { Cookie: cashier } });
  const photoBytes = Buffer.from(await photoRes.arrayBuffer());
  check(photoRes.status === 200 && photoRes.headers.get("content-type") === "image/png" && photoBytes.equals(Buffer.from(pngBase64, "base64")) && /immutable/.test(photoRes.headers.get("cache-control") || ""),
    "N8: the link serves the exact image, and the browser may keep it");
  check((await fetch(base + listedPhoto)).status === 401, "N8: photos need a signed-in session");
  check((await request(`/api/menu/${photoId}`, "PUT", { name: "Photo Dish renamed", imageUrl: listedPhoto }, owner)).status === 200
    && (await admin.query("SELECT image_url FROM menu_items WHERE id=$1", [photoId])).rows[0].image_url === photoDataUrl, "N8: saving with the unchanged photo link keeps the stored photo");
  await admin.query("UPDATE menu_items SET image_url=$1 WHERE id=$2", ["data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", photoId]);
  check((await fetch(`${base}/api/menu/${photoId}/photo`, { headers: { Cookie: cashier } })).status === 404, "N8: something that is not an image is never served as a photo");
  await admin.query("DELETE FROM menu_items WHERE id=$1", [photoId]);
  const deletableId = deletable.body.item.id;
  const soldDish = await request("/api/orders", "POST", order("menu-delete-history", { items: [{ menuItemId: deletableId, quantity: 1 }] }), cashier);
  check(soldDish.status === 200, "the dish sells before it is removed");
  check((await request(`/api/menu/${deletableId}`, "DELETE", {}, cashier)).status === 403, "cashier cannot remove menu items");
  check((await request(`/api/menu/${deletableId}`, "DELETE", {}, owner)).status === 200, "owner removes a sold menu item");
  check(!(await request("/api/menu", "GET", undefined, owner)).body.items.some((i: any) => i.id === deletableId), "removed item leaves the menu list");
  check((await request("/api/menu?includeArchived=1", "GET", undefined, owner)).body.items.some((i: any) => i.id === deletableId && i.isArchived === true), "removed item is archived, not erased");
  check((await request("/api/menu?includeArchived=1", "GET", undefined, cashier)).status === 403, "cashier cannot fetch the deleted-items list");
  check((await request("/api/menu?includeArchived=1", "GET", undefined, manager)).status === 200, "menu managers can fetch the deleted-items list");
  const soldHistory = await request(`/api/orders/${soldDish.body.order.id}`, "GET", undefined, owner);
  check(soldHistory.status === 200 && soldHistory.body.order.items.some((i: any) => i.itemName === "Delete Me Dish"), "a removed dish stays on the orders that sold it");
  // Removal is owner-only: a manager holds menu management, yet both the
  // DELETE and the restore side door (PUT isArchived) refuse them.
  check((await request(`/api/menu/${deletableId}`, "DELETE", {}, manager)).status === 403, "manager cannot remove menu items — owner only");
  check((await request(`/api/menu/${deletableId}`, "PUT", { isArchived: false }, manager)).status === 403, "manager cannot restore menu items either");
  check((await request("/api/menu?includeArchived=1", "GET", undefined, owner)).body.items.some((i: any) => i.id === deletableId && i.isArchived === true), "the refused manager attempts change nothing");
  check((await request(`/api/menu/${deletableId}`, "PUT", { isArchived: false, isAvailable: false }, owner)).status === 200, "owner restores a removed item");
  check((await request("/api/menu", "GET", undefined, owner)).body.items.some((i: any) => i.id === deletableId && i.isArchived === false), "restored item returns to the menu list");
  check((await request(`/api/menu/${deletableId}`, "PUT", { price: "13.00" }, manager)).status === 200, "manager can still edit menu items");
  check((await request(`/api/menu/99999999`, "DELETE", {}, owner)).status === 404, "removing a missing menu item is a 404");
  if (soldDish.body.order?.id) await request(`/api/orders/${soldDish.body.order.id}`, "DELETE", {}, owner);
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
  // The audit row for a switch must name the person who is NOW signed in —
  // naming the person who left misread a real investigation (Oct 2026).
  const switchTarget = await request("/api/staff", "POST", { action: "create_employee", name: "Switch Target", email: "switchtarget@test.invalid", role: "cashier", password: "Switch-target-123!", pin: "2211" }, owner);
  check(switchTarget.status === 200, "owner creates a colleague to switch to");
  const switch3 = await request("/api/auth/switch-pin", "POST", { pin: "2211" }, pinLogin2.cookie);
  check(switch3.status === 200 && switch3.body.user.name === "Switch Target", "switching to a colleague works");
  const lastSwitch = (await admin.query("SELECT user_name, entity_id, details FROM audit_logs WHERE action = 'pos_quick_pin_switch' ORDER BY id DESC LIMIT 1")).rows[0];
  check(lastSwitch?.user_name === "Switch Target" && String(lastSwitch?.entity_id) === String(pinStaff.body.employee.id) && /PIN Test/.test(String(lastSwitch?.details || "")), "the PIN-switch audit row names the incoming user, outgoing user in details");
  const dup = await request("/api/staff", "POST", { action: "update_pin", userId: pwStaff.body.employee.id, pin: "6677" }, owner);
  check(dup.status === 409 && /already used/i.test(dup.body.error), "duplicate branch PIN rejected with clear message");
  const dupCreate = await request("/api/staff", "POST", { action: "create_employee", name: "Dup PIN", email: "duppin@test.invalid", role: "cashier", password: "Dup-pin-password-123!", pin: "6677" }, owner);
  check(dupCreate.status === 409 && /already used/i.test(dupCreate.body.error), "employee creation rejects duplicate PIN with clear message");
  // N5: the "already used" answer cannot be farmed to learn everyone's PIN.
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'pin-collision:%'");
  let collisionStatuses: number[] = [];
  for (let i = 0; i < 3; i++) collisionStatuses.push((await request("/api/staff", "POST", { action: "update_pin", userId: pwStaff.body.employee.id, pin: "6677" }, manager)).status);
  check(collisionStatuses.every(s => s === 409) && (await counter("pin-collision:actor:2")) === 3, "N5: each PIN collision counts against the person setting PINs, despite rollback");
  check((await request("/api/staff", "POST", { action: "update_pin", userId: pwStaff.body.employee.id, pin: "8080" }, manager)).status === 429, "N5: after three collisions that person cannot keep probing PINs");
  check((await request("/api/staff", "POST", { action: "update_pin", userId: pwStaff.body.employee.id, pin: "8080" }, owner)).status === 200, "N5: the limit is per person; others can still set PINs");
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'pin-collision:%'");
  collisionStatuses = [];
  // N5: the owner is never reachable by quick PIN switch, even with the right PIN
  // (the fixture owner's PIN is 1111; it still approves refunds below).
  const ownerSwitch = await request("/api/auth/switch-pin", "POST", { pin: "111111" }, pinLogin2.cookie);
  check(ownerSwitch.status === 403 && !ownerSwitch.cookie, "N5: the owner's correct PIN does not switch a till into the owner account");
  // --- N19: PINs that approve are 6-8 digits ----------------------------------
  check((await request("/api/staff", "POST", { action: "create_employee", name: "Short Pin Manager", email: "shortpinmgr@test.invalid", role: "manager", password: "Short-pin-manager-123!", pin: "4321" }, owner)).status === 400,
    "N19: a manager cannot be given a 4-digit PIN");
  const longPinManager = await request("/api/staff", "POST", { action: "create_employee", name: "Long Pin Manager", email: "longpinmgr@test.invalid", role: "manager", password: "Long-pin-manager-123!", pin: "432165" }, owner);
  check(longPinManager.status === 200, "N19: a manager with a 6-digit PIN is created");
  check((await request("/api/staff", "POST", { action: "update_pin", userId: longPinManager.body.employee.id, pin: "1357" }, owner)).status === 400, "N19: nor changed to a short one later");
  check((await request("/api/staff", "POST", { action: "update_pin", userId: pwStaff.body.employee.id, pin: "8081" }, owner)).status === 200, "N19: a cashier keeps a 4-digit PIN");
  // A manager still holding a short PIN from before this change:
  await admin.query("UPDATE users SET pin=$1, pin_lookup=$2 WHERE id=2", [hashPassword("2468"), pinDigest("2468")]);
  const legacySwitch = await request("/api/auth/switch-pin", "POST", { pin: "2468" }, pinLogin2.cookie);
  check(legacySwitch.status === 403 && /6 to 8 digits/.test(legacySwitch.body.error), "N19: a manager's short legacy PIN no longer opens their account by quick switch");
  await admin.query("UPDATE users SET pin=$1, pin_lookup=$2 WHERE id=2", [hashPassword("222222"), pinDigest("222222")]);
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'pin:%'");
  const grant = await request("/api/staff", "POST", { action: "update_permissions", userId: pwStaff.body.employee.id, permissions: { canApproveRefunds: true } }, owner);
  check(grant.status === 200 && /6 to 8 digits/.test(grant.body.note || ""), "N19: granting approval power reminds the owner about the PIN length");
  await request("/api/staff", "POST", { action: "update_permissions", userId: pwStaff.body.employee.id, permissions: {} }, owner);
  const dupEmail = await request("/api/staff", "POST", { action: "create_employee", name: "Dup Email", email: "pintest@test.invalid", role: "cashier", password: "Dup-email-password-123!" }, owner);
  check(dupEmail.status === 409 && /already registered/i.test(dupEmail.body.error), "duplicate email rejected with clear message");
  // --- N3/N4: removing items from, or cancelling, a kitchen order -------------
  // The owner turned the manager-PIN approval for these off (Nov 2026; N3/N4
  // Accepted in docs/FINDINGS.md). They are allowed for till staff, and every
  // removal or cancel is still logged with who did it and what went.
  // Later checks assert exact stock, so this block puts the shelf back as it found it.
  const n3StockBefore = (await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock;
  const lastAudit = async (action: string, orderId: number) => (await admin.query(
    "SELECT user_id, user_name, details FROM audit_logs WHERE action=$1 AND entity_id=$2 ORDER BY id DESC LIMIT 1", [action, String(orderId)])).rows[0];
  const sent = await request("/api/orders", "POST", order("n3-removal-sent", { items: [{ menuItemId: 1, quantity: 2 }] }), cashier);
  check(sent.status === 200, "cashier rings up a kitchen order");
  const sentId = sent.body.order.id;
  const shrink = { items: [{ menuItemId: 1, quantity: 1 }] };
  const sentQty = async () => Number((await admin.query("SELECT sum(quantity) AS q FROM order_items WHERE order_id=$1", [sentId])).rows[0].q);
  const removal = await request(`/api/orders/${sentId}/edit`, "PATCH", shrink, cashier);
  check(removal.status === 200 && (await sentQty()) === 1, "N3 (accepted): a cashier removes items from a kitchen order without a manager PIN");
  const removalRow = await lastAudit("order_items_removed", sentId);
  check(removalRow?.user_id === 3 && /removed 1×/.test(removalRow?.details) && /kitchen already had it/.test(removalRow?.details), "N3: the removal is logged with the cashier, what went and that the kitchen had it");
  check((await request(`/api/orders/${sentId}/edit`, "PATCH", { items: [{ menuItemId: 1, quantity: 3 }] }, cashier)).status === 200, "N3: adding items to a kitchen order is allowed");
  check((await lastAudit("order_items_removed", sentId))?.details === removalRow?.details, "N3: adding items writes no removal entry");
  const draft = await request("/api/orders", "POST", order("n3-removal-draft", { items: [{ menuItemId: 1, quantity: 2 }], sendToKitchen: false }), cashier);
  const draftId = draft.body.order.id;
  check((await request(`/api/orders/${draftId}/edit`, "PATCH", shrink, cashier)).status === 200, "N3: an order never sent to the kitchen can be reduced");
  check(/Not yet sent to the kitchen/.test((await lastAudit("order_items_removed", draftId))?.details || ""), "N3: that removal is logged as before the kitchen");
  check((await request(`/api/orders/${sentId}`, "PATCH", { status: "cancelled" }, cashier)).status === 200
    && (await admin.query("SELECT status FROM orders WHERE id=$1", [sentId])).rows[0].status === "cancelled", "N4 (accepted): a cashier cancels a kitchen order without a manager PIN");
  const cancelRow = await lastAudit("order_cancelled", sentId);
  check(cancelRow?.user_id === 3 && cancelRow?.user_name && /kitchen already had it/.test(cancelRow?.details) && /Stock returned/.test(cancelRow?.details), "N4: the cancel is logged with the cashier, that the kitchen had it and the stock decision");
  // (Editing the draft above opened a kitchen docket, as the till's edit does, so
  // use a fresh draft that never reached the kitchen.)
  const freshDraft = await request("/api/orders", "POST", order("n4-fresh-draft", { sendToKitchen: false }), cashier);
  const freshDraftId = freshDraft.body.order.id;
  check((await request(`/api/orders/${freshDraftId}`, "PATCH", { status: "cancelled" }, cashier)).status === 200
    && /Not yet sent to the kitchen/.test((await lastAudit("order_cancelled", freshDraftId))?.details || "")
    && (await lastAudit("order_cancelled", freshDraftId))?.user_id === 3, "N4: a draft cancel is logged as before the kitchen, with the actor");
  const paidCancel = await request("/api/orders", "POST", order("n4-paid-cancel"), cashier);
  await admin.query("UPDATE orders SET paid_amount=total_amount, payment_status='paid' WHERE id=$1", [paidCancel.body.order.id]);
  check((await request(`/api/orders/${paidCancel.body.order.id}`, "PATCH", { status: "cancelled" }, cashier)).status === 409, "N4: an order with money taken still cannot be cancelled (refund first, which needs a PIN)");
  await admin.query("UPDATE orders SET paid_amount=0, payment_status='unpaid' WHERE id=$1", [paidCancel.body.order.id]);
  check((await request(`/api/orders/${paidCancel.body.order.id}`, "PATCH", { status: "cancelled" }, cashier)).status === 200, "N4: (probe order put back and cancelled so later totals are unaffected)");
  await admin.query("UPDATE ingredients SET current_stock=$1 WHERE id=1", [n3StockBefore]);
  // --- P5: a stuck request cannot freeze the till -----------------------------
  // The test server's lock limit is 1.5 s (tests/run-security.ts). A request that
  // needs a row another session holds must give up promptly with a clear answer,
  // not hang, and work again as soon as the lock is released.
  const p5StockBefore = (await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock;
  const lockTarget = await request("/api/orders", "POST", order("p5-lock-target"), owner);
  const lockTargetId = lockTarget.body.order.id;
  const holder = await admin.connect();
  try {
    await holder.query("BEGIN");
    await holder.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [lockTargetId]);
    const started = Date.now();
    const blocked = await request(`/api/orders/${lockTargetId}`, "PATCH", { notes: "lock probe" }, owner);
    const waited = Date.now() - started;
    check(blocked.status === 503 && /Someone else is working on this same record/.test(blocked.body.error) && blocked.headers.get("retry-after") === "2",
      "P5: a request blocked by a locked row is refused with a clear 'try again' answer");
    check(waited < 5000, `P5: the blocked request gave up promptly (${waited} ms), instead of hanging`);
  } finally {
    await holder.query("ROLLBACK");
    holder.release();
  }
  // N9: reading an order never waits for, or takes, a row lock.
  const readHolder = await admin.connect();
  try {
    await readHolder.query("BEGIN");
    await readHolder.query("SELECT id FROM orders WHERE id=$1 FOR UPDATE", [lockTargetId]);
    const readStarted = Date.now();
    const readWhileLocked = await request(`/api/orders/${lockTargetId}`, "GET", undefined, owner);
    check(readWhileLocked.status === 200 && Date.now() - readStarted < 1000, "N9: viewing an order while another session holds it answers at once");
  } finally {
    await readHolder.query("ROLLBACK");
    readHolder.release();
  }
  const unblocked = await request(`/api/orders/${lockTargetId}`, "PATCH", { notes: "lock probe" }, owner);
  check(unblocked.status === 200 && unblocked.body.order.notes === "lock probe", "P5: the same request succeeds once the lock is released");
  // N10: fulfilment only moves forward; malformed ids are a 400, not a 500.
  check((await request(`/api/orders/${lockTargetId}`, "PATCH", { status: "served" }, owner)).status === 200, "N10: an order can move forward to served");
  const backwards = await request(`/api/orders/${lockTargetId}`, "PATCH", { status: "preparing" }, owner);
  check(backwards.status === 409 && /cannot go back/.test(backwards.body.error), "N10: a served order cannot be put back to preparing");
  check((await request("/api/orders/abc", "PATCH", { notes: "x" }, owner)).status === 400 && (await request("/api/orders/abc", "GET", undefined, owner)).status === 400, "N10: a malformed order id is a 400");
  // N11: an Origin of "null" is refused plainly; a body of undeclared length is refused.
  check((await request("/api/orders", "POST", order("n11-null-origin"), cashier, { Origin: "null" })).status === 403, "N11: Origin null is refused with 403, not a server error");
  const chunked = await fetch(base + "/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cashier },
    body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify(order("n11-chunked")))); c.close(); } }),
    duplex: "half",
  } as RequestInit);
  check(chunked.status === 411, `N11: a body sent without a declared length is refused (${chunked.status})`);
  // N12: an items-only edit keeps the discount and tip already on the bill.
  const discounted = await request("/api/orders", "POST", order("n12-discounted", { items: [{ menuItemId: 1, quantity: 2 }], discountAmount: "3.00", tipAmount: "2.00" }), owner);
  const discountedId = discounted.body.order.id;
  check((await request(`/api/orders/${discountedId}/edit`, "PATCH", { items: [{ menuItemId: 1, quantity: 3 }] }, owner)).status === 200, "N12: an items-only edit succeeds");
  const afterEdit = (await admin.query("SELECT discount_amount, tip_amount FROM orders WHERE id=$1", [discountedId])).rows[0];
  check(afterEdit.discount_amount === "3.00" && afterEdit.tip_amount === "2.00", `N12: the discount and tip survive an items-only edit (${afterEdit.discount_amount}, ${afterEdit.tip_amount})`);
  // Later checks assert exact stock levels; give back what the probe orders used.
  await admin.query("UPDATE ingredients SET current_stock=$1 WHERE id=1", [p5StockBefore]);
  const { databaseTimeouts } = await import("../src/db/timeouts");
  process.env.POS_DB_STATEMENT_TIMEOUT_MS = "0";
  check((() => { try { databaseTimeouts(); return false; } catch { return true; } })(), "P5: a timeout set to 0 (no limit) is refused, not silently accepted");
  delete process.env.POS_DB_STATEMENT_TIMEOUT_MS;
  check(databaseTimeouts().statement_timeout === 15000 && databaseTimeouts().lock_timeout === 5000, "P5: default limits are 15 s per statement and 5 s per lock wait");
  // --- Owner-selected per-user permissions ----------------------------------
  // A role is only the starting point: the owner may give one person a single
  // extra ability (or take one away) without changing their whole role, and
  // nobody below the owner may touch the selections.
  const permStaff = await request("/api/staff", "POST", { action: "create_employee", name: "Permissions Test", email: "permtest@test.invalid", role: "cashier", password: "Permissions-password-123!", pin: "1212" }, owner);
  check(permStaff.status === 200 && permStaff.body.employee.permissions.canViewReports === false, "a new cashier starts from the role's default permissions");
  const permStaffId = permStaff.body.employee.id;
  const permLogin = await request("/api/auth/login", "POST", { email: "permtest@test.invalid", password: "Permissions-password-123!" });
  check((await request("/api/reports", "GET", undefined, permLogin.cookie)).status === 403, "the cashier cannot read reports before the owner grants it");
  check((await request("/api/staff", "POST", { action: "update_permissions", userId: permStaffId, permissions: { canViewReports: true } }, manager)).status === 403, "a manager cannot select permissions — the owner alone");
  check((await request("/api/staff", "POST", { action: "update_permissions", userId: permStaffId, permissions: { canFly: true } }, owner)).status === 400, "an unknown permission name is refused, not ignored");
  const granted = await request("/api/staff", "POST", { action: "update_permissions", userId: permStaffId, permissions: { canViewReports: true } }, owner);
  check(granted.status === 200 && granted.body.employee.permissions.canViewReports === true && granted.body.employee.permissionOverrides.canViewReports === true, "the owner grants one cashier report access on top of the cashier role");
  check((await request("/api/auth/me", "GET", undefined, permLogin.cookie)).status === 401, "a permission change signs the person out so the new access is what they return to");
  const permLogin2 = await request("/api/auth/login", "POST", { email: "permtest@test.invalid", password: "Permissions-password-123!" });
  check(permLogin2.body.user.permissions.canViewReports === true, "the granted permission arrives with the next sign-in");
  check((await request("/api/reports", "GET", undefined, permLogin2.cookie)).status === 200, "the granted cashier can now read reports");
  const revoked = await request("/api/staff", "POST", { action: "update_permissions", userId: permStaffId, permissions: { canViewReports: false } }, owner);
  check(revoked.status === 200 && revoked.body.employee.permissions.canViewReports === false && Object.keys(revoked.body.employee.permissionOverrides).length === 0, "returning to the role default stores no override");
  const permLogin3 = await request("/api/auth/login", "POST", { email: "permtest@test.invalid", password: "Permissions-password-123!" });
  check((await request("/api/reports", "GET", undefined, permLogin3.cookie)).status === 403, "the revoked permission is refused again");
  check((await request("/api/staff", "POST", { action: "update_permissions", userId: 1, permissions: { canAccessPos: false } }, owner)).status === 400, "an owner account cannot be limited by permission selections");
  const createdWithPermissions = await request("/api/staff", "POST", { action: "create_employee", name: "Tailored Test", email: "tailored@test.invalid", role: "cashier", password: "Tailored-password-123!", pin: "3434", permissions: { canViewReports: true } }, owner);
  check(createdWithPermissions.status === 200 && createdWithPermissions.body.employee.permissions.canViewReports === true, "the owner can select permissions when creating an employee");
  check((await request("/api/staff", "POST", { action: "create_employee", name: "Manager Tailored", email: "mgrtailored@test.invalid", role: "cashier", password: "Tailored-password-123!", pin: "5656", permissions: { canViewReports: true } }, manager)).status === 403, "a manager cannot select permissions at creation either");
  // --- N6: approvals follow the owner's per-person choices, not job titles ---
  // Set directly so nobody's session is revoked mid-suite; restored below.
  const n6Before = (await admin.query("SELECT id, permission_overrides FROM users WHERE id IN (2,3) ORDER BY id")).rows;
  const n6Stock = (await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock;
  const setOverrides = (id: number, value: object) => admin.query("UPDATE users SET permission_overrides=$1 WHERE id=$2", [JSON.stringify(value), id]);
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'refund:%'");
  // The refund route checks the approver before the order, so an unpaid order
  // shows the verdict without moving money: 403 = PIN refused, 409 = PIN accepted
  // (then stopped by the empty refundable balance).
  const unpaid = await request("/api/orders", "POST", order("n6-unpaid-probe"), owner);
  const refundWith = (pin: string) => request(`/api/orders/${unpaid.body.order.id}/refund`, "POST", { amount: "1.00", reason: "N6 probe", managerPin: pin }, owner);
  check((await refundWith("222222")).status === 409, "N6: by default a manager's PIN can approve a refund");
  const shortRefund = await refundWith("2222");
  check(shortRefund.status === 403 && /6 to 8 digits/.test(shortRefund.body.error), "N19: a 4-digit PIN never approves a refund");
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'refund:%'");
  await setOverrides(2, { canApproveRefunds: false });
  check((await refundWith("222222")).status === 403, "N6: a manager the owner barred from approving refunds cannot approve one with their PIN");
  await setOverrides(3, { canApproveRefunds: true });
  check((await refundWith("333333")).status === 409, "N6: a cashier the owner allowed to approve refunds can approve one");
  check((await request("/api/auth/me", "GET", undefined, accountant)).body.permissions?.canApproveRefunds === false, "N6: finance may request refunds but cannot approve them by default");
  await setOverrides(3, { canApplyDiscounts: true });
  check((await request("/api/orders", "POST", order("n6-discount-cashier", { discountAmount: "1.00" }), cashier)).status === 200, "N6: a cashier allowed to give discounts can ring one up");
  await setOverrides(2, { canApplyDiscounts: false });
  check((await request("/api/orders", "POST", order("n6-discount-manager", { discountAmount: "1.00" }), manager)).status === 403, "N6: a manager barred from discounts cannot ring one up");
  for (const row of n6Before) await setOverrides(row.id, row.permission_overrides);
  await admin.query("UPDATE ingredients SET current_stock=$1 WHERE id=1", [n6Stock]);
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'refund:%'");
  // --- N7: every activity-log row names who did it --------------------------
  const actorOf = async (action: string, entityId: number) => (await admin.query(
    "SELECT user_id, user_name FROM audit_logs WHERE action=$1 AND entity_id=$2 ORDER BY id DESC LIMIT 1", [action, String(entityId)])).rows[0];
  const supplier = await request("/api/purchasing/suppliers", "POST", { name: "N7 Supplier", phone: "000" }, inventory);
  const supplierActor = supplier.status === 200 ? await actorOf("supplier_created", supplier.body.supplier?.id ?? supplier.body.id) : null;
  check(supplierActor?.user_id === 5 && supplierActor?.user_name === "Test inventory_officer", "N7: a new supplier is logged with the person who added it");
  const ingredient = await request("/api/inventory", "POST", { action: "create_ingredient", name: "N7 Salt", unit: "kg", currentStock: 1, minStockLevel: 0, costPerUnit: 1 }, inventory);
  const ingredientActor = ingredient.status === 200 ? await actorOf("ingredient_created", ingredient.body.ingredient?.id ?? ingredient.body.id) : null;
  check(ingredientActor?.user_id === 5, "N7: a new ingredient is logged with the person who added it");
  // --- N15: supervising a colleague's shift follows a permission -------------
  // No money moves: the permission check runs before the amount check, so an
  // invalid amount answers 403 when refused and 400 when allowed.
  const ownerShiftId = (await admin.query("SELECT id FROM shifts WHERE branch_id=1 AND user_id=1 AND status='open' ORDER BY id DESC LIMIT 1")).rows[0]?.id;
  check(ownerShiftId, "the owner has an open shift to supervise");
  const n15Before = (await admin.query("SELECT id, permission_overrides FROM users WHERE id IN (2,3) ORDER BY id")).rows;
  const payoutOnOwnerShift = (cookieValue: string) => request("/api/shifts", "POST", { action: "cash_payout", shiftId: ownerShiftId, amount: "-1", reason: "N15 probe" }, cookieValue);
  check((await payoutOnOwnerShift(manager)).status === 400, "N15: by default a manager may supervise a colleague's shift");
  check((await payoutOnOwnerShift(cashier)).status === 403, "N15: by default a cashier may not touch a colleague's shift");
  await admin.query("UPDATE users SET permission_overrides=$1 WHERE id=2", [JSON.stringify({ canManageOthersShifts: false })]);
  check((await payoutOnOwnerShift(manager)).status === 403, "N15: a manager the owner barred cannot record payouts on a colleague's shift");
  check((await request("/api/shifts", "POST", { action: "close_shift", shiftId: ownerShiftId, actualClosingCash: "0" }, manager)).status === 403, "N15: nor close it");
  await admin.query("UPDATE users SET permission_overrides=$1 WHERE id=3", [JSON.stringify({ canManageOthersShifts: true })]);
  check((await payoutOnOwnerShift(cashier)).status === 400, "N15: a cashier the owner allowed may supervise a colleague's shift");
  check((await request("/api/auth/me", "GET", undefined, cashier)).body.permissions?.canManageOthersShifts === true, "N15: the drawer screen sees the same permission");
  for (const row of n15Before) await admin.query("UPDATE users SET permission_overrides=$1 WHERE id=$2", [JSON.stringify(row.permission_overrides), row.id]);
  check((await admin.query("SELECT status FROM shifts WHERE id=$1", [ownerShiftId])).rows[0].status === "open", "N15: the probes left the owner's shift open and untouched");
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
  const cashierShiftOpen = await request("/api/shifts", "POST", { action: "open_shift", openingCash: "0.00" }, cashier);
  check(cashierShiftOpen.status === 200, "cashier opens their own shift before selling");
  const managerShiftOpen = await request("/api/shifts", "POST", { action: "open_shift", openingCash: "0.00" }, manager);
  check(managerShiftOpen.status === 200, "manager opens their own shift before refunding");
  const pay = await Promise.all([1,2].map(() => request(`/api/orders/${id}/pay`, "POST", { paymentMethod: "split", amount: "10", cashAmount: "4", momoAmount: "6" }, cashier)));
  check(pay.filter(r => r.status === 200).length === 1 && pay.filter(r => r.status === 409).length === 1, "concurrent payments cannot overpay");
  check(Number((await admin.query("SELECT sum(amount) AS amount FROM payments WHERE order_id=$1", [id])).rows[0].amount) === 10, "split payment ledger equals sale total");
  const tenderDetail = await request(`/api/orders/${id}`, "GET", undefined, cashier);
  check(tenderDetail.body.order.paymentBreakdown?.cash === "4.00" && tenderDetail.body.order.paymentBreakdown?.momo === "6.00" && tenderDetail.body.order.paymentBreakdown?.other === "0.00", "order details split paid money into cash and MoMo");
  check(Array.isArray(tenderDetail.body.order.paymentBreakdown?.payments) && tenderDetail.body.order.paymentBreakdown.payments.length === 2, "order details list each payment received");
  for (const amount of ["-1", "0", "NaN", "0.001", "1e2"]) check((await request(`/api/orders/${id}/refund`, "POST", { amount, reason: "Test", managerPin: "222222" }, manager)).status === 400, `refund rejects ${amount}`);
  await admin.query("DELETE FROM auth_attempts WHERE key='refund:branch:1'");
  check((await request(`/api/orders/${id}/refund`, "POST", { amount: "1", reason: "Test", managerPin: "888888" }, manager)).status === 403, "other-branch manager cannot authorize refund");
  check((await counter("refund:branch:1")) === 1, "a wrong manager PIN counts once against the refund key");
  check((await request(`/api/orders/${id}/refund`, "POST", { amount: "4", reason: "Partial", managerPin: "222222", returnStock: true }, manager)).status === 400, "partial refund cannot restore all stock");
  const partial = await request(`/api/orders/${id}/refund`, "POST", { amount: "4", reason: "Partial", managerPin: "222222" }, manager);
  check(partial.status === 200, "partial refund succeeds");
  check((await counter("refund:branch:1")) === 1, "an approved refund is not counted against the refund key");
  // N13: wrong approver PINs lock out the person asking, not the whole branch.
  const lockKey = (key: string, count: number) => admin.query(
    "INSERT INTO auth_attempts (key, count, reset_at) VALUES ($1, $2, now()+interval '15 minutes') ON CONFLICT (key) DO UPDATE SET count=$2, reset_at=now()+interval '15 minutes'", [key, count]);
  check((await counter("refund:user:2")) === 1, "N13: the wrong PIN also counted against the person asking");
  await lockKey("refund:user:2", 10);
  check((await request(`/api/orders/${id}/refund`, "POST", { amount: "1", reason: "Test", managerPin: "222222" }, manager)).status === 429, "a person locked out by wrong approver PINs is refused even with a valid one");
  // 999 passes approval and is then refused for exceeding the balance (409), so no money moves.
  check((await request(`/api/orders/${id}/refund`, "POST", { amount: "999", reason: "Test", managerPin: "222222" }, owner)).status === 409, "N13: a colleague can still get refunds approved");
  await lockKey("refund:branch:1", 40);
  check((await request(`/api/orders/${id}/refund`, "POST", { amount: "999", reason: "Test", managerPin: "222222" }, owner)).status === 429, "N13: the branch-wide backstop still stops guessing across many people");
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'refund:%'");
  // N13 (quick switch): same rule. pinStaff's PIN is 6677.
  check((await request("/api/auth/switch-pin", "POST", { pin: "0000" }, cashier)).status === 401 && (await counter("pin:user:3")) >= 1, "N13: a wrong switch PIN counts against the person typing");
  await lockKey("pin:user:3", 10);
  check((await request("/api/auth/switch-pin", "POST", { pin: "6677" }, cashier)).status === 429, "N13: that person is locked out of quick switch");
  check((await request("/api/auth/switch-pin", "POST", { pin: "6677" }, manager)).status === 200, "N13: other people at the branch can still switch");
  await lockKey("pin:branch:1", 40);
  check((await request("/api/auth/switch-pin", "POST", { pin: "6677" }, manager)).status === 429, "N13: the branch-wide switch backstop still applies");
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'pin:%'");
  check((await admin.query("SELECT payment_status FROM orders WHERE id=$1", [id])).rows[0].payment_status === "partially_refunded", "partial refund preserves distinct state");
  // Change recipe after sale: restoration must use original ledger.
  await admin.query("UPDATE recipe_ingredients SET quantity=9 WHERE recipe_id=1");
  const refund = await Promise.all([1,2].map(() => request(`/api/orders/${id}/refund`, "POST", { amount: "6", cashAmount: "0.00", momoAmount: "6.00", reason: "Remaining", managerPin: "222222", returnStock: true }, manager)));
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
  const beforeFaultPayouts = (await admin.query("SELECT cash_payouts FROM shifts WHERE branch_id=1 AND status='open' AND user_id=2")).rows[0].cash_payouts;
  const beforeFaultStock = (await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock;
  await admin.query(`CREATE FUNCTION test_refund_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'order_refunded' THEN RAISE EXCEPTION 'Injected late audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_refund_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_refund_fault();`);
  const fault = await request(`/api/orders/${faultId}/refund`, "POST", { amount: "10", reason: "Failure injection", managerPin: "222222", returnStock: true }, manager);
  check(fault.status === 500 && !JSON.stringify(fault.body).includes("Injected"), "late refund failure returns no database internals");
  check((await admin.query("SELECT id FROM refunds WHERE order_id=$1", [faultId])).rowCount === 0, "failed refund rolls back refund ledger");
  check((await admin.query("SELECT payment_status FROM orders WHERE id=$1", [faultId])).rows[0].payment_status === "paid", "failed refund rolls back order state");
  check((await admin.query("SELECT current_stock FROM ingredients WHERE id=1")).rows[0].current_stock === beforeFaultStock, "failed refund rolls back stock restoration");
  check((await admin.query("SELECT cash_payouts FROM shifts WHERE branch_id=1 AND status='open' AND user_id=2")).rows[0].cash_payouts === beforeFaultPayouts, "failed refund rolls back drawer aggregate");
  check((await admin.query("SELECT dm.id FROM drawer_movements dm JOIN refunds r ON r.id=dm.refund_id WHERE r.order_id=$1", [faultId])).rowCount === 0, "failed refund leaves no drawer movement");
  await admin.query("DROP TRIGGER test_refund_fault ON audit_logs; DROP FUNCTION test_refund_fault()");
  // An accountant has no shift of their own: their cash refund is authorised
  // by the manager's PIN and paid out of the manager's open shift.
  const acctOrder = await request("/api/orders", "POST", order("accountant-refund-order"), cashier);
  const acctOrderId = acctOrder.body.order.id;
  await request(`/api/orders/${acctOrderId}/pay`, "POST", { paymentMethod: "cash", amount: "10" }, cashier);
  const acctRefund = await request(`/api/orders/${acctOrderId}/refund`, "POST", { amount: "4", cashAmount: "4", momoAmount: "0.00", reason: "Accountant cash refund", managerPin: "222222" }, accountant);
  check(acctRefund.status === 200, "accountant cash refund succeeds via the approving manager's shift");
  check(Number((await admin.query("SELECT user_id FROM shifts WHERE id=(SELECT shift_id FROM refunds WHERE order_id=$1)", [acctOrderId])).rows[0].user_id) === 2, "accountant cash refund is recorded on the manager's shift");
  const branchWrites = await Promise.all([
    request("/api/orders", "POST", order("branch-one-parallel"), cashier),
    request("/api/orders", "POST", order("branch-two-parallel", { items: [{ menuItemId: 2, quantity: 1 }] }), other),
  ]);
  check(branchWrites[0].body.order.branchId === 1 && branchWrites[1].body.order.branchId === 2, "parallel requests do not leak branch context");
  check((await request("/api/staff", "POST", { action: "toggle_active", userId: 7, isActive: false }, owner)).status === 404, "owner cannot change staff in another branch");
  check((await request("/api/staff", "POST", { action: "delete_user", userId: 7 }, owner)).status === 404, "owner cannot remove staff in another branch");

  // A database outage must never read as a password problem: on 12 October a
  // .env/role mismatch answered "Request failed" everywhere, and the owner
  // asked how to reset the admin password. The messages are pure functions,
  // so they are asserted directly.
  check(/rejected the app's login/i.test(String(databaseUnreachableMessage("28P01", 'password authentication failed for user "pos_runtime"'))), "a refused database login is explained as the app's connection, not the user's password");
  check(/does not exist/i.test(String(databaseUnreachableMessage("3D000", 'database "pos" does not exist'))), "a missing database is named as such");
  check(/not answering/i.test(String(databaseUnreachableMessage("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:5432"))), "a database service that is down is named as such");
  check(databaseUnreachableMessage("42703", 'column "x" does not exist') === null && databaseUnreachableMessage("23505", "duplicate key value violates unique constraint") === null, "ordinary query errors are not mislabelled as connection failures");

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
  // A removed account stays closed: no other staff action may bring it back.
  // (A manager once could reset the password and switch the account on again,
  // and the roster hid it while the login worked.)
  check((await request("/api/staff", "POST", { action: "reset_password", userId: removableId, password: "Revived-password-123!" }, manager)).status === 409, "manager cannot reset a removed account's password");
  check((await request("/api/staff", "POST", { action: "toggle_active", userId: removableId, isActive: true }, manager)).status === 409, "manager cannot reactivate a removed account");
  check((await request("/api/staff", "POST", { action: "update_pin", userId: removableId, pin: "2468" }, owner)).status === 409, "owner cannot set a PIN on a removed account");
  check((await request("/api/auth/login", "POST", { email: removedRow.email, password: "Revived-password-123!" })).status === 401, "removed account still cannot sign in after the refused attempts");
  check((await request("/api/staff", "POST", { action: "create_employee", name: "Rehired Test", email: "removeme@test.invalid", role: "cashier", password: "Rehire-password-123!", pin: "8383" }, owner)).status === 200, "the freed email and PIN can be used by a new account");
  check((await request("/api/health")).status === 200, "public health endpoint works without scoped data access");
  // F7: health says which code is running: the commit this build was made from.
  const builtFrom = execSync("git rev-parse --short HEAD").toString().trim();
  const healthBody = (await request("/api/health")).body;
  check(healthBody.ok === true && healthBody.commit === builtFrom, `F7: /api/health reports the running commit (${healthBody.commit}, built from ${builtFrom})`);
  check((await request("/api/orders", "POST", order("bad-origin"), cashier, { Origin: "https://attacker.invalid" })).status === 403, "cross-origin mutation rejected");
  // --- P6: password and PIN checks must not freeze the server ----------------
  const asyncHash = await hashPasswordAsync("Shift-change-1234");
  check(verifyPassword("Shift-change-1234", asyncHash) && await verifyPasswordAsync("Shift-change-1234", hashPassword("Shift-change-1234")),
    "P6: async and blocking hashes are interchangeable, so every stored password and PIN still verifies");
  check(!(await verifyPasswordAsync("wrong-password", asyncHash)) && !(await verifyPasswordAsync("x".repeat(300), asyncHash)) && !(await verifyPasswordAsync("a", "not-a-hash")),
    "P6: the async check refuses wrong, oversized and malformed input");
  const legacySalt = "0123456789abcdef";
  check(await verifyPasswordAsync("Legacy-pass-1", `${legacySalt}:${pbkdf2Sync("Legacy-pass-1", legacySalt, 10000, 64, "sha512").toString("hex")}`),
    "P6: legacy PBKDF2 hashes still verify asynchronously");
  let ticks = 0;
  const ticker = setInterval(() => { ticks++; }, 10);
  await Promise.all([1, 2, 3, 4].map(() => verifyPasswordAsync("Shift-change-1234", asyncHash)));
  clearInterval(ticker);
  check(ticks >= 2, `P6: other work keeps running while four password checks are in progress (${ticks} timer ticks)`);
  const signed = createToken({ id: 3, sessionVersion: 0 });
  check(verifyToken(signed)?.id === 3 && verifyToken(signed + "tampered") === null, "token verification rejects tampering");
  const data = Buffer.from(JSON.stringify({ id: 3, version: 0, iat: 1, exp: 2 })).toString("base64url");
  const expired = `${data}.${createHmac("sha256", process.env.AUTH_SECRET!).update(data).digest("base64url")}`;
  check((await request("/api/menu", "GET", undefined, `pos_session=${expired}`)).status === 401, "server rejects correctly signed expired token");
  // --- P4: an active session renews itself; nothing outlives 16 h ------------
  const forge = (claims: Record<string, number>) => {
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return `pos_session=${body}.${createHmac("sha256", process.env.AUTH_SECRET!).update(body).digest("base64url")}`;
  };
  const claimsOf = (cookie: string) => JSON.parse(Buffer.from(cookie.replace("pos_session=", "").split(".")[0], "base64url").toString());
  const ownerVersion = Number((await admin.query("SELECT session_version FROM users WHERE id=1")).rows[0].session_version);
  const nowS = Math.floor(Date.now() / 1000), hour = 3600;
  const freshMe = await request("/api/auth/me", "GET", undefined, owner);
  check(freshMe.status === 200 && !freshMe.cookie, "P4: a session under an hour old is not renewed");
  const aged = forge({ id: 1, version: ownerVersion, iat: nowS - 2 * hour, auth: nowS - 2 * hour, exp: nowS + 6 * hour });
  const renewedMe = await request("/api/auth/me", "GET", undefined, aged);
  const renewedClaims = renewedMe.cookie ? claimsOf(renewedMe.cookie) : null;
  check(renewedMe.status === 200 && renewedClaims && renewedClaims.iat >= nowS && renewedClaims.exp >= nowS + 8 * hour - 5 && renewedClaims.auth === nowS - 2 * hour,
    "P4: a two-hour-old session gets a fresh 8-hour cookie that keeps the original sign-in time");
  check(/HttpOnly/.test(renewedMe.headers.get("set-cookie") || "") && /SameSite=Lax/.test(renewedMe.headers.get("set-cookie") || "") && /Secure/.test(renewedMe.headers.get("set-cookie") || ""), "P4: the renewed cookie keeps HttpOnly, SameSite and Secure");
  check((await request("/api/menu", "GET", undefined, renewedMe.cookie)).status === 200, "P4: the renewed cookie works");
  const legacy = forge({ id: 1, version: ownerVersion, iat: nowS - 2 * hour, exp: nowS + 6 * hour });
  const legacyMe = await request("/api/auth/me", "GET", undefined, legacy);
  check(legacyMe.status === 200 && claimsOf(legacyMe.cookie).auth === nowS - 2 * hour, "P4: a token from before renewal treats its issue time as the sign-in time");
  const nearCap = forge({ id: 1, version: ownerVersion, iat: nowS - 2 * hour, auth: nowS - 16 * hour + 600, exp: nowS + 600 });
  const nearCapMe = await request("/api/auth/me", "GET", undefined, nearCap);
  check(nearCapMe.status === 200 && claimsOf(nearCapMe.cookie).exp <= nowS - 16 * hour + 600 + 16 * hour && /Max-Age=(\d+)/.test(nearCapMe.headers.get("set-cookie") || "") && Number(/Max-Age=(\d+)/.exec(nearCapMe.headers.get("set-cookie") || "")![1]) <= 600,
    "P4: renewal never extends a session past 16 hours from sign-in");
  const pastCap = forge({ id: 1, version: ownerVersion, iat: nowS - hour, auth: nowS - 16 * hour - 60, exp: nowS + 7 * hour });
  check((await request("/api/auth/me", "GET", undefined, pastCap)).status === 401, "P4: a session more than 16 hours past sign-in is refused, however recently renewed");
  await admin.query("UPDATE users SET role='accountant' WHERE id=3");
  check((await request("/api/orders", "GET", undefined, cashier)).status === 200, "a token downgraded to finance keeps only the read-only history");
  check((await request("/api/orders", "POST", order("downgraded-to-finance"), cashier)).status === 403, "existing token immediately reflects role downgrade (the till is refused)");
  await admin.query("UPDATE users SET is_active=false WHERE id=3");
  check((await request("/api/menu", "GET", undefined, cashier)).status === 401, "deactivated user loses existing session access");
  check((await request("/api/auth/logout", "POST", {}, manager)).status === 200, "logout succeeds");
  check((await request("/api/menu", "GET", undefined, manager)).status === 401, "copied session is revoked by logout");
  let limited = 0;
  for (let i=0; i<11; i++) limited = (await request("/api/auth/login", "POST", { email: "unknown@test.invalid", password: "wrong" })).status;
  check(limited === 429, "login throttling persists across failed request rollbacks");
  // Only wrong credentials count. Successful sign-ins never lock a busy venue out,
  // and a locked account refuses even the right password until the window passes.
  const ownerLogin = { email: "user1@test.invalid", password: "Test-password-only-123!" };
  await admin.query("DELETE FROM auth_attempts WHERE key='email:user1@test.invalid'");
  let successes = 0;
  for (let i = 0; i < 12; i++) if ((await request("/api/auth/login", "POST", ownerLogin)).status === 200) successes++;
  check(successes === 12 && (await counter("email:user1@test.invalid")) === 0, "twelve successful sign-ins are never throttled or counted");
  check((await request("/api/auth/login", "POST", { ...ownerLogin, password: "wrong-password-123" })).status === 401 && (await counter("email:user1@test.invalid")) === 1, "a wrong password counts once");
  check((await counter("email:user1@test.invalid:ip:direct")) === 1 && (await counter("login:ip:direct")) >= 1, "a wrong password also counts against the account-from-this-address and address keys");
  const lock = (key: string, count: number) => admin.query(
    "INSERT INTO auth_attempts (key, count, reset_at) VALUES ($1, $2, now()+interval '15 minutes') ON CONFLICT (key) DO UPDATE SET count=$2, reset_at=now()+interval '15 minutes'", [key, count]);
  await lock("email:user1@test.invalid:ip:direct", 10);
  check((await request("/api/auth/login", "POST", ownerLogin)).status === 429, "a locked account refuses the right password from the locked address");
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'email:user1@test.invalid%'");
  check((await request("/api/auth/login", "POST", ownerLogin)).status === 200, "the account opens again once the lock is cleared");
  // P2: nobody can lock the whole restaurant out. A flood of failures site-wide,
  // or against one account from somewhere else, must not stop staff signing in.
  const venue = { "X-Real-IP": "198.51.100.7" }, attacker = { "X-Real-IP": "203.0.113.9" };
  await lock("login:global", 100000);
  check((await request("/api/auth/login", "POST", ownerLogin, "", venue)).status === 200, "P2: a site-wide failure flood never refuses a correct login");
  await admin.query("DELETE FROM auth_attempts WHERE key='login:global'");
  await lock("email:user1@test.invalid:ip:203.0.113.9", 10);
  check((await request("/api/auth/login", "POST", ownerLogin, "", attacker)).status === 429, "P2: the address that guessed an account is locked out of it");
  check((await request("/api/auth/login", "POST", ownerLogin, "", venue)).status === 200, "P2: that lock does not reach the same account from another address");
  await lock("login:ip:203.0.113.9", 30);
  check((await request("/api/auth/login", "POST", { email: "user2@test.invalid", password: "Test-password-only-123!" }, "", attacker)).status === 429, "P2: an address spraying many accounts is refused for every account");
  check((await request("/api/auth/login", "POST", { email: "user2@test.invalid", password: "Test-password-only-123!" }, "", venue)).status === 200, "P2: other addresses keep signing in");
  await lock("email:user1@test.invalid", 50);
  check((await request("/api/auth/login", "POST", ownerLogin, "", venue)).status === 429, "an account guessed from many addresses hits its overall backstop");
  await admin.query("DELETE FROM auth_attempts WHERE key LIKE 'email:user1@test.invalid%' OR key LIKE 'email:user2@test.invalid%' OR key LIKE 'login:%'");
  check((await request("/api/auth/login", "POST", ownerLogin)).status === 200, "the account opens again once the backstop is cleared");
  const runtime = new Pool({ connectionString: process.env.DATABASE_URL });
  try { check((await runtime.query("SELECT * FROM orders")).rowCount === 0, "runtime DB connection without request scope sees no orders"); } finally { await runtime.end(); }
  // --- A database that has not been migrated must say so, not fail randomly --
  // Order deletion once answered a bare "Request failed" for hours because the
  // code expected a column the database did not have yet. The app now names the
  // missing update, and /api/health reports it, so a stale environment is
  // diagnosable from the first request instead of from a log hunt.
  // A seeded installation refuses sales until the owner saves the VAT rate.
  await admin.query("INSERT INTO application_settings(branch_id,key,value) VALUES(1,'tax_rate_confirmed','false')");
  const unconfirmed = await request("/api/orders", "POST", order("tax-unconfirmed"), owner);
  check(unconfirmed.status === 409 && /VAT rate/.test(String(unconfirmed.body.error)), "a sale is refused until the VAT rate has been saved");
  check((await admin.query("SELECT count(*)::int AS n FROM orders WHERE idempotency_key='tax-unconfirmed'")).rows[0].n === 0, "the refused sale leaves no order behind");
  const restaurant = (await request("/api/settings", "GET", undefined, owner)).body.restaurant;
  check((await request("/api/settings", "POST", { restaurantData: restaurant }, owner)).status === 200, "the owner saves the VAT rate in Settings");
  check((await admin.query("SELECT value FROM application_settings WHERE branch_id=1 AND key='tax_rate_confirmed'")).rows[0].value === "true", "saving the rate confirms it");
  check((await request("/api/orders", "POST", order("tax-confirmed"), owner)).status === 200, "a sale rings up once the rate is saved");
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
  // The pay route catches its own errors, so it used to hide this explanation
  // behind "Could not record the payment". A refused payment must name the
  // missing column and take no money.
  const driftedPay = await request(`/api/orders/${driftSale.body.order.id}/pay`, "POST", { amount: "1.00", paymentMethod: "cash", cashTendered: "1.00", idempotencyKey: "drift-pay-probe-1" }, owner);
  check(driftedPay.status === 503, `a payment during the drift answers 503, not a generic 500 (${driftedPay.status})`);
  check(/idempotency_key/.test(String(driftedPay.body.error)) && /db:migrate/.test(String(driftedPay.body.error)), "the payment refusal names the missing column and the command that fixes it");
  check(Number((await admin.query("SELECT paid_amount FROM orders WHERE id=$1", [driftSale.body.order.id])).rows[0].paid_amount) === 0, "the refused payment took no money");
  const driftedHealth = await request("/api/health");
  check(driftedHealth.status === 503 && driftedHealth.body.reason === "schema-behind" && !JSON.stringify(driftedHealth.body).includes("idempotency_key") && !("missing" in driftedHealth.body) && !("database" in driftedHealth.body) && driftedHealth.body.commit === builtFrom, "public health reports the schema gap and the commit, without naming tables, columns or the database");
  await admin.query(await readFile("migrations/0004_payment_idempotency.sql", "utf8"));
  check((await request("/api/health")).status === 200, "running the migration returns the app to healthy");
  check((await request(`/api/orders/${driftId}`, "DELETE", {}, owner)).status === 200, "and the work that was refused now succeeds");
  check((await request(`/api/orders/${driftSale.body.order.id}`, "DELETE", {}, owner)).status === 200, "the sale rung up during the drift erases too");
  check(Number((await admin.query("SELECT count(*)::int AS c FROM information_schema.columns WHERE table_name='payments' AND column_name='idempotency_key'")).rows[0].c) === 1, "the re-applied migration restored the column");
  const shift = (await request("/api/shifts", "GET", undefined, owner)).body.activeShift;
  const expected = Number(shift.openingCash) + Number(shift.totalCashSales) - Number(shift.cashPayouts);
  check((await request("/api/shifts", "POST", { action: "close_shift", shiftId: shift.id, actualClosingCash: expected.toFixed(2) }, owner)).status === 200, "security fixture closes register");
  // Per-staff shifts: colleagues hold shifts simultaneously, drawer state is
  // per caller, and only a shift's cashier — or a manager — can close it.
  // (Fixture user 3 was deliberately deactivated above, so hire a fresh one.)
  const hire = await request("/api/staff", "POST", { action: "create_employee", name: "Shift Colleague", email: "shiftmate@test.invalid", role: "cashier", password: "Shiftmate-password-123!", pin: "9911" }, owner);
  check(hire.status === 200, "owner creates a second cashier for the shift checks");
  const mate = (await request("/api/auth/login", "POST", { email: "shiftmate@test.invalid", password: "Shiftmate-password-123!" })).cookie;
  const mateOpen = await request("/api/shifts", "POST", { action: "open_shift", openingCash: "30.00" }, mate);
  check(mateOpen.status === 200, "a colleague opens a shift while another staff shift is open");
  const mateShift = mateOpen.body.shift;
  check((await request("/api/shifts", "GET", undefined, mate)).body.activeShift.id === mateShift.id, "drawer state shows each cashier their own shift");
  const ownerShift2 = await request("/api/shifts", "POST", { action: "open_shift", openingCash: "20.00" }, owner);
  check(ownerShift2.status === 200 && ownerShift2.body.shift.id !== mateShift.id, "a second staff member opens a shift while a colleague's is open");
  check(((await request("/api/shifts", "GET", undefined, owner)).body.openShifts || []).length >= 2, "till roles can list every open shift");
  check((await request("/api/shifts", "POST", { action: "open_shift", openingCash: "5.00" }, mate)).status === 400, "one open shift per staff member");
  check((await request("/api/shifts", "POST", { action: "close_shift", shiftId: ownerShift2.body.shift.id, actualClosingCash: "20.00" }, mate)).status === 403, "cashier cannot close a colleague's shift");
  const managerFresh = await login(2);
  check((await request("/api/shifts", "POST", { action: "close_shift", shiftId: mateShift.id, actualClosingCash: "30.00" }, managerFresh)).status === 200, "manager can close a cashier's shift");
  await request("/api/shifts", "POST", { action: "close_shift", shiftId: ownerShift2.body.shift.id, actualClosingCash: "20.00" }, owner);
  console.log(`\n${checks} security checks passed against disposable PostgreSQL.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => admin.end());
