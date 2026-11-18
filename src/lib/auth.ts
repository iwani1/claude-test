import crypto from "node:crypto";
import type { PermissionOverrides, RolePermissionSet, UserRole } from "./permissions";
export { APPROVER_PIN_MESSAGE, APPROVER_PIN_MIN_LENGTH, needsApproverPin, ROLE_PERMISSIONS, PERMISSION_DEFINITIONS, PERMISSION_KEYS, effectivePermissions, hasTerminalAccess, permissionOverridesFor, sanitizePermissionOverrides, TERMINAL_ACCESS_DENIED_MESSAGE } from "./permissions";
export type { PermissionKey, PermissionOverrides, RolePermissionSet, UserRole } from "./permissions";
export interface SessionUser {
  id: number; restaurantId: number; branchId: number; name: string; email: string;
  role: UserRole; avatarUrl?: string | null; sessionVersion: number;
  /** The owner's per-user selections for this account (role defaults are
   *  filled in in `permissions`). Empty for an untouched account. */
  permissionOverrides: PermissionOverrides;
  /** Effective permissions: role defaults + the owner's selections. Every
   *  gate, server and screen, reads this — never the role alone. */
  permissions: RolePermissionSet;
}
/** A session lasts this long without use. Every request from a session older
 *  than SESSION_RENEW_AFTER_SECONDS gets a fresh cookie (src/lib/api.ts), so a
 *  device in use stays signed in through a long shift, while an idle one signs
 *  out after 7–8 hours (P4 in docs/FINDINGS.md). */
export const SESSION_SECONDS = 60 * 60 * 8;
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60;
/** Hard limit from the original sign-in, however busy the device: renewal never
 *  keeps a session (or a stolen cookie) alive past this. */
export const SESSION_MAX_SECONDS = 60 * 60 * 16;
export function authSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 random characters");
  return value;
}
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

// Password and PIN hashing comes in two forms with identical output (P6 in
// docs/FINDINGS.md). scrypt at these settings costs ~50-150 ms of CPU, and the
// *Sync form does that on Node's only JavaScript thread, freezing every other
// till's request meanwhile. Request handlers must use the async forms, which
// run on libuv's worker threads; `npm run audit:workflows` refuses the sync
// forms anywhere under src/app or src/lib. The sync forms remain for one-off
// maintenance scripts, seeding and tests.

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, SCRYPT_OPTIONS, (err, key) => (err ? reject(err) : resolve(key))));
}
function pbkdf2Async(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => crypto.pbkdf2(password, salt, 10000, 64, "sha512", (err, key) => (err ? reject(err) : resolve(key))));
}

/** Hash a password or PIN without blocking the server. Use in request handlers. */
export async function hashPasswordAsync(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await scryptAsync(password, salt)).toString("hex")}`;
}

/** Check a password or PIN without blocking the server. Use in request handlers. */
export async function verifyPasswordAsync(password: string, stored: string): Promise<boolean> {
  try {
    if (typeof password !== "string" || password.length > 256) return false;
    const parts = stored.split(":");
    // Legacy passwords remain readable; successful login upgrades the hash.
    const expected = Buffer.from(parts.at(-1)!, "hex");
    const actual = parts[0] === "scrypt" ? await scryptAsync(password, parts[1]) : await pbkdf2Async(password, parts[0]);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    /* audit-ok: fails closed — an unverifiable comparison is not a pass */
    return false;
  }
}

/** Blocking form, for maintenance scripts, seeding and tests only. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
/** Blocking form, for maintenance scripts and tests only. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (typeof password !== "string" || password.length > 256) return false;
    const parts = stored.split(":");
    // Legacy passwords remain readable; successful login upgrades the hash.
    const expected = Buffer.from(parts.at(-1)!, "hex");
    const actual = parts[0] === "scrypt"
      ? crypto.scryptSync(password, parts[1], 64, SCRYPT_OPTIONS)
      : crypto.pbkdf2Sync(password, parts[0], 10000, 64, "sha512");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    /* audit-ok: fails closed — an unverifiable comparison is not a pass */
    return false;
  }
}
export function pinDigest(pin: string): string {
  return crypto.createHmac("sha256", authSecret()).update(`pin:${pin}`).digest("hex");
}
/** `auth` is when the person originally signed in; renewals carry it forward. */
export interface TokenClaims { id: number; version: number; exp: number; iat: number; auth: number; }
export function createToken(user: Pick<SessionUser, "id" | "sessionVersion">, originalAuth?: number): string {
  const iat = Math.floor(Date.now() / 1000);
  const auth = originalAuth ?? iat;
  // Never issue a token that outlives the hard limit from the original sign-in.
  const exp = Math.min(iat + SESSION_SECONDS, auth + SESSION_MAX_SECONDS);
  const data = Buffer.from(JSON.stringify({ id: user.id, version: user.sessionVersion, iat, auth, exp })).toString("base64url");
  return `${data}.${crypto.createHmac("sha256", authSecret()).update(data).digest("base64url")}`;
}
export function verifyToken(token: string): TokenClaims | null {
  const secret = authSecret();
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || token.length > 2048) return null;
    const [data, signature] = parts;
    const expected = crypto.createHmac("sha256", secret).update(data).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(payload.id) || payload.id <= 0 || !Number.isSafeInteger(payload.version) || payload.version < 0 ||
        !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) || payload.iat > now ||
        payload.exp <= now || payload.exp <= payload.iat || payload.exp - payload.iat > SESSION_SECONDS) return null;
    // Tokens issued before renewal existed carry no `auth`; their issue time is it.
    const auth = payload.auth === undefined ? payload.iat : payload.auth;
    if (!Number.isSafeInteger(auth) || auth > payload.iat || now - auth > SESSION_MAX_SECONDS) return null;
    return { id: payload.id, version: payload.version, iat: payload.iat, exp: payload.exp, auth };
  } catch {
    /* audit-ok: fails closed — an unverifiable token is no session */
    return null;
  }
}
export function publicUser(user: SessionUser) {
  const { sessionVersion: _version, ...safe } = user;
  return safe;
}
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS });

/** A renewed session cookie, if this session is due one: older than
 *  SESSION_RENEW_AFTER_SECONDS and still inside the hard limit. */
export function renewedSessionCookie(claims: TokenClaims, user: Pick<SessionUser, "id" | "sessionVersion">): string | null {
  const now = Math.floor(Date.now() / 1000);
  if (now - claims.iat < SESSION_RENEW_AFTER_SECONDS) return null;
  const token = createToken(user, claims.auth);
  const maxAge = Math.max(0, Math.min(SESSION_SECONDS, claims.auth + SESSION_MAX_SECONDS - now));
  if (maxAge <= 0) return null;
  const options = cookieOptions();
  return [`pos_session=${token}`, `Path=${options.path}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax", ...(options.secure ? ["Secure"] : [])].join("; ");
}

