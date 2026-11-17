"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AuditDateRangePicker, type AuditDateRange } from "./AuditDateRangePicker";
import { LoadFailure } from "./LoadFailure";

type CountItem = {
  ingredientId?: number;
  name?: string;
  systemStock?: number | string;
  physicalStock?: number | string;
  diff?: number | string;
  costDiff?: number | string;
};
type StockCount = {
  id: number;
  countDate: string;
  conductedBy: number;
  conductedByName: string | null;
  status: string;
  notes: string | null;
  items: unknown;
};
const PAGE_SIZE = 20;
const ghTime = (date: string) => new Date(date).toLocaleString("en-GH", { timeZone: "Africa/Accra" });
const quantity = (value: unknown) => {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? number.toFixed(3) : "—";
};
const money = (value: unknown) => {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number) ? `GH₵${number.toFixed(2)}` : "—";
};

export function StockCountHistory({ refreshKey }: { refreshKey: number }) {
  const [range, setRange] = useState<AuditDateRange>(null);
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchCounts = useCallback(async (offset = 0, append = false) => {
    const id = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (range) { params.set("from", range.from); params.set("to", range.to); }
    try {
      const response = await fetch(`/api/inventory/counts?${params}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = await response.json();
      if (id !== requestId.current) return;
      setCounts((previous) => append ? [...previous, ...data.counts] : data.counts);
      setHasMore(data.hasMore === true);
      setLoadError(null);
    } catch {
      if (id === requestId.current) setLoadError("Saved stock counts could not be loaded. Results may be out of date.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    requestId.current++; // discard an earlier request when the range or saved counts change
    const kick = setTimeout(() => { void fetchCounts(); }, 0);
    return () => { clearTimeout(kick); };
  }, [fetchCounts, refreshKey]);

  const applyRange = (next: AuditDateRange) => {
    requestId.current++;
    setCounts([]);
    setHasMore(false);
    setLoadError(null);
    setLoading(true);
    setRange(next);
    if (!next && !range) void fetchCounts();
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden" aria-label="Saved cycle counts">
      <div className="p-4 space-y-3 border-b border-neutral-800">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Saved Cycle Counts</h3>
            <p className="text-xs text-neutral-400">Review recorded counts and variances as they were submitted; this is not today&apos;s stock balance.</p>
          </div>
          <button type="button" onClick={() => { void fetchCounts(); }}
            aria-label="Refresh saved stock counts" title="Refresh saved stock counts"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <AuditDateRangePicker label="Stock count history" onApply={applyRange} />
        <p className="text-xs text-amber-200" aria-live="polite">
          {range ? `Showing counts from ${range.from} to ${range.to} (Ghana time)` : "Showing recent counts (all dates)"}
          {` · ${counts.length} loaded`}{hasMore ? " · older counts available" : ""}
          {loading ? " · Loading…" : ""}
        </p>
      </div>
      <LoadFailure message={loadError} onRetry={() => { void fetchCounts(); }} />
      <div className="p-4 space-y-3">
        {counts.length === 0 && !loading && !loadError && (
          <p className="py-6 text-center text-sm text-neutral-400">
            {range ? "No saved stock counts in this date range." : "No saved stock counts yet."}
          </p>
        )}
        {counts.map((count) => {
          // Historical JSON is not schema-enforced: a malformed line must not
          // take down the entire history screen.
          const items: CountItem[] = Array.isArray(count.items)
            ? count.items.filter((item): item is CountItem => !!item && typeof item === "object" && !Array.isArray(item))
            : [];
          const variances = items.filter((item) => Number.isFinite(Number(item.diff)) && Math.abs(Number(item.diff)) >= 0.001).length;
          return (
            <article key={count.id} className="rounded-xl border border-neutral-700 bg-neutral-850 p-4 space-y-2">
              <div className="flex flex-wrap gap-2 items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Count #{count.id}</h4>
                  <p className="text-xs text-neutral-400">{ghTime(count.countDate)} · {count.conductedByName || `Staff #${count.conductedBy}`}</p>
                </div>
                <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 px-2 py-1 text-xs font-semibold capitalize">{count.status}</span>
              </div>
              <p className="text-xs text-neutral-300">{items.length} items recorded · {variances} with a variance</p>
              {count.notes && <p className="text-xs text-neutral-400 break-words">Notes: {count.notes}</p>}
              <details className="text-xs">
                <summary className="min-h-11 flex items-center cursor-pointer text-amber-300 font-semibold select-none">
                  View recorded ingredients and variances
                </summary>
                {items.length === 0 ? <p className="text-neutral-400">No ingredient lines saved on this count.</p> : (
                  <div className="space-y-2 pt-2 border-t border-neutral-700">
                    {items.map((item, index) => (
                      <div key={`${item.ingredientId ?? "item"}-${index}`} className="rounded-lg bg-neutral-900 border border-neutral-800 p-3">
                        <div className="font-semibold text-white mb-2">{typeof item.name === "string" && item.name ? item.name : `Ingredient #${item.ingredientId ?? "?"}`}</div>
                        <div className="grid grid-cols-2 gap-2 text-neutral-300">
                          <span>System: <b className="text-white">{quantity(item.systemStock)}</b></span>
                          <span>Physical: <b className="text-white">{quantity(item.physicalStock)}</b></span>
                          <span>Variance: <b className="text-white">{quantity(item.diff)}</b></span>
                          <span>Value difference: <b className="text-white">{money(item.costDiff)}</b></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </article>
          );
        })}
        {hasMore && <button type="button" disabled={loading} onClick={() => { void fetchCounts(counts.length, true); }}
          className="min-h-11 w-full rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-amber-200 text-sm font-semibold disabled:opacity-50">
          {loading ? "Loading…" : `Load ${PAGE_SIZE} older counts`}
        </button>}
      </div>
    </section>
  );
}
