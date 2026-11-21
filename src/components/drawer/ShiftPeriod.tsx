"use client";

import React from "react";
import { CalendarRange, Scale } from "lucide-react";

/**
 * Period filter and reconciliation summary for the cash drawer's shift history
 * (Nov 2026). Shared by the new board and the classic screen; `classic` swaps
 * the colours. The figures come from GET /api/shifts as returned.
 */

export type ShiftPeriod = "recent" | "today" | "7days" | "30days" | "custom";
export const SHIFT_PERIODS: [ShiftPeriod, string][] = [
  ["recent", "Latest"],
  ["today", "Today"],
  ["7days", "Last 7 days"],
  ["30days", "Last 30 days"],
  ["custom", "Dates…"],
];

const cedi = (v: unknown) =>
  `GH₵${Number(v || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });

export function ShiftPeriodControls(p: {
  classic?: boolean;
  period: ShiftPeriod;
  onPeriod: (p: ShiftPeriod) => void;
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onApply: () => void;
  applied: boolean;
  loading: boolean;
}) {
  const c = p.classic;
  const today = new Date().toISOString().slice(0, 10);
  const tabOn = c ? "bg-amber-500 text-black" : "bg-ui-primary text-ui-on-primary";
  const tabOff = c ? "text-neutral-300 hover:bg-neutral-800" : "text-ui-text-2 hover:bg-ui-subtle";
  const box = c ? "border-neutral-700 bg-neutral-900" : "border-ui-border bg-ui-surface";
  const input = c
    ? "block mt-1 h-11 rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-white"
    : "block mt-1 h-11 rounded-lg border border-ui-border-strong bg-ui-surface px-3 text-ui-text";
  const muted = c ? "text-neutral-400" : "text-ui-muted";
  const canApply = !!p.start && !!p.end && p.start <= p.end && !p.loading;
  return (
    <div className="space-y-2">
      <div role="tablist" aria-label="Shift history period" className={`inline-flex max-w-full overflow-x-auto gap-1 p-1 rounded-lg border ${box}`}>
        {SHIFT_PERIODS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={p.period === value}
            onClick={() => p.onPeriod(value)}
            className={`h-10 px-3.5 rounded-md text-[0.8125rem] font-semibold whitespace-nowrap shrink-0 ${p.period === value ? tabOn : tabOff}`}
          >
            {label}
          </button>
        ))}
      </div>
      {p.period === "custom" && (
        <div className={`flex items-end gap-2 flex-wrap rounded-xl border p-3 ${box}`}>
          <label className="text-sm font-semibold">
            From
            <input type="date" value={p.start} max={p.end || today} onChange={(e) => p.onStart(e.target.value)} className={input} />
          </label>
          <label className="text-sm font-semibold">
            To
            <input type="date" value={p.end} min={p.start || undefined} max={today} onChange={(e) => p.onEnd(e.target.value)} className={input} />
          </label>
          <button
            type="button"
            onClick={p.onApply}
            disabled={!canApply}
            className={`h-11 px-4 rounded-lg text-sm font-bold disabled:opacity-50 ${c ? "bg-amber-500 text-black" : "bg-ui-primary text-ui-on-primary"}`}
          >
            Apply
          </button>
          <span className={`text-xs ${muted}`}>
            {p.start && p.end && p.start > p.end
              ? "The From date must be on or before the To date."
              : p.applied
                ? "Showing shifts opened on these dates."
                : "Choose both dates, then Apply."}
          </span>
        </div>
      )}
    </div>
  );
}

export function ReconciliationSummary({
  classic,
  summary,
  window,
  truncated,
}: {
  classic?: boolean;
  summary: any;
  window: { start: string; endExclusive: string; timezone: string } | null;
  truncated: boolean;
}) {
  if (!summary) return null;
  const c = classic;
  const card = c ? "rounded-xl border border-neutral-800 bg-neutral-900 p-3" : "rounded-xl border border-ui-border bg-ui-surface shadow-ui-1 p-3";
  const label = c ? "text-xs font-semibold text-neutral-400" : "text-xs font-semibold text-ui-muted";
  const value = c ? "text-lg font-bold font-mono text-white mt-0.5" : "text-lg font-extrabold font-mono mt-0.5";
  const sub = c ? "text-[0.75rem] text-neutral-400 mt-0.5" : "text-[0.75rem] text-ui-muted mt-0.5";
  const net = Number(summary.netDifference);
  const netTone = net > 0.005 ? (c ? "text-emerald-400" : "text-ui-success") : net < -0.005 ? (c ? "text-rose-400" : "text-ui-danger") : "";
  return (
    <section aria-label="Reconciliation for the period" className="space-y-2">
      <h3 className={`text-sm font-bold inline-flex items-center gap-2 ${c ? "text-white" : ""}`}>
        <Scale className="w-4 h-4" /> Reconciliation
        {window && (
          <span className={`font-semibold inline-flex items-center gap-1 ${c ? "text-neutral-400" : "text-ui-muted"}`}>
            <CalendarRange className="w-3.5 h-3.5" />
            {day(window.start)} to {day(new Date(new Date(window.endExclusive).getTime() - 1).toISOString())}
          </span>
        )}
      </h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2">
        <div className={card}>
          <div className={label}>Shifts</div>
          <div className={value}>{summary.shiftCount}</div>
          <div className={sub}>
            {summary.closedCount} closed{summary.openCount ? ` · ${summary.openCount} still open` : ""}
          </div>
        </div>
        <div className={card}>
          <div className={label}>Cash sales</div>
          <div className={value}>{cedi(summary.cashSales)}</div>
          <div className={sub}>MoMo {cedi(summary.momoSales)} · float {cedi(summary.openingFloat)}</div>
        </div>
        <div className={card}>
          <div className={label}>Cash out</div>
          <div className={value}>{cedi(Number(summary.cashPayouts))}</div>
          <div className={sub}>payouts, including cash refunds of {cedi(summary.cashRefunds)}</div>
        </div>
        <div className={card}>
          <div className={label}>Expected vs counted</div>
          <div className={value}>{cedi(summary.countedCash)}</div>
          <div className={sub}>counted, against {cedi(summary.expectedCash)} expected (closed shifts)</div>
        </div>
        <div className={card}>
          <div className={label}>Over / short</div>
          <div className={`${value} ${netTone}`}>
            {net > 0.005 ? `+${cedi(net)}` : net < -0.005 ? `−${cedi(-net)}` : "Exact"}
          </div>
          <div className={sub}>
            {summary.shortCount} short ({cedi(summary.totalShort)}) · {summary.overCount} over ({cedi(summary.totalOver)})
          </div>
        </div>
      </div>
      {truncated && <p className={`text-xs ${c ? "text-amber-300" : "text-ui-primary-text"}`}>Only the latest 500 shifts in this period are listed and counted. Choose fewer dates.</p>}
    </section>
  );
}
