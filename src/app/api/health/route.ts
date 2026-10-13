import { rootDb } from "@/db";
import { sql } from "drizzle-orm";

const NO_STORE = { "Cache-Control": "no-store" };
import { findMissingSchema, MIGRATE_HINT } from "@/lib/schema-guard";

export const dynamic = "force-dynamic";

/** Baked in at build time by next.config.ts (see APP_BUILD_COMMIT). */
const COMMIT = process.env.APP_BUILD_COMMIT || "unknown";

type Where = { database?: string; schema?: string };

async function where(): Promise<Where> {
  const result = await rootDb.execute(sql`select current_database() as database, current_schema() as schema`);
  return (result.rows[0] as Where) || {};
}

export async function GET() {
  try {
    const place = await where();
    // A database that has not run this version's migrations is not healthy:
    // this is the first place the deploy script and the operator look. The
    // other operations keep working (see src/lib/api.ts) — the hard stop
    // belongs here, before a release starts serving traffic.
    const missing = await findMissingSchema(rootDb);
    if (missing.length) {
      console.error(`Schema behind on ${place.database}.${place.schema} @ ${COMMIT}: missing ${missing.join(", ")}`);
      return Response.json(
        { ok: false, reason: "schema-behind", missing, commit: COMMIT, ...place, hint: MIGRATE_HINT },
        { status: 503, headers: NO_STORE }
      );
    }
    return Response.json({ ok: true, commit: COMMIT, ...place }, { headers: NO_STORE });
  } catch (err) {
    // Name it: a missing database is not the same failure as an app that never
    // started, and the deploy script and the operator both read this.
    const code = (() => { for (let node: any = err, depth = 0; node && depth < 5; node = node.cause, depth++) { if (node.code) return String(node.code); } return ""; })();
    console.error(`Health check failed on ${COMMIT}: ${code || (err as any)?.message}`);
    return Response.json({ ok: false, reason: "database-unreachable", commit: COMMIT },
      { status: 503, headers: NO_STORE });
  }
}
