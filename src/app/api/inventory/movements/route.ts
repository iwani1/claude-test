import { secureRoute, ApiError, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockMovements } from "@/db/schema";
import { auditListQuery } from "@/lib/audit-list-query";
import { and, desc, gte, lt } from "drizzle-orm";

async function handleGET(req: Request) {
  try {
    // The stock ledger has its own read gate, the same as Ingredient Stock.
    // Filter before pagination so an older date is not limited to the latest 50.
    const { limit, offset, window } = auditListQuery(new URL(req.url).searchParams, 50, 500);
    const rows = await db.select().from(stockMovements)
      .where(window ? and(gte(stockMovements.createdAt, window.start!), lt(stockMovements.createdAt, window.end)) : undefined)
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(limit + 1).offset(offset);
    const hasMore = rows.length > limit;
    return NextResponse.json({ movements: rows.slice(0, limit), hasMore });
  } catch (err: unknown) {
    if (err instanceof ApiError || isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: "Could not load stock movements" }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canModifyInventory");
