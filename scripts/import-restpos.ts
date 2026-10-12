/**
 * Import a legacy "restpos" (Android POS) SQLite backup into the live PostgreSQL
 * schema. Designed for the Lush View Hotel cutover, but mapping is data-driven.
 *
 * Usage (dry run — no database needed):
 *   npx tsx scripts/import-restpos.ts --source /path/2026-10-12_restpos.db --report
 *
 * Usage (apply — idempotent, safe to re-run at cutover):
 *   export MIGRATION_DATABASE_URL='postgresql://pos_owner:...@127.0.0.1:5432/pos'
 *   export AUTH_SECRET='...'          # same secret the app uses (for PIN lookup digests)
 *   npx tsx scripts/import-restpos.ts --source /path/restpos.db --apply \
 *     --credentials-out staff-pins.csv
 *
 * Rules honoured by this importer:
 *  - Never overwrites existing rows (matches on natural keys; skips otherwise).
 *  - Never copies legacy PINs/passwords (they are plaintext in the old app);
 *    every imported staff member gets a fresh random 4-digit PIN and an
 *    unusable password that the owner replaces via Staff Manager.
 *  - Financial history is preserved as recorded (legacy tax was configured but
 *    never charged — totals carry tax = 0.00).
 *  - Everything runs in one transaction under a maintenance role (RLS FORCE).
 */
import { randomBytes, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient } from "pg";
import { hashPassword, pinDigest } from "../src/lib/auth";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const sourcePath = arg("--source");
const reportOnly = process.argv.includes("--report");
const apply = process.argv.includes("--apply");
const credentialsOut = arg("--credentials-out");
if (!sourcePath || (!reportOnly && !apply) || (reportOnly && apply)) {
  console.error("Usage: tsx scripts/import-restpos.ts --source <restpos.db> (--report | --apply [--credentials-out <csv>])");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** SQLite rows may hold nulls, empty strings, or literal "None" from the old app. */
function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" || s === "None" ? null : s;
}
function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function money(value: number): string {
  return value.toFixed(2);
}
function qtyInt(value: unknown): number {
  return Math.max(1, Math.round(num(value) || 1));
}
/** Timestamps like "2025-12-09 14:11" or "... 14:11:32" stay wall-clock local. */
function ts(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
}
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "user";
}
function sqlIdent(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

// Role mapping: legacy role ids 0=admin 1=manager 2=cashier 3=waiter 4=driver.
const ROLE_MAP: Record<number, string> = { 0: "super_admin", 1: "manager", 2: "cashier", 3: "cashier", 4: "cashier" };
// Legacy orderType: 0 = numbered tables (dine-in), 1 = "Takeout" counter, 3 = "Bar" counter.
const ORDER_TYPE_MAP: Record<number, string> = { 0: "dine_in", 1: "takeaway", 3: "dine_in" };
// Legacy order status: 0 = still open, 1 = completed, 2 = cancelled.
const ORDER_STATUS_MAP: Record<number, string> = { 0: "draft", 1: "completed", 2: "cancelled" };
const PAYMENT_METHOD_MAP: Record<string, string> = { cash: "cash", card: "card", "mobile money": "momo" };
// Cashier names that differ from the staff account spelling in the old database.
const NAME_ALIASES: Record<string, string> = { "AUGUSTINA ASARE": "AUGESTINA" };
const CATEGORY_STATION: Array<[RegExp, string]> = [
  [/drink|bar|beverage/i, "bar"],
  [/dessert|cake|ice.?cream/i, "dessert"],
  [/grill|steak|bbq/i, "grill"],
];

interface SourceData {
  company: Record<string, unknown> | null;
  categories: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  tables: Array<Record<string, unknown>>;
  tableGroups: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  orderItems: Array<Record<string, unknown>>;
  orderPayments: Array<Record<string, unknown>>;
  inventoryItems: Array<Record<string, unknown>>;
  inventoryCategories: Array<Record<string, unknown>>;
  inventoryVendors: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  memberTypes: Array<Record<string, unknown>>;
  soldItemIds: Set<number>;
}

function readSource(path: string): SourceData {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const all = (table: string) => db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
    const sold = db.prepare("SELECT DISTINCT itemId FROM rest_order_item WHERE itemId IS NOT NULL").all() as Array<{ itemId: number }>;
    return {
      company: (db.prepare("SELECT * FROM rest_company LIMIT 1").get() as Record<string, unknown>) ?? null,
      categories: all("rest_category"),
      items: all("rest_item"),
      tables: all("rest_table"),
      tableGroups: all("rest_table_group"),
      users: all("rest_user"),
      orders: all("rest_order"),
      orderItems: all("rest_order_item"),
      orderPayments: all("rest_order_payment"),
      inventoryItems: all("inventory_item"),
      inventoryCategories: all("inventory_category"),
      inventoryVendors: all("inventory_vendor"),
      customers: all("rest_customer"),
      memberTypes: all("rest_member_type"),
      soldItemIds: new Set(sold.map(r => num(r.itemId))),
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Report (pure source analysis)
// ---------------------------------------------------------------------------
interface Warning { level: "info" | "warn"; text: string }

function analyse(src: SourceData): { warnings: Warning[]; counts: Record<string, number | Record<string, number>> } {
  const warnings: Warning[] = [];
  const orderStatus = { draft: 0, completed: 0, cancelled: 0 };
  for (const o of src.orders) orderStatus[ORDER_STATUS_MAP[num(o.status)] as keyof typeof orderStatus] += 1;
  const methodCounts: Record<string, number> = {};
  for (const p of src.orderPayments) {
    const m = PAYMENT_METHOD_MAP[(str(p.paymentMethodName) ?? "other").toLowerCase()] ?? "other";
    methodCounts[m] = (methodCounts[m] ?? 0) + 1;
  }
  const openOrders = src.orders.filter(o => num(o.status) === 0);
  for (const o of openOrders) {
    warnings.push({
      level: "warn",
      text: `OPEN order ${str(o.orderNum)} (${str(o.orderTime)}, table ${str(o.tableName)}, GH₵${money(num(o.amount))}) imported as a draft — complete or cancel it after cutover`,
    });
  }
  const presentItemIds = new Set(src.items.map(i => num(i.id)));
  const missingItems = new Map<number, { name: string; price: number }>();
  for (const oi of src.orderItems) {
    const id = num(oi.itemId);
    if (id && !presentItemIds.has(id)) missingItems.set(id, { name: str(oi.itemName) ?? `item ${id}`, price: num(oi.price) });
  }
  for (const [id, info] of missingItems) {
    warnings.push({ level: "warn", text: `Sold item "${info.name}" (legacy id ${id}) is missing from the menu — a disabled stub will be created so history stays intact` });
  }
  const accountNames = new Set(src.users.map(u => (str(u.account) ?? "").toUpperCase()));
  const unmatched = new Map<string, number>();
  for (const o of src.orders) {
    const name = str(o.cashierName);
    if (!name) continue;
    const key = (NAME_ALIASES[name.toUpperCase()] ?? name).toUpperCase();
    if (!accountNames.has(key)) unmatched.set(name, (unmatched.get(name) ?? 0) + 1);
  }
  for (const [name, n] of unmatched) {
    warnings.push({ level: "warn", text: `Cashier "${name}" (${n} orders) has no staff account — an inactive stub user will hold the history` });
  }
  for (const [alias, target] of Object.entries(NAME_ALIASES)) {
    if (src.orders.some(o => (str(o.cashierName) ?? "").toUpperCase() === alias)) {
      warnings.push({ level: "info", text: `Name alias resolved: "${alias}" → staff account "${target}"` });
    }
  }
  const nonZeroTax = src.orders.filter(o => num(o.tax1TotalAmt) + num(o.tax2TotalAmt) + num(o.tax3TotalAmt) !== 0).length;
  if (nonZeroTax === 0) {
    warnings.push({ level: "info", text: "Legacy sales carried GH₵0.00 tax on every order (the 4% + 4.875% config was never charged). History is imported with tax = 0.00 as recorded. Settle VAT treatment with your accountant before trading." });
  } else {
    warnings.push({ level: "warn", text: `${nonZeroTax} legacy orders carry non-zero tax — review tax figures with your accountant` });
  }
  const takeoutPriced = src.items.filter(i => num(i.takeOutPrice) > 0 || num(i.deliveryPrice) > 0).length;
  if (takeoutPriced) {
    warnings.push({ level: "info", text: `${takeoutPriced} items had separate take-out/delivery prices in the old app — imported with their base price only` });
  }
  const fractional = src.orderItems.filter(oi => num(oi.qty) !== Math.round(num(oi.qty))).length;
  if (fractional) warnings.push({ level: "warn", text: `${fractional} order lines had fractional quantities and were rounded` });
  const seenItems = new Set<string>();
  const duplicateItems: string[] = [];
  for (const it of src.items) {
    const key = `${it.categoryid}|${String(it.name ?? "").trim().toLowerCase()}`;
    if (seenItems.has(key)) duplicateItems.push(String(it.name));
    seenItems.add(key);
  }
  if (duplicateItems.length) {
    warnings.push({ level: "warn", text: `${duplicateItems.length} menu items duplicate a name in the same category (${[...new Set(duplicateItems)].slice(0, 5).join(", ")}…) — the first wins; order history keeps per-line names and prices` });
  }
  const zeroPayments = src.orderPayments.filter(p => num(p.amount) <= 0).length;
  if (zeroPayments) {
    warnings.push({ level: "info", text: `${zeroPayments} zero-value payment stubs in the legacy data are dropped (the schema requires amount > 0); the matching ₵0.00 orders still import` });
  }
  const dateMin = src.orders.reduce<string | null>((a, o) => (a && a < String(o.orderTime) ? a : String(o.orderTime)), null);
  const dateMax = src.orders.reduce<string | null>((a, o) => (a && a > String(o.orderTime) ? a : String(o.orderTime)), null);
  warnings.push({ level: "info", text: `Sales history covers ${dateMin} → ${dateMax}` });
  warnings.push({ level: "info", text: `${src.customers.length} customers + ${src.memberTypes.length} member types are preserved in application_settings key "legacy_customers" (the current system has no members module yet)` });
  warnings.push({ level: "info", text: "Legacy PINs/passwords are NOT imported (they are plaintext in the old app). Imported staff get fresh random PINs listed in the credentials CSV; reset their passwords via Staff Manager." });
  return {
    warnings,
    counts: {
      categories: src.categories.length,
      items: src.items.length,
      missingItemStubs: missingItems.size,
      staff: src.users.length,
      areas: src.tableGroups.length,
      tables: src.tables.length,
      orders: src.orders.length,
      ordersCompleted: orderStatus.completed,
      ordersCancelled: orderStatus.cancelled,
      ordersOpen: orderStatus.draft,
      orderItems: src.orderItems.length,
      payments: src.orderPayments.length,
      paymentsByMethod: methodCounts,
      ingredients: src.inventoryItems.length,
      suppliers: src.inventoryVendors.length,
      customers: src.customers.length,
    },
  };
}

function printReport(src: SourceData): void {
  const { warnings, counts } = analyse(src);
  const company = str(src.company?.name) ?? "(unknown business)";
  console.log("== Legacy restpos import report ==");
  console.log(`Business: ${company}`);
  console.log(`Menu: ${counts.categories} categories, ${counts.items} items${counts.missingItemStubs ? ` (+${counts.missingItemStubs} stubs)` : ""}`);
  console.log(`Staff: ${counts.staff} accounts (fresh PINs on import)`);
  console.log(`Floor: ${counts.areas} area(s), ${counts.tables} tables`);
  console.log(`Sales: ${counts.orders} orders (${counts.ordersCompleted} completed, ${counts.ordersCancelled} cancelled, ${counts.ordersOpen} OPEN → drafts)`);
  console.log(`       ${counts.orderItems} order lines, ${counts.payments} payments ${JSON.stringify(counts.paymentsByMethod)}`);
  console.log(`Inventory: ${counts.ingredients} ingredients, ${counts.suppliers} suppliers`);
  console.log(`Customers: ${counts.customers} (preserved in settings.legacy_customers)`);
  console.log("\nNotes & warnings:");
  for (const w of warnings) console.log(`  [${w.level}] ${w.text}`);
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
interface ImportResult { inserted: Record<string, number>; skipped: Record<string, number>; warnings: Warning[] }

async function applyImport(src: SourceData, dbUrl: string): Promise<{ result: ImportResult; credentials: Array<{ name: string; email: string; role: string; pin: string }> }> {
  const pool = new Pool({ connectionString: dbUrl, max: 1 });
  const client = await pool.connect();
  const inserted: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const bump = (bucket: Record<string, number>, key: string) => { bucket[key] = (bucket[key] ?? 0) + 1; };
  const credentials: Array<{ name: string; email: string; role: string; pin: string }> = [];
  const warnings: Warning[] = analyse(src).warnings;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(834924)");
    const maintenance = await client.query("SELECT rolsuper OR rolbypassrls AS ok FROM pg_roles WHERE rolname=current_user");
    if (!maintenance.rows[0]?.ok) throw new Error("Import requires a maintenance role with BYPASSRLS (use MIGRATION_DATABASE_URL with pos_owner, never the runtime role)");

    const branchRow = (await client.query("SELECT id, restaurant_id FROM branches ORDER BY id LIMIT 1")).rows[0];
    if (!branchRow) throw new Error("No branch found — run npm run db:migrate && npm run db:bootstrap first");
    const branchId: number = branchRow.id;
    const restaurantId: number = branchRow.restaurant_id;
    const defaultTaxRate = String((await client.query("SELECT default_tax_rate FROM restaurants WHERE id=$1", [restaurantId])).rows[0]?.default_tax_rate ?? "0.00");

    // ---- Dining area + tables (legacy "First floor", table names 101–110, Bar, Takeout)
    const areaName = str(src.tableGroups[0]?.name) ?? "Main Floor";
    let areaId: number = (await client.query("SELECT id FROM dining_areas WHERE branch_id=$1 AND name=$2", [branchId, areaName])).rows[0]?.id;
    if (!areaId) {
      areaId = (await client.query("INSERT INTO dining_areas(branch_id,name,sort_order) VALUES($1,$2,0) RETURNING id", [branchId, areaName])).rows[0].id;
      bump(inserted, "areas");
    } else bump(skipped, "areas");
    const tableNames = new Set<string>();
    for (const t of src.tables) { const n = str(t.name); if (n) tableNames.add(n); }
    for (const o of src.orders) { const n = str(o.tableName); if (n) tableNames.add(n); }
    const tableIdByNumber = new Map<string, number>();
    for (const name of tableNames) {
      let id: number = (await client.query("SELECT id FROM dining_tables WHERE branch_id=$1 AND table_number=$2", [branchId, name])).rows[0]?.id;
      if (!id) {
        id = (await client.query("INSERT INTO dining_tables(branch_id,area_id,table_number,status) VALUES($1,$2,$3,'available') RETURNING id", [branchId, areaId, name])).rows[0].id;
        bump(inserted, "tables");
      } else bump(skipped, "tables");
      tableIdByNumber.set(name, id);
    }

    // ---- Menu categories
    const categoryIdByOld = new Map<number, number>();
    for (const c of src.categories) {
      const name = str(c.name) ?? `Category ${c.id}`;
      let id: number = (await client.query("SELECT id FROM menu_categories WHERE branch_id=$1 AND name=$2", [branchId, name])).rows[0]?.id;
      if (!id) {
        id = (await client.query(
          "INSERT INTO menu_categories(branch_id,name,slug,sort_order,is_active) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [branchId, name, `${slugify(name)}-${c.id}`, num(c.sequence), num(c.enable) !== 0],
        )).rows[0].id;
        bump(inserted, "categories");
      } else bump(skipped, "categories");
      categoryIdByOld.set(num(c.id), id);
    }

    // ---- Menu items
    const stationFor = (categoryName: string | null) => {
      for (const [re, station] of CATEGORY_STATION) if (categoryName && re.test(categoryName)) return station;
      return "kitchen";
    };
    const categoryNames = new Map<number, string>();
    for (const c of src.categories) categoryNames.set(num(c.id), str(c.name) ?? "");
    const menuItemIdByOld = new Map<number, number>();
    for (const it of src.items) {
      const name = str(it.name) ?? `Item ${it.id}`;
      const categoryId = categoryIdByOld.get(num(it.categoryid));
      if (!categoryId) { warnings.push({ level: "warn", text: `Item "${name}" has an unknown category — skipped` }); bump(skipped, "items"); continue; }
      let id: number = (await client.query("SELECT id FROM menu_items WHERE branch_id=$1 AND category_id=$2 AND name=$3", [branchId, categoryId, name])).rows[0]?.id;
      if (!id) {
        id = (await client.query(
          `INSERT INTO menu_items(branch_id,category_id,name,description,barcode,price,cost_price,station,is_available,tax_rate)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [branchId, categoryId, name, str(it.description), str(it.barCode), money(num(it.price)), money(num(it.cost)),
            stationFor(categoryNames.get(num(it.categoryid)) ?? null), num(it.enable) !== 0, defaultTaxRate],
        )).rows[0].id;
        bump(inserted, "items");
      } else bump(skipped, "items");
      menuItemIdByOld.set(num(it.id), id);
    }
    // Stubs for sold-but-removed items so order history keeps valid item references.
    const missingItems = new Map<number, { name: string; price: number }>();
    for (const oi of src.orderItems) {
      const id = num(oi.itemId);
      if (id && !menuItemIdByOld.has(id) && !src.items.some(it => num(it.id) === id)) {
        missingItems.set(id, { name: str(oi.itemName) ?? `Item ${id}`, price: num(oi.price) });
      }
    }
    const fallbackCategoryId = categoryIdByOld.get(3) ?? [...categoryIdByOld.values()][0];
    for (const [oldId, info] of missingItems) {
      let id: number = (await client.query("SELECT id FROM menu_items WHERE branch_id=$1 AND category_id=$2 AND name=$3", [branchId, fallbackCategoryId, info.name])).rows[0]?.id;
      if (!id) {
        id = (await client.query(
          `INSERT INTO menu_items(branch_id,category_id,name,price,cost_price,station,is_available,tax_rate)
           VALUES($1,$2,$3,$4,'0.00','bar',false,$5) RETURNING id`,
          [branchId, fallbackCategoryId, info.name, money(info.price), defaultTaxRate],
        )).rows[0].id;
        bump(inserted, "itemStubs");
      } else bump(skipped, "itemStubs");
      menuItemIdByOld.set(oldId, id);
    }

    // ---- Users (fresh PINs; legacy credentials are plaintext and never copied)
    const usedPinLookups = new Set<string>(
      (await client.query("SELECT pin_lookup FROM users WHERE branch_id=$1 AND pin_lookup IS NOT NULL", [branchId])).rows.map((r: { pin_lookup: string }) => r.pin_lookup),
    );
    const usedEmails = new Set<string>(
      (await client.query("SELECT email FROM users")).rows.map((r: { email: string }) => String(r.email).toLowerCase()),
    );
    const makeUniqueEmail = (base: string) => {
      let email = `${base}@imported.invalid`;
      let n = 2;
      while (usedEmails.has(email.toLowerCase())) email = `${base}+${n++}@imported.invalid`;
      usedEmails.add(email.toLowerCase());
      return email;
    };
    const makeUniquePin = (): string => {
      for (let tries = 0; tries < 200; tries++) {
        const pin = String(randomInt(1000, 10000));
        const lookup = pinDigest(pin);
        if (!usedPinLookups.has(lookup)) { usedPinLookups.add(lookup); return pin; }
      }
      throw new Error("Unable to allocate a unique PIN");
    };
    const userIdByName = new Map<string, number>();
    const ensureUser = async (name: string, role: string, active: boolean, withPin: boolean): Promise<number> => {
      const key = name.trim().toUpperCase();
      const existing = userIdByName.get(key);
      if (existing) return existing;
      // Idempotency: a previous run already created this account (email is derived
      // deterministically from the name, with numeric suffixes on collision).
      const baseEmail = `${slugify(name)}@imported.invalid`;
      const prior = await client.query("SELECT id FROM users WHERE lower(email)=lower($1) OR lower(email)=lower($2)", [baseEmail, `${slugify(name)}+2@imported.invalid`]);
      if (prior.rows[0]) {
        userIdByName.set(key, prior.rows[0].id);
        bump(skipped, "users");
        return prior.rows[0].id;
      }
      const email = makeUniqueEmail(slugify(name));
      const pin = withPin ? makeUniquePin() : null;
      const passwordHash = hashPassword(randomBytes(24).toString("base64url"));
      const id: number = (await client.query(
        `INSERT INTO users(restaurant_id,branch_id,name,email,password_hash,pin,pin_lookup,role,is_active)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [restaurantId, branchId, name.trim(), email, passwordHash, pin ? hashPassword(pin) : null, pin ? pinDigest(pin) : null, role, active],
      )).rows[0].id;
      bump(inserted, "users");
      if (pin) credentials.push({ name: name.trim(), email, role, pin });
      userIdByName.set(key, id);
      return id;
    };
    for (const u of src.users) {
      const name = str(u.account) ?? `User ${u.id}`;
      const role = ROLE_MAP[num(u.role)] ?? "cashier";
      await ensureUser(name, role, true, true);
    }
    // Attribution stubs for cashier names seen on orders but missing from rest_user.
    for (const o of src.orders) {
      const raw = str(o.cashierName);
      if (!raw) continue;
      const aliased = NAME_ALIASES[raw.toUpperCase()] ?? raw;
      if (!userIdByName.has(aliased.trim().toUpperCase())) {
        await ensureUser(aliased, "cashier", false, false);
        warnings.push({ level: "warn", text: `Created inactive stub user "${aliased.trim()}" for order attribution only (no PIN, cannot sign in)` });
      }
    }
    const resolveUserId = (rawName: string | null): number => {
      if (!rawName) return userIdByName.get("ADMIN") ?? [...userIdByName.values()][0];
      const aliased = NAME_ALIASES[rawName.toUpperCase()] ?? rawName;
      return userIdByName.get(aliased.trim().toUpperCase()) ?? userIdByName.get("ADMIN") ?? [...userIdByName.values()][0];
    };

    // ---- Inventory: suppliers + ingredients (opening stock starts at 0; count on site)
    for (const v of src.inventoryVendors) {
      const name = str(v.companyName) ?? str(v.contactPerson) ?? `Vendor ${v.id}`;
      let id: number = (await client.query("SELECT id FROM suppliers WHERE branch_id=$1 AND name=$2", [branchId, name])).rows[0]?.id;
      if (!id) {
        id = (await client.query("INSERT INTO suppliers(branch_id,name,contact_person,phone,email,address) VALUES($1,$2,$3,$4,$5,$6) RETURNING id", [branchId, name, str(v.contactPerson), str(v.phone), str(v.email), str(v.address)])).rows[0].id;
        bump(inserted, "suppliers");
      } else bump(skipped, "suppliers");
    }
    const invCategoryNames = new Map<number, string>();
    for (const c of src.inventoryCategories) invCategoryNames.set(num(c.id), str(c.name) ?? "general");
    for (const ing of src.inventoryItems) {
      const name = str(ing.itemName) ?? `Ingredient ${ing.id}`;
      const unit = str(ing.stockUnit) ?? str(ing.purchaseUnit) ?? "pcs";
      let id: number = (await client.query("SELECT id FROM ingredients WHERE branch_id=$1 AND name=$2", [branchId, name])).rows[0]?.id;
      if (!id) {
        id = (await client.query(
          `INSERT INTO ingredients(branch_id,name,category,current_stock,min_stock_level,unit,cost_per_unit,is_active)
           VALUES($1,$2,$3,'0.000',$4,$5,'0.00',true) RETURNING id`,
          [branchId, name, invCategoryNames.get(num(ing.categoryId)) ?? "general", money(num(ing.warmQty)) || "10.000", unit],
        )).rows[0].id;
        bump(inserted, "ingredients");
        warnings.push({ level: "info", text: `Ingredient "${name}" imported with opening stock 0 — enter the counted quantity via Stock Audit` });
      } else bump(skipped, "ingredients");
    }

    // ---- Orders + items + payments
    const orderNumberSeen = new Set<string>(
      (await client.query("SELECT order_number FROM orders WHERE branch_id=$1", [branchId])).rows.map((r: { order_number: string }) => r.order_number),
    );
    const makeOrderNumber = (oldNum: string | null, oldId: number) => {
      const base = `OLD-${oldNum && /^\d+$/.test(oldNum) ? oldNum.padStart(5, "0") : String(oldId)}`;
      let candidate = base;
      let n = 2;
      while (orderNumberSeen.has(candidate)) candidate = `${base}-${n++}`;
      orderNumberSeen.add(candidate);
      return candidate;
    };
    for (const o of src.orders) {
      const oldId = num(o.id);
      const orderNumber = makeOrderNumber(str(o.orderNum), oldId);
      const idempotencyKey = `legacy-restpos:${oldId}`;
      const existing = (await client.query("SELECT id FROM orders WHERE branch_id=$1 AND (idempotency_key=$2 OR order_number=$3)", [branchId, idempotencyKey, orderNumber])).rows[0];
      if (existing) { bump(skipped, "orders"); continue; }
      const status = ORDER_STATUS_MAP[num(o.status)] ?? "cancelled";
      const tableName = str(o.tableName);
      const tipAmount = src.orderPayments.filter(p => num(p.orderId) === oldId).reduce((s, p) => s + num(p.gratuityAmount), 0);
      const totalAmount = num(o.amount);
      const paidRaw = src.orderPayments.filter(p => num(p.orderId) === oldId && num(p.status) === 0 && num(p.amount) > 0).reduce((s, p) => s + num(p.amount), 0);
      // Schema CHECK (paid_amount <= total_amount): never import an overpaid order.
      const paidAmount = Math.min(paidRaw, totalAmount);
      if (paidRaw > totalAmount + 0.005) warnings.push({ level: "warn", text: `Order ${str(o.orderNum)}: payments exceed the total in the legacy data — paid amount capped at the total` });
      const paymentStatus = status === "draft" ? "unpaid"
        : status === "cancelled" ? (paidAmount > 0 ? "refunded" : "unpaid")
        : totalAmount <= 0 ? "paid"
        : paidAmount <= 0 ? "unpaid"
        : paidAmount + 0.005 >= totalAmount ? "paid"
        : "partially_paid";
      const notes = [
        `Imported from legacy POS (order ${str(o.orderNum) ?? oldId}, invoice ${str(o.invoiceNum) ?? "—"})`,
        str(o.waiterName) ? `waiter: ${str(o.waiterName)}` : null,
        str(o.cancelReason) ? `cancel reason: ${str(o.cancelReason)}` : null,
        status === "draft" ? "was OPEN in the old system — complete or cancel" : null,
      ].filter(Boolean).join(" · ");
      const orderId: number = (await client.query(
        `INSERT INTO orders(order_number,branch_id,table_id,room_number,user_id,customer_name,customer_phone,order_type,status,
                            subtotal,tax_amount,service_charge,discount_amount,discount_reason,tip_amount,total_amount,
                            paid_amount,payment_status,notes,idempotency_key,stock_deducted,created_at,updated_at)
         VALUES($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,true,$20,$21) RETURNING id`,
        [orderNumber, branchId, tableName ? tableIdByNumber.get(tableName) ?? null : null,
          resolveUserId(str(o.cashierName)), str(o.customerName) ?? "Walk-in Guest", str(o.customerPhone),
          ORDER_TYPE_MAP[num(o.orderType)] ?? "dine_in", status,
          money(num(o.subTotal)), money(num(o.tax1TotalAmt) + num(o.tax2TotalAmt) + num(o.tax3TotalAmt)),
          money(num(o.serviceAmt)), money(num(o.discountAmt)), str(o.discountReason), money(tipAmount), money(totalAmount),
          money(paidAmount), paymentStatus, notes, idempotencyKey,
          ts(o.orderTime) ?? ts(o.transactionTime) ?? new Date().toISOString().slice(0, 19).replace("T", " "),
          ts(o.endTime) ?? ts(o.orderTime) ?? new Date().toISOString().slice(0, 19).replace("T", " ")],
      )).rows[0].id;
      bump(inserted, "orders");
      for (const oi of src.orderItems.filter(r => num(r.orderId) === oldId)) {
        const menuItemId = menuItemIdByOld.get(num(oi.itemId));
        if (!menuItemId) { warnings.push({ level: "warn", text: `Order ${orderNumber}: unmapped item id ${oi.itemId} — line skipped` }); continue; }
        const itemCancelled = str(oi.cancelReason) !== null || num(oi.status) !== 0 || status === "cancelled";
        await client.query(
          `INSERT INTO order_items(branch_id,order_id,menu_item_id,item_name,quantity,unit_price,total_price,cost_price,special_instructions,item_status,station,created_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [branchId, orderId, menuItemId, str(oi.itemName) ?? "Item", qtyInt(oi.qty), money(num(oi.price)),
            money(num(oi.price) * qtyInt(oi.qty)), money(num(oi.cost)), str(oi.remark),
            status === "draft" ? "pending" : itemCancelled ? "cancelled" : "served",
            "kitchen", ts(oi.orderTime) ?? ts(o.orderTime) ?? new Date().toISOString().slice(0, 19).replace("T", " ")],
        );
        bump(inserted, "orderItems");
      }
      for (const p of src.orderPayments.filter(r => num(r.orderId) === oldId)) {
        // Old app occasionally wrote zero-value payment stubs; the schema
        // enforces amount > 0 so they are dropped (and counted).
        if (num(p.amount) <= 0) { bump(skipped, "payments"); continue; }
        const raw = (str(p.paymentMethodName) ?? "other").toLowerCase();
        await client.query(
          `INSERT INTO payments(branch_id,order_id,amount,payment_method,reference_number,cash_tendered,change_given,status,processed_by,created_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [branchId, orderId, money(num(p.amount)), PAYMENT_METHOD_MAP[raw] ?? "other", str(p.transactionRequestId),
            p.paidAmt === null || p.paidAmt === undefined ? null : money(num(p.paidAmt)),
            p.changeAmt === null || p.changeAmt === undefined ? null : money(num(p.changeAmt)),
            status === "cancelled" ? "refunded" : "completed", resolveUserId(str(p.cashierName)),
            ts(p.paymentTime) ?? ts(o.orderTime) ?? new Date().toISOString().slice(0, 19).replace("T", " ")],
        );
        bump(inserted, "payments");
      }
    }

    // ---- Customers & member types: preserved losslessly in settings (no members module yet)
    if (src.customers.length) {
      const payload = JSON.stringify({ memberTypes: src.memberTypes, customers: src.customers, source: "legacy restpos import", importedAt: new Date().toISOString() });
      const existing = await client.query("SELECT id FROM application_settings WHERE branch_id=$1 AND key='legacy_customers'", [branchId]);
      if (existing.rows[0]) {
        await client.query("UPDATE application_settings SET value=$1, updated_at=now() WHERE id=$2", [payload, existing.rows[0].id]);
        bump(skipped, "customers");
      } else {
        await client.query("INSERT INTO application_settings(branch_id,key,value,description) VALUES($1,'legacy_customers',$2,$3)", [branchId, payload, "Customers and member types preserved from the legacy POS (no members module yet)"]);
        bump(inserted, "customers");
      }
    }

    // ---- Audit trail (only when this run actually changed something)
    const totalInserted = Object.values(inserted).reduce((a, b) => a + b, 0);
    if (totalInserted > 0) {
      await client.query(
        `INSERT INTO audit_logs(branch_id,user_id,user_name,action,entity_type,details) VALUES($1,NULL,'Legacy import','legacy_import','system',$2)`,
        [branchId, `Imported legacy restpos data: ${JSON.stringify(inserted)}`],
      );
    }
    await client.query("COMMIT");
    return { result: { inserted, skipped, warnings }, credentials };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
async function main() {
  const src = readSource(sourcePath!);
  if (reportOnly) {
    printReport(src);
    return;
  }
  const dbUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Set MIGRATION_DATABASE_URL (maintenance connection) or DATABASE_URL");
  const { result, credentials } = await applyImport(src, dbUrl);
  console.log("== Legacy restpos import complete ==");
  console.log("Inserted:", JSON.stringify(result.inserted));
  console.log("Skipped (already present):", JSON.stringify(result.skipped));
  if (credentialsOut) {
    const header = "name,email,role,pin";
    const rows = credentials.map(c => `"${c.name.replace(/"/g, '""')}",${c.email},${c.role},${c.pin}`);
    writeFileSync(credentialsOut, [header, ...rows].join("\n") + "\n", { mode: 0o600 });
    console.log(`Fresh staff PINs written to ${credentialsOut} — distribute securely, then delete the file.`);
  }
  if (!credentials.length) console.log("No new staff created (all already imported).");
  console.log("\nNotes & warnings:");
  for (const w of result.warnings) console.log(`  [${w.level}] ${w.text}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
