"use client";

import React, { useEffect, useState } from "react";
import { ArrowRightLeft, CalendarClock, CheckCircle2, Clock, Plus, Sparkles, Users, Utensils } from "lucide-react";

/**
 * The dining room in the new design (redesign stage 4b, Nov 2026): area tabs,
 * status counts that filter, and one tile per table coloured by its state,
 * with the open bill on occupied tables.
 *
 * Presentation only. TableFloorPlan keeps the status changes, moves and new
 * tables (POST /api/tables); each button here calls one of them. Every state
 * offers only the change that makes sense for it:
 *   available → Reserve · reserved → Free up · cleaning → Ready for guests ·
 *   occupied → Move bill, Needs cleaning.
 */

type Status = "available" | "occupied" | "reserved" | "cleaning";

const LOOK: Record<Status, { label: string; tile: string; chip: string; dot: string }> = {
  available: { label: "Available", tile: "border-ui-success bg-ui-surface", chip: "bg-ui-success-soft text-ui-success", dot: "bg-ui-success" },
  occupied: { label: "Occupied", tile: "border-ui-primary bg-ui-primary-soft", chip: "bg-ui-primary text-ui-on-primary", dot: "bg-ui-primary" },
  reserved: { label: "Reserved", tile: "border-ui-info bg-ui-info-soft", chip: "bg-ui-info-soft text-ui-info", dot: "bg-ui-info" },
  cleaning: {
    label: "Cleaning",
    tile: "border-ui-border-strong border-dashed bg-ui-subtle",
    chip: "bg-ui-subtle text-ui-text-2",
    dot: "bg-ui-muted",
  },
};

const docketNo = (orderNumber: string) => `K-${String(orderNumber).slice(-4)}`;
const tableLabel = (n: unknown) => (/^\d+$/.test(String(n)) ? `Table ${n}` : String(n));

export function TablesBoard(p: {
  areas: any[];
  tables: any[];
  onOpen: (tableId: number) => void;
  onStatus: (tableId: number, status: Status) => void;
  onMove: (table: any) => void;
  onAdd: () => void;
}) {
  const [area, setArea] = useState<number | "all">("all");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const inArea = p.tables.filter((t) => area === "all" || t.areaId === area);
  const shown = inArea.filter((t) => filter === "all" || t.status === filter);
  const count = (s: Status) => inArea.filter((t) => t.status === s).length;
  const seatsFree = inArea.filter((t) => t.status === "available").reduce((n, t) => n + Number(t.capacity || 0), 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-ui-bg text-ui-text">
      <div className="shrink-0 px-5 pt-5 pb-3 flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Tables</h1>
        <span className="text-[0.8125rem] text-ui-muted">{seatsFree} seats free</span>
        <div className="flex-1" />
        <div role="group" aria-label="Show tables" className="flex items-center gap-1.5 flex-wrap">
          {(["all", "available", "occupied", "reserved", "cleaning"] as const).map((s) => {
            const on = filter === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(s)}
                className={`h-10 px-3.5 rounded-full border text-[0.8125rem] font-semibold inline-flex items-center gap-2 transition ${
                  on ? "border-ui-primary bg-ui-primary text-ui-on-primary" : "border-ui-border bg-ui-surface text-ui-text-2 hover:bg-ui-subtle"
                }`}
              >
                {s !== "all" && <span className={`w-2 h-2 rounded-full ${on ? "bg-ui-on-primary" : LOOK[s].dot}`} />}
                {s === "all" ? `All (${inArea.length})` : `${LOOK[s].label} (${count(s)})`}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={p.onAdd}
          className="h-11 px-4 rounded-lg border border-ui-border-strong bg-ui-surface text-ui-text text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-ui-subtle"
        >
          <Plus className="w-4 h-4" /> Add table
        </button>
      </div>

      {p.areas.length > 0 && (
        <div className="shrink-0 px-5 pb-3">
          <div role="tablist" aria-label="Dining area" className="inline-flex gap-1 p-1 rounded-lg border border-ui-border bg-ui-surface flex-wrap">
            {[{ id: "all" as const, name: "All areas" }, ...p.areas].map((a) => (
              <button
                key={String(a.id)}
                type="button"
                role="tab"
                aria-selected={area === a.id}
                onClick={() => setArea(a.id)}
                className={`h-10 px-3.5 rounded-md text-[0.8125rem] font-semibold transition ${
                  area === a.id ? "bg-ui-primary text-ui-on-primary" : "text-ui-text-2 hover:bg-ui-subtle"
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 custom-scrollbar">
        {shown.length === 0 ? (
          <p className="text-sm text-ui-muted py-16 text-center">{p.tables.length === 0 ? "No tables yet. Add one to start." : "No tables in this view."}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
            {shown.map((t) => {
              const s = (LOOK[t.status as Status] ? t.status : "available") as Status;
              const look = LOOK[s];
              const order = t.activeOrder;
              const mins = order?.createdAt ? Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000)) : null;
              const ageText = mins == null ? "" : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
              return (
                <article
                  key={t.id}
                  aria-label={`${tableLabel(t.tableNumber)}, ${look.label}${order ? `, bill ${docketNo(order.orderNumber)}` : ""}`}
                  className={`rounded-xl border-2 p-3.5 flex flex-col gap-3 ${look.tile}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-lg font-bold leading-tight truncate">{tableLabel(t.tableNumber)}</div>
                      <div className="text-[0.8125rem] text-ui-text-2 inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {t.capacity} seats
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${look.chip}`}>{look.label}</span>
                  </div>

                  {s === "occupied" && order ? (
                    <div className="rounded-lg bg-ui-surface border border-ui-border px-3 py-2 text-[0.8125rem] space-y-0.5">
                      <div className="font-semibold truncate">{order.customerName || "Dine-in guest"}</div>
                      <div className="flex justify-between text-ui-text-2">
                        <span className="font-mono" title={order.orderNumber}>
                          {docketNo(order.orderNumber)}
                        </span>
                        <span className="font-mono font-bold text-ui-text">GH₵{Number(order.totalAmount).toFixed(2)}</span>
                      </div>
                      {ageText && (
                        <div className="text-ui-muted inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> open {ageText}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[0.8125rem] text-ui-muted min-h-[2.75rem] flex items-center">
                      {s === "available" ? "Ready for guests" : s === "reserved" ? "Held for a booking" : s === "cleaning" ? "Being cleared" : "No open bill found"}
                    </div>
                  )}

                  <div className="mt-auto space-y-2">
                    <button
                      type="button"
                      onClick={() => p.onOpen(t.id)}
                      className="w-full h-11 rounded-lg bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-sm font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      <Utensils className="w-4 h-4" /> {s === "occupied" ? "View / add to bill" : "Open table"}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      {s === "occupied" && (
                        <>
                          <button type="button" onClick={() => p.onMove(t)} className="h-11 rounded-lg border border-ui-border-strong bg-ui-surface text-[0.8125rem] font-semibold inline-flex items-center justify-center gap-1.5">
                            <ArrowRightLeft className="w-4 h-4" /> Move bill
                          </button>
                          <button type="button" onClick={() => p.onStatus(t.id, "cleaning")} className="h-11 rounded-lg border border-ui-border-strong bg-ui-surface text-[0.8125rem] font-semibold inline-flex items-center justify-center gap-1.5">
                            <Sparkles className="w-4 h-4" /> Needs cleaning
                          </button>
                        </>
                      )}
                      {s === "available" && (
                        <button type="button" onClick={() => p.onStatus(t.id, "reserved")} className="col-span-2 h-11 rounded-lg border border-ui-border-strong bg-ui-surface text-[0.8125rem] font-semibold inline-flex items-center justify-center gap-1.5">
                          <CalendarClock className="w-4 h-4" /> Reserve
                        </button>
                      )}
                      {s === "reserved" && (
                        <button type="button" onClick={() => p.onStatus(t.id, "available")} className="col-span-2 h-11 rounded-lg border border-ui-border-strong bg-ui-surface text-[0.8125rem] font-semibold">
                          Free up (no longer reserved)
                        </button>
                      )}
                      {s === "cleaning" && (
                        <button type="button" onClick={() => p.onStatus(t.id, "available")} className="col-span-2 h-11 rounded-lg border border-ui-success bg-ui-success-soft text-ui-success text-[0.8125rem] font-bold inline-flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Ready for guests
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
