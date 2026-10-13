import crypto from "node:crypto";
import type { UserRole } from "./permissions";
export { ROLE_PERMISSIONS, hasTerminalAccess, TERMINAL_ACCESS_DENIED_MESSAGE } from "./permissions";
export type { UserRole } from "./permissions";
export interface SessionUser {
  id: number; restaurantId: number; branchId: number; name: string; email: string;
  role: UserRole; avatarUrl?: string | null; sessionVersion: number;
}
export const SESSION_SECONDS = 60 * 60 * 8;
export function authSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 random characters");
  return value;
}
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (typeof password !== "string" || password.length > 256) return false;
    const parts = stored.split(":");
    // Legacy passwords remain readable; successful login upgrades the hash.
    const expected = Buffer.from(parts.at(-1)!, "hex");
    const actual = parts[0] === "scrypt"
      ? crypto.scryptSync(password, parts[1], 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
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
export interface TokenClaims { id: number; version: number; exp: number; iat: number; }
export function createToken(user: Pick<SessionUser, "id" | "sessionVersion">): string {
  const iat = Math.floor(Date.now() / 1000);
  const data = Buffer.from(JSON.stringify({ id: user.id, version: user.sessionVersion, iat, exp: iat + SESSION_SECONDS })).toString("base64url");
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
    return payload;
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

