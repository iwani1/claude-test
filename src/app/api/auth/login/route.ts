import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { createToken, verifyPassword, hashPassword, pinDigest, publicUser, cookieOptions } from "@/lib/auth";
import { activateUser, ApiError, assertNotThrottled, recordFailedAttempt, secureRoute } from "@/lib/api";
// Only wrong credentials are counted. A sign-in that succeeds is never counted,
// so a busy venue cannot lock itself out by signing in too often. The global
// key is a backstop against a flood of wrong passwords across many accounts.
const GLOBAL_FAILURE_KEY = "login:global";
const GLOBAL_FAILURE_LIMIT = 300;
export const POST = secureRoute(async (req) => {
  await assertNotThrottled(GLOBAL_FAILURE_KEY, GLOBAL_FAILURE_LIMIT);
  const { email, password, pin } = await req.json();
  let user;
  if (pin !== undefined) {
    // Anonymous PIN access is opt-in for a deployment pinned to one branch.
    const branchId = Number(process.env.PIN_LOGIN_BRANCH_ID);
    if (!Number.isSafeInteger(branchId) || branchId <= 0) throw new ApiError(400, "Sign in with email and password first");
    const pinKey = `pin:branch:${branchId}`;
    await assertNotThrottled(pinKey);
    if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
      await recordFailedAttempt(pinKey);
      await recordFailedAttempt(GLOBAL_FAILURE_KEY);
      throw new ApiError(401, "Invalid credentials");
    }
    [user] = await db.select().from(users).where(and(eq(users.branchId, branchId), eq(users.pinLookup, pinDigest(pin))));
    if (!user?.pin || !verifyPassword(pin, user.pin)) {
      await recordFailedAttempt(pinKey);
      await recordFailedAttempt(GLOBAL_FAILURE_KEY);
      throw new ApiError(401, "Invalid credentials");
    }
  } else {
    if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) throw new ApiError(400, "Email and password required");
    const normalized = email.trim().toLowerCase();
    const accountKey = `email:${normalized}`;
    await assertNotThrottled(accountKey);
    [user] = await db.select().from(users).where(eq(users.email, normalized));
    // Always perform a password KDF, including for unknown email addresses.
    const hash = user?.passwordHash || DUMMY_HASH;
    if (!verifyPassword(password, hash) || !user) {
      await recordFailedAttempt(accountKey);
      await recordFailedAttempt(GLOBAL_FAILURE_KEY);
      throw new ApiError(401, "Invalid credentials");
    }
  }
  const session = await activateUser(requestContext.getStore()!.tx, user);
  await db.update(users).set({ lastLogin: new Date(), ...(!pin && !user.passwordHash.startsWith("scrypt:") ? { passwordHash: hashPassword(password) } : {}) }).where(eq(users.id, user.id));
  await db.insert(auditLogs).values({ userId: user.id, userName: user.name, action: "user_login", entityType: "user", entityId: String(user.id) });
  const response = NextResponse.json({ success: true, user: publicUser(session) });
  response.cookies.set("pos_session", createToken(session), cookieOptions());
  return response;
}, "public");
const DUMMY_HASH = hashPassword("not-a-real-account-password");
