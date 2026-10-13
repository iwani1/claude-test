import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import { stockCounts, ingredients, stockMovements, auditLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

async function handleGET() {
  try {
    const counts = await db.select().from(stockCounts).orderBy(desc(stockCounts.countDate)).limit(20);
    return NextResponse.json({ counts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canModifyInventory");

export const POST = secureRoute(handlePOST, "canModifyInventory");
