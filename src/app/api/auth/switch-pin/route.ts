import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { cookieOptions, createToken, pinDigest, publicUser, verifyPassword } from "@/lib/auth";
import { ApiError, activateUser, assertNotThrottled, recordFailedAttempt, secureRoute } from "@/lib/api";
export const POST = secureRoute(async req => {
  const current = requestContext.getStore()!.user!;
  // Quick switches are routine on a shared till; only wrong PINs are counted.
  const pinKey = `pin:branch:${current.branchId}`;
  await assertNotThrottled(pinKey);
  const { pin } = await req.json();
  if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
    await recordFailedAttempt(pinKey);
    throw new ApiError(400, "Invalid PIN");
  }
  const [user] = await db.select().from(users).where(eq(users.pinLookup, pinDigest(pin)));
  if (!user?.pin || !verifyPassword(pin, user.pin)) {
    await recordFailedAttempt(pinKey);
    throw new ApiError(401, "Invalid PIN");
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
