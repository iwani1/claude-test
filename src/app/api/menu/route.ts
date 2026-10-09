import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  menuCategories,
  menuItems,
  modifiers,
  modifierOptions,
  menuItemModifiers,
  auditLogs,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";

async function handleGET() {
  try {
    const categories = await db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.isActive, true))
      .orderBy(asc(menuCategories.sortOrder));

    const items = await db
      .select()
      .from(menuItems)
      .orderBy(asc(menuItems.id));

    const mods = await db.select().from(modifiers);
    const modOpts = await db.select().from(modifierOptions).orderBy(asc(modifierOptions.sortOrder));
    const itemModLinks = await db.select().from(menuItemModifiers);

    // Structure modifiers with their options
    const modifiersWithOpts = mods.map((m) => ({
      ...m,
      options: modOpts.filter((opt) => opt.modifierId === m.id),
    }));

    // Attach modifiers to items
    const enrichedItems = items.map((item) => {
      const linkedModIds = itemModLinks
        .filter((l) => l.menuItemId === item.id)
        .map((l) => l.modifierId);
      const itemMods = modifiersWithOpts.filter((m) => linkedModIds.includes(m.id));

      return {
        ...item,
        modifiers: itemMods,
      };
    });

    return NextResponse.json({
      categories,
      items: enrichedItems,
      allModifiers: modifiersWithOpts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const body = await req.json();
    const {
      categoryId,
      name,
      description,
      sku,
      price,
      costPrice,
      imageUrl,
      prepTimeMinutes,
      station,
      isAvailable,
      isFeatured,
      hasRecipe,
      modifierIds,
    } = body;

    if (!name || !price || !categoryId) {
      return NextResponse.json({ error: "Name, price, and category are required" }, { status: 400 });
    }

    const [newItem] = await db
      .insert(menuItems)
      .values({
        categoryId: Number(categoryId),
        name,
        description: description || "",
        sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
        price: String(price),
        costPrice: String(costPrice || "0.00"),
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80",
        prepTimeMinutes: Number(prepTimeMinutes) || 15,
        station: station || "kitchen",
        isAvailable: isAvailable ?? true,
        isFeatured: isFeatured ?? false,
        hasRecipe: hasRecipe ?? false,
      })
      .returning();

    if (modifierIds && Array.isArray(modifierIds)) {
      for (const modId of modifierIds) {
        await db.insert(menuItemModifiers).values({
          menuItemId: newItem.id,
          modifierId: Number(modId),
        });
      }
    }

    await db.insert(auditLogs).values({
      action: "menu_item_created",
      entityType: "menu",
      entityId: String(newItem.id),
      details: `Created menu item "${newItem.name}" at $${newItem.price}`,
    });

    return NextResponse.json({ success: true, item: newItem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "session");

export const POST = secureRoute(handlePOST, "canManageMenu");
