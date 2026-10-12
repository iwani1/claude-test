"use client";

import { useEffect } from "react";

/**
 * Registers the offline app shell (public/sw.js).
 *
 * Production only: in dev the service worker would fight hot reload by serving
 * yesterday's chunks, and there is nothing to protect on a workstation. The
 * offline features that matter to a shift — the order queue, the cached menu,
 * tables and billing config, and the restored session — are application-level
 * and work in every environment.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    // Delayed so registration never competes with the first paint of the till.
    const timer = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Offline shell is a bonus, never a blocker for taking an order. */
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
