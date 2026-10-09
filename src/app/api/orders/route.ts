import { createOrder } from "@/lib/create-order";
import { secureRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { db, requestContext } from "@/db";
import {
  orders,
  orderItems,
  kitchenTickets,
  diningTables,
  auditLogs,
  menuItems,
  modifierOptions,
} from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { deductStockForOrder } from "@/lib/inventory-deduction";
import { requireSession } from "@/lib/guard";
import { loadBillingConfig, priceOrder, fromCents } from "@/lib/pricing";

async function handleGET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Number(searchParams.get("limit") || 50);

    let query = db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
    const orderList = await query;

    // Filter if needed
    const filtered = status ? orderList.filter((o) => o.status === status) : orderList;

    // Fetch order items for each order
    const allOrderIds = filtered.map((o) => o.id);
    const items = allOrderIds.length > 0 ? await db.select().from(orderItems) : [];

    const populatedOrders = filtered.map((ord) => ({
      ...ord,
      items: items.filter((it) => it.orderId === ord.id),
    }));

    return NextResponse.json({ orders: populatedOrders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export const GET = secureRoute(handleGET, "canAccessPos");

export const POST = secureRoute(createOrder, "canAccessPos");
