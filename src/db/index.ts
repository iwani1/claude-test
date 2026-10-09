import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionUser } from "@/lib/auth";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const globalDb = globalThis as typeof globalThis & { posPool?: Pool };
export const pool = globalDb.posPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 15 });
globalDb.posPool = pool;
// Only the request boundary and maintenance scripts may use rootDb directly.
export const rootDb = drizzle(pool);
export type Transaction = Parameters<Parameters<typeof rootDb.transaction>[0]>[0];
export const requestContext = new AsyncLocalStorage<{ tx: Transaction; user?: SessionUser }>();
export const db: typeof rootDb = new Proxy(rootDb, {
  get(_target, property) {
    const context = requestContext.getStore();
    if (!context) throw new Error("Database access requires a scoped request transaction");
    const value = Reflect.get(context.tx, property);
    return typeof value === "function" ? value.bind(context.tx) : value;
  },
});
