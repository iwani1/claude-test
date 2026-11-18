"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

/**
 * The till's left-hand panel (redesign stage 1, Nov 2026): the branch's
 * recent orders with their state, so a cashier sees "Table 7 asked for the
 * bill 41 minutes ago" without leaving the till. Tapping an open order puts
 * it on the bill panel through the same path Tables and Order History use.
 *
 * Read-only. It never changes an order itself; opening one goes through the
 * till's existing attach logic, which refuses while another ticket is on the
 * panel.
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

type Filter = "open" | "paid" | "all";

const POLL_MS = 30_000;

/** An order is open while money is still owed and it was not called off.
 *  Same rule the till uses before it will reopen an order. */
export const isOpenOrder = (o: Pick<OrderRow, "status" | "paymentStatus">) =>
  ["unpaid", "partially_paid"].includes(o.paymentStatus) && !["cancelled", "refunded"].includes(o.status);

const TYPE_LABEL: Record<string, string> = {
  dine_in: "Table",
  room_service: "Room service",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

function statusBadge(o: OrderRow): { label: string; className: string } {
  if (o.status === "cancelled") return { label: "Cancelled", className: "bg-neutral-800 text-neutral-400" };
  if (o.status === "refunded" || o.paymentStatus === "refunded") return { label: "Refunded", className: "bg-neutral-800 text-neutral-400" };
  if (o.paymentStatus === "paid") return { label: "Paid", className: "bg-neutral-800 text-neutral-300" };
  if (o.paymentStatus === "partially_paid") return { label: "Part paid", className: "bg-amber-500/15 text-amber-300" };
  if (o.status === "ready") return { label: "Ready", className: "bg-emerald-500/15 text-emerald-300" };
  if (o.status === "served") return { label: "Served", className: "bg-sky-500/15 text-sky-300" };
  if (o.status === "preparing") return { label: "Preparing", className: "bg-neutral-700 text-neutral-100" };
  return { label: "In kitchen", className: "bg-neutral-700 text-neutral-100" };
}

function elapsed(createdAt: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}

export function OpenOrdersPanel({
  tables,
  refreshKey,
  activeOrderId,
  onOpenOrder,
  onNewOrder,
}: {
  tables: any[];
  /** Bumped by the till after it creates, sends or settles an order. */
  refreshKey: number;
  /** The order currently on the bill panel, highlighted in the list. */
  activeOrderId: number | null;
  onOpenOrder: (orderId: number) => void;
  onNewOrder: () => void;
}) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [now, setNow] = useState(() => Date.now());

  // State is only set in the promise callbacks, after the answer arrives.
  const load = useCallback(
    () =>
      apiFetch("/api/orders?limit=40")
        .then((data) => {
          setOrders(Array.isArray(data?.orders) ? data.orders : []);
          setFailed(false);
          setNow(Date.now());
        })
        .catch(() => {
          // audit-ok: shown in the panel ("Orders could not be loaded"); the
          // till itself keeps working, offline included.
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

  const label = (o: OrderRow) => {
    if (o.orderType === "dine_in" && o.tableId != null) {
      const n = tableName.get(o.tableId);
      return n ? (/^\d+$/.test(n) ? `Table ${n}` : n) : "Table";
    }
    if (o.orderType === "room_service" && o.roomNumber) return `Room ${o.roomNumber}`;
    return o.customerName || "Walk-in Guest";
  };

  const rows = (orders ?? []).filter((o) =>
    filter === "all" ? true : filter === "open" ? isOpenOrder(o) : o.paymentStatus === "paid",
  );
  const openCount = (orders ?? []).filter(isOpenOrder).length;

  return (
    <section aria-label="Recent orders" className="h-full w-60 shrink-0 flex flex-col bg-neutral-900 border-r border-neutral-800">
      <div className="p-3 space-y-2.5 border-b border-neutral-800">
        <button
          type="button"
          onClick={onNewOrder}
          className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black text-sm font-extrabold flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" strokeWidth={2.6} />
          New order
        </button>
        <div role="tablist" aria-label="Show orders" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-neutral-950 border border-neutral-800">
          {([
            ["open", `Open${orders ? ` ${openCount}` : ""}`],
            ["paid", "Paid"],
            ["all", "All"],
          ] as const).map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`h-9 rounded-lg text-xs font-bold transition ${
                filter === key ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {orders === null && !failed && <p className="p-3 text-xs text-neutral-500">Loading orders…</p>}
        {failed && (
          <div className="p-3 text-xs text-neutral-400 space-y-2">
            <p>Orders could not be loaded. The till still works; this list will try again.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="h-9 px-3 rounded-lg border border-neutral-700 text-neutral-200 font-bold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}
        {orders !== null && rows.length === 0 && !failed && (
          <p className="p-3 text-xs text-neutral-500">
            {filter === "open" ? "No open orders." : filter === "paid" ? "No paid orders in the latest 40." : "No orders yet."}
          </p>
        )}
        {rows.map((o) => {
          const badge = statusBadge(o);
          const open = isOpenOrder(o);
          const active = o.id === activeOrderId;
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-neutral-50 truncate">{label(o)}</span>
                <span className="text-[0.6875rem] text-neutral-400 shrink-0">{elapsed(o.createdAt, now)}</span>
              </div>
              <div className="text-[0.6875rem] text-neutral-400 mt-0.5 truncate">
                {o.orderNumber} · {TYPE_LABEL[o.orderType] ?? o.orderType}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-md ${badge.className}`}>{badge.label}</span>
                <span className="text-[0.8125rem] font-bold font-mono text-neutral-100">
                  GH₵{Number(o.totalAmount).toFixed(2)}
                </span>
              </div>
            </>
          );
          const cls = `w-full text-left rounded-xl px-3 py-2.5 border transition ${
            active ? "border-amber-500 bg-amber-500/10" : "border-neutral-800 bg-neutral-850"
          }`;
          // Only open orders can go back on the bill panel; settled ones are
          // listed for reference (receipts live in Order History).
          return open ? (
            <button
              key={o.id}
              type="button"
              onClick={() => onOpenOrder(o.id)}
              aria-label={`Open ${label(o)}, order ${o.orderNumber}, ${badge.label}`}
              className={`${cls} hover:border-neutral-600 active:scale-[0.99]`}
            >
              {body}
            </button>
          ) : (
            <div key={o.id} className={`${cls} opacity-80`}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
