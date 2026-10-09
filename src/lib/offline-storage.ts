"use client";

const OFFLINE_QUEUE_KEY = "bistro_pos_offline_orders_queue";
const MENU_CACHE_KEY = "bistro_pos_cached_menu";
function scopedKey(key: string, branchId: number): string {
  if (!Number.isSafeInteger(branchId) || branchId <= 0) throw new Error("A verified branch is required for offline storage");
  return `${key}:branch:${branchId}`;
}

export interface OfflineOrder {
  idempotencyKey: string;
  clientTimestamp: number;
  branchId: number;
  tableId: number | null;
  userId: number;
  customerName: string;
  orderType: string;
  items: any[];
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  tipAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
}

export function saveMenuToCache(menuData: any, branchId: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedKey(MENU_CACHE_KEY, branchId), JSON.stringify(menuData));
  } catch (e) {
    console.warn("Failed to cache menu:", e);
  }
}

export function getCachedMenu(branchId: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(scopedKey(MENU_CACHE_KEY, branchId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function queueOfflineOrder(order: OfflineOrder) {
  if (typeof window === "undefined") return;
  try {
    const queue = getOfflineQueue(order.branchId);
    queue.push(order);
    localStorage.setItem(scopedKey(OFFLINE_QUEUE_KEY, order.branchId), JSON.stringify(queue));
  } catch (e) {
    console.error("Failed to queue offline order:", e);
  }
}

export function getOfflineQueue(branchId: number): OfflineOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedKey(OFFLINE_QUEUE_KEY, branchId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function clearOfflineQueue(branchId: number) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(scopedKey(OFFLINE_QUEUE_KEY, branchId));
}

export async function syncOfflineQueueToServer(branchId: number): Promise<{ success: boolean; count: number }> {
  const queue = getOfflineQueue(branchId).slice(0, 50);
  if (queue.length === 0) return { success: true, count: 0 };

  try {
    const res = await fetch("/api/sync/offline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offlineOrders: queue }),
    });

    const data = await res.json();
    if (data.success) {
      // Remove only acknowledged entries, preserving orders added during the request.
      const acknowledged = new Set(queue.map(order => order.idempotencyKey));
      const remaining = getOfflineQueue(branchId).filter(order => !acknowledged.has(order.idempotencyKey));
      localStorage.setItem(scopedKey(OFFLINE_QUEUE_KEY, branchId), JSON.stringify(remaining));
      return { success: true, count: data.syncedCount ?? queue.length };
    }
    return { success: false, count: 0 };
  } catch (e) {
    return { success: false, count: 0 };
  }
}
