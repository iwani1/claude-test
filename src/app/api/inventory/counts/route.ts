import { secureRoute, ApiError, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import { stockCounts, ingredients, stockMovements, auditLogs, users } from "@/db/schema";
import { auditListQuery } from "@/lib/audit-list-query";
import { and, desc, eq, gte, lt } from "drizzle-orm";

async function handleGET(req: Request) {
  try {
    const { limit, offset, window } = auditListQuery(new URL(req.url).searchParams, 20, 100);
    const rows = await db.select({ count: stockCounts, conductedByName: users.name })
      .from(stockCounts).leftJoin(users, eq(stockCounts.conductedBy, users.id))
      .where(window ? and(gte(stockCounts.countDate, window.start!), lt(stockCounts.countDate, window.end)) : undefined)
      .orderBy(desc(stockCounts.countDate), desc(stockCounts.id))
      .limit(limit + 1).offset(offset);
    const hasMore = rows.length > limit;
    return NextResponse.json({
      counts: rows.slice(0, limit).map(({ count, conductedByName }) => ({ ...count, conductedByName })),
      hasMore,
    });
  } catch (err: unknown) {
    if (err instanceof ApiError || isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: "Could not load stock counts" }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const body = await req.json();
    const { items, notes, conductedBy, reconcileToSystem } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Stock count items required" }, { status: 400 });
    }

    const [newCount] = await db
      .insert(stockCounts)
      .values({
        conductedBy: requestContext.getStore()!.user!.id,
        notes: notes || "Weekly physical inventory cycle count",
        status: reconcileToSystem ? "reconciled" : "completed",
        items,
      })
      .returning();

    // If reconcileToSystem is selected, update actual stock to match physical count!
    if (reconcileToSystem) {
      for (const it of items) {
        if (it.diff && Math.abs(Number(it.diff)) > 0.001) {
          const [current] = await db
            .select()
            .from(ingredients)
            .where(eq(ingredients.id, Number(it.ingredientId)))
            .limit(1);

          if (current) {
            await db
              .update(ingredients)
              .set({ currentStock: String(it.physicalStock), updatedAt: new Date() })
              .where(eq(ingredients.id, current.id));

            await db.insert(stockMovements).values({
              ingredientId: current.id,
              movementType: "adjustment",
              quantityDelta: String(it.diff),
              previousStock: String(it.systemStock),
              newStock: String(it.physicalStock),
              referenceId: `COUNT-${newCount.id}`,
              unitCost: current.costPerUnit,
              reason: `Physical count variance reconciliation: ${it.diff} ${current.unit}`,
              createdById: requestContext.getStore()!.user!.id,
            });
          }
        }
      }
    }

    await db.insert(auditLogs).values({
      action: "stock_count_recorded",
      entityType: "inventory",
      entityId: String(newCount.id),
      details: `Stock count #${newCount.id} submitted (${items.length} items counted, reconciled=${!!reconcileToSystem})`,
    });

    return NextResponse.json({ success: true, count: newCount });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canModifyInventory");

export const POST = secureRoute(handlePOST, "canModifyInventory");
