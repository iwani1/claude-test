import { NextResponse } from "next/server";
import { createOrder } from "@/lib/create-order";
import { ApiError, secureRoute } from "@/lib/api";
export const POST = secureRoute(async req => {
  const { offlineOrders } = await req.json();
  if (!Array.isArray(offlineOrders) || offlineOrders.length > 50) throw new ApiError(400, "Supply at most 50 offline orders");
  const orders = [];
  let duplicateCount = 0;
  for (const order of offlineOrders) {
    if (!order || typeof order.idempotencyKey !== "string") throw new ApiError(400, "Each offline order requires a stable idempotencyKey");
    // This endpoint queues orders, not verified payments. Never turn a client
    // 'paid' flag into money. Staff collect/record tender via the payment API.
    if (Number(order.paidAmount || 0) !== 0 || (order.paymentStatus && order.paymentStatus !== "unpaid")) throw new ApiError(400, "Record payments separately after synchronization");
    const response = await createOrder(new Request(req.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...order, sendToKitchen: true }) }));
    if (!response.ok) return response; // request boundary rolls the entire batch back
    const result = await response.json();
    if (result.duplicate) duplicateCount++;
    orders.push(result.order);
  }
  return NextResponse.json({ success: true, syncedCount: orders.length - duplicateCount, duplicateCount, orders });
}, "canAccessPos");
