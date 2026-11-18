import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { APPROVER_PIN_MIN_LENGTH, createToken, needsApproverPin, verifyPasswordAsync, hashPasswordAsync, pinDigest, publicUser, cookieOptions, type UserRole } from "@/lib/auth";
import { activateUser, ApiError, assertNotThrottled, clientAddress, recordFailedAttempt, secureRoute } from "@/lib/api";
// Only wrong credentials are counted. A sign-in that succeeds is never counted,
// so a busy venue cannot lock itself out by signing in too often.
//
// Every limit below is scoped so that whoever trips it is the one locked out
// (P2 in docs/FINDINGS.md). There used to be a site-wide limit that refused
// *every* login after 300 failures from anywhere, which let one stranger lock the
// whole restaurant out indefinitely.
//   - per address: one source cannot spray guesses across many accounts;
//   - per account per address: the normal lock for one person guessing one account;
//   - per account overall: a backstop against guessing one account from many addresses.
// The site-wide count is still kept, but only to raise an alert in the server log.
const ADDRESS_LIMIT = 30;
const ACCOUNT_ADDRESS_LIMIT = 10;
const ACCOUNT_LIMIT = 50;
const GLOBAL_FAILURE_KEY = "login:global";
const GLOBAL_ALERT_EVERY = 300;

/** Count a site-wide failure and, at every 300th in a window, log a structured
 *  alert for the operator. Never refuses a request. */
async function countGlobalFailure(address: string) {
  const total = await recordFailedAttempt(GLOBAL_FAILURE_KEY);
  if (total > 0 && total % GLOBAL_ALERT_EVERY === 0) {
    console.error(JSON.stringify({ level: "warn", event: "login_failure_surge", failuresInWindow: total, lastAddress: address }));
  }
}

export const POST = secureRoute(async (req) => {
  const address = clientAddress(req);
  const addressKey = `login:ip:${address}`;
  await assertNotThrottled(addressKey, ADDRESS_LIMIT);
  const { email, password, pin } = await req.json();
  let user;
  if (pin !== undefined) {
    // Anonymous PIN access is opt-in for a deployment pinned to one branch.
    const branchId = Number(process.env.PIN_LOGIN_BRANCH_ID);
    if (!Number.isSafeInteger(branchId) || branchId <= 0) throw new ApiError(400, "Sign in with email and password first");
    const pinKey = `pin:branch:${branchId}`;
    await assertNotThrottled(pinKey);
    const fail = async () => {
      await recordFailedAttempt(pinKey);
      await recordFailedAttempt(addressKey);
      await countGlobalFailure(address);
      throw new ApiError(401, "Invalid credentials");
    };
    if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) await fail();
    [user] = await db.select().from(users).where(and(eq(users.branchId, branchId), eq(users.pinLookup, pinDigest(pin))));
    if (!user?.pin || !(await verifyPasswordAsync(pin, user.pin))) await fail();
    // An approver's short legacy PIN does not sign in either (N19).
    if (pin.length < APPROVER_PIN_MIN_LENGTH && needsApproverPin(user!.role as UserRole, user!.permissionOverrides)) await fail();
  } else {
    if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) throw new ApiError(400, "Email and password required");
    const normalized = email.trim().toLowerCase();
    const accountKey = `email:${normalized}`;
    const accountAddressKey = `email:${normalized}:ip:${address}`;
    await assertNotThrottled(accountAddressKey, ACCOUNT_ADDRESS_LIMIT);
    await assertNotThrottled(accountKey, ACCOUNT_LIMIT);
    [user] = await db.select().from(users).where(eq(users.email, normalized));
    // Always perform a password KDF, including for unknown email addresses.
    const hash = user?.passwordHash || await dummyHash();
    if (!(await verifyPasswordAsync(password, hash)) || !user) {
      await recordFailedAttempt(accountAddressKey);
      await recordFailedAttempt(accountKey);
      await recordFailedAttempt(addressKey);
      await countGlobalFailure(address);
      throw new ApiError(401, "Invalid credentials");
    }
  }
  const session = await activateUser(requestContext.getStore()!.tx, user);
  await db.update(users).set({ lastLogin: new Date(), ...(!pin && !user!.passwordHash.startsWith("scrypt:") ? { passwordHash: await hashPasswordAsync(password) } : {}) }).where(eq(users.id, user!.id));
  await db.insert(auditLogs).values({ userId: user!.id, userName: user!.name, action: "user_login", entityType: "user", entityId: String(user!.id) });
  const response = NextResponse.json({ success: true, user: publicUser(session) });
  response.cookies.set("pos_session", createToken(session), cookieOptions());
  return response;
}, "public");
// Unknown emails are checked against this, so they take as long as real ones.
// Made once, on first use, off the main thread.
let dummyHashPromise: Promise<string> | undefined;
const dummyHash = () => (dummyHashPromise ??= hashPasswordAsync("not-a-real-account-password"));
