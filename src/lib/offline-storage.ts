"use client";

// Legacy key names are kept so terminals upgraded mid-service never lose
// already-queued offline orders; the prefix is internal only.
const OFFLINE_QUEUE_KEY = "bistro_pos_offline_orders_queue";
const MENU_CACHE_KEY = "bistro_pos_cached_menu";
const TABLES_CACHE_KEY = "bistro_pos_cached_tables";
const SHIFT_CACHE_KEY = "bistro_pos_cached_shift";
const BILLING_CACHE_KEY = "bistro_pos_cached_billing";
// Identity is not branch-scoped: it is what tells the app which branch this
// device was last working in.
const IDENTITY_CACHE_KEY = "bistro_pos_last_identity";
/** How long a device may keep working from its last sign-in without a server. */
const IDENTITY_TTL_MS = 12 * 60 * 60 * 1000;
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
    /* audit-ok: the cache is best effort — the live menu comes from the server */
    console.warn("Failed to cache menu:", e);
  }
}

export function getCachedMenu(branchId: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(scopedKey(MENU_CACHE_KEY, branchId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    /* audit-ok: unreadable cache — the caller falls back to the server */
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * Cached read-only context.
 *
 * The till needs four things to be usable with no signal: the menu, the floor
 * plan, the billing configuration it prices with, and whether the drawer was
 * open. All four are cached from the server's own answers — never invented —
 * and the UI says plainly when it is running from this cache rather than from
 * a live read.
 * ------------------------------------------------------------------------- */

function writeCache(key: string, branchId: number, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedKey(key, branchId), JSON.stringify({ value, cachedAt: Date.now() }));
  } catch (e) {
    /* audit-ok: the cache is best effort — it is refreshed from the server */
    console.warn("Failed to cache", key, e);
  }
}

function readCache<T>(key: string, branchId: number): { value: T; cachedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(scopedKey(key, branchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && "value" in parsed ? parsed : null;
  } catch (e) {
    /* audit-ok: unreadable cache — the caller falls back to the server */
    return null;
  }
}

export function saveTablesToCache(areas: unknown[], tables: unknown[], branchId: number) {
  writeCache(TABLES_CACHE_KEY, branchId, { areas, tables });
}

export function getCachedTables(branchId: number): { areas: any[]; tables: any[] } | null {
  return readCache<{ areas: any[]; tables: any[] }>(TABLES_CACHE_KEY, branchId)?.value ?? null;
}

export function saveShiftToCache(activeShift: unknown, branchId: number) {
  writeCache(SHIFT_CACHE_KEY, branchId, { activeShift });
}

/** Last known drawer state. The UI must label it as last known while offline. */
export function getCachedShift(branchId: number): { activeShift: any; cachedAt: number } | null {
  const hit = readCache<{ activeShift: any }>(SHIFT_CACHE_KEY, branchId);
  return hit ? { activeShift: hit.value?.activeShift ?? null, cachedAt: hit.cachedAt } : null;
}

export function saveBillingConfigToCache(config: unknown, branchId: number) {
  writeCache(BILLING_CACHE_KEY, branchId, config);
}

export function getCachedBillingConfig(branchId: number): any | null {
  return readCache<any>(BILLING_CACHE_KEY, branchId)?.value ?? null;
}

export interface CachedIdentity {
  user: any;
  branchId: number;
  cachedAt: number;
}

/**
 * Remembers who was signed in on this device so a reload with no signal lands
 * back on the till instead of the login screen.
 *
 * This is display context only: every read and every write still has to pass
 * the server's session check, so an offline identity can queue orders but can
 * never see stock, prices from the server, payments or other people's data.
 * It is cleared on sign-out and expires after a shift-length (12h).
 */
export function saveIdentity(user: any) {
  if (typeof window === "undefined" || !user?.branchId) return;
  try {
    localStorage.setItem(
      IDENTITY_CACHE_KEY,
      JSON.stringify({ user, branchId: user.branchId, cachedAt: Date.now() })
    );
  } catch (e) {
    /* audit-ok: private mode — offline restore simply is not available */
  }
}

export function readIdentity(): CachedIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(IDENTITY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIdentity;
    if (!parsed?.user?.branchId || !Number.isSafeInteger(parsed?.branchId)) return null;
    if (Date.now() - Number(parsed.cachedAt || 0) > IDENTITY_TTL_MS) return null;
    return parsed;
  } catch (e) {
    /* audit-ok: unreadable identity — the device asks for the network instead */
    return null;
  }
}

export function clearIdentity() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(IDENTITY_CACHE_KEY);
}

/**
 * Stores an order on this device until the server can take it.
 *
 * Returns whether the order is now verifiably in the queue: the caller is about
 * to tell a cashier the sale is safe, so it may not guess. A device with no
 * storage left (private mode, full quota) returns false and the caller keeps
 * the ticket instead of clearing a sale nobody has a record of.
 */
export function queueOfflineOrder(order: OfflineOrder): boolean {
  if (typeof window === "undefined") return false;
  try {
    const queue = getOfflineQueue(order.branchId);
    queue.push(order);
    localStorage.setItem(scopedKey(OFFLINE_QUEUE_KEY, order.branchId), JSON.stringify(queue));
    return getOfflineQueue(order.branchId).some(
      (queued) => queued.idempotencyKey === order.idempotencyKey
    );
  } catch (e) {
    /* audit-ok: the caller is told (false) and keeps the ticket on screen */
    console.error("Failed to queue offline order:", e);
    return false;
  }
}

export function getOfflineQueue(branchId: number): OfflineOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedKey(OFFLINE_QUEUE_KEY, branchId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    /* audit-ok: unreadable queue — treated as empty, never as money */
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
    /* audit-ok: the sync reports failure; callers tell the user and keep the queue */
    return { success: false, count: 0 };
  }
}
