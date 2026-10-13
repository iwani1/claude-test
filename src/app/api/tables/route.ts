import { secureRoute, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import { diningAreas, diningTables, orders } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

async function handleGET() {
  try {
    const areas = await db.select().from(diningAreas).orderBy(asc(diningAreas.sortOrder));
    const tables = await db.select().from(diningTables).orderBy(asc(diningTables.tableNumber));

    // Fetch active orders linked to tables
    const activeOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        tableId: orders.tableId,
        customerName: orders.customerName,
        totalAmount: orders.totalAmount,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.paymentStatus, "unpaid"));

    const tablesWithOrders = tables.map((tbl) => {
      const currentOrder = activeOrders.find((o) => o.tableId === tbl.id);
      return {
        ...tbl,
        activeOrder: currentOrder || null,
      };
    });

    return NextResponse.json({
      areas,
      tables: tablesWithOrders,
    });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePOST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create_table") {
      const { areaId, branchId, tableNumber, capacity, shape } = body;
      const [newTable] = await db
        .insert(diningTables)
        .values({
          areaId: Number(areaId),
          branchId: requestContext.getStore()!.user!.branchId,
          tableNumber,
          capacity: Number(capacity) || 4,
          shape: shape || "square",
          status: "available",
        })
        .returning();
      return NextResponse.json({ success: true, table: newTable });
    }

    if (action === "update_status") {
      const { tableId, status } = body;
      const [updated] = await db
        .update(diningTables)
        .set({ status })
        .where(eq(diningTables.id, Number(tableId)))
        .returning();
      return NextResponse.json({ success: true, table: updated });
    }

    if (action === "move_table") {
      const { sourceTableId, targetTableId } = body;
      const [sourceTable] = await db
        .select()
        .from(diningTables)
        .where(eq(diningTables.id, Number(sourceTableId)))
        .limit(1);

      if (!sourceTable || !sourceTable.currentOrderId) {
        return NextResponse.json({ error: "Source table has no active order" }, { status: 400 });
      }

      // Update the order's tableId
      await db
        .update(orders)
        .set({ tableId: Number(targetTableId) })
        .where(eq(orders.id, sourceTable.currentOrderId));

      // Update target table
      await db
        .update(diningTables)
        .set({ status: "occupied", currentOrderId: sourceTable.currentOrderId })
        .where(eq(diningTables.id, Number(targetTableId)));

      // Free source table
      await db
        .update(diningTables)
        .set({ status: "cleaning", currentOrderId: null })
        .where(eq(diningTables.id, Number(sourceTableId)));

      return NextResponse.json({ success: true, message: "Order moved successfully" });
    }

    if (action === "release_table") {
      const { tableId } = body;
      await db
        .update(diningTables)
        .set({ status: "available", currentOrderId: null })
        .where(eq(diningTables.id, Number(tableId)));
      return NextResponse.json({ success: true, message: "Table released" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canAccessPos");

export const POST = secureRoute(handlePOST, "canAccessPos");
