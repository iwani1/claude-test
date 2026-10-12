import assert from "node:assert/strict";
import {
  saveMenuToCache,
  getCachedMenu,
  queueOfflineOrder,
  getOfflineQueue,
  syncOfflineQueueToServer,
  OfflineOrder,
  saveTablesToCache,
  getCachedTables,
  saveShiftToCache,
  getCachedShift,
  saveBillingConfigToCache,
  getCachedBillingConfig,
  saveIdentity,
  readIdentity,
  clearIdentity,
} from "../src/lib/offline-storage";
export async function testOfflineStorage() {
  const values = new Map<string,string>();
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key,value),
    removeItem: (key: string) => values.delete(key),
  } });
  try {
    saveMenuToCache({ items: [1] }, 1);
    saveMenuToCache({ items: [2] }, 2);
    assert.deepEqual(getCachedMenu(1), { items: [1] });
    assert.deepEqual(getCachedMenu(2), { items: [2] });
    const fixture = (branchId: number, idempotencyKey: string) => ({ branchId, idempotencyKey } as OfflineOrder);
    queueOfflineOrder(fixture(1, "old-one"));
    queueOfflineOrder(fixture(2, "other-branch"));
    globalThis.fetch = (async () => {
      queueOfflineOrder(fixture(1, "added-during-request"));
      return Response.json({ success: true, syncedCount: 1 });
    }) as typeof fetch;
    assert.equal((await syncOfflineQueueToServer(1)).count, 1);
    assert.deepEqual(getOfflineQueue(1).map(o => o.idempotencyKey), ["added-during-request"]);
    assert.deepEqual(getOfflineQueue(2).map(o => o.idempotencyKey), ["other-branch"]);
    globalThis.fetch = (async () => Response.json({ error: "Denied" }, { status: 403 })) as typeof fetch;
    assert.equal((await syncOfflineQueueToServer(1)).success, false);
    assert.equal(getOfflineQueue(1).length, 1);
    console.log("PASS offline cache/queue branch isolation, in-flight preservation, and failure retention");

    // A device that cannot store an order must say so rather than let the till
    // clear a sale nothing has a record of.
    const realSetItem = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };
    assert.equal(queueOfflineOrder(fixture(1, "unwritable")), false);
    globalThis.localStorage.setItem = realSetItem;
    assert.equal(queueOfflineOrder(fixture(1, "writable")), true);
    assert.deepEqual(getOfflineQueue(1).map(o => o.idempotencyKey), ["added-during-request", "writable"]);
    console.log("PASS offline queue reports whether the order was actually stored");

    // The floor plan, drawer state and billing rates survive a lost signal, and
    // never leak across branches.
    saveTablesToCache([{ id: 1 }], [{ id: 9, tableNumber: "T1" }], 1);
    saveTablesToCache([{ id: 2 }], [{ id: 8, tableNumber: "T2" }], 2);
    assert.equal(getCachedTables(1)?.tables[0].tableNumber, "T1");
    assert.equal(getCachedTables(2)?.tables[0].tableNumber, "T2");
    assert.equal(getCachedTables(3), null);
    saveShiftToCache({ id: 77, openingCash: "100.00" }, 1);
    assert.equal(getCachedShift(1)?.activeShift.id, 77);
    assert.equal(getCachedShift(2), null);
    saveBillingConfigToCache({ roomChargeCents: 3500, taxRatePercent: 12.5 }, 1);
    assert.equal(getCachedBillingConfig(1).roomChargeCents, 3500);
    assert.equal(getCachedBillingConfig(2), null);
    console.log("PASS cached tables, drawer state and billing rates are branch-scoped and restorable");

    // Offline identity restores the till after a reload with no signal, but it
    // expires so a device cannot stay signed in forever.
    saveIdentity({ id: 5, role: "cashier", branchId: 1, name: "Ama" });
    assert.equal(readIdentity()?.user.id, 5);
    assert.equal(readIdentity()?.branchId, 1);
    clearIdentity();
    assert.equal(readIdentity(), null);
    saveIdentity({ id: 5, role: "cashier", branchId: 1 });
    const stored = JSON.parse(values.get("bistro_pos_last_identity")!);
    values.set("bistro_pos_last_identity", JSON.stringify({ ...stored, cachedAt: Date.now() - 13 * 60 * 60 * 1000 }));
    assert.equal(readIdentity(), null);
    saveIdentity({ id: 5, role: "cashier", branchId: 1 });
    values.set("bistro_pos_last_identity", JSON.stringify({ id: 5, role: "cashier" }));
    assert.equal(readIdentity(), null);
    clearIdentity();
    console.log("PASS offline identity restore is time-boxed and rejects malformed records");
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  }
}
