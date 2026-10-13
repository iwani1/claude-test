import "dotenv/config";
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
// Run only with the owner/maintenance URL, never from the web application.
const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
async function main() {
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error("MIGRATION_DATABASE_URL required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(834923)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const name of (await readdir("migrations")).filter(n => n.endsWith(".sql")).sort()) {
      const sql = await readFile(`migrations/${name}`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const found = await client.query("SELECT checksum FROM schema_migrations WHERE name=$1", [name]);
      if (found.rowCount) {
        if (found.rows[0].checksum !== checksum) throw new Error(`Changed migration: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name, checksum) VALUES ($1,$2)", [name, checksum]);
      console.log(`Applied ${name}`);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
