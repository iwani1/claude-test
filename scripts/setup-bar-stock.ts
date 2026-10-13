/**
 * Switch on bar stock tracking: one stock ingredient per bar (DRINKS) menu
 * item, a 1:1 recipe so every sale deducts one bottle, and opening quantities
 * seeded from the legacy restpos counters where they exist.
 *
 * Usage (dry run):
 *   npx tsx scripts/setup-bar-stock.ts --report [--source /path/restpos.db]
 *
 * Usage (apply — idempotent, safe to re-run; never overwrites existing stock):
 *   export MIGRATION_DATABASE_URL='postgresql://pos_owner:...@127.0.0.1:5432/pos'
 *   npx tsx scripts/setup-bar-stock.ts --apply --source /path/restpos.db
 *
 * Rules:
 *  - Only menu items in a category named "DRINKS" are touched.
 *  - Opening stock is seeded ONCE, when the ingredient is first created;
 *    later runs never clobber counts you have adjusted or audited.
 *  - Existing ingredients/recipes are reused, never duplicated.
 */
import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const sourcePath = arg("--source");
const reportOnly = process.argv.includes("--report");
const apply = process.argv.includes("--apply");
if ((!reportOnly && !apply) || (reportOnly && apply)) {
  console.error("Usage: tsx scripts/setup-bar-stock.ts (--report | --apply) [--source restpos.db]");
  process.exit(2);
}

const MIN_STOCK = "10.000";
const UNIT = "bottle";

function legacyCounts(path: string): Map<string, number> {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const rows = db.prepare(
      `SELECT i.name AS name, q.qty AS qty FROM rest_item_qty q
       JOIN rest_item i ON i.id = q.id
       JOIN rest_category c ON c.id = i.categoryid
       WHERE TRIM(UPPER(c.name)) = 'DRINKS' AND q.qty > 0`,
    ).all() as Array<{ name: string; qty: number }>;
    return new Map(rows.map(r => [String(r.name).trim(), Number(r.qty)]));
  } finally {
    db.close();
  }
}

async function main() {
  const counts = sourcePath ? legacyCounts(sourcePath) : new Map<string, number>();
  if (reportOnly) {
    console.log("== Bar stock setup report ==");
    console.log(`Legacy opening counters found: ${counts.size} drink(s)`);
    for (const [name, qty] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${name}: ${qty} ${UNIT}s`);
    console.log("\nOn apply, every DRINKS menu item gets:");
    console.log(`  - a stock ingredient (unit: ${UNIT}, category: beverage, min level ${Number(MIN_STOCK)})`);
    console.log("  - a 1:1 recipe so each sale deducts one unit");
    console.log("  - opening stock from the counters above (items without a counter start at 0)");
    console.log("\nThen confirm the real bar levels with a Stock Audit.");
    return;
  }

  const dbUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Set MIGRATION_DATABASE_URL (maintenance connection)");
  const pool = new Pool({ connectionString: dbUrl, max: 1 });
  const client = await pool.connect();
  const created = { ingredients: 0, recipes: 0, seeded: 0 };
  const reused = { ingredients: 0, recipes: 0 };
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(834925)");
    const maintenance = await client.query("SELECT rolsuper OR rolbypassrls AS ok FROM pg_roles WHERE rolname=current_user");
    if (!maintenance.rows[0]?.ok) throw new Error("Requires a maintenance role with BYPASSRLS (use MIGRATION_DATABASE_URL)");

    const branchRow = (await client.query("SELECT id FROM branches ORDER BY id LIMIT 1")).rows[0];
    if (!branchRow) throw new Error("No branch found — migrate and bootstrap first");
    const branchId: number = branchRow.id;

    const drinks = (await client.query(
      `SELECT m.id, m.name FROM menu_items m
       JOIN menu_categories c ON c.id = m.category_id
       WHERE m.branch_id = $1 AND TRIM(UPPER(c.name)) = 'DRINKS' AND m.is_available = true
       ORDER BY m.name`,
      [branchId],
    )).rows as Array<{ id: number; name: string }>;
    if (!drinks.length) throw new Error("No available menu items found in a 'DRINKS' category");

    for (const item of drinks) {
      const name = item.name.trim();
      let ing = (await client.query("SELECT id, current_stock FROM ingredients WHERE branch_id=$1 AND name=$2", [branchId, name])).rows[0];
      if (!ing) {
        const opening = counts.get(name) ?? 0;
        ing = (await client.query(
          `INSERT INTO ingredients(branch_id,name,category,unit,cost_per_unit,current_stock,min_stock_level,is_active)
           VALUES($1,$2,'beverage',$3,'0.00',$4,$5,true) RETURNING id, current_stock`,
          [branchId, name, UNIT, opening > 0 ? String(opening) : "0.000", MIN_STOCK],
        )).rows[0];
        created.ingredients++;
        if (opening > 0) created.seeded++;
      } else {
        reused.ingredients++;
      }
      let recipe = (await client.query("SELECT id FROM recipes WHERE menu_item_id=$1", [item.id])).rows[0];
      if (!recipe) {
        recipe = (await client.query(
          "INSERT INTO recipes(branch_id,menu_item_id,yield_count) VALUES($1,$2,1) RETURNING id",
          [branchId, item.id],
        )).rows[0];
        created.recipes++;
        await client.query(
          `INSERT INTO recipe_ingredients(branch_id,recipe_id,ingredient_id,quantity,unit,cost_portion)
           VALUES($1,$2,$3,'1.000',$4,'0.00')`,
          [branchId, recipe.id, ing.id, UNIT],
        );
      } else {
        reused.recipes++;
      }
      await client.query("UPDATE menu_items SET has_recipe = true WHERE id=$1", [item.id]);
    }

    await client.query(
      `INSERT INTO audit_logs(branch_id,user_id,user_name,action,entity_type,details) VALUES($1,NULL,'Bar stock setup','bar_stock_setup','inventory',$2)`,
      [branchId, `Bar stock enabled for ${drinks.length} drink(s): ${JSON.stringify({ created, reused })}`],
    );
    await client.query("COMMIT");
    console.log("== Bar stock setup complete ==");
    console.log(`Drinks processed: ${drinks.length}`);
    console.log(`Ingredients created: ${created.ingredients} (opening stock seeded for ${created.seeded}), reused: ${reused.ingredients}`);
    console.log(`Recipes created: ${created.recipes}, reused: ${reused.recipes}`);
    console.log("\nNext: open Inventory → Stock Audit and confirm the real bar levels.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
