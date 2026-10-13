import { secureRoute, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { kitchenTickets, orders, diningTables } from "@/db/schema";
import { eq, or, desc, inArray, and, notInArray } from "drizzle-orm";

async function handleGET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const station = searchParams.get("station"); // 'all', 'kitchen', 'bar', 'grill'

    // Fetch active tickets (pending, preparing, ready)
    const tickets = await db
      .select({
        id: kitchenTickets.id,
        orderId: kitchenTickets.orderId,
        ticketNumber: kitchenTickets.ticketNumber,
        station: kitchenTickets.station,
        status: kitchenTickets.status,
        items: kitchenTickets.items,
        startedAt: kitchenTickets.startedAt,
        readyAt: kitchenTickets.readyAt,
        createdAt: kitchenTickets.createdAt,
      })
      .from(kitchenTickets)
      .where(or(eq(kitchenTickets.status, "pending"), eq(kitchenTickets.status, "preparing"), eq(kitchenTickets.status, "ready")))
      .orderBy(desc(kitchenTickets.createdAt));

    // Get order details for these tickets
    const orderIds = tickets.map((t) => t.orderId);
    const orderList = orderIds.length > 0 ? await db.select().from(orders).where(inArray(orders.id, orderIds)) : [];
    const tableList = await db.select().from(diningTables);

    const enrichedTickets = tickets
      .filter((t) => !station || station === "all" || t.station === station)
      .map((t) => {
        const ord = orderList.find((o) => o.id === t.orderId);
        const tbl = ord?.tableId ? tableList.find((tb) => tb.id === ord.tableId) : null;
        return {
          ...t,
          orderNumber: ord?.orderNumber || "ORD-000",
          orderType: ord?.orderType || "dine_in",
          roomNumber: ord?.roomNumber || null,
          tableNumber:
            tbl?.tableNumber ||
            (ord?.orderType === "room_service"
              ? `Room ${ord.roomNumber || "—"}`
              : ord?.orderType === "takeaway"
                ? "Takeaway"
                : ord?.orderType === "delivery"
                  ? "Delivery"
                  : "Restaurant Floor"),
          customerName: ord?.customerName || "Guest",
          orderNotes: ord?.notes,
        };
      });

    return NextResponse.json({ tickets: enrichedTickets });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePATCH(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, status } = body; // 'preparing' | 'ready' | 'completed'

    if (!Number.isSafeInteger(Number(ticketId)) || !["preparing", "ready", "completed"].includes(status)) {
      return NextResponse.json({ error: "ticketId and status are required" }, { status: 400 });
    }

    const updates: any = { status };
    if (status === "preparing") updates.startedAt = new Date();
    if (status === "ready") updates.readyAt = new Date();

    const [updated] = await db
      .update(kitchenTickets)
      .set(updates)
      .where(eq(kitchenTickets.id, Number(ticketId)))
      .returning();

    // Also update parent order status
    if (updated) {
      const newOrderStatus = status === "completed" ? "ready" : status;
      await db
        .update(orders)
        .set({ status: newOrderStatus, updatedAt: new Date() })
        .where(and(eq(orders.id, updated.orderId), notInArray(orders.status, ["cancelled", "refunded", "completed"])));
    }

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canAccessKds");

export const PATCH = secureRoute(handlePATCH, "canAccessKds");
