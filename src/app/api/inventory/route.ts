import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { ingredients, stockMovements, suppliers, auditLogs } from "@/db/schema";
import { requirePermission } from "@/lib/guard";
import { eq, desc, asc } from "drizzle-orm";

async function handleGET() {
  try {
    const rawIngredients = await db.select().from(ingredients).orderBy(asc(ingredients.name));
    const allSuppliers = await db.select().from(suppliers);
    const recentMovements = await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt)).limit(50);

    const enrichedIngredients = rawIngredients.map((ing) => {
      const sup = allSuppliers.find((s) => s.id === ing.supplierId);
      const stock = Number(ing.currentStock);
      const minStock = Number(ing.minStockLevel);
      const unitCost = Number(ing.costPerUnit);
      return {
        ...ing,
        supplierName: sup?.name || "Unassigned",
        isLowStock: stock <= minStock,
        valuation: (stock * unitCost).toFixed(2),
      };
    });

    // Summary calculations
    const totalValuation = enrichedIngredients.reduce((acc, curr) => acc + Number(curr.valuation), 0);
    const lowStockCount = enrichedIngredients.filter((i) => i.isLowStock).length;

    return NextResponse.json({
      ingredients: enrichedIngredients,
      movements: recentMovements,
      totalValuation: totalValuation.toFixed(2),
      lowStockCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    // Cashiers and kitchen staff must never alter stock quantities or costs.
    const guard = await requirePermission("canModifyInventory", "POST /api/inventory");
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { action } = body;

    if (action === "create_ingredient") {
      const { name, sku, category, currentStock, minStockLevel, unit, costPerUnit, supplierId, location } = body;
      const [newIng] = await db
        .insert(ingredients)
        .values({
          name,
          sku: sku || `ING-${Date.now().toString().slice(-6)}`,
          category: category || "general",
          currentStock: String(currentStock || "0.000"),
          minStockLevel: String(minStockLevel || "5.000"),
          unit: unit || "kg",
          costPerUnit: String(costPerUnit || "0.00"),
          supplierId: supplierId ? Number(supplierId) : null,
          location: location || "Main Storage",
        })
        .returning();

      await db.insert(auditLogs).values({
        action: "ingredient_created",
        entityType: "inventory",
        entityId: String(newIng.id),
        details: `Created new ingredient "${newIng.name}" (Initial: ${newIng.currentStock} ${newIng.unit})`,
      });

      return NextResponse.json({ success: true, ingredient: newIng });
    }

    if (action === "adjust_stock") {
      const { ingredientId, delta, movementType, reason } = body;

      // Lock the ingredient row so two adjustments (or a double tap) cannot
      // read the same starting stock and lose one of the movements, and so the
      // stock, the ledger line and the audit entry commit together.
      const deltaNum = Number(delta);
      if (!Number.isFinite(deltaNum) || deltaNum === 0) {
        return NextResponse.json({ error: "Enter a non-zero adjustment amount." }, { status: 400 });
      }

      const outcome = await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(ingredients)
          .where(eq(ingredients.id, Number(ingredientId)))
          .limit(1)
          .for("update");
        if (!locked) return { error: "Ingredient not found", status: 404 };

        const prevStock = Number(locked.currentStock);
        const newStock = Math.max(0, prevStock + deltaNum);
        // What actually moved, after the floor at zero: the ledger must agree
        // with the stock it wrote.
        const appliedDelta = newStock - prevStock;

        const [updated] = await tx
          .update(ingredients)
          .set({ currentStock: newStock.toFixed(3), updatedAt: new Date() })
          .where(eq(ingredients.id, Number(ingredientId)))
          .returning();

        await tx.insert(stockMovements).values({
          ingredientId: Number(ingredientId),
          movementType: movementType || "adjustment",
          quantityDelta: appliedDelta.toFixed(3),
          previousStock: prevStock.toFixed(3),
          newStock: newStock.toFixed(3),
          unitCost: locked.costPerUnit,
          reason: reason || "Manual inventory adjustment",
          // Attribution comes from the verified session, never from the client body.
          createdById: guard.user.id,
        });

        await tx.insert(auditLogs).values({
          userId: guard.user.id,
          userName: guard.user.name,
          action: "stock_adjusted",
          entityType: "inventory",
          entityId: String(ingredientId),
          details: `${movementType || "Stock adjustment"}: ${appliedDelta > 0 ? "+" : ""}${appliedDelta} ${locked.unit} on "${locked.name}". New: ${newStock.toFixed(3)} ${locked.unit}. By ${guard.user.name}`,
        });

        return { ok: true as const, updated };
      });

      if ("error" in outcome) {
        return NextResponse.json({ error: outcome.error }, { status: outcome.status });
      }

      return NextResponse.json({ success: true, ingredient: outcome.updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canModifyInventory");

export const POST = secureRoute(handlePOST, "canModifyInventory");
