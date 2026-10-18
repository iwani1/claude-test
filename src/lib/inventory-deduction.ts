import { ApiError } from "./api";
import { db } from "@/db";
import { ingredients, recipes, recipeIngredients, stockMovements, orders } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";

export interface OrderItemDeduction {
  menuItemId: number;
  quantity: number;
}

export interface StockMutationResult {
  success: boolean;
  message?: string;
  /** True when the operation was skipped because it had already been applied. */
  alreadyApplied?: boolean;
  movements?: number;
}

/**
 * Collapses an order's line items into a single
 * { ingredientId -> total quantity } map by walking each item's recipe.
 *
 * Aggregating first means an ingredient shared by several dishes on the same
 * ticket is touched exactly once, which keeps the ledger readable and avoids
 * repeatedly locking the same row inside the transaction.
 */
async function resolveIngredientTotals(
  items: OrderItemDeduction[]
): Promise<Map<number, number>> {
  const totals = new Map<number, number>();
  const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
  if (menuItemIds.length === 0) return totals;

  const recipeRows = await db
    .select()
    .from(recipes)
    .where(inArray(recipes.menuItemId, menuItemIds));
  if (recipeRows.length === 0) return totals;

  const componentRows = await db
    .select()
    .from(recipeIngredients)
    .where(
      inArray(
        recipeIngredients.recipeId,
        recipeRows.map((r) => r.id)
      )
    );

  for (const item of items) {
    const recipe = recipeRows.find((r) => r.menuItemId === item.menuItemId);
    if (!recipe) continue; // Items without a recipe (e.g. bottled drinks) are not deducted.

    // A recipe that yields N portions consumes its ingredients once per N sold.
    const yieldCount = recipe.yieldCount && recipe.yieldCount > 0 ? recipe.yieldCount : 1;

    for (const comp of componentRows.filter((c) => c.recipeId === recipe.id)) {
      const required = (Number(comp.quantity) * item.quantity) / yieldCount;
      totals.set(comp.ingredientId, (totals.get(comp.ingredientId) ?? 0) + required);
    }
  }

  return totals;
}

/**
 * Applies a signed stock change for an order inside a single database
 * transaction.
 *
 * Concurrency / integrity guarantees:
 *  1. The `orders.stock_deducted` flag is flipped with a *conditional* UPDATE.
 *     Postgres evaluates that predicate atomically, so if two requests race
 *     (a double-tapped button, a retried fetch, or an offline replay), exactly
 *     one of them matches a row and the other is a no-op. This is the primary
 *     defence against double deduction.
 *  2. Each ingredient row is locked with SELECT ... FOR UPDATE before being
 *     read, so a concurrent order cannot read a stale balance between our
 *     read and our write.
 *  3. Everything commits or rolls back together, so stock levels and the
 *     movement ledger can never drift apart.
 */
async function applyStockChange(
  orderId: number,
  orderNumber: string,
  items: OrderItemDeduction[],
  direction: "deduct" | "restore",
  userId: number | undefined,
  reasonPrefix: string
): Promise<StockMutationResult> {
  // Restoration uses the actual deduction ledger, never today's editable recipe.
  const totals = direction === "deduct" ? await resolveIngredientTotals(items) : new Map<number, number>();
  if (direction === "restore") {
    // Net, never gross. Deductions are booked under the order number and every
    // restore under REF-<order number>, so summing both forms answers "what is
    // still taken out of stock for this order" — which is exactly what has to
    // go back. Summing the deductions alone would give back stock that an
    // earlier edit, cancel or refund had already returned.
    const movements = await db
      .select()
      .from(stockMovements)
      .where(sql`${stockMovements.referenceId} = ${orderNumber} OR ${stockMovements.referenceId} = ${`REF-${orderNumber}`}`);
    for (const movement of movements) totals.set(movement.ingredientId, (totals.get(movement.ingredientId) || 0) - Number(movement.quantityDelta));
  }

  return db.transaction(async (tx) => {
    // --- Step 1: atomically claim the operation -----------------------------
    // Deducting requires the flag to currently be false; restoring requires
    // it to be true. Either way only one caller can win the transition.
    const expectedCurrentFlag = direction === "deduct" ? false : true;
    const nextFlag = direction === "deduct";

    const claimed = await tx
      .update(orders)
      .set({ stockDeducted: nextFlag, updatedAt: new Date() })
      .where(sql`${orders.id} = ${orderId} AND ${orders.stockDeducted} = ${expectedCurrentFlag}`)
      .returning({ id: orders.id });

    if (claimed.length === 0) {
      // Another request already performed this exact transition.
      return {
        success: true,
        alreadyApplied: true,
        message:
          direction === "deduct"
            ? "Stock was already deducted for this order; skipping to prevent a duplicate."
            : "Stock was already restored for this order; skipping to prevent a duplicate.",
      };
    }

    if (totals.size === 0) {
      return { success: true, movements: 0, message: "No recipe-linked ingredients to adjust." };
    }

    // --- Step 2: mutate each ingredient under a row lock --------------------
    let movementCount = 0;

    // Sorting by id gives every transaction the same lock ordering, which
    // removes the classic deadlock where two tickets grab the same two
    // ingredients in opposite order.
    const ingredientIds = [...totals.keys()].sort((a, b) => a - b);

    for (const ingredientId of ingredientIds) {
      const magnitude = totals.get(ingredientId) ?? 0;
      if (magnitude <= 0) continue;

      const locked = await tx
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, ingredientId))
        .limit(1)
        .for("update"); // row-level lock held until commit

      const current = locked[0];
      if (!current) throw new ApiError(400, "Recipe ingredient not found in this branch");

      const previous = Number(current.currentStock);
      const delta = direction === "deduct" ? -magnitude : magnitude;
      // Reject shortages rather than silently creating a fictitious movement.
      const next = previous + delta;
      if (next < 0) throw new ApiError(409, `Insufficient ingredient stock: ${current.name} (have ${previous}, need ${magnitude})`);

      await tx
        .update(ingredients)
        .set({ currentStock: next.toFixed(3), updatedAt: new Date() })
        .where(eq(ingredients.id, ingredientId));

      await tx.insert(stockMovements).values({
        ingredientId,
        movementType: direction === "deduct" ? "order_deduction" : "return",
        quantityDelta: delta.toFixed(3),
        previousStock: previous.toFixed(3),
        newStock: next.toFixed(3),
        referenceId: direction === "deduct" ? orderNumber : `REF-${orderNumber}`,
        unitCost: current.costPerUnit,
        reason: `${reasonPrefix} ${orderNumber}`,
        createdById: userId,
      });

      movementCount += 1;
    }

    return { success: true, movements: movementCount };
  });
}

/**
 * Deducts every recipe-linked ingredient consumed by an order.
 * Safe to call more than once — repeat calls are ignored.
 */
export async function deductStockForOrder(
  orderId: number,
  orderNumber: string,
  items: OrderItemDeduction[],
  userId?: number
): Promise<StockMutationResult> {
  return applyStockChange(
    orderId,
    orderNumber,
    items,
    "deduct",
    userId,
    "Automatic recipe deduction for order"
  );
}

/**
 * Returns ingredients to stock when an order is voided or refunded.
 * Safe to call more than once — repeat calls are ignored.
 */
/**
 * Re-syncs the recipe deduction of an order whose lines have changed, in one
 * transaction.
 *
 * The move is the difference between what the order currently holds (the
 * ledger's net, already net of any earlier reversal) and what the new lines
 * require. "Undo everything, then deduct everything" is wrong here: it
 * double-counts as soon as an order has been edited, cancelled or partly
 * refunded before, and it can invent stock that never existed.
 *
 * A shortage rolls the whole move back (the caller writes nothing else first),
 * so a refused edit cannot leave the bill changed while the shelf disagrees.
 */
export async function resyncStockForOrder(
  orderId: number,
  orderNumber: string,
  items: OrderItemDeduction[],
  userId?: number
): Promise<StockMutationResult> {
  const required = await resolveIngredientTotals(items);

  return db.transaction(async (tx) => {
    const movements = await tx
      .select()
      .from(stockMovements)
      .where(sql`${stockMovements.referenceId} = ${orderNumber} OR ${stockMovements.referenceId} = ${`REF-${orderNumber}`}`);

    const held = new Map<number, number>(); // positive = still out of stock for this order
    for (const movement of movements) {
      held.set(movement.ingredientId, (held.get(movement.ingredientId) ?? 0) - Number(movement.quantityDelta));
    }

    const ingredientIds = [...new Set([...required.keys(), ...held.keys()])].sort((a, b) => a - b);
    let movementCount = 0;

    for (const ingredientId of ingredientIds) {
      if (!Number.isFinite(ingredientId)) continue;
      const target = required.get(ingredientId) ?? 0; // should be out of stock now
      const current = held.get(ingredientId) ?? 0; // is out of stock now
      const take = target - current; // positive: take more, negative: give back
      if (take === 0) continue;

      // Same lock ordering as applyStockChange, so two tickets touching the
      // same ingredients cannot deadlock against each other.
      const locked = await tx.select().from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1).for("update");
      const ingredient = locked[0];
      if (!ingredient) continue;

      const previous = Number(ingredient.currentStock);
      const next = previous - take;
      if (next < 0) {
        throw new ApiError(
          409,
          `Not enough ${ingredient.name} in stock: ${previous} ${ingredient.unit} on hand, the edited order needs ${target}. Nothing was changed.`
        );
      }

      await tx
        .update(ingredients)
        .set({ currentStock: next.toFixed(3), updatedAt: new Date() })
        .where(eq(ingredients.id, ingredientId));

      await tx.insert(stockMovements).values({
        ingredientId,
        movementType: take > 0 ? "order_deduction" : "return",
        quantityDelta: (-take).toFixed(3),
        previousStock: previous.toFixed(3),
        newStock: next.toFixed(3),
        referenceId: take > 0 ? orderNumber : `REF-${orderNumber}`,
        unitCost: ingredient.costPerUnit,
        reason: `Edited order ${orderNumber}: stock re-synced to the saved lines`,
        createdById: userId,
      });
      movementCount += 1;
    }

    // The order holds a deduction exactly when its lines still consume stock.
    await tx.update(orders).set({ stockDeducted: required.size > 0, updatedAt: new Date() }).where(eq(orders.id, orderId));

    return { success: true, movements: movementCount, message: "Edited order stock re-synced." };
  });
}

export async function reverseStockForOrder(
  orderId: number,
  orderNumber: string,
  items: OrderItemDeduction[],
  userId?: number
): Promise<StockMutationResult> {
  return applyStockChange(
    orderId,
    orderNumber,
    items,
    "restore",
    userId,
    "Stock returned from void/refund on order"
  );
}
