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
        ...Object.fromEntries(Object.entries(body).filter(([key]) => ["categoryId", "name", "description", "sku", "barcode", "imageUrl", "prepTimeMinutes", "station", "isAvailable", "isFeatured", "taxRate", "hasRecipe"].includes(key))),
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

async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const itemId = Number(id);

    await db
      .update(menuItems)
      .set({ isAvailable: false })
      .where(eq(menuItems.id, itemId));

    await db.insert(auditLogs).values({
      action: "menu_item_deactivated",
      entityType: "menu",
      entityId: String(itemId),
      details: `Deactivated menu item ID ${itemId}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PUT = secureRoute(handlePUT, "canManageMenu");

export const DELETE = secureRoute(handleDELETE, "canManageMenu");
