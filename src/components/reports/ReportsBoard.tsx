"use client";

import React from "react";
import { Coffee, FileSpreadsheet, Receipt, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { Bars, TenderSplit, cedi } from "@/components/dashboard/charts";
import { SkeletonCards } from "@/components/ui/Skeleton";

/**
 * Reports in the new design (redesign stage 5b, Nov 2026): money received
 * first (collected, refunded, net, by tender), then billed sales and margin,
 * then what sold, then free breakfasts.
 *
 * Presentation only. ReportsDashboard keeps the period, the custom range
 * (a draft until Apply), the loading and the accounting exports; the figures
 * are GET /api/reports exactly as returned.
 */

export type ReportsTimeframe = "today" | "7days" | "30days" | "all" | "custom";
const PERIODS: [ReportsTimeframe, string][] = [
  ["today", "Today"],
  ["7days", "Last 7 days"],
  ["30days", "Last 30 days"],
  ["all", "All time"],
  ["custom", "Dates…"],
];
const docketNo = (orderNumber: string) => `K-${String(orderNumber).slice(-4)}`;

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div className="ui-in rounded-xl border border-ui-border bg-ui-surface shadow-ui-1 p-4">
      <div className="text-[0.8125rem] font-semibold text-ui-muted">{label}</div>
      <div className={`text-2xl font-extrabold tracking-tight mt-1 ${tone === "danger" ? "text-ui-danger" : tone === "success" ? "text-ui-success" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-ui-muted mt-1">{sub}</div>}
    </div>
  );
}

export function ReportsBoard(p: {
  timeframe: ReportsTimeframe;
  onTimeframe: (t: ReportsTimeframe) => void;
  startDate: string;
  endDate: string;
  onStartDate: (v: string) => void;
  onEndDate: (v: string) => void;
  onApply: () => void;
  applied: boolean;
  data: any | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canExport: boolean;
  onExport: (format: "quickbooks" | "xero") => void;
}) {
  const s = p.data?.summary;
  const pay = p.data?.paymentBreakdown || {};
  const comps: any[] = p.data?.complimentaryOrders || [];
  const win = p.data?.window;
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-ui-bg text-ui-text">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">Reports</h1>
          <div role="tablist" aria-label="Period" className="flex gap-1 p-1 rounded-lg border border-ui-border bg-ui-surface flex-wrap">
            {PERIODS.map(([t, l]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={p.timeframe === t}
                onClick={() => p.onTimeframe(t)}
                className={`h-10 px-3.5 rounded-md text-[0.8125rem] font-semibold ${p.timeframe === t ? "bg-ui-primary text-ui-on-primary" : "text-ui-text-2 hover:bg-ui-subtle"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button type="button" onClick={p.onRetry} aria-label="Refresh" className="w-11 h-11 rounded-full border border-ui-border bg-ui-surface text-ui-text-2 flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 ${p.loading ? "animate-spin" : ""}`} />
          </button>
          <div className="flex-1" />
          {p.canExport && (
            <div className="flex gap-2">
              {(["quickbooks", "xero"] as const).map((f) => (
                <button key={f} type="button" onClick={() => p.onExport(f)} className="h-11 px-3.5 rounded-lg border border-ui-border-strong bg-ui-surface text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-ui-subtle">
                  <FileSpreadsheet className="w-4 h-4" /> {f === "quickbooks" ? "QuickBooks CSV" : "Xero CSV"}
                </button>
              ))}
            </div>
          )}
        </div>

        {p.timeframe === "custom" && (
          <div className="flex items-end gap-2 flex-wrap rounded-xl border border-ui-border bg-ui-surface p-3">
            <label className="text-sm font-semibold">
              From
              <input type="date" value={p.startDate} onChange={(e) => p.onStartDate(e.target.value)} className="block mt-1 h-11 rounded-lg border border-ui-border-strong bg-ui-surface px-3 text-ui-text" />
            </label>
            <label className="text-sm font-semibold">
              To
              <input type="date" value={p.endDate} onChange={(e) => p.onEndDate(e.target.value)} className="block mt-1 h-11 rounded-lg border border-ui-border-strong bg-ui-surface px-3 text-ui-text" />
            </label>
            <button type="button" onClick={p.onApply} className="h-11 px-4 rounded-lg bg-ui-primary text-ui-on-primary text-sm font-bold">
              Apply
            </button>
            <span className="text-xs text-ui-muted">{p.applied ? "Showing the applied dates. Exports follow them." : "Choose both dates, then Apply."}</span>
          </div>
        )}

        {p.loadError && (
          <div role="alert" className="rounded-lg bg-ui-danger-soft text-ui-danger px-3 py-2.5 text-sm font-semibold flex items-center gap-3">
            <span className="flex-1">{p.loadError}</span>
            <button type="button" onClick={p.onRetry} className="h-9 px-3 rounded-md border border-current text-xs font-bold">
              Retry
            </button>
          </div>
        )}

        {!s ? (
          p.loading ? (
            <>
              <p className="sr-only">Loading figures…</p>
              <SkeletonCards count={6} min="13rem" />
            </>
          ) : (
            <p className="text-sm text-ui-muted">No figures yet.</p>
          )
        ) : (
          <>
            {win && (
              <p className="text-xs text-ui-muted">
                {win.start ? `${fmtDay(win.start)} to ${fmtDay(new Date(new Date(win.endExclusive).getTime() - 1).toISOString())}` : "All time"} · {win.timezone}.{" "}
                Collections and refunds count on the day of the transaction; billed sales on the day the order was rung. Tender figures are the till&apos;s records, not
                bank statements or a tax return.
              </p>
            )}

            <section aria-label="Money received" className="space-y-3">
              <h2 className="text-base font-bold inline-flex items-center gap-2">
                <Wallet className="w-4 h-4 text-ui-muted" /> Money received
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
                <Stat label="Collected" value={cedi(s.grossCollections)} sub={`cash ${cedi(s.cashCollections)} · MoMo ${cedi(s.momoCollections)}`} />
                <Stat label="Refunded" value={cedi(s.totalRefunds)} sub={`cash ${cedi(s.cashRefunds)} · MoMo ${cedi(s.momoRefunds)}${Number(s.unallocatedRefunds) > 0 ? ` · unallocated ${cedi(s.unallocatedRefunds)}` : ""}`} tone={Number(s.totalRefunds) > 0 ? "danger" : undefined} />
                <Stat label="Net collections" value={cedi(s.netCollections)} sub="collected less refunded (can go below zero when older sales are refunded)" tone="success" />
              </div>
              {Number(pay.cash || 0) + Number(pay.momo || 0) + Number(pay.other || 0) > 0 && (
                <div className="rounded-xl border border-ui-border bg-ui-surface p-4">
                  <TenderSplit cash={Number(pay.cash || 0)} momo={Number(pay.momo || 0)} other={Number(pay.other || 0)} />
                </div>
              )}
            </section>

            <section aria-label="Sales and margin" className="space-y-3">
              <h2 className="text-base font-bold inline-flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-ui-muted" /> Sales and margin
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3">
                <Stat label="Billed sales" value={cedi(s.totalSales)} sub={`${s.totalOrdersCount} orders · ${s.paidOrderCount} charged`} />
                <Stat label="Average bill" value={cedi(s.avgOrderValue)} sub="billed, per charged order" />
                {Number(s.totalCostOfGoods) > 0 || Number(s.totalSales) === 0 ? (
                  <>
                    <Stat label="Recipe cost of goods" value={cedi(s.totalCostOfGoods)} sub={`food cost ${s.foodCostPercentage}% of billed sales (aim 28–35%)`} />
                    <Stat label="Gross margin (estimate)" value={cedi(s.grossProfit)} sub="billed sales less recipe cost" />
                  </>
                ) : (
                  <>
                    <Stat label="Recipe cost of goods" value="Not recorded" sub="these sales have no recipe costs, so no food-cost figure" />
                    <Stat label="Gross margin (estimate)" value="Not yet" sub="needs recipe costs: add them under Recipes" />
                  </>
                )}
                <Stat label="Room service charge" value={cedi(s.totalRoomCharge)} sub="charged on room-service orders" />
                <Stat label="Waste & spoilage" value={cedi(s.totalWastageCost)} sub="stock written off in this period" tone={Number(s.totalWastageCost) > 0 ? "danger" : undefined} />
              </div>
            </section>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] gap-4 items-start">
              <section aria-label="Top sellers" className="rounded-xl border border-ui-border bg-ui-surface p-4 space-y-3">
                <h2 className="text-[0.9375rem] font-bold inline-flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-ui-muted" /> Top sellers
                </h2>
                {(p.data.topItems || []).length === 0 ? (
                  <p className="text-sm text-ui-muted">Nothing sold in this period.</p>
                ) : (
                  <Bars rows={(p.data.topItems as any[]).slice(0, 10).map((t) => ({ name: t.name, value: Number(t.revenue), sub: `${t.quantity} sold` }))} unit={(v) => cedi(v)} />
                )}
              </section>
              <section aria-label="Sales by category" className="rounded-xl border border-ui-border bg-ui-surface p-4 space-y-3">
                <h2 className="text-[0.9375rem] font-bold inline-flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-ui-muted" /> Sales by category
                </h2>
                {(p.data.categoryBreakdown || []).length === 0 ? (
                  <p className="text-sm text-ui-muted">Nothing sold in this period.</p>
                ) : (
                  <Bars rows={(p.data.categoryBreakdown as any[]).map((c) => ({ name: c.name, value: Number(c.revenue), sub: `${c.count} item${Number(c.count) === 1 ? "" : "s"}` }))} unit={(v) => cedi(v)} />
                )}
              </section>
            </div>

            <section aria-label="Free breakfasts" className="rounded-xl border border-ui-border bg-ui-surface p-4 space-y-3">
              <h2 className="text-[0.9375rem] font-bold inline-flex items-center gap-2">
                <Coffee className="w-4 h-4 text-ui-muted" /> Free breakfasts · {cedi(s.totalCompValue)} given ({s.compOrderCount})
              </h2>
              {comps.length === 0 ? (
                <p className="text-sm text-ui-muted">None in this period.</p>
              ) : (
                <ul className="divide-y divide-ui-border text-[0.8125rem]">
                  {comps.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2">
                      <span className="font-mono font-bold" title={c.orderNumber}>
                        {docketNo(c.orderNumber)}
                      </span>
                      <span className="font-semibold">{c.customerName || "Room guest"}</span>
                      <span className="text-ui-text-2 flex-1 min-w-40">{c.reason || "No reason given"}</span>
                      <span className="text-ui-muted">{new Date(c.createdAt).toLocaleString("en-GH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="font-mono font-bold">{cedi(c.compValue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
