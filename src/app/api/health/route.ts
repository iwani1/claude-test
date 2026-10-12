import { rootDb } from "@/db";
import { sql } from "drizzle-orm";
import { findMissingSchema, MIGRATE_HINT } from "@/lib/schema-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await rootDb.execute(sql`select 1`);
    // A database that has not run this version's migrations is not healthy:
    // writes would fail half-way through a real task. This is the first place
    // the deploy script and the operator look, so it says so here.
    const missing = await findMissingSchema(rootDb);
    if (missing.length) {
      console.error(`Schema behind: missing ${missing.join(", ")}`);
      return Response.json({ ok: false, reason: "schema-behind", missing, hint: MIGRATE_HINT }, { status: 503 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
