"use client";

import React from "react";
import { AlertCircle, CheckCircle2, ChefHat, Clock, Flame, Printer, RefreshCw, Wine } from "lucide-react";

/**
 * The kitchen board in the new design (redesign stage 4a, Nov 2026): one
 * column per step (New, Preparing, Ready), ticket cards with age, items,
 * options and notes, and one clear next-step button per ticket.
 *
 * Presentation only. KitchenDisplaySystem keeps the polling, the station
 * filter and the status changes (PATCH /api/kds); this component calls them.
 * The step rules are the classic screen's: pending → preparing → ready →
 * completed (collected).
 */

type Station = "all" | "kitchen" | "grill" | "bar";

/** Classic thresholds: amber from 8 minutes, overdue after 15. */
const WARN_MIN = 8;
const LATE_MIN = 15;

const STATIONS: [Station, string, typeof ChefHat][] = [
  ["all", "All lines", ChefHat],
  ["kitchen", "Kitchen", ChefHat],
  ["grill", "Grill", Flame],
  ["bar", "Bar", Wine],
];

const TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine in",
  takeaway: "Takeaway",
  delivery: "Delivery",
  room_service: "Room service",
};

const COLUMNS: { status: string; label: string; dot: string; next?: { to: "preparing" | "ready" | "completed"; label: string } }[] = [
  { status: "pending", label: "New", dot: "bg-ui-danger", next: { to: "preparing", label: "Start preparing" } },
  { status: "preparing", label: "Preparing", dot: "bg-ui-primary", next: { to: "ready", label: "Mark ready" } },
  { status: "ready", label: "Ready", dot: "bg-ui-success", next: { to: "completed", label: "Collected · clear" } },
];

export function KitchenBoard(p: {
  tickets: any[];
  now: number;
  station: Station;
  onStation: (s: Station) => void;
  onRefresh: () => void;
  onStatus: (ticketId: number, status: "preparing" | "ready" | "completed") => void;
  onReprint: (ticket: any) => void;
  loadError: string | null;
}) {
  const minutes = (t: any) => Math.max(0, Math.floor((p.now - new Date(t.createdAt).getTime()) / 60_000));
  const late = p.tickets.filter((t) => t.status !== "ready" && minutes(t) > LATE_MIN).length;
  const count = (s: string) => p.tickets.filter((t) => t.status === s).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-ui-bg text-ui-text">
      <div className="shrink-0 px-5 pt-5 pb-3 flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Kitchen</h1>
        <button
          type="button"
          onClick={p.onRefresh}
          aria-label="Refresh tickets"
          className="w-11 h-11 rounded-full border border-ui-border bg-ui-surface text-ui-text-2 flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-xs text-ui-muted">Updates every 5 seconds · tickets are the printed dockets</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap text-[0.8125rem] font-semibold">
          {count("pending") > 0 && (
            <span className="h-10 px-3 rounded-full bg-ui-surface border border-ui-border inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ui-danger" /> New {count("pending")}
            </span>
          )}
          <span className="h-10 px-3 rounded-full bg-ui-surface border border-ui-border inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ui-primary" /> Preparing {count("preparing")}
          </span>
          <span className="h-10 px-3 rounded-full bg-ui-surface border border-ui-border inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ui-success" /> Ready {count("ready")}
          </span>
          {late > 0 && (
            <span className="h-10 px-3 rounded-full bg-ui-danger-soft text-ui-danger inline-flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {late} over {LATE_MIN} min
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-3">
        <div role="tablist" aria-label="Station" className="inline-flex max-w-full overflow-x-auto gap-1 p-1 rounded-lg border border-ui-border bg-ui-surface">
          {STATIONS.map(([s, label, Icon]) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={p.station === s}
              onClick={() => p.onStation(s)}
              className={`h-10 px-3.5 rounded-md text-[0.8125rem] font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition ${
                p.station === s ? "bg-ui-primary text-ui-on-primary" : "text-ui-text-2 hover:bg-ui-subtle"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {p.loadError && (
        <div role="alert" className="mx-5 mb-3 rounded-lg bg-ui-danger-soft text-ui-danger px-3 py-2.5 text-sm font-semibold flex items-center gap-3">
          <span className="flex-1">{p.loadError}</span>
          <button type="button" onClick={p.onRefresh} className="h-9 px-3 rounded-md border border-current text-xs font-bold">
            Retry
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 custom-scrollbar">
        {p.tickets.length === 0 ? (
          <div className="h-full min-h-64 flex flex-col items-center justify-center text-center text-ui-muted">
            <CheckCircle2 className="w-14 h-14 text-ui-success mb-3 opacity-60" />
            <p className="text-base font-bold text-ui-text-2">No open dockets</p>
            <p className="text-sm mt-1">Dockets appear here when an order is sent to the kitchen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-4 items-start">
            {/* Orders reach the kitchen already "preparing" (create-order), so
                the New column only shows while a pending ticket exists. */}
            {COLUMNS.filter((col) => col.status !== "pending" || count("pending") > 0).map((col) => {
              const list = p.tickets
                .filter((t) => t.status === col.status)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
              return (
                <section key={col.status} aria-label={`${col.label} tickets`} className="rounded-xl bg-ui-subtle border border-ui-border p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} /> {col.label}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-ui-surface text-ui-text-2">{list.length}</span>
                  </div>
                  {list.length === 0 && <p className="text-xs text-ui-muted px-1 pb-1">None</p>}
                  {list.map((t) => {
                    const m = minutes(t);
                    const isLate = t.status !== "ready" && m > LATE_MIN;
                    const tone =
                      t.status === "ready"
                        ? "bg-ui-success-soft text-ui-success"
                        : isLate
                          ? "bg-ui-danger text-ui-surface"
                          : m > WARN_MIN
                            ? "bg-ui-primary-soft text-ui-primary-text"
                            : "bg-ui-subtle text-ui-text-2";
                    return (
                      <article
                        key={t.id}
                        aria-label={`Ticket ${t.ticketNumber}, ${m} minutes${isLate ? ", overdue" : ""}`}
                        className={`rounded-xl bg-ui-surface border-2 flex flex-col overflow-hidden ${
                          isLate ? "border-ui-danger" : t.status === "ready" ? "border-ui-success" : "border-ui-border"
                        }`}
                      >
                        <div className="p-3 flex items-start gap-2 border-b border-ui-border">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold font-mono">#{t.ticketNumber}</span>
                              {t.tableNumber && (
                                <span className="px-2 py-0.5 rounded-md bg-ui-primary-soft text-ui-primary-text text-xs font-bold font-mono">{t.tableNumber}</span>
                              )}
                            </div>
                            <div className="text-[0.8125rem] text-ui-muted truncate">
                              {TYPE_LABEL[t.orderType] ?? t.orderType} · {t.customerName || "Walk-in Guest"}
                            </div>
                          </div>
                          <span className={`h-9 px-2.5 rounded-lg text-sm font-bold font-mono inline-flex items-center gap-1 shrink-0 ${tone}`}>
                            <Clock className="w-4 h-4" /> {m}m
                          </span>
                          <button
                            type="button"
                            onClick={() => p.onReprint(t)}
                            aria-label={`Reprint docket ${t.ticketNumber}`}
                            title="Reprint this docket"
                            className="w-9 h-9 rounded-lg border border-ui-border text-ui-text-2 hover:bg-ui-subtle flex items-center justify-center shrink-0"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                        <ul className="p-3 space-y-2.5">
                          {(t.items || []).map((it: any, i: number) => {
                            const note = it.notes || it.specialInstructions;
                            return (
                              <li key={i} className="text-sm">
                                <div className="flex items-start gap-2">
                                  <span className="min-w-8 h-8 px-1 rounded-md bg-ui-primary-soft text-ui-primary-text font-bold font-mono flex items-center justify-center shrink-0">
                                    {it.qty || it.quantity || 1}×
                                  </span>
                                  <span className="font-bold leading-snug pt-1">{it.name || it.itemName}</span>
                                </div>
                                {it.modifiers?.length > 0 && (
                                  <div className="pl-10 text-[0.8125rem] text-ui-text-2">{it.modifiers.map((mm: any) => mm.name || mm.optionName).join(" · ")}</div>
                                )}
                                {note && (
                                  <div className="ml-10 mt-1 px-2 py-1 rounded-md bg-ui-danger-soft text-ui-danger text-[0.8125rem] font-semibold inline-flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {note}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                          {t.orderNotes && (
                            <li className="px-2.5 py-2 rounded-md bg-ui-subtle text-[0.8125rem] text-ui-text-2">
                              <span className="block text-[0.6875rem] font-bold text-ui-muted">ORDER NOTE</span>
                              {t.orderNotes}
                            </li>
                          )}
                        </ul>
                        {col.next && (
                          <div className="p-3 pt-0 mt-auto">
                            <button
                              type="button"
                              onClick={() => p.onStatus(t.id, col.next!.to)}
                              className={`w-full h-12 rounded-lg text-sm font-bold transition active:scale-[0.99] ${
                                col.next.to === "completed"
                                  ? "border border-ui-border-strong text-ui-text hover:bg-ui-subtle"
                                  : "bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary"
                              }`}
                            >
                              {col.next.label}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
