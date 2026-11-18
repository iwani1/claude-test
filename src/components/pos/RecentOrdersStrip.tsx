"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Clock, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

/**
 * Recent orders across the top of the new POS screen (redesign stage 2): the
 * branch's open orders as cards, filterable by order type, paged four at a
 * time. Read-only: tapping a card hands its id to the till, which reopens it
 * through the same attach path Tables and Order History use (and refuses
 * while another ticket is on the panel).
 */

type OrderRow = {
  id: number;
  orderNumber: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  tableId: number | null;
  roomNumber: string | null;
  customerName: string | null;
  createdAt: string;
};

const POLL_MS = 30_000;
const PER_PAGE = 4;

/** Open = money still owed and not called off: the till's own reopen rule. */
const isOpen = (o: OrderRow) =>
  ["unpaid", "partially_paid"].includes(o.paymentStatus) && !["cancelled", "refunded"].includes(o.status);

const TYPES = [
  ["all", "All orders"],
  ["dine_in", "Dine in"],
  ["takeaway", "Takeaway"],
  ["delivery", "Delivery"],
  ["room_service", "Room"],
] as const;
type TypeFilter = (typeof TYPES)[number][0];

/** Order numbers are long unique codes; staff know an order by the short
 *  number its kitchen docket prints (create-order.ts: `K-` + last 4). */
export const docketNo = (orderNumber: string) => `K-${orderNumber.slice(-4)}`;

const TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine in",
  takeaway: "Takeaway",
  delivery: "Delivery",
  room_service: "Room service",
};

function stateOf(o: OrderRow): { label: string; className: string } {
  if (o.paymentStatus === "partially_paid") return { label: "Part paid", className: "bg-ui-primary-soft text-ui-primary-text" };
  if (o.status === "ready") return { label: "Ready", className: "bg-ui-success-soft text-ui-success" };
  if (o.status === "served") return { label: "Served", className: "bg-ui-info-soft text-ui-info" };
  return { label: "In kitchen", className: "bg-ui-subtle text-ui-text-2" };
}

/** Minutes since the order was rung, coloured as it ages (no target times
 *  exist in the data, so this shows age, not a countdown). */
function age(createdAt: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000));
  const tone = mins >= 40 ? "danger" : mins >= 20 ? "warn" : "ok";
  return { mins, tone, pct: Math.min(100, Math.round((mins / 45) * 100)) };
}

export function RecentOrdersStrip({
  tables,
  refreshKey,
  activeOrderId,
  onOpenOrder,
}: {
  tables: any[];
  refreshKey: number;
  activeOrderId: number | null;
  onOpenOrder: (orderId: number) => void;
}) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState<TypeFilter>("all");
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // State is set only in the promise callbacks, after the answer arrives.
  const load = useCallback(
    () =>
      apiFetch("/api/orders?limit=60")
        .then((data) => {
          setOrders(Array.isArray(data?.orders) ? data.orders : []);
          setFailed(false);
          setNow(Date.now());
        })
        .catch(() => {
          // audit-ok: shown on the strip ("could not be loaded"); the till keeps working.
          setFailed(true);
          setNow(Date.now());
        }),
    [],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, refreshKey]);

  const tableName = useMemo(() => new Map(tables.map((t: any) => [t.id, String(t.tableNumber)])), [tables]);
  const place = (o: OrderRow) => {
    if (o.orderType === "dine_in" && o.tableId != null) {
      const n = tableName.get(o.tableId);
      return n ? (/^\d+$/.test(n) ? `Table ${n}` : n) : "Table";
    }
    if (o.orderType === "room_service" && o.roomNumber) return `Room ${o.roomNumber}`;
    return TYPE_LABEL[o.orderType] ?? o.orderType;
  };

  const open = (orders ?? []).filter(isOpen);
  const shown = open.filter((o) => type === "all" || o.orderType === type);
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const cards = shown.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);
  const countFor = (t: TypeFilter) => (t === "all" ? open.length : open.filter((o) => o.orderType === t).length);

  return (
    <section aria-label="Recent open orders" className="pb-4 mb-4 border-b border-ui-border">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-bold text-ui-text">Recent orders</h2>
        <div role="tablist" aria-label="Order type" className="flex items-center gap-1.5 flex-wrap flex-1">
          {TYPES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={type === key}
              onClick={() => {
                setType(key);
                setPage(0);
              }}
              className={`h-10 px-3.5 rounded-full text-[0.8125rem] font-semibold border transition ${
                type === key
                  ? "bg-ui-primary border-ui-primary text-ui-on-primary"
                  : "bg-ui-surface border-ui-border text-ui-text-2 hover:bg-ui-subtle"
              }`}
            >
              {label} {orders ? <span className="opacity-80">({countFor(key)})</span> : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((current - 1 + pages) % pages)}
            disabled={pages < 2}
            aria-label="Earlier orders"
            className="w-10 h-10 rounded-full border border-ui-border bg-ui-surface text-ui-text-2 flex items-center justify-center disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage((current + 1) % pages)}
            disabled={pages < 2}
            aria-label="Later orders"
            className="w-10 h-10 rounded-full border border-ui-border bg-ui-surface text-ui-text-2 flex items-center justify-center disabled:opacity-40"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {failed && (
        <div className="flex items-center gap-3 text-[0.8125rem] text-ui-muted">
          Open orders could not be loaded. The till still works.
          <button type="button" onClick={() => void load()} className="h-9 px-3 rounded-lg border border-ui-border text-ui-text font-semibold inline-flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}
      {!failed && orders === null && <p className="text-[0.8125rem] text-ui-muted">Loading open orders…</p>}
      {!failed && orders !== null && cards.length === 0 && (
        <p className="text-[0.8125rem] text-ui-muted">No open {type === "all" ? "" : `${TYPES.find((t) => t[0] === type)?.[1].toLowerCase()} `}orders.</p>
      )}

      {cards.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
          {cards.map((o) => {
            const a = age(o.createdAt, now);
            const s = stateOf(o);
            const active = o.id === activeOrderId;
            const time = new Date(o.createdAt).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onOpenOrder(o.id)}
                aria-label={`Open ${place(o)}, docket ${docketNo(o.orderNumber)}, ${s.label}, ${a.mins} minutes`}
                title={o.orderNumber}
                className={`text-left rounded-xl p-3 bg-ui-surface border transition hover:border-ui-border-strong ${
                  active ? "border-ui-primary ring-2 ring-ui-primary/25" : "border-ui-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-ui-muted font-mono">{docketNo(o.orderNumber)}</div>
                    <div className="text-sm font-bold text-ui-text truncate">{place(o)}</div>
                    <div className="text-xs text-ui-muted truncate">
                      {time} · {o.customerName || "Walk-in Guest"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-ui-text-2">{TYPE_LABEL[o.orderType] ?? o.orderType}</div>
                    <span className={`inline-block mt-1 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full ${s.className}`}>{s.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex-1 h-1.5 rounded-full bg-ui-subtle overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${a.tone === "danger" ? "bg-ui-danger" : a.tone === "warn" ? "bg-ui-primary" : "bg-ui-success"}`}
                      style={{ width: `${Math.max(6, a.pct)}%` }}
                    />
                  </div>
                  <span className={`text-[0.6875rem] font-semibold inline-flex items-center gap-1 ${a.tone === "danger" ? "text-ui-danger" : "text-ui-muted"}`}>
                    <Clock className="w-3 h-3" /> {a.mins} min
                  </span>
                  <span className="text-[0.75rem] font-bold font-mono text-ui-text">GH₵{Number(o.totalAmount).toFixed(2)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
