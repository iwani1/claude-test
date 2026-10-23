import { secureRoute, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { menuItems, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/guard";

/**
 * Removing an item from the menu (and bringing one back) is owner-only —
 * stricter than general menu management. A role check, not a permission,
 * so per-user permission selections can never grant it to a manager.
 */
async function requireOwnerForArchiveChange(): Promise<NextResponse | null> {
  const actor = await getSessionUser();
  if (!actor || actor.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only the owner can remove or restore menu items" },
      { status: 403 },
    );
  }
  return null;
}

async function handlePUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    const body = await req.json();

    // Editing is menu management; archiving or restoring is owner-only, so
    // a PUT that touches isArchived must come from the owner. This closes
    // the side door around the DELETE rule below.
    if (Object.prototype.hasOwnProperty.call(body, "isArchived")) {
      const refused = await requireOwnerForArchiveChange();
      if (refused) return refused;
    }

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
 * Owner-only: see requireOwnerForArchiveChange.
 */
async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Invalid menu item id" }, { status: 400 });
    }

    const refused = await requireOwnerForArchiveChange();
    if (refused) return refused;

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
