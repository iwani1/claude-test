/**
 * Database time limits for every connection the web app opens (P5 in
 * docs/FINDINGS.md). Without them one stuck request could hold row locks on an
 * order or a shift indefinitely, or use up the pool, so every till hung instead
 * of failing. They travel in the connection's startup parameters, so every
 * installation gets them without a manual database step.
 *
 * Each can be tuned with an environment variable (milliseconds). Maintenance
 * scripts (migrations, imports, backups) open their own connections and are not
 * limited by these.
 */
const DEFAULTS = {
  /** Longest a single statement may run. */
  POS_DB_STATEMENT_TIMEOUT_MS: 15_000,
  /** Longest a request waits for a row another request has locked. */
  POS_DB_LOCK_TIMEOUT_MS: 5_000,
  /** Longest a transaction may sit open and idle before the server ends it. */
  POS_DB_IDLE_TX_TIMEOUT_MS: 30_000,
  /** Longest a request waits for a free pooled connection. */
  POS_DB_CONNECT_TIMEOUT_MS: 5_000,
} as const;

function setting(name: keyof typeof DEFAULTS): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return DEFAULTS[name];
  const value = Number(raw);
  // A typo must not silently switch a limit off (0 means "no limit" to PostgreSQL).
  if (!Number.isSafeInteger(value) || value < 100 || value > 600_000) {
    throw new Error(`${name} must be a whole number of milliseconds between 100 and 600000`);
  }
  return value;
}

/** Options for a node-postgres Pool used by the running app. */
export function databaseTimeouts() {
  return {
    statement_timeout: setting("POS_DB_STATEMENT_TIMEOUT_MS"),
    lock_timeout: setting("POS_DB_LOCK_TIMEOUT_MS"),
    idle_in_transaction_session_timeout: setting("POS_DB_IDLE_TX_TIMEOUT_MS"),
    connectionTimeoutMillis: setting("POS_DB_CONNECT_TIMEOUT_MS"),
    idleTimeoutMillis: 30_000,
  };
}
