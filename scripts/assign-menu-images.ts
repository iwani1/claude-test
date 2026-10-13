/**
 * Assign the bundled Ghanaian food photos (public/menu-images/) to existing
 * menu items by name match.
 *
 * Usage (dry run — nothing is changed):
 *   npx tsx scripts/assign-menu-images.ts --report
 *
 * Usage (apply — idempotent; fills image_url only where it is currently empty):
 *   export MIGRATION_DATABASE_URL='postgresql://pos_owner:...@127.0.0.1:5432/pos'
 *   npx tsx scripts/assign-menu-images.ts --apply [--overwrite]
 *
 * Rules:
 *  - Matching is on the normalized (lowercased) item name; the FIRST matching
 *    rule wins, so "Jollof Rice with Grilled Chicken" gets the jollof photo,
 *    not the grilled-chicken one.
 *  - Without --overwrite, items that already have an image_url are left alone.
 *  - Unmatched items are reported and never modified.
 */
import "dotenv/config";
import { Pool } from "pg";

const apply = process.argv.includes("--apply");
const reportOnly = process.argv.includes("--report");
const overwrite = process.argv.includes("--overwrite");
if (!apply && !reportOnly) {
  console.error("Usage: tsx scripts/assign-menu-images.ts (--report | --apply) [--overwrite]");
  process.exit(2);
}

/** image paths are served from the app root, e.g. /menu-images/waakye.jpg */
const IMG = (f: string) => `/menu-images/${f}`;

/** Ordered rules: specific dishes first so compound names match the right photo. */
const RULES: Array<[string[], string]> = [
  [["jollof"], IMG("jollof-rice-grilled-chicken.jpg")],
  [["waakye"], IMG("waakye.jpg")],
  [["banku"], IMG("banku-grilled-tilapia.jpg")],
  [["groundnut", "abenkwan", "abensh"], IMG("fufu-groundnut-soup.jpg")],
  [["kontomire", "palava"], IMG("kontomire.jpg")],
  [["kenkey"], IMG("kenkey-fried-fish.jpg")],
  [["red red", "red-red"], IMG("red-red.jpg")],
  [["omo tuo", "tuo", "zaafi"], IMG("omo-tuo.jpg")],
  [["fried rice"], IMG("fried-rice-grilled-chicken.jpg")],
  [["suya", "chichinga"], IMG("beef-suya.jpg")],
  [["kelewele", "aloco", "alloco"], IMG("kelewele.jpg")],
  [["meat pie"], IMG("meat-pie.jpg")],
  [["puff puff", "puff-puff", "bofrot"], IMG("puff-puff.jpg")],
  [["sobolo", "bissap", "zobo", "hibiscus"], IMG("sobolo.jpg")],
  [["palm wine"], IMG("palm-wine.jpg")],
  [["tilapia"], IMG("grilled-tilapia.jpg")],
  [["grilled chicken"], IMG("grilled-chicken.jpg")],
];

function match(name: string): string | null {
  const n = name.toLowerCase();
  for (const [keywords, url] of RULES) if (keywords.some((k) => n.includes(k))) return url;
  return null;
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("Set MIGRATION_DATABASE_URL (the maintenance login) first");
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, name, image_url FROM menu_items ORDER BY id"
    );
    if (rows.length === 0) throw new Error("No menu items found — build the menu first (Menu Manager)");

    const plan = rows.map((r) => ({ ...r, target: match(r.name) }));
    const unmatched = plan.filter((r) => !r.target);
    const wouldSet = plan.filter((r) => r.target && (r.image_url == null || String(r.image_url).trim() === "" || overwrite));
    const skipped = plan.filter((r) => r.target && !wouldSet.includes(r));

    console.log(`Menu items: ${plan.length}`);
    for (const r of plan) {
      const state = !r.target ? "UNMATCHED" : wouldSet.includes(r) ? (overwrite && r.image_url ? "REPLACE" : "WILL SET") : "kept (already has image)";
      console.log(`  [${state}] #${r.id} ${r.name} -> ${r.target ?? "—"}`);
    }
    if (skipped.length) console.log(`Skipped (already have an image; use --overwrite to replace): ${skipped.length}`);
    if (unmatched.length) console.log(`Unmatched: ${unmatched.map((r) => `#${r.id} ${r.name}`).join(", ")}`);
    if (reportOnly) {
      console.log(`Dry run — ${wouldSet.length} image_url value(s) would be written.`);
      return;
    }
    if (wouldSet.length === 0) {
      console.log("Nothing to do — all matched items already have images.");
      return;
    }
    await client.query("BEGIN");
    for (const r of wouldSet) {
      await client.query("UPDATE menu_items SET image_url = $1 WHERE id = $2", [r.target, r.id]);
    }
    await client.query("COMMIT");
    console.log(`Updated ${wouldSet.length} menu item(s).`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
