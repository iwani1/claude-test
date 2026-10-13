import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { rootDb, requestContext, Transaction } from "@/db";
import { users, branches } from "@/db/schema";
import { authSecret, hasTerminalAccess, ROLE_PERMISSIONS, SessionUser, UserRole, verifyToken } from "./auth";
import type { Permission } from "./guard";
import { databaseUnreachableMessage, schemaDriftMessage } from "./schema-guard";
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
class RollbackResponse { constructor(public response: Response) {} }
export type RouteContext = { params: Promise<{ id: string }> };
type Handler = (req: Request, context: RouteContext) => Promise<Response>;
export async function setScope(tx: Transaction, user: SessionUser) {
  await tx.execute(sql`select set_config('app.auth', '0', true), set_config('app.branch_id', ${String(user.branchId)}, true), set_config('app.restaurant_id', ${String(user.restaurantId)}, true)`);
  requestContext.getStore()!.user = user;
}
/** The driver error hiding inside Drizzle's wrapper (it nests `cause`). */
function driverError(err: unknown): any {
  for (let node: any = err, depth = 0; node && depth < 5; node = node.cause, depth++) {
    if (node.code) return node;
  }
  return {};
}
/** Every API answer is uncacheable — including failures. A cached 503 or 401
 *  once made a repaired system look broken for an hour, to the browser and to
 *  whoever was checking it. */
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
function errorResponse(body: Record<string, unknown>, status: number) {
  return noStore(NextResponse.json(body, { status }));
}
export function safeSession(row: typeof users.$inferSelect): SessionUser {
  return { id: row.id, restaurantId: row.restaurantId, branchId: row.branchId, name: row.name, email: row.email,
    role: row.role as UserRole, avatarUrl: row.avatarUrl, sessionVersion: row.sessionVersion };
}
export async function activateUser(tx: Transaction, row: typeof users.$inferSelect | undefined) {
  if (!row || !row.isActive || !hasTerminalAccess(row.role as UserRole)) throw new ApiError(401, "Invalid credentials or inactive account");
  const [branch] = await tx.select().from(branches).where(eq(branches.id, row.branchId));
  if (!branch?.isActive || branch.restaurantId !== row.restaurantId) throw new ApiError(403, "No active branch assigned");
  const user = safeSession(row);
  await setScope(tx, user);
  return user;
}
function checkRequest(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") || new URL(req.url).host;
  if (origin && new URL(origin).host !== host && origin !== process.env.APP_ORIGIN) throw new ApiError(403, "Cross-origin request rejected");
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "Use application/json");
  if (Number(req.headers.get("content-length") || 0) > 1_000_000) throw new ApiError(413, "Request too large");
}
// Every business handler runs inside a branch-scoped transaction. Error responses
// roll back too: legacy handlers sometimes catch database errors themselves.
export function secureRoute(handler: Handler, permission: Permission | "session" | "public") {
  return async (req: Request, context: { params: Promise<Record<string, string>> } = { params: Promise.resolve({}) }): Promise<Response> => {
    try {
      authSecret();
      checkRequest(req);
      return await rootDb.transaction(async tx => requestContext.run({ tx }, async () => {
        const role = await tx.execute(sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`);
        if (role.rows[0]?.rolsuper || role.rows[0]?.rolbypassrls) throw new Error("Runtime database role must not bypass row security");
        await tx.execute(sql`select version from security_meta where version = 1`);
        await tx.execute(sql`select set_config('app.auth', '1', true)`);
        if (permission !== "public") {
          const cookie = req.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("pos_session="))?.slice(12);
          const claims = cookie ? verifyToken(cookie) : null;
          if (!claims) throw new ApiError(401, "Authentication required");
          const [fresh] = await tx.select().from(users).where(eq(users.id, claims.id));
          if (!fresh || fresh.sessionVersion !== claims.version) throw new ApiError(401, "Session revoked");
          const user = await activateUser(tx, fresh);
          if (permission !== "session" && !ROLE_PERMISSIONS[user.role]?.[permission]) throw new ApiError(403, "Access denied");
        }
        const params = (await context?.params) || {};
        const response = await handler(req, { params: Promise.resolve({ id: params.id || "" }) });
        if (response.status >= 400) throw new RollbackResponse(response);
        response.headers.set("Cache-Control", "no-store");
        return response;
      }));
    } catch (err) {
      if (err instanceof RollbackResponse) {
        // Do not expose legacy handlers' SQL/error internals to the browser.
        if (err.response.status >= 500) return errorResponse({ error: "Request failed" }, 500);
        return noStore(err.response as NextResponse);
      }
      // Database constraint rejections become clear 409/400 explanations,
      // never anonymous 500s (Drizzle may wrap the driver error).
      const driver: any = driverError(err);
      const detail = String(driver.constraint || (err as any)?.message || (err as any)?.cause?.message || "");
      // A stale database (migration not applied, or grants not re-run) gets
      // instructions instead of "Request failed".
      const drift = driver.code ? schemaDriftMessage(String(driver.code), String(driver.message || detail)) : null;
      if (drift) return errorResponse({ error: drift }, 503);
      // The app could not reach its database at all: that is the operator's
      // problem, not the user's, and it must not read as a wrong password.
      const unreachable = databaseUnreachableMessage(String(driver.code || ""), String(driver.message || detail));
      if (unreachable) return errorResponse({ error: unreachable }, 503);
      if (driver.code === "23505" || /duplicate key/i.test(detail)) {
        const label = /pin/i.test(detail) ? "That PIN is already used by another staff member in this branch. Choose a different PIN."
          : /email/i.test(detail) ? "That email is already registered."
          : /recipe/i.test(detail) ? "A recipe already exists for that dish."
          : /order_number/i.test(detail) ? "Order numbering collided; please retry."
          : /po_number/i.test(detail) ? "A purchase order with that number already exists."
          : /grn_number/i.test(detail) ? "A goods receipt with that number already exists."
          : /settings/i.test(detail) ? "That setting key is already in use."
          : "That record already exists.";
        return errorResponse({ error: label }, 409);
      }
      if (driver.code === "23503" || /foreign key/i.test(detail)) {
        return errorResponse({ error: "A linked record is missing or belongs to another branch." }, 409);
      }
      if (driver.code === "23514" || /check constraint/i.test(detail)) {
        return errorResponse({ error: "One of the values is not allowed." }, 400);
      }
      if (err instanceof ApiError) return errorResponse({ error: err.message }, err.status);
      if (err instanceof SyntaxError) return errorResponse({ error: "Invalid JSON" }, 400);
      console.error("API request failed", err);
      return errorResponse({ error: "Request failed" }, 500);
    }
  };
}
const rateDb = drizzle(new Pool({ connectionString: process.env.DATABASE_URL, max: 2 }));
// Counters commit independently of a rejected login's request transaction.
export async function rateLimit(key: string, maximum = 10) {
  const result = await rateDb.execute(sql`
    insert into auth_attempts (key, count, reset_at) values (${key}, 1, now() + interval '15 minutes')
    on conflict (key) do update set
      count = case when auth_attempts.reset_at <= now() then 1 else auth_attempts.count + 1 end,
      reset_at = case when auth_attempts.reset_at <= now() then now() + interval '15 minutes' else auth_attempts.reset_at end
    returning count`);
  if (Number(result.rows[0].count) > maximum) throw new ApiError(429, "Too many attempts. Try again in 15 minutes.");
}
