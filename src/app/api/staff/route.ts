import { NextResponse } from "next/server";
import { eq, asc, sql } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { hashPassword, pinDigest, ROLE_PERMISSIONS, UserRole } from "@/lib/auth";
import { ApiError, secureRoute } from "@/lib/api";
const fields = { id: users.id, restaurantId: users.restaurantId, branchId: users.branchId, name: users.name, email: users.email, role: users.role,
  phone: users.phone, avatarUrl: users.avatarUrl, isActive: users.isActive, lastLogin: users.lastLogin, createdAt: users.createdAt };
export const GET = secureRoute(async () => NextResponse.json({ staff: await db.select(fields).from(users).orderBy(asc(users.name)) }), "canManageStaff");
export const POST = secureRoute(async req => {
  const actor = requestContext.getStore()!.user!;
  const body = await req.json();
  const { action } = body;
  if (body.branchId !== undefined && Number(body.branchId) !== actor.branchId) throw new ApiError(403, "Branch access denied");
  let employee;
  if (action === "create_employee") {
    const { name, email, password, pin, role, phone } = body;
    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
        typeof password !== "string" || password.length < 12 || password.length > 256 || (typeof role !== "string" || !Object.hasOwn(ROLE_PERMISSIONS, role))) throw new ApiError(400, "Valid name, email, role, and a password of 12–256 characters are required");
    if (actor.role !== "super_admin" && ["super_admin", "manager"].includes(role)) throw new ApiError(403, "Only owners may create privileged staff");
    if (pin && (typeof pin !== "string" || !/^\d{4,8}$/.test(pin))) throw new ApiError(400, "PIN must contain 4–8 digits");
    [employee] = await db.insert(users).values({ restaurantId: actor.restaurantId, branchId: actor.branchId, name: name.trim(), email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password), pin: pin ? hashPassword(pin) : null, pinLookup: pin ? pinDigest(pin) : null,
      role: role as UserRole, phone: typeof phone === "string" ? phone : null }).returning(fields);
  } else if (["toggle_active", "update_pin"].includes(action)) {
    const [target] = await db.select().from(users).where(eq(users.id, Number(body.userId))).for("update");
    if (!target) throw new ApiError(404, "Employee not found");
    if (actor.role !== "super_admin" && ["super_admin", "manager"].includes(target.role)) throw new ApiError(403, "Only owners may modify privileged staff");
    if (action === "toggle_active") {
      if (typeof body.isActive !== "boolean") throw new ApiError(400, "isActive must be a boolean");
      if (target.id === actor.id && !body.isActive) throw new ApiError(400, "Cannot deactivate your own account");
      [employee] = await db.update(users).set({ isActive: body.isActive, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, target.id)).returning(fields);
    } else {
      if (typeof body.pin !== "string" || !/^\d{4,8}$/.test(body.pin)) throw new ApiError(400, "PIN must contain 4–8 digits");
      [employee] = await db.update(users).set({ pin: hashPassword(body.pin), pinLookup: pinDigest(body.pin), sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, target.id)).returning(fields);
    }
  } else throw new ApiError(400, "Invalid action");
  await db.insert(auditLogs).values({ userId: actor.id, userName: actor.name, action, entityType: "user", entityId: String(employee.id) });
  return NextResponse.json({ success: true, employee });
}, "canManageStaff");
