"use client";

import React from "react";
import { ArrowDownRight, Banknote, CheckCircle2, Lock, RefreshCw, Smartphone, Unlock, Wallet } from "lucide-react";

/**
 * The cash drawer in the new design (redesign stage 4c, Nov 2026): the cash
 * that should be in the drawer first, with the sum that produces it spelled
 * out, then colleagues on shift and the reconciliation history.
 *
 * Presentation only. ShiftCashDrawer keeps the data and every action (open
 * shift, payout, no-sale drawer open, close and reconcile, all via
 * POST /api/shifts) and computes the figures shown here; the dialogs that
 * take amounts are its own.
 */

const cedi = (n: number) => `GH₵${n.toFixed(2)}`;
const time = (d: string) => new Date(d).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
const dateTime = (d: string) => new Date(d).toLocaleString("en-GH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function DrawerBoard(p: {
  activeShift: any | null;
  staffName: string;
  readOnly: boolean;
  canManageShifts: boolean;
  figures: { opening: number; cashSales: number; momoSales: number; outflows: number; refunds: number; expected: number };
  otherOpenShifts: any[];
  history: any[];
  drawerMessage: string | null;
  loadError: string | null;
  onRefresh: () => void;
  onOpenShift: () => void;
  onOpenDrawer: () => void;
  onPayout: () => void;
  onCloseMine: () => void;
  onCloseOther: (shift: any) => void;
}) {
  const f = p.figures;
  const shift = p.activeShift;
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-ui-bg text-ui-text">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">Cash drawer</h1>
          <span className={`h-9 px-3 rounded-full text-[0.8125rem] font-bold inline-flex items-center gap-1.5 ${shift ? "bg-ui-success-soft text-ui-success" : "bg-ui-subtle text-ui-text-2"}`}>
            {shift ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {shift ? `Your shift is open · since ${time(shift.openedAt)}` : "Your shift is closed"}
          </span>
          <button type="button" onClick={p.onRefresh} aria-label="Refresh" className="w-11 h-11 rounded-full border border-ui-border bg-ui-surface text-ui-text-2 flex items-center justify-center">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          {p.readOnly ? (
            <span className="h-11 px-3 rounded-lg border border-ui-border bg-ui-surface text-[0.8125rem] text-ui-text-2 inline-flex items-center gap-2">
              <Lock className="w-4 h-4" /> Read-only: the register is opened, closed and adjusted at the till.
            </span>
          ) : shift ? (
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={p.onOpenDrawer} title="Pop the drawer open without a sale (logged)" className="h-12 px-4 rounded-lg border border-ui-border-strong bg-ui-surface text-sm font-semibold inline-flex items-center gap-2 hover:bg-ui-subtle">
                <Banknote className="w-[1.125rem] h-[1.125rem]" /> Open drawer
              </button>
              <button type="button" onClick={p.onPayout} className="h-12 px-4 rounded-lg border border-ui-border-strong bg-ui-surface text-sm font-semibold inline-flex items-center gap-2 hover:bg-ui-subtle">
                <ArrowDownRight className="w-[1.125rem] h-[1.125rem]" /> Cash drop / payout
              </button>
              <button type="button" onClick={p.onCloseMine} className="h-12 px-4 rounded-lg bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-sm font-bold inline-flex items-center gap-2">
                <Lock className="w-[1.125rem] h-[1.125rem]" /> Count &amp; close shift
              </button>
            </div>
          ) : (
            <button type="button" onClick={p.onOpenShift} className="h-12 px-5 rounded-lg bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-sm font-bold inline-flex items-center gap-2">
              <Unlock className="w-[1.125rem] h-[1.125rem]" /> Open my shift
            </button>
          )}
        </div>

        {p.loadError && (
          <div role="alert" className="rounded-lg bg-ui-danger-soft text-ui-danger px-3 py-2.5 text-sm font-semibold flex items-center gap-3">
            <span className="flex-1">{p.loadError}</span>
            <button type="button" onClick={p.onRefresh} className="h-9 px-3 rounded-md border border-current text-xs font-bold">
              Retry
            </button>
          </div>
        )}
        {p.drawerMessage && (
          <div role="status" className="rounded-lg bg-ui-success-soft text-ui-success px-3 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {p.drawerMessage}
          </div>
        )}

        {shift ? (
          <section aria-label="Your shift" className="rounded-xl border border-ui-border bg-ui-surface overflow-hidden">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <div className="p-4 bg-ui-primary-soft">
                <div className="text-xs font-bold text-ui-primary-text">CASH THAT SHOULD BE IN THE DRAWER</div>
                <div className="text-3xl font-bold font-mono text-ui-primary-text mt-1">{cedi(f.expected)}</div>
                <div className="text-xs text-ui-primary-text mt-1">
                  Shift #{shift.id} · {shift.userName || p.staffName}
                </div>
              </div>
              {[
                { label: "Starting float", value: cedi(f.opening), icon: Wallet, cls: "text-ui-text" },
                { label: "Cash sales", value: `+${cedi(f.cashSales)}`, icon: Banknote, cls: "text-ui-success" },
                { label: "Cash out (payouts, refunds)", value: `−${cedi(f.outflows)}`, icon: ArrowDownRight, cls: "text-ui-danger" },
                { label: "MoMo sales (not in the drawer)", value: cedi(f.momoSales), icon: Smartphone, cls: "text-ui-info" },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="p-4 border-t md:border-t-0 md:border-l border-ui-border">
                    <div className="text-xs font-semibold text-ui-muted inline-flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" /> {m.label}
                    </div>
                    <div className={`text-xl font-bold font-mono mt-1 ${m.cls}`}>{m.value}</div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-ui-border bg-ui-subtle text-[0.8125rem] text-ui-text-2 font-mono">
              {cedi(f.opening)} float + {cedi(f.cashSales)} cash sales − {cedi(f.outflows)} cash out = <b className="text-ui-text">{cedi(f.expected)}</b>
              <span className="font-sans text-ui-muted"> · cash refunds in that: {cedi(f.refunds)} (recorded automatically; use payouts only for other cash out)</span>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-ui-border bg-ui-surface p-6 text-center">
            <Lock className="w-10 h-10 mx-auto text-ui-muted mb-2" />
            <h2 className="text-base font-bold">Your shift is closed</h2>
            <p className="text-sm text-ui-muted mt-1">
              {p.otherOpenShifts.length > 0
                ? `${p.otherOpenShifts.map((o) => o.userName).join(", ")} ${p.otherOpenShifts.length === 1 ? "has" : "have"} a shift open. Sales you ring land on your own shift, so open yours before selling.`
                : "Open your shift to start taking sales and tracking the drawer."}
            </p>
          </section>
        )}

        {p.canManageShifts && p.otherOpenShifts.length > 0 && (
          <section aria-label="Also on shift">
            <h2 className="text-base font-bold mb-2">Also on shift now</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
              {p.otherOpenShifts.map((o) => {
                const expected = Number(o.openingCash || 0) + Number(o.totalCashSales || 0) - Number(o.cashPayouts || 0);
                return (
                  <article key={o.id} className="rounded-xl border border-ui-border bg-ui-surface p-4 flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold truncate">{o.userName}</span>
                      <span className="text-xs text-ui-muted shrink-0">#{o.id} · since {time(o.openedAt)}</span>
                    </div>
                    <div className="text-[0.8125rem] text-ui-text-2">
                      Cash <b className="font-mono text-ui-success">{cedi(Number(o.totalCashSales || 0))}</b> · MoMo{" "}
                      <b className="font-mono text-ui-info">{cedi(Number(o.totalCardSales || 0))}</b>
                    </div>
                    <div className="text-[0.8125rem]">
                      Expected in drawer <b className="font-mono text-ui-primary-text">{cedi(expected)}</b>
                    </div>
                    <button type="button" onClick={() => p.onCloseOther(o)} className="mt-1 h-11 rounded-lg border border-ui-border-strong text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-ui-subtle">
                      <Lock className="w-4 h-4" /> Count &amp; close their shift
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section aria-label="Shift history" className="rounded-xl border border-ui-border bg-ui-surface overflow-hidden">
          <h2 className="px-4 py-3 text-base font-bold border-b border-ui-border">Shift history</h2>
          {p.history.length === 0 ? (
            <p className="p-6 text-center text-sm text-ui-muted">No shifts recorded yet.</p>
          ) : (
            <ul className="divide-y divide-ui-border">
              {/* Column labels for wide screens; each row labels its own
                  fields when it wraps on a narrower one. */}
              <li aria-hidden="true" className="hidden xl:grid grid-cols-[5rem_1.2fr_1fr_1fr_repeat(5,minmax(0,1fr))] gap-3 px-4 py-2.5 bg-ui-subtle text-xs font-semibold text-ui-muted">
                <span>Shift</span>
                <span>Cashier</span>
                <span>Opened</span>
                <span>Closed</span>
                <span className="text-right">Float</span>
                <span className="text-right">Cash</span>
                <span className="text-right">MoMo</span>
                <span className="text-right">Counted</span>
                <span className="text-right">Over / short</span>
              </li>
              {p.history.map((s) => {
                const closed = s.status === "closed";
                const diff = Number(s.cashDifference || 0);
                const field = "flex xl:block justify-between gap-2";
                const lbl = "xl:hidden text-ui-muted";
                return (
                  <li key={s.id} className="grid grid-cols-2 xl:grid-cols-[5rem_1.2fr_1fr_1fr_repeat(5,minmax(0,1fr))] gap-x-6 gap-y-1 xl:gap-3 px-4 py-3 text-[0.8125rem]">
                    <span className="font-mono font-semibold">#{s.id}</span>
                    <span className="font-semibold xl:font-normal text-right xl:text-left">{s.userName}</span>
                    <span className={`${field} text-ui-text-2`}>
                      <span className={lbl}>Opened</span> {dateTime(s.openedAt)}
                    </span>
                    <span className={`${field} text-ui-text-2`}>
                      <span className={lbl}>Closed</span>
                      {closed && s.closedAt ? dateTime(s.closedAt) : <span className="font-bold text-ui-success">Open</span>}
                    </span>
                    <span className={`${field} xl:text-right font-mono`}>
                      <span className={`${lbl} font-sans`}>Float</span> {cedi(Number(s.openingCash || 0))}
                    </span>
                    <span className={`${field} xl:text-right font-mono`}>
                      <span className={`${lbl} font-sans`}>Cash</span> {cedi(Number(s.totalCashSales || 0))}
                    </span>
                    <span className={`${field} xl:text-right font-mono`}>
                      <span className={`${lbl} font-sans`}>MoMo</span> {cedi(Number(s.totalCardSales || 0))}
                    </span>
                    <span className={`${field} xl:text-right font-mono`}>
                      <span className={`${lbl} font-sans`}>Counted</span> {closed ? cedi(Number(s.actualClosingCash || 0)) : "—"}
                    </span>
                    <span
                      className={`${field} xl:text-right font-mono font-bold ${
                        !closed ? "text-ui-muted" : diff > 0.005 ? "text-ui-success" : diff < -0.005 ? "text-ui-danger" : "text-ui-text"
                      }`}
                    >
                      <span className={`${lbl} font-sans font-normal`}>Over / short</span>
                      {!closed ? "—" : diff > 0.005 ? `+${cedi(diff)} over` : diff < -0.005 ? `−${cedi(-diff)} short` : "Exact"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
