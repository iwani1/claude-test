/* Lush View POS — offline app shell.
 *
 * The till runs on phones and tablets on a restaurant floor, where the signal
 * drops. Without this file a reload while offline shows the browser's error
 * page and the shift stops. With it, the shell (HTML + the JS/CSS chunks that
 * were already downloaded) is served from the device cache, and the app's own
 * layers — cached menu, cached tables, cached billing config, the offline order
 * queue — keep the till usable.
 *
 * Deliberate rules:
 *   - Only GET is ever intercepted. Writes must hit the network or fail loudly;
 *     a cached "success" would be a lie about money.
 *   - /api/ is never cached. Stock, prices, payments and shift state must be
 *     live or absent — never a stale number that looks current. The app caches
 *     what it is allowed to cache deliberately, and says so in the UI.
 *   - Navigations are network-first, so a redeployed build is picked up the
 *     moment there is a connection; the cache is only the fallback.
 *   - Version bump on activate wipes older caches.
 */
const VERSION = "lushview-pos-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_URLS = ["/", "/manifest.json", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One failing URL must not abort the whole install.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/** Cache-first, for content-hashed build output that never changes in place. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === "basic") {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first: fresh when possible, cached copy when the signal is gone. */
async function networkFirst(request, cacheName, isNavigation) {
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      const cache = await caches.open(cacheName);
      cache.put(isNavigation ? new Request("/") : request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = (isNavigation && (await caches.match("/"))) || (await caches.match(request));
    if (cached) return cached;
    if (isNavigation) {
      // Nothing cached for this device yet. Say so plainly instead of letting
      // the browser claim the server is broken.
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8">
         <meta name="viewport" content="width=device-width,initial-scale=1">
         <title>Offline</title></head>
         <body style="margin:0;background:#09090b;color:#f4f4f5;font:16px system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
         <div style="padding:24px;max-width:420px">
           <h1 style="font-size:18px;margin:0 0 8px">No connection</h1>
           <p style="color:#a1a1aa;margin:0 0 16px">This device has not stored the app yet. Reconnect once, keep the screen open for a moment, and it will work offline afterwards.</p>
           <button onclick="location.reload()" style="height:48px;padding:0 20px;border:0;border-radius:12px;background:#f59e0b;color:#000;font-weight:700;font-size:15px">Try again</button>
         </div></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Writes, prefetches and range requests are none of our business.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live data: never cached, always the network's answer.
  if (url.pathname.startsWith("/api/")) return;

  // Respect an explicit "bypass the cache" from the app itself.
  if (request.cache === "no-store") return;

  // Router prefetch payloads belong to one build; caching them buys nothing
  // offline and risks pairing an old payload with a new page.
  if (url.searchParams.has("_rsc") || url.pathname.startsWith("/_next/data/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(
    networkFirst(request, request.mode === "navigate" ? SHELL_CACHE : ASSET_CACHE, request.mode === "navigate")
  );
});
