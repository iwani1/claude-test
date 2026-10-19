import { NextResponse } from "next/server";
import { requestContext } from "@/db";
import { publicUser } from "@/lib/auth";
import { secureRoute } from "@/lib/api";
export const GET = secureRoute(async () => {
  const user = requestContext.getStore()!.user!;
  return NextResponse.json({ authenticated: true, user: publicUser(user), permissions: user.permissions });
}, "session");
