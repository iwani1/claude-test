import { secureRoute, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requirePermission } from "@/lib/guard";
import { desc } from "drizzle-orm";

async function handleGET(req: Request) {
  try {
    // The audit trail exposes staff activity and money movement, so it is
    // limited to roles that already hold reporting rights.
    const guard = await requirePermission("canViewReports", "GET /api/audit-logs");
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 100);

    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
    return NextResponse.json({ logs });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canViewReports");
