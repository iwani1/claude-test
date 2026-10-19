import { NextResponse } from "next/server";
import { eq, and, asc, isNull, sql } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { users, shifts, auditLogs } from "@/db/schema";
import { effectivePermissions, hashPassword, permissionOverridesFor, pinDigest, PERMISSION_KEYS, ROLE_PERMISSIONS, sanitizePermissionOverrides, UserRole, type PermissionKey } from "@/lib/auth";
import { ApiError, secureRoute } from "@/lib/api";
import { columnExists } from "@/lib/schema-guard";
const fields = { id: users.id, restaurantId: users.restaurantId, branchId: users.branchId, name: users.name, email: users.email, role: users.role,
  phone: users.phone, avatarUrl: users.avatarUrl, isActive: users.isActive, lastLogin: users.lastLogin, createdAt: users.createdAt };
// A removed account keeps its row — orders, payments and refunds point at it,
// and the name on those sales has to stay right — but loses every way back in.
// The address moves to a reserved TLD (freeing the real one for a rehire) and
// the password hash becomes a value no password can produce: verifyPassword
// fails closed on it.
const REMOVED_EMAIL_SUFFIX = "@deleted.invalid";
const REMOVED_PASSWORD_HASH = "!removed";
/** The owner's permission selection from a request body: a plain object whose
 *  keys are known permissions and whose values are booleans. Anything else is
 *  refused rather than silently dropped, so a typo can never read as "no
 *  change intended". Missing keys mean "the role default". */
function selectedPermissions(value: unknown): Partial<Record<PermissionKey, boolean>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "Permissions must be a set of on/off choices");
  const selected: Partial<Record<PermissionKey, boolean>> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!(PERMISSION_KEYS as readonly string[]).includes(key) || typeof entry !== "boolean") {
      throw new ApiError(400, `Unknown or invalid permission: ${key}`);
    }
    selected[key as PermissionKey] = entry;
  }
  return selected;
}
/** A roster row as the staff screen needs it: role defaults plus the owner's
 *  per-user selections, resolved to the permissions the person actually has. */
function withPermissions<T extends { role: string; permissionOverrides?: unknown }>(row: T) {
  const permissionOverrides = sanitizePermissionOverrides(row.permissionOverrides);
  return { ...row, permissionOverrides, permissions: effectivePermissions(row.role as UserRole, permissionOverrides) };
}
/** Whether the account has been removed. Asks the catalogue first: on a database
 *  that has not run 0005 nothing can have been removed, so the answer is no
 *  rather than a failed query. The `deleted_at` column is the authority — the
 *  email tombstone is not, because any address can be typed in. */
async function isRemoved(userId: number): Promise<boolean> {
  if (!(await columnExists(db, "users", "deleted_at"))) return false;
  const result = await db.execute(sql`select deleted_at from users where id = ${userId}`);
  return result.rows[0]?.deleted_at != null;
}
export const GET = secureRoute(async () => {
  // 0005 not applied on this database yet: nothing has been removed there, so
  // the full roster is the honest answer and the staff screen keeps working
  // while the migration is pending (removal itself still asks for it — see the
  // delete_user branch). The catalogue is asked before choosing, because a
  // query that fails would abort the request's whole transaction.
  const removable = await columnExists(db, "users", "deleted_at");
  // 0009 not applied yet: nobody has selections on that database, so role
  // defaults are the exact answer and the roster keeps working.
  const customisable = await columnExists(db, "users", "permission_overrides");
  const projection = customisable ? { ...fields, permissionOverrides: users.permissionOverrides } : fields;
  const rows = removable
    ? await db.select(projection as typeof fields).from(users).where(sql`deleted_at is null`).orderBy(asc(users.name))
    : await db.select(projection as typeof fields).from(users).orderBy(asc(users.name));
  return NextResponse.json({ staff: rows.map((row) => withPermissions(row as typeof row & { permissionOverrides?: unknown })) });
}, "canManageStaff");
export const POST = secureRoute(async req => {
  const actor = requestContext.getStore()!.user!;
  const body = await req.json();
  const { action } = body;
  if (body.branchId !== undefined && Number(body.branchId) !== actor.branchId) throw new ApiError(403, "Branch access denied");
  let employee;
  let note: string | null = null;
  let permissionAudit = "";
  try {
  if (action === "create_employee") {
    const { name, email, password, pin, role, phone } = body;
    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
        typeof password !== "string" || password.length < 12 || password.length > 256 || (typeof role !== "string" || !Object.hasOwn(ROLE_PERMISSIONS, role))) throw new ApiError(400, "Valid name, email, role, and a password of 12–256 characters are required");
    if (actor.role !== "super_admin" && ["super_admin", "manager"].includes(role)) throw new ApiError(403, "Only owners may create privileged staff");
    if (pin && (typeof pin !== "string" || !/^\d{4,8}$/.test(pin))) throw new ApiError(400, "PIN must contain 4–8 digits");
    // Selecting permissions is the owner's call, at creation as afterwards.
    // What is stored is only where the selection differs from the role.
    let permissionOverrides = {};
    if (body.permissions !== undefined) {
      if (actor.role !== "super_admin") throw new ApiError(403, "Only the owner may select permissions");
      permissionOverrides = permissionOverridesFor(role as UserRole, selectedPermissions(body.permissions));
    }
    [employee] = await db.insert(users).values({ restaurantId: actor.restaurantId, branchId: actor.branchId, name: name.trim(), email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password), pin: pin ? hashPassword(pin) : null, pinLookup: pin ? pinDigest(pin) : null,
      role: role as UserRole, permissionOverrides, phone: typeof phone === "string" ? phone : null }).returning(fields);
    employee = withPermissions({ ...employee, permissionOverrides });
  } else if (["toggle_active", "update_pin", "reset_password", "delete_user", "update_permissions"].includes(action)) {
    const [target] = await db.select().from(users).where(eq(users.id, Number(body.userId))).for("update");
    if (!target) throw new ApiError(404, "Employee not found");
    const removed = await isRemoved(target.id);
    if (action === "delete_user") {
      // Owner only: this takes away a person's ability to sign in. The activity
      // log keeps who did it; their sales history stays behind untouched.
      if (actor.role !== "super_admin") throw new ApiError(403, "Only the owner may remove a staff account");
      if (target.id === actor.id) throw new ApiError(400, "You cannot remove your own account");
      if (removed) throw new ApiError(409, "That account was already removed");
      const [openShift] = await db.select({ id: shifts.id }).from(shifts)
        .where(and(eq(shifts.userId, target.id), isNull(shifts.closedAt))).limit(1);
      await db.execute(sql`
        update users set deleted_at = now(), is_active = false, email = ${`removed-${target.id}${REMOVED_EMAIL_SUFFIX}`},
          password_hash = ${REMOVED_PASSWORD_HASH}, pin = null, pin_lookup = null, phone = null, avatar_url = null,
          session_version = session_version + 1
        where id = ${target.id}`);
      // Re-read through the redacting projection: the response never carries a hash.
      [employee] = await db.select(fields).from(users).where(eq(users.id, target.id));
      if (openShift) note = `Shift #${openShift.id} is still open. Close it on the Drawer screen so its cash is reconciled.`;
    } else {
      // A removed account is closed for good. Reviving it through another action
      // (password reset, reactivation, PIN) would bring back a login the owner
      // removed, and the roster would not show it.
      if (removed) throw new ApiError(409, "This staff account was removed and can no longer be changed. Its sales history is kept.");
      if (actor.role !== "super_admin" && ["super_admin", "manager"].includes(target.role)) throw new ApiError(403, "Only owners may modify privileged staff");
      if (action === "update_permissions") {
        // Selecting what a person may do is the owner's call alone — even a
        // manager who manages staff day-to-day cannot grant or revoke access.
        if (actor.role !== "super_admin") throw new ApiError(403, "Only the owner may select permissions");
        if (target.role === "super_admin") throw new ApiError(400, "Owner accounts always have full access and cannot be limited");
        const before = effectivePermissions(target.role as UserRole, target.permissionOverrides);
        const overrides = permissionOverridesFor(target.role as UserRole, selectedPermissions(body.permissions));
        const after = effectivePermissions(target.role as UserRole, overrides);
        const granted = PERMISSION_KEYS.filter((key) => after[key] && !before[key]);
        const revoked = PERMISSION_KEYS.filter((key) => !after[key] && before[key]);
        permissionAudit = `${actor.name} updated permissions for ${target.name}: ` +
          [granted.length ? `granted ${granted.join(", ")}` : "", revoked.length ? `revoked ${revoked.join(", ")}` : ""].filter(Boolean).join("; ") +
          (!granted.length && !revoked.length ? "reset to role defaults" : "");
        // Sessions are revoked so the person's screens match their new access
        // on the next sign-in; the server enforces the change immediately
        // either way, because every request re-reads the account.
        [employee] = await db.update(users).set({ permissionOverrides: overrides, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, target.id)).returning(fields);
        employee = withPermissions({ ...employee, permissionOverrides: overrides });
      } else if (action === "toggle_active") {
        if (typeof body.isActive !== "boolean") throw new ApiError(400, "isActive must be a boolean");
        if (target.id === actor.id && !body.isActive) throw new ApiError(400, "Cannot deactivate your own account");
        [employee] = await db.update(users).set({ isActive: body.isActive, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, target.id)).returning(fields);
      } else if (action === "update_pin") {
        if (typeof body.pin !== "string" || !/^\d{4,8}$/.test(body.pin)) throw new ApiError(400, "PIN must contain 4–8 digits");
        [employee] = await db.update(users).set({ pin: hashPassword(body.pin), pinLookup: pinDigest(body.pin), sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, target.id)).returning(fields);
      } else {
        // Password reset (self or managed account) always revokes existing sessions.
        if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 256) throw new ApiError(400, "Password must be 12–256 characters");
        [employee] = await db.update(users).set({ passwordHash: hashPassword(body.password), sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, target.id)).returning(fields);
      }
    }
  } else throw new ApiError(400, "Invalid action");
  } catch (err: any) {
    // Unique violations must not surface as anonymous server failures.
    // Drizzle may wrap the driver error, so unwrap defensively.
    const driver = err?.code ? err : err?.cause?.code ? err.cause : {};
    const detail = String(driver.constraint || err?.message || err?.cause?.message || "");
    if (driver.code === "23505" || /duplicate key/i.test(detail)) {
      if (/pin/i.test(detail)) throw new ApiError(409, "That PIN is already used by another staff member in this branch. Choose a different PIN.");
      if (/email/i.test(detail)) throw new ApiError(409, "That email is already registered.");
      throw new ApiError(409, "That record already exists.");
    }
    throw err;
  }
  await db.insert(auditLogs).values({ userId: actor.id, userName: actor.name, action, entityType: "user", entityId: String(employee.id),
    ...(action === "delete_user" ? { details: `${employee.name} was removed from the staff roster. Past sales keep this account's name.` }
      : action === "update_permissions" ? { details: permissionAudit } : {}) });
  return NextResponse.json({ success: true, employee, note });
}, "canManageStaff");
