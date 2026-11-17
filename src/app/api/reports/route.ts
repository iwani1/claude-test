import { collectionSummary, reportWindow } from "@/lib/collection-report";
import { secureRoute, ApiError, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, ingredients } from "@/db/schema";
import { desc, gte, lt, lte, and, sql } from "drizzle-orm";

async function handleGET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "all"; // 'today', '7days', '30days', 'all'

    const window = reportWindow(timeframe, new Date(), {
      start: searchParams.get("start") ?? undefined,
      end: searchParams.get("end") ?? undefined,
    });
    const collections = await collectionSummary(window);
    // Everything below is aggregated in the database for this period only (P7 in
    // docs/FINDINGS.md). The report used to load every order line, stock movement,
    // ingredient and menu item of the branch's whole history, photos included,
    // and add them up here on every request.
    // Bounds are sent as ISO text, exactly as Drizzle sends them for the orders
    // query below, so every figure uses the same period. `column` is a constant.
    const inWindow = (column: string) => window.start
      ? sql`${sql.raw(column)} >= ${window.start.toISOString()} AND ${sql.raw(column)} < ${window.end.toISOString()}`
      : sql`${sql.raw(column)} < ${window.end.toISOString()}`;

    // Orders of the period: only the columns the report uses.
    const periodOrders = await db.select({
      id: orders.id, orderNumber: orders.orderNumber, status: orders.status, totalAmount: orders.totalAmount,
      roomCharge: orders.roomCharge, isComplimentary: orders.isComplimentary, compValue: orders.compValue,
      customerName: orders.customerName, complimentaryReason: orders.complimentaryReason, createdAt: orders.createdAt,
    }).from(orders).where(and(
      window.start ? gte(orders.createdAt, window.start) : undefined, lt(orders.createdAt, window.end)
    )).orderBy(desc(orders.createdAt));

    const validOrders = periodOrders.filter((o) => o.status !== "cancelled");
    const totalSales = validOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalOrdersCount = validOrders.length;

    // --- Eat-in room charge & complimentary orders ------------------------
    // The room charge is real revenue collected on top of food, so it is
    // reported separately — management needs to see it apart from dish sales.
    const totalRoomCharge = validOrders.reduce(
      (sum, o) => sum + Number(o.roomCharge || 0),
      0
    );

    // Complimentary orders total GH₵0.00 but still consume stock, so their
    // retail value is tracked as a cost of doing business.
    const compOrders = validOrders.filter((o) => o.isComplimentary === true);
    const totalCompValue = compOrders.reduce((sum, o) => sum + Number(o.compValue || 0), 0);

    // Paid orders only — comps would otherwise drag the average down to zero.
    const paidOrders = validOrders.filter((o) => !o.isComplimentary);
    const avgOrderValue =
      paidOrders.length > 0
        ? paidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) / paidOrders.length
        : 0;

    // Lines of the period's non-cancelled orders, as a reusable subquery.
    const periodLines = sql`
      SELECT oi.menu_item_id, oi.item_name, oi.quantity, oi.total_price, oi.cost_price
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'cancelled' AND ${inWindow("o.created_at")}`;

    // Cost of goods sold (COGS)
    const [cogs] = (await db.execute(sql`
      SELECT COALESCE(SUM(COALESCE(cost_price, 0) * quantity), 0) AS total FROM (${periodLines}) l`)).rows as { total: string }[];
    const totalCostOfGoods = Number(cogs?.total ?? 0);
    const grossProfit = totalSales - totalCostOfGoods;
    const foodCostPercentage = totalSales > 0 ? ((totalCostOfGoods / totalSales) * 100).toFixed(1) : "0.0";

    // Sales by Category (lines whose dish and category still exist, as before)
    const categoryRows = (await db.execute(sql`
      SELECT c.name, SUM(l.total_price) AS revenue, SUM(l.quantity) AS count
      FROM (${periodLines}) l
      JOIN menu_items m ON m.id = l.menu_item_id
      JOIN menu_categories c ON c.id = m.category_id
      GROUP BY c.id, c.name`)).rows as { name: string; revenue: string; count: string }[];
    const categoryBreakdown = categoryRows
      .map((c) => ({ name: c.name, revenue: Number(c.revenue), count: Number(c.count) }))
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // Sales by Payment Method
    // This restaurant settles by Mobile Money or cash only.
    const paymentMethodMap = { cash: Number(collections.cashCollections), momo: Number(collections.momoCollections), other: Number(collections.otherCollections) };

    // Top Selling Items
    const topRows = (await db.execute(sql`
      SELECT item_name AS name, SUM(quantity) AS quantity, SUM(total_price) AS revenue
      FROM (${periodLines}) l
      GROUP BY item_name
      ORDER BY SUM(quantity) DESC, item_name
      LIMIT 6`)).rows as { name: string; quantity: string; revenue: string }[];
    const topItems = topRows.map((t) => ({ name: t.name, quantity: Number(t.quantity), revenue: Number(t.revenue) }));

    // Wastage & Spoilage, recorded in this period (it used to be all-time,
    // whatever period the report was for).
    const [waste] = (await db.execute(sql`
      SELECT COALESCE(SUM(ABS(quantity_delta) * COALESCE(unit_cost, 0)), 0) AS total
      FROM stock_movements
      WHERE movement_type = 'waste_spoilage' AND ${inWindow("created_at")}`)).rows as { total: string }[];
    const totalWastageCost = Number(waste?.total ?? 0);

    // Low stock items: a snapshot of now, not of the period.
    const lowStockAlerts = await db.select({
      id: ingredients.id, name: ingredients.name, currentStock: ingredients.currentStock,
      minStockLevel: ingredients.minStockLevel, unit: ingredients.unit,
    }).from(ingredients).where(lte(ingredients.currentStock, ingredients.minStockLevel));

    return NextResponse.json({
      window: { start: window.start?.toISOString() ?? null, endExclusive: window.end.toISOString(), timezone: "UTC / Africa/Accra", basis: "Collections/refunds use transaction dates; gross billed sales use order creation dates." },
      summary: {
        ...collections,
        grossBilledSales: totalSales.toFixed(2),
        totalSales: totalSales.toFixed(2),
        totalOrdersCount,
        avgOrderValue: avgOrderValue.toFixed(2),
        totalCostOfGoods: totalCostOfGoods.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        foodCostPercentage,
        totalWastageCost: totalWastageCost.toFixed(2),
        // Eat-in room charge collected, reported apart from dish revenue.
        totalRoomCharge: totalRoomCharge.toFixed(2),
        // Complimentary breakfast exposure: value of food given away free.
        totalCompValue: totalCompValue.toFixed(2),
        compOrderCount: compOrders.length,
        paidOrderCount: paidOrders.length,
      },
      categoryBreakdown,
      paymentBreakdown: paymentMethodMap,
      topItems,
      lowStockAlerts,
      // Per-order comp detail so management can review who authorised what.
      complimentaryOrders: compOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        reason: o.complimentaryReason,
        compValue: o.compValue,
        createdAt: o.createdAt,
      })),
    });
  } catch (err: any) {
    if (isDatabaseFailure(err)) throw err;
    if (err instanceof ApiError) throw err;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = secureRoute(handleGET, "canViewReports");
