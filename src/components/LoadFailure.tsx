"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Says a screen failed to load, instead of showing an empty screen that looks
 * like "nothing to see". A cashier must never have to guess whether a zero is
 * real or a broken connection, so every screen that loads data renders this
 * when the load fails, with a retry that is big enough for a finger.
 */
export function LoadFailure({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  if (!message) return null;
  return (
    <div
      className="mx-4 mt-3 flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-100"
      role="alert"
    >
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <span className="flex-1 min-w-[12rem] text-sm font-semibold leading-snug">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 min-h-11 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 font-bold text-sm flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}
