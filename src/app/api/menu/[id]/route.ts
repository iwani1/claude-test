import { secureRoute, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { menuItems, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

async function handlePUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    const body = await req.json();

    const [updated] = await db
      .update(menuItems)
      .set({
        ...Object.fromEntries(Object.entries(body).filter(([key]) => ["categoryId", "name", "description", "sku", "barcode", "imageUrl", "prepTimeMinutes", "station", "isAvailable", "isArchived", "isFeatured", "taxRate", "hasRecipe"].includes(key))),
        price: body.price ? String(body.price) : undefined,
        costPrice: body.costPrice ? String(body.costPrice) : undefined,
      })
      .where(eq(menuItems.id, itemId))
      .returning();

    await db.insert(auditLogs).values({
      action: "menu_item_updated",
      entityType: "menu",
      entityId: String(itemId),
      details: `Updated item "${updated.name}" details/availability`,
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * "Delete" from the menu. The row is NOT erased: order_items references it
 * and a sold dish is sales history, so permanent removal would either fail
 * the foreign key or falsify reports. Instead the item is archived — the
 * menu endpoints stop returning it, so it leaves the till grid and the
 * Menu Manager list at once — and it can be restored from the Deleted
 * view. (The daily, reversible "86" remains the isAvailable toggle.)
 */
async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Invalid menu item id" }, { status: 400 });
    }

    const [archived] = await db
      .update(menuItems)
      .set({ isArchived: true, isAvailable: false })
      .where(eq(menuItems.id, itemId))
      .returning();

    if (!archived) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    await db.insert(auditLogs).values({
      action: "menu_item_deleted",
      entityType: "menu",
      entityId: String(itemId),
      details: `Removed menu item "${archived.name}" from the menu (archived; past sales and reports unchanged, restorable from Deleted items)`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PUT = secureRoute(handlePUT, "canManageMenu");

export const DELETE = secureRoute(handleDELETE, "canManageMenu");
