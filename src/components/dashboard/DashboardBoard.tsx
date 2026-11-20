"use client";

import { Money } from "@/components/ui/Money";
import { SkeletonCards } from "@/components/ui/Skeleton";
import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Banknote, Boxes, ChefHat, Grid, Receipt, RefreshCw, Smartphone, TrendingUp, Utensils, Wallet } from "lucide-react";
import type { NavTab } from "@/components/nav-config";
import { Bars, TenderSplit, cedi } from "@/components/dashboard/charts";

/**
 * The owner's dashboard in the new design (redesign stage 5b, Nov 2026):
 * money first (net collections, orders, average bill, margin), the cash and
 * MoMo split, the floor and kitchen right now, low stock, and what sold.
 *
 * It reads the same endpoints as the classic dashboard and keeps its rule: a
 * panel whose request was refused or failed says so, never "GH₵0.00" or "all
 * clear", because those are statements about the venue. The period switch
 * uses the reports API's own timeframes.
 */

type Period = "today" | "7days" | "30days";
const PERIODS: [Period, string][] = [
  ["today", "Today"],
  ["7days", "Last 7 days"],
  ["30days", "Last 30 days"],
];

function Panel({ title, icon, error, action, children }: { title: string; icon: React.ReactNode; error?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-ui-border bg-ui-surface p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-ui-muted">{icon}</span>
        <h2 className="text-[0.9375rem] font-bold flex-1">{title}</h2>
        {action}
      </div>
      {error ? <p className="text-sm font-semibold text-ui-danger">{error}: these figures are not shown.</p> : children}
    </section>
  );
}

export function DashboardBoard({
  onNavigate,
  openShift,
  canOpen,
}: {
  onNavigate: (tab: NavTab) => void;
  openShift?: any;
  canOpen: { till: boolean; kds: boolean; stock: boolean; drawer: boolean; reports: boolean };
}) {
  const [period, setPeriod] = useState<Period>("today");
  const [reports, setReports] = useState<any>(null);
  const [tables, setTables] = useState<any[] | null>(null);
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  /** When the kitchen tickets were read: their ages are measured from it. */
  const [ticketsAt, setTicketsAt] = useState(0);

  useEffect(() => {
    const load = (key: string, url: string, onData: (d: any) => void) =>
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(r.status === 403 ? "Not available to your role" : `Could not load (${r.status})`);
          return r.json();
        })
        .then((d) => {
          setErrors((e) => {
            const next = { ...e };
            delete next[key];
            return next;
          });
          onData(d);
        })
        .catch((e) => setErrors((prev) => ({ ...prev, [key]: e?.message || "Could not load" })));
    load("reports", `/api/reports?timeframe=${period}`, setReports);
    load("tables", "/api/tables", (d) => setTables(d.tables || []));
    load("kds", "/api/kds", (d) => {
      setTickets(d.tickets || []);
      setTicketsAt(Date.now());
    });
  }, [period, tick]);

  const s = reports?.summary;
  const cash = Number(reports?.paymentBreakdown?.cash || 0);
  const momo = Number(reports?.paymentBreakdown?.momo || 0);
  const other = Number(reports?.paymentBreakdown?.other || 0);
  const tendered = cash + momo + other;
  const occupied = (tables || []).filter((t) => t.status === "occupied");
  const openBills = occupied.reduce((n, t) => n + Number(t.activeOrder?.totalAmount || 0), 0);
  const preparing = (tickets || []).filter((t) => t.status !== "ready").length;
  const ready = (tickets || []).filter((t) => t.status === "ready").length;
  const late = (tickets || []).filter((t) => t.status !== "ready" && ticketsAt - new Date(t.createdAt).getTime() > 15 * 60_000).length;
  const lowStock: any[] = reports?.lowStockAlerts || [];
  const label = PERIODS.find((p) => p[0] === period)![1].toLowerCase();

  const kpis = s
    ? [
        { label: `Net collections · ${label}`, value: cedi(s.netCollections), sub: `${cedi(s.grossCollections)} taken, ${cedi(s.totalRefunds)} refunded`, icon: Wallet },
        // The API's "paid" orders are the charged ones (not complimentary), paid or
        // not yet; the average is billed sales over those.
        { label: "Orders", value: String(s.totalOrdersCount), sub: `${s.paidOrderCount} charged · ${s.compOrderCount} free`, icon: Receipt },
        { label: "Average bill", value: cedi(s.avgOrderValue), sub: "billed, per charged order", icon: TrendingUp },
        // With no recipe costs recorded the margin would equal sales, which
        // reads as a real figure; say so instead (stage 7).
        Number(s.totalCostOfGoods) > 0 || Number(s.totalSales) === 0
          ? {
              label: "Gross margin (estimate)",
              value: cedi(s.grossProfit),
              sub: `billed sales less recipe cost · food cost ${s.foodCostPercentage}%`,
              icon: Banknote,
            }
          : { label: "Gross margin (estimate)", value: "Not yet", sub: "no recipe costs recorded for these sales", icon: Banknote },
      ]
    : [];

  const shortcuts: { tab: NavTab; label: string; icon: typeof Grid; ok: boolean }[] = [
    { tab: "pos", label: "Take an order", icon: Utensils, ok: canOpen.till },
    { tab: "tables", label: "Tables", icon: Grid, ok: canOpen.till },
    { tab: "kds", label: "Kitchen", icon: ChefHat, ok: canOpen.kds },
    { tab: "shifts", label: "Cash drawer", icon: Wallet, ok: canOpen.drawer },
    { tab: "inventory", label: "Stock", icon: Boxes, ok: canOpen.stock },
  ];
  const go = (tab: NavTab, ok: boolean, text: string) =>
    ok ? (
      <button type="button" onClick={() => onNavigate(tab)} className="h-9 px-2 -mr-2 rounded-md text-[0.8125rem] font-bold text-ui-primary-text inline-flex items-center gap-1 hover:bg-ui-subtle">
        {text} <ArrowRight className="w-4 h-4" />
      </button>
    ) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-ui-bg text-ui-text">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-[0.8125rem] text-ui-muted">
              {new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
              {openShift ? "a shift is open" : "no shift open on this login"}
            </p>
          </div>
          <div className="flex-1" />
          <div role="tablist" aria-label="Period" className="flex gap-1 p-1 rounded-lg border border-ui-border bg-ui-surface">
            {PERIODS.map(([p, l]) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={`h-10 px-3.5 rounded-md text-[0.8125rem] font-semibold ${period === p ? "bg-ui-primary text-ui-on-primary" : "text-ui-text-2 hover:bg-ui-subtle"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setTick((t) => t + 1)} aria-label="Refresh" className="w-11 h-11 rounded-full border border-ui-border bg-ui-surface text-ui-text-2 flex items-center justify-center">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {errors.reports ? (
          <p role="alert" className="rounded-xl border border-ui-border bg-ui-surface p-4 text-sm font-semibold text-ui-danger">
            Sales figures: {errors.reports}. Nothing is shown rather than a wrong zero.
          </p>
        ) : !s ? (
          <>
            <p className="sr-only">Loading figures…</p>
            <SkeletonCards count={4} />
          </>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="ui-in rounded-xl border border-ui-border bg-ui-surface shadow-ui-1 p-4">
                  <div className="flex items-center justify-between gap-2 text-[0.8125rem] font-semibold text-ui-muted">
                    {k.label}
                    <span className="w-8 h-8 rounded-full bg-ui-primary-soft text-ui-primary-text flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-[1.75rem] font-extrabold tracking-tight mt-1 leading-tight">
                    {k.value.startsWith("GH₵") ? <Money value={k.value.slice(3).replace(/,/g, "")} /> : k.value}
                  </div>
                  <div className="text-xs text-ui-muted mt-1">{k.sub}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] gap-4 items-start">
          <Panel title="How it was paid" icon={<Wallet className="w-4 h-4" />} error={errors.reports} action={go("reports", canOpen.reports, "Reports")}>
            {tendered <= 0 ? (
              <p className="text-sm text-ui-muted">No payments {label}.</p>
            ) : (
              <>
                <TenderSplit cash={cash} momo={momo} other={other} />
                <p className="text-xs text-ui-muted">
                  Refunds {cedi(s?.totalRefunds)} (cash {cedi(s?.cashRefunds)}, MoMo {cedi(s?.momoRefunds)}) · room charge {cedi(s?.totalRoomCharge)} · free breakfasts {cedi(s?.totalCompValue)} ({s?.compOrderCount ?? 0})
                </p>
              </>
            )}
          </Panel>

          <Panel title="Right now" icon={<Grid className="w-4 h-4" />} error={errors.tables && errors.kds ? errors.tables : undefined}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => canOpen.till && onNavigate("tables")} className="rounded-lg bg-ui-subtle p-3 text-left">
                <div className="text-xs font-semibold text-ui-muted">Tables in use</div>
                {errors.tables ? (
                  <div className="text-sm font-semibold text-ui-danger mt-1">{errors.tables}</div>
                ) : (
                  <>
                    <div className="text-xl font-bold font-mono">
                      {occupied.length} / {(tables || []).length}
                    </div>
                    <div className="text-xs text-ui-muted">{cedi(openBills)} on open bills</div>
                  </>
                )}
              </button>
              <button type="button" onClick={() => canOpen.kds && onNavigate("kds")} className="rounded-lg bg-ui-subtle p-3 text-left">
                <div className="text-xs font-semibold text-ui-muted">Kitchen</div>
                {errors.kds ? (
                  <div className="text-sm font-semibold text-ui-danger mt-1">{errors.kds}</div>
                ) : (
                  <>
                    <div className="text-xl font-bold font-mono">{preparing} cooking</div>
                    <div className={`text-xs ${late ? "text-ui-danger font-bold" : "text-ui-muted"}`}>
                      {ready} ready{late ? ` · ${late} over 15 min` : ""}
                    </div>
                  </>
                )}
              </button>
            </div>
            {!errors.tables && occupied.length > 0 && (
              <ul className="text-[0.8125rem] divide-y divide-ui-border">
                {occupied.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex justify-between py-1.5">
                    <span className="font-semibold">{/^\d+$/.test(String(t.tableNumber)) ? `Table ${t.tableNumber}` : t.tableNumber}</span>
                    <span className="font-mono text-ui-text-2">{t.activeOrder ? cedi(t.activeOrder.totalAmount) : "no bill"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Low stock" icon={<AlertTriangle className="w-4 h-4" />} error={errors.reports} action={go("inventory", canOpen.stock, "Stock")}>
            {lowStock.length === 0 ? (
              <p className="text-sm text-ui-success font-semibold">Every ingredient is above its minimum.</p>
            ) : (
              <ul className="text-[0.8125rem] divide-y divide-ui-border">
                {lowStock.slice(0, 6).map((i) => (
                  <li key={i.id} className="flex justify-between gap-2 py-1.5">
                    <span className="font-semibold truncate inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-ui-danger shrink-0" aria-label="Low" /> {i.name}
                    </span>
                    <span className="font-mono text-ui-text-2 shrink-0">
                      {Number(i.currentStock)} / min {Number(i.minStockLevel)} {i.unit}
                    </span>
                  </li>
                ))}
                {lowStock.length > 6 && <li className="py-1.5 text-ui-muted">+{lowStock.length - 6} more</li>}
              </ul>
            )}
          </Panel>

          <Panel title={`Top sellers · ${label}`} icon={<TrendingUp className="w-4 h-4" />} error={errors.reports}>
            {(reports?.topItems || []).length === 0 ? (
              <p className="text-sm text-ui-muted">Nothing sold {label}.</p>
            ) : (
              <Bars rows={(reports.topItems as any[]).slice(0, 6).map((t) => ({ name: t.name, value: Number(t.revenue), sub: `${t.quantity} sold` }))} unit={(v) => cedi(v)} />
            )}
          </Panel>

          <Panel title={`Sales by category · ${label}`} icon={<Receipt className="w-4 h-4" />} error={errors.reports}>
            {(reports?.categoryBreakdown || []).length === 0 ? (
              <p className="text-sm text-ui-muted">Nothing sold {label}.</p>
            ) : (
              <Bars rows={(reports.categoryBreakdown as any[]).slice(0, 8).map((c) => ({ name: c.name, value: Number(c.revenue), sub: `${c.count} item${Number(c.count) === 1 ? "" : "s"}` }))} unit={(v) => cedi(v)} />
            )}
          </Panel>

          <Panel title="Go to" icon={<ArrowRight className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-2">
              {shortcuts
                .filter((x) => x.ok)
                .map((x) => {
                  const Icon = x.icon;
                  return (
                    <button key={x.tab} type="button" onClick={() => onNavigate(x.tab)} className="h-12 rounded-lg border border-ui-border-strong text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-ui-subtle">
                      <Icon className="w-4 h-4" /> {x.label}
                    </button>
                  );
                })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
