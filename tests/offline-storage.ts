import assert from "node:assert/strict";
import { saveMenuToCache, getCachedMenu, queueOfflineOrder, getOfflineQueue, syncOfflineQueueToServer, OfflineOrder } from "../src/lib/offline-storage";
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
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  }
}
