import { createOrder } from "@/lib/create-order";
import { secureRoute, isDatabaseFailure } from "@/lib/api";
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
import { eq, desc, inArray, and, gte, lte, count } from "drizzle-orm";
import { deductStockForOrder } from "@/lib/inventory-deduction";
import { requireSession } from "@/lib/guard";
import { loadBillingConfig, priceOrder, fromCents } from "@/lib/pricing";

async function handleGET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50) || 50, 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0) || 0, 0);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions = [];
    if (status) conditions.push(eq(orders.status, status));
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) conditions.push(gte(orders.createdAt, new Date(`${from}T00:00:00`)));
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) conditions.push(lte(orders.createdAt, new Date(`${to}T23:59:59`)));
    const where = conditions.length ? and(...conditions) : undefined;

    const orderList = await db.select().from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(orders).where(where);

    // Fetch order items for each order
    const allOrderIds = orderList.map((o) => o.id);
    const items = allOrderIds.length > 0 ? await db.select().from(orderItems) : [];

    const populatedOrders = orderList.map((ord) => ({
      ...ord,
      items: items.filter((it) => it.orderId === ord.id),
    }));

    return NextResponse.json({ orders: populatedOrders, total: Number(total) });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export const GET = secureRoute(handleGET, "canViewOrderHistory");

export const POST = secureRoute(createOrder, "canAccessPos");
