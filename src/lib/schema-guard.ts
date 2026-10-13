import { sql } from "drizzle-orm";

/**
 * The parts of the schema this code cannot run without.
 *
 * When the code moves ahead of the database — a migration that has not been
 * applied to that environment yet — Postgres answers `column "x" does not
 * exist` and the browser used to get a bare "Request failed" in the middle of
 * a real task. That is exactly how order deletion broke: the migration adding
 * `payments.idempotency_key` existed in the repository but had never been run
 * against the database the app was pointed at, so every query that read a
 * payment row died, and nothing told the operator why.
 *
 * So the app now checks before it works: `/api/health` reports
 * `schema-behind`, and any request against a stale database is refused with
 * the missing piece and the command that fixes it.
 *
 * Keep this list in step with `migrations/`: every migration that adds a
 * column adds a line here. `scripts/audit-workflows.py` fails when a migration
 * adds a column that is missing from this list, so it cannot be forgotten
 * silently.
 */
export const REQUIRED_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  // 0002_order_fingerprint.sql
  ["orders", "request_fingerprint"],
  // 0003_refund_accounting.sql
  ["payments", "shift_id"],
  ["refunds", "shift_id"],
  ["refunds", "cash_amount"],
  ["refunds", "momo_amount"],
  ["refunds", "idempotency_key"],
  ["refunds", "request_fingerprint"],
  // 0004_payment_idempotency.sql
  ["payments", "idempotency_key"],
  ["payments", "request_fingerprint"],
  // 0005_staff_removal.sql
  ["users", "deleted_at"],
];

/**
 * Tables a migration after the initial schema created. The initial schema is
 * not listed: a database without it fails the tamper-canary query anyway, and
 * listing every base table here would say nothing.
 */
export const REQUIRED_TABLES: readonly string[] = [
  // 0001_security.sql
  "security_meta",
  "auth_attempts",
  // 0003_refund_accounting.sql
  "drawer_movements",
];

export const MIGRATE_HINT =
  'Run "npm run db:migrate" on the server with MIGRATION_DATABASE_URL set, then restart the app.';

export function schemaBehindMessage(missing: string[]): string {
  return `The database is missing an update this version needs (${missing.join(", ")}). ${MIGRATE_HINT}`;
}

/**
 * Turn a Postgres "this schema is not what the code expects" error into
 * instructions. Belt and braces: the check above is informed by
 * REQUIRED_COLUMNS, this one catches anything not listed there.
 */
export function schemaDriftMessage(code: string, detail: string): string | null {
  if (code === "42703" || code === "42P01") {
    return `The database is missing an update this version needs (${detail}). ${MIGRATE_HINT}`;
  }
  if (code === "42501") {
    return `The database user is missing a privilege this version needs (${detail}). Re-apply the runtime grants in docs/VPS_DEPLOYMENT.md, then restart the app.`;
  }
  return null;
}

/** Anything that can run SQL: the connection pool, or the request's transaction. */
export type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: Array<Record<string, unknown>> }> };

/**
 * Which of REQUIRED_COLUMNS this database does not have yet. Reads the
 * catalogue instead of the tables, so it needs no privileges and no rows.
 */
export async function findMissingSchema(executor: Executor): Promise<string[]> {
  const columns = REQUIRED_COLUMNS.map(([table, column]) => `${table}.${column}`);
  const result = await executor.execute(sql`
    select c.relname || '.' || a.attname as name
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = current_schema()
      and a.attnum > 0 and not a.attisdropped
      and c.relname || '.' || a.attname in (${sql.join(columns.map(name => sql`${name}`), sql`, `)})
    union all
    select c.relname as name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = current_schema() and c.relkind = 'r'
      and c.relname in (${sql.join(REQUIRED_TABLES.map(name => sql`${name}`), sql`, `)})
  `);
  const present = new Set(result.rows.map(row => String(row.name)));
  return [...REQUIRED_TABLES, ...columns].filter(name => !present.has(name));
}

/**
 * Does this database have that column yet? Reads the catalogue, so it always
 * succeeds — which matters, because a *failed* statement poisons the request's
 * transaction: asking first lets one query shape be chosen over another, while
 * a try/catch around a query that dies can only ever roll the request back.
 *
 * Used where the code can keep working on the old schema: `users.deleted_at`
 * only hides removed accounts from the staff list, and a database that has not
 * run 0005 has no removed accounts, so listing everyone is exact. Everything
 * else keeps the existing behaviour — the request that needs the missing piece
 * is answered with the migration advice, and the venue keeps trading.
 */
export async function columnExists(executor: Executor, table: string, column: string): Promise<boolean> {
  const result = await executor.execute(sql`
    select 1 from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = current_schema() and c.relname = ${table} and a.attname = ${column}
      and a.attnum > 0 and not a.attisdropped
    limit 1
  `);
  return result.rows.length > 0;
}
