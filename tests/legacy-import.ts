/**
 * End-to-end test for scripts/import-restpos.ts against a disposable database.
 * Builds a tiny synthetic legacy SQLite fixture (never the real business backup),
 * imports it twice, and asserts mappings, credential hygiene, and idempotency.
 *
 * Run: npx tsx tests/legacy-import.ts
 */
import EmbeddedPostgres from "embedded-postgres";
import { Pool, type PoolClient } from "pg";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { hashPassword, pinDigest, verifyPassword } from "../src/lib/auth";

const failures: string[] = [];
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures.push(label); console.error(`  ✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`); }
}
async function run(command: string, args: string[], env = process.env) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "inherit"], env });
    let out = "";
    child.stdout?.on("data", d => { out += String(d); });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${command} failed (${code})\n${out}`)));
  });
}
function buildFixture(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE rest_company (id INTEGER, name TEXT);
    CREATE TABLE rest_category (id INTEGER, name TEXT, sequence INTEGER, enable INTEGER);
    CREATE TABLE rest_item (id INTEGER, categoryid INTEGER, name TEXT, price REAL, cost REAL, enable INTEGER, barCode TEXT, description TEXT, takeOutPrice REAL, deliveryPrice REAL);
    CREATE TABLE rest_table (id INTEGER, name TEXT);
    CREATE TABLE rest_table_group (id INTEGER, name TEXT);
    CREATE TABLE rest_user (id INTEGER, account TEXT, password TEXT, role INTEGER);
    CREATE TABLE rest_order (id INTEGER, orderTime TEXT, endTime TEXT, orderNum TEXT, invoiceNum TEXT, tableName TEXT,
      customerName TEXT, customerPhone TEXT, orderType INTEGER, status INTEGER, cashierName TEXT, waiterName TEXT,
      cancelReason TEXT, subTotal REAL, discountAmt REAL, discountReason TEXT, serviceAmt REAL, amount REAL,
      tax1TotalAmt REAL, tax2TotalAmt REAL, tax3TotalAmt REAL);
    CREATE TABLE rest_order_item (id INTEGER, orderId INTEGER, itemId INTEGER, itemName TEXT, price REAL, cost REAL,
      qty REAL, remark TEXT, orderTime TEXT, cancelReason TEXT, status INTEGER);
    CREATE TABLE rest_order_payment (id INTEGER, orderId INTEGER, amount REAL, paidAmt REAL, changeAmt REAL,
      paymentTime TEXT, paymentMethodName TEXT, transactionRequestId TEXT, cashierName TEXT, gratuityAmount REAL, status INTEGER);
    CREATE TABLE inventory_item (id INTEGER, itemName TEXT, purchaseUnit TEXT, stockUnit TEXT, warmQty REAL, categoryId INTEGER, locationId INTEGER);
    CREATE TABLE inventory_category (id INTEGER, name TEXT);
    CREATE TABLE inventory_vendor (id INTEGER, contactPerson TEXT, companyName TEXT, phone TEXT, email TEXT, address TEXT);
    CREATE TABLE rest_customer (id INTEGER, name TEXT, tel TEXT, memberTypeId INTEGER);
    CREATE TABLE rest_member_type (id INTEGER, name TEXT);`);
  const ins = (sql: string, rows: unknown[][]) => { for (const r of rows) db.prepare(sql).run(...(r as never[])); };
  ins("INSERT INTO rest_company VALUES (1,'Test Lodge')", [[]]);
  ins("INSERT INTO rest_category VALUES (?,?,?,1)", [[1, "MAIN", 1], [2, "DRINKS ", 2]]);
  ins("INSERT INTO rest_item VALUES (?,?,?,?,?,1,'','',0,0)", [
    [10, 1, "Jollof", 65, 20], [11, 2, "Water", 5, 1],
  ]);
  ins("INSERT INTO rest_table VALUES (?,?)", [[1, "101"], [2, "102"]]);
  ins("INSERT INTO rest_table_group VALUES (1,'First floor')", [[]]);
  ins("INSERT INTO rest_user VALUES (?,?,'plaintext-old',?)", [
    [1, "Admin", 0], [2, "Waiter One", 3],
  ]);
  ins(`INSERT INTO rest_order VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    [1, "2026-01-05 12:00", "2026-01-05 12:30", "00001", "00001", "101", "None", "None", 0, 1, "Admin", "Waiter One", "None", 65, 0, "None", 0, 65, 0, 0, 0],
    [2, "2026-01-06 18:00", "2026-01-06 18:20", "00002", "00002", "Bar", "None", "None", 3, 1, "WAITER ONE", "Waiter One", "None", 10, 0, "None", 1, 11, 0, 0, 0],
    [3, "2026-01-07 13:00", "2026-01-07 13:05", "00003", "00003", "Takeout", "None", "None", 1, 2, "Ghost Person", "Ghost Person", "customer left", 5, 0, "None", 0, 5, 0, 0, 0],
    [4, "2026-01-08 19:00", "2026-01-08 19:10", "00004", "00004", "102", "None", "None", 0, 0, "None", "None", "None", 7.5, 0, "None", 0, 7.5, 0, 0, 0],
  ]);
  ins("INSERT INTO rest_order_item VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
    [1, 1, 10, "Jollof", 65, 20, 1, "None", "2026-01-05 12:00", "None", 0],
    [2, 2, 11, "Water", 5, 1, 2, "extra ice", "2026-01-06 18:00", "None", 0],
    [3, 2, 99, "Gone Item", 1, 0, 1, "None", "2026-01-06 18:00", "wrong order", 1],
    [4, 3, 11, "Water", 5, 1, 1, "None", "2026-01-07 13:00", "None", 0],
    [5, 4, 10, "Jollof", 65, 20, 0.115, "None", "2026-01-08 19:00", "None", 0],
  ]);
  ins("INSERT INTO rest_order_payment VALUES (?,?,?,?,?,?,?,?,?,?,?)", [
    [1, 1, 65, 65, 0, "2026-01-05 12:30", "Cash", "None", "Admin", 0, 0],
    [2, 2, 11, 20, 9, "2026-01-06 18:20", "Mobile Money", "MM-7788", "WAITER ONE", 2, 0],
    [3, 3, 5, 5, 0, "2026-01-07 13:05", "Card", "AUTH1", "Ghost Person", 0, 0],
  ]);
  ins("INSERT INTO inventory_category VALUES (1,'Meat')", [[]]);
  ins("INSERT INTO inventory_item VALUES (?,?,?,?,?,?,?)", [[1, "Chicken", "Kilogram", "Kilogram", 10, 1, 1]]);
  ins("INSERT INTO inventory_vendor VALUES (?,?,?,?,?,?)", [[1, "Mr. Supplier", "Demo Supplier", "123", "v@x.com", "Addr"]]);
  ins("INSERT INTO rest_customer VALUES (?,?,?,?)", [[1, "Steven", "233", 1]]);
  ins("INSERT INTO rest_member_type VALUES (?,?)", [[1, "Reward Card"]]);
  db.close();
}

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "pos-legacy-import-"));
  const fixture = join(dir, "fixture.db");
  const password = randomBytes(24).toString("hex");
  const port = 15433;
  const secret = randomBytes(48).toString("hex");
  process.env.AUTH_SECRET = secret;
  buildFixture(fixture);
  const pg = new EmbeddedPostgres({ databaseDir: join(dir, "pgdata"), user: "postgres", password, port, persistent: false,
    postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: msg => { if (String(msg).includes("FATAL")) console.error(msg); } });
  let admin: Pool | undefined;
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase("legacy_import_test");
    const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/legacy_import_test`;
    admin = new Pool({ connectionString: adminUrl });
    await run("node_modules/.bin/tsx", ["scripts/migrate.ts"], { ...process.env, MIGRATION_DATABASE_URL: adminUrl });
    // Baseline identical to production bootstrap: restaurant, branch, owner.
    const client: PoolClient = await admin.connect();
    const restaurant = (await client.query("INSERT INTO restaurants(name,currency,currency_symbol,default_tax_rate) VALUES('Test Lodge','GHS','GH₵','0.00') RETURNING id")).rows[0].id;
    const branch = (await client.query("INSERT INTO branches(restaurant_id,name,code) VALUES($1,'Main Branch','MAIN') RETURNING id", [restaurant])).rows[0].id;
    await client.query("INSERT INTO users(restaurant_id,branch_id,name,email,password_hash,role) VALUES($1,$2,'Owner','owner@test.invalid',$3,'super_admin')", [restaurant, branch, hashPassword("Owner-password-123!")]);
    client.release();

    const env = { ...process.env, MIGRATION_DATABASE_URL: adminUrl, AUTH_SECRET: secret };
    const credsFile = join(dir, "pins.csv");
    console.log("Running importer (first pass)…");
    await run("node_modules/.bin/tsx", ["scripts/import-restpos.ts", "--source", fixture, "--apply", "--credentials-out", credsFile], env);

    console.log("Assertions after first import:");
    const one = async (q: string) => (await admin!.query(q)).rows[0] as Record<string, never>;
    check("2 categories", (await one("SELECT COUNT(*)::int n FROM menu_categories")).n === 2);
    check("3 menu items (2 + 1 disabled stub)", (await one("SELECT COUNT(*)::int n FROM menu_items")).n === 3);
    check("stub item is disabled", (await one("SELECT is_available FROM menu_items WHERE name='Gone Item'")).is_available === false);
    check("station mapping: Water → bar", (await one("SELECT station FROM menu_items WHERE name='Water'")).station === "bar");
    check("4 dining tables incl. Bar & Takeout", (await one("SELECT COUNT(*)::int n FROM dining_tables")).n === 4);
    check("4 orders", (await one("SELECT COUNT(*)::int n FROM orders")).n === 4);
    check("order numbers use OLD- prefix", (await one("SELECT COUNT(*)::int n FROM orders WHERE order_number LIKE 'OLD-%'")).n === 4);
    check("1 completed + 1 completed + 1 cancelled + 1 draft", (await one("SELECT COUNT(*)::int n FROM orders WHERE status='completed'")).n === 2
      && (await one("SELECT COUNT(*)::int n FROM orders WHERE status='cancelled'")).n === 1
      && (await one("SELECT COUNT(*)::int n FROM orders WHERE status='draft'")).n === 1);
    check("paid order settled (65.00)", (await one("SELECT payment_status, paid_amount FROM orders WHERE order_number='OLD-00001'")).paid_amount === "65.00");
    check("cancelled order with payment → refunded", (await one("SELECT payment_status FROM orders WHERE order_number='OLD-00003'")).payment_status === "refunded");
    check("open order → draft/unpaid", (await one("SELECT payment_status FROM orders WHERE order_number='OLD-00004'")).payment_status === "unpaid");
    check("total includes legacy service charge (11.00)", (await one("SELECT total_amount FROM orders WHERE order_number='OLD-00002'")).total_amount === "11.00");
    check("5 order lines", (await one("SELECT COUNT(*)::int n FROM order_items")).n === 5);
    check("cancelled-line mapping", (await one("SELECT COUNT(*)::int n FROM order_items WHERE item_status='cancelled'")).n === 2);
    check("draft lines pending", (await one("SELECT COUNT(*)::int n FROM order_items WHERE item_status='pending'")).n === 1);
    check("fractional qty rounded", (await one("SELECT quantity FROM order_items WHERE special_instructions IS NULL AND order_id=(SELECT id FROM orders WHERE order_number='OLD-00004')")).quantity === 1);
    check("3 payments mapped cash/momo/card", (await one("SELECT COUNT(*)::int n FROM payments WHERE payment_method IN ('cash','momo','card')")).n === 3);
    check("momo reference preserved", (await one("SELECT reference_number FROM payments WHERE payment_method='momo'")).reference_number === "MM-7788");
    check("3 users: 2 staff + 1 inactive stub (+owner)", (await one("SELECT COUNT(*)::int n FROM users")).n === 4);
    check("stub user inactive", (await one("SELECT is_active FROM users WHERE name='Ghost Person'")).is_active === false);
    check("stub user has no PIN", (await one("SELECT pin FROM users WHERE name='Ghost Person'")).pin === null);
    check("1 ingredient at zero stock", (await one("SELECT current_stock, min_stock_level FROM ingredients WHERE name='Chicken'")).current_stock === "0.000");
    check("1 supplier", (await one("SELECT COUNT(*)::int n FROM suppliers")).n === 1);
    check("settings hold legacy customers", (await one("SELECT COUNT(*)::int n FROM application_settings WHERE key='legacy_customers'")).n === 1);
    check("audit entry written", (await one("SELECT COUNT(*)::int n FROM audit_logs WHERE action='legacy_import'")).n === 1);
    check("no legacy plaintext PIN copied", (await one("SELECT COUNT(*)::int n FROM users WHERE password_hash LIKE '%plaintext%'")).n === 0);

    const csv = await readFile(credsFile, "utf8");
    const pinRows = csv.trim().split("\n").slice(1).map(line => {
      const m = line.match(/^"(.*?)",([^,]+),([^,]+),(\d+)$/);
      return m ? { name: m[1].replace(/""/g, '"'), email: m[2], role: m[3], pin: m[4] } : null;
    }).filter((r): r is NonNullable<typeof r> => r !== null);
    check("credentials CSV lists 2 imported staff", pinRows.length === 2, csv);
    const adminRow = pinRows.find(r => r.name === "Admin");
    const waiterRow = pinRows.find(r => r.name === "Waiter One");
    check("Admin is super_admin with fresh 4-digit PIN", adminRow?.role === "super_admin" && /^\d{4}$/.test(adminRow?.pin ?? ""), adminRow);
    check("Waiter One resolved case-insensitively", !!waiterRow, pinRows);
    if (adminRow) {
      const stored = await one("SELECT pin, pin_lookup FROM users WHERE email=$1".replace("$1", `'${adminRow.email}'`));
      check("CSV PIN verifies against stored hash", verifyPassword(adminRow.pin, stored.pin as unknown as string));
      check("pin_lookup digest matches", pinDigest(adminRow.pin) === stored.pin_lookup);
    }
    if (adminRow && waiterRow) check("generated PINs are distinct", adminRow.pin !== waiterRow.pin);

    console.log("Running importer (second pass — idempotency)…");
    await run("node_modules/.bin/tsx", ["scripts/import-restpos.ts", "--source", fixture, "--apply"], env);
    check("re-run inserts nothing", (await one("SELECT COUNT(*)::int n FROM orders")).n === 4
      && (await one("SELECT COUNT(*)::int n FROM menu_items")).n === 3
      && (await one("SELECT COUNT(*)::int n FROM users")).n === 4
      && (await one("SELECT COUNT(*)::int n FROM payments")).n === 3
      && (await one("SELECT COUNT(*)::int n FROM order_items")).n === 5);
    check("re-run writes no second audit entry", (await one("SELECT COUNT(*)::int n FROM audit_logs WHERE action='legacy_import'")).n === 1);

    await writeFile(join(dir, "ok"), "ok");
  } finally {
    await admin?.end();
    await pg.stop().catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll legacy-import checks passed.");
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
