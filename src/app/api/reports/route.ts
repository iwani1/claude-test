import { collectionSummary, reportWindow } from "@/lib/collection-report";
import { secureRoute, ApiError, isDatabaseFailure } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  orderItems,
  menuItems,
  menuCategories,
  payments,
  ingredients,
  stockMovements,
} from "@/db/schema";
import { desc, eq, gte, lt, and } from "drizzle-orm";

async function handleGET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "all"; // 'today', '7days', '30days', 'all'

    const window = reportWindow(timeframe, new Date(), {
      start: searchParams.get("start") ?? undefined,
      end: searchParams.get("end") ?? undefined,
    });
    const collections = await collectionSummary(window);
    const allOrders = await db.select().from(orders).where(and(
      window.start ? gte(orders.createdAt, window.start) : undefined, lt(orders.createdAt, window.end)
    )).orderBy(desc(orders.createdAt));

    const allOrderItems = await db.select().from(orderItems);
    const allCategories = await db.select().from(menuCategories);
    const allMenuItems = await db.select().from(menuItems);
    const allIngredients = await db.select().from(ingredients);
    const allMovements = await db.select().from(stockMovements);

    const validOrders = allOrders.filter((o) => o.status !== "cancelled");
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

    // Cost of goods sold (COGS)
    const validOrderIds = new Set(validOrders.map((o) => o.id));
    const itemsInValidOrders = allOrderItems.filter((i) => validOrderIds.has(i.orderId));
    const totalCostOfGoods = itemsInValidOrders.reduce(
      (sum, i) => sum + Number(i.costPrice || 0) * i.quantity,
      0
    );
    const grossProfit = totalSales - totalCostOfGoods;
    const foodCostPercentage = totalSales > 0 ? ((totalCostOfGoods / totalSales) * 100).toFixed(1) : "0.0";

    // Sales by Category
    const categorySalesMap: Record<string, { name: string; revenue: number; count: number }> = {};
    for (const cat of allCategories) {
      categorySalesMap[cat.id] = { name: cat.name, revenue: 0, count: 0 };
    }

    for (const item of itemsInValidOrders) {
      const menuItem = allMenuItems.find((m) => m.id === item.menuItemId);
      if (menuItem && categorySalesMap[menuItem.categoryId]) {
        categorySalesMap[menuItem.categoryId].revenue += Number(item.totalPrice);
        categorySalesMap[menuItem.categoryId].count += item.quantity;
      }
    }

    const categoryBreakdown = Object.values(categorySalesMap)
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // Sales by Payment Method
    // This restaurant settles by Mobile Money or cash only.
    const paymentMethodMap = { cash: Number(collections.cashCollections), momo: Number(collections.momoCollections), other: Number(collections.otherCollections) };

    // Top Selling Items
    const itemSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const item of itemsInValidOrders) {
      if (!itemSalesMap[item.itemName]) {
        itemSalesMap[item.itemName] = { name: item.itemName, quantity: 0, revenue: 0 };
      }
      itemSalesMap[item.itemName].quantity += item.quantity;
      itemSalesMap[item.itemName].revenue += Number(item.totalPrice);
    }

    const topItems = Object.values(itemSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);

    // Wastage & Spoilage
    const wastageMovements = allMovements.filter((m) => m.movementType === "waste_spoilage");
    const totalWastageCost = wastageMovements.reduce(
      (acc, m) => acc + Math.abs(Number(m.quantityDelta)) * Number(m.unitCost || 0),
      0
    );

    // Low stock items
    const lowStockAlerts = allIngredients
      .filter((ing) => Number(ing.currentStock) <= Number(ing.minStockLevel))
      .map((ing) => ({
        id: ing.id,
        name: ing.name,
        currentStock: ing.currentStock,
        minStockLevel: ing.minStockLevel,
        unit: ing.unit,
      }));

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
