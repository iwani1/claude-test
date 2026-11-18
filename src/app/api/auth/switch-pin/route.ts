import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { APPROVER_PIN_MESSAGE, APPROVER_PIN_MIN_LENGTH, cookieOptions, createToken, needsApproverPin, pinDigest, publicUser, verifyPasswordAsync, type UserRole } from "@/lib/auth";
import { ApiError, activateUser, assertNotThrottled, BRANCH_PIN_BACKSTOP, recordFailedAttempt, secureRoute } from "@/lib/api";
export const POST = secureRoute(async req => {
  const current = requestContext.getStore()!.user!;
  // Quick switches are routine on a shared till; only wrong PINs are counted.
  // They count against the person typing (so one mistyping cashier does not lock
  // the whole branch out, N13) and against a higher branch-wide backstop.
  const pinKey = `pin:user:${current.id}`;
  const branchKey = `pin:branch:${current.branchId}`;
  await assertNotThrottled(pinKey);
  await assertNotThrottled(branchKey, BRANCH_PIN_BACKSTOP);
  const { pin } = await req.json();
  if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
    await recordFailedAttempt(pinKey);
    await recordFailedAttempt(branchKey);
    throw new ApiError(400, "Invalid PIN");
  }
  const [user] = await db.select().from(users).where(eq(users.pinLookup, pinDigest(pin)));
  if (!user?.pin || !(await verifyPasswordAsync(pin, user.pin))) {
    await recordFailedAttempt(pinKey);
    await recordFailedAttempt(branchKey);
    throw new ApiError(401, "Invalid PIN");
  }
  // The owner account is never reachable by a PIN alone: a PIN is short, and a
  // manager who learned the owner's PIN could otherwise switch into full owner
  // powers (N5). The owner signs in with email and password.
  if (user.role === "super_admin") throw new ApiError(403, "The owner account signs in with email and password, not quick PIN switch.");
  // An approver's short legacy PIN no longer opens their account (N19).
  if (pin.length < APPROVER_PIN_MIN_LENGTH && needsApproverPin(user.role as UserRole, user.permissionOverrides)) {
    await recordFailedAttempt(pinKey);
    await recordFailedAttempt(branchKey);
    throw new ApiError(403, APPROVER_PIN_MESSAGE);
  }
  const session = await activateUser(requestContext.getStore()!.tx, user);
  // Name the person who is NOW signed in: they are the actor for everything
  // that follows, and a row that names the person who just left misleads
  // anyone reading the audit trail (it complicated a real disputed-payment
  // investigation in Oct 2026). The outgoing user stays traceable in the
  // details and as the entity the switch acted on.
  await db.insert(auditLogs).values({
    userId: user.id,
    userName: user.name,
    action: "pos_quick_pin_switch",
    entityType: "user",
    entityId: String(current.id),
    details: `Quick PIN switch at the till: ${current.name} handed over to ${user.name}`,
  });
  const response = NextResponse.json({ success: true, user: publicUser(session) });
  response.cookies.set("pos_session", createToken(session), cookieOptions());
  return response;
}, "session");
