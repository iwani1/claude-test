import { requestContext } from "@/db";

/**
 * Who did it, for an activity-log row: the person signed in to this request
 * (N7 in docs/FINDINGS.md). Spread it into every audit insert:
 *
 *   await db.insert(auditLogs).values({ ...auditActor(), action: "...", ... });
 *
 * `npm run audit:workflows` refuses an audit insert that names no actor.
 * Outside a signed-in request (login, public routes) it is empty; those routes
 * set userId/userName themselves.
 */
export function auditActor(): { userId?: number; userName?: string } {
  const user = requestContext.getStore()?.user;
  return user ? { userId: user.id, userName: user.name } : {};
}
