import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, requestContext } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { cookieOptions } from "@/lib/auth";
import { secureRoute } from "@/lib/api";
export const POST = secureRoute(async () => {
  const user = requestContext.getStore()!.user!;
  // Revokes all this user's sessions, including copied cookies.
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, user.id));
  await db.insert(auditLogs).values({ userId: user.id, userName: user.name, action: "user_logout", entityType: "user", entityId: String(user.id) });
  const response = NextResponse.json({ success: true });
  response.cookies.set("pos_session", "", { ...cookieOptions(), maxAge: 0 });
  return response;
}, "session");
