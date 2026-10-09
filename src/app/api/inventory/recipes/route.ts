import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  recipes,
  recipeIngredients,
  menuItems,
  ingredients,
  auditLogs,
} from "@/db/schema";
import { eq } from "drizzle-orm";

async function handleGET() {
  try {
    const allRecipes = await db.select().from(recipes);
    const allItems = await db.select().from(menuItems);
    const allIngredients = await db.select().from(ingredients);
    const allRecipeIngredients = await db.select().from(recipeIngredients);

    const enrichedRecipes = allRecipes.map((r) => {
      const item = allItems.find((i) => i.id === r.menuItemId);
      const rIngs = allRecipeIngredients
        .filter((ri) => ri.recipeId === r.id)
        .map((ri) => {
          const ing = allIngredients.find((i) => i.id === ri.ingredientId);
          return {
            ...ri,
            ingredientName: ing?.name || "Unknown",
            ingredientSku: ing?.sku,
            costPerUnit: ing?.costPerUnit || "0.00",
            totalCost: (Number(ri.quantity) * Number(ing?.costPerUnit || 0)).toFixed(2),
          };
        });

      const totalCost = rIngs.reduce((acc, curr) => acc + Number(curr.totalCost), 0);
      const sellingPrice = Number(item?.price || 0);
      const foodCostPercentage = sellingPrice > 0 ? ((totalCost / sellingPrice) * 100).toFixed(1) : "0.0";
      const grossMargin = sellingPrice > 0 ? (((sellingPrice - totalCost) / sellingPrice) * 100).toFixed(1) : "0.0";

      return {
        ...r,
        itemName: item?.name || "Unassigned",
        itemPrice: item?.price || "0.00",
        itemImageUrl: item?.imageUrl,
        ingredients: rIngs,
        calculatedCost: totalCost.toFixed(2),
        foodCostPercentage,
        grossMargin,
      };
    });

    return NextResponse.json({
      recipes: enrichedRecipes,
      menuItems: allItems,
      allIngredients,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const body = await req.json();
    const { menuItemId, yieldCount, prepInstructions, ingredients: ingList } = body;

    if (!menuItemId || !ingList || ingList.length === 0) {
      return NextResponse.json({ error: "Menu item and ingredients are required" }, { status: 400 });
    }

    // Check if recipe already exists
    const [existing] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.menuItemId, Number(menuItemId)))
      .limit(1);

    let recipeId = existing?.id;

    if (existing) {
      await db
        .update(recipes)
        .set({
          yieldCount: Number(yieldCount) || 1,
          prepInstructions: prepInstructions || "",
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, existing.id));

      // Remove old ingredients
      await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, existing.id));
    } else {
      const [newRec] = await db
        .insert(recipes)
        .values({
          menuItemId: Number(menuItemId),
          yieldCount: Number(yieldCount) || 1,
          prepInstructions: prepInstructions || "",
        })
        .returning();
      recipeId = newRec.id;

      // Mark menu item as having recipe
      await db
        .update(menuItems)
        .set({ hasRecipe: true })
        .where(eq(menuItems.id, Number(menuItemId)));
    }

    // Insert recipe ingredients
    let totalRecipeCost = 0;
    for (const ing of ingList) {
      const [currentIng] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, Number(ing.ingredientId)))
        .limit(1);

      const costPortion = currentIng ? Number(ing.quantity) * Number(currentIng.costPerUnit) : 0;
      totalRecipeCost += costPortion;

      await db.insert(recipeIngredients).values({
        recipeId: recipeId!,
        ingredientId: Number(ing.ingredientId),
        quantity: String(ing.quantity),
        unit: ing.unit || currentIng?.unit || "pcs",
        costPortion: costPortion.toFixed(2),
      });
    }

    // Update total cost on recipe and cost price on menu item
    await db
      .update(recipes)
      .set({ totalRecipeCost: totalRecipeCost.toFixed(2) })
      .where(eq(recipes.id, recipeId!));

    await db
      .update(menuItems)
      .set({ costPrice: totalRecipeCost.toFixed(2) })
      .where(eq(menuItems.id, Number(menuItemId)));

    await db.insert(auditLogs).values({
      action: "recipe_saved",
      entityType: "inventory",
      entityId: String(recipeId),
      details: `Saved recipe for menu item #${menuItemId}. Cost: $${totalRecipeCost.toFixed(2)}`,
    });

    return NextResponse.json({ success: true, recipeId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canModifyInventory");

export const POST = secureRoute(handlePOST, "canModifyInventory");
