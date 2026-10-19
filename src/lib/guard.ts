import { NextResponse } from "next/server";
import { requestContext } from "@/db";
import { ROLE_PERMISSIONS, SessionUser } from "./auth";
export type Permission = Exclude<keyof (typeof ROLE_PERMISSIONS)["super_admin"], "label">;
/** The one permission question every gate asks: the person's *effective*
 *  permissions (role defaults + the owner's per-user selections). Sessions
 *  built before per-user permissions existed fall back to the role matrix. */
export function hasPermission(user: { role: SessionUser["role"]; permissions?: SessionUser["permissions"] } | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.permissions) return user.permissions[permission] === true;
  return ROLE_PERMISSIONS[user.role]?.[permission] === true;
}
export async function getSessionUser(): Promise<SessionUser | null> {
  return requestContext.getStore()?.user ?? null;
}
export type GuardFailure = { ok: false; response: NextResponse };
export type GuardSuccess = { ok: true; user: SessionUser };
export async function requireSession(): Promise<GuardFailure | GuardSuccess> {
  const user = await getSessionUser();
  return user ? { ok: true, user } : { ok: false, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
}
export async function requirePermission(permission: Permission, _context: string): Promise<GuardFailure | GuardSuccess> {
  const session = await requireSession();
  if (!session.ok) return session;
  return hasPermission(session.user, permission) ? session :
    { ok: false, response: NextResponse.json({ error: "Access denied" }, { status: 403 }) };
}
