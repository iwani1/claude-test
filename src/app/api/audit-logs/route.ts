import { secureRoute, ApiError, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { auditListQuery } from "@/lib/audit-list-query";
import { requirePermission } from "@/lib/guard";
import { and, desc, gte, lt } from "drizzle-orm";

async function handleGET(req: Request) {
  try {
    // The audit trail exposes staff activity and every payment and refund, so it
    // is limited to the transaction-trail roles (owner, manager, accountant).
    const guard = await requirePermission("canViewTransactionTrail", "GET /api/audit-logs");
    if (!guard.ok) return guard.response;

    const { limit, offset, window } = auditListQuery(new URL(req.url).searchParams, 100, 500);
    const rows = await db.select().from(auditLogs)
      .where(window ? and(gte(auditLogs.createdAt, window.start!), lt(auditLogs.createdAt, window.end)) : undefined)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1).offset(offset);
    const hasMore = rows.length > limit;
    return NextResponse.json({ logs: rows.slice(0, limit), hasMore });
  } catch (err: unknown) {
    if (err instanceof ApiError || isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: "Could not load audit logs" }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canViewTransactionTrail");
