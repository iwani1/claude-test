"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Route-level error boundary for the POS shell (F8a).
 *
 * Before this file existed, any render/runtime crash in the single-page
 * shell white-screened the terminal — mid-service, on a device whose whole
 * job is to keep taking orders. This boundary keeps a branded, finger-sized
 * recovery in front of the cashier instead: the failure is logged with its
 * digest (correlates with the structured server logs via x-request-id on
 * API calls), and "Reload the till" remounts the segment without losing the
 * offline queue or cached menu (both live in localStorage, not React state).
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", event: "client_error_boundary", digest: error.digest ?? null, message: error.message }));
  }, [error]);

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center shadow-2xl">
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-300" aria-hidden />
        <h1 className="mt-4 text-xl font-bold">This screen hit a problem</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Nothing you already sent to the kitchen or took payment for is lost — completed orders are on the
          server, and orders queued offline are still stored on this device. Reload the till to carry on.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-neutral-500">Reference: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-base font-bold text-white transition hover:bg-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
        >
          <RotateCcw className="h-5 w-5" aria-hidden /> Reload the till
        </button>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 min-h-[44px] w-full rounded-2xl border border-neutral-700 px-5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-white/5"
        >
          Full restart
        </button>
      </div>
    </div>
  );
}
