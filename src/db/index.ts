import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionUser } from "@/lib/auth";

// The pool is created lazily, on first actual database use — never at module
// import. Next.js imports every route module while collecting page data at
// build time, so throwing (or opening a pool) here made `next build` fail on
// any machine without DATABASE_URL (CI, a colleague's laptop, a preview).
// The clear "DATABASE_URL is required" error now surfaces at the first real
// query instead, where health checks and the request boundary can report it
// as a database problem rather than a build failure.
const globalDb = globalThis as typeof globalThis & {
  posPool?: Pool;
  posRootDb?: ReturnType<typeof drizzle>;
};

export function getPool(): Pool {
  if (!globalDb.posPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");
    globalDb.posPool = new Pool({ connectionString, max: 15 });
  }
  return globalDb.posPool;
}

function getRootDb(): ReturnType<typeof drizzle> {
  if (!globalDb.posRootDb) globalDb.posRootDb = drizzle(getPool());
  return globalDb.posRootDb;
}

// Backwards-compatible lazy handles: importing either name is side-effect
// free; the underlying pool/client is created on first property access.
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, property) {
    const target = getPool();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
  set(_target, property, value) {
    return Reflect.set(getPool(), property, value);
  },
});

// Only the request boundary and maintenance scripts may use rootDb directly.
export const rootDb: ReturnType<typeof drizzle> = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    const target = getRootDb();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
  set(_target, property, value) {
    return Reflect.set(getRootDb(), property, value);
  },
});

export type Transaction = Parameters<Parameters<(typeof rootDb)["transaction"]>[0]>[0];
export const requestContext = new AsyncLocalStorage<{ tx: Transaction; user?: SessionUser; requestId?: string }>();
export const db: typeof rootDb = new Proxy(rootDb, {
  get(_target, property) {
    const context = requestContext.getStore();
    if (!context) throw new Error("Database access requires a scoped request transaction");
    const value = Reflect.get(context.tx, property);
    return typeof value === "function" ? value.bind(context.tx) : value;
  },
});
