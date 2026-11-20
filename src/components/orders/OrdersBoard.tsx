"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bike,
  CalendarDays,
  ChefHat,
  Clock,
  Columns3,
  Eye,
  Hotel,
  LayoutGrid,
  MoreVertical,
  Pencil,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react";

/**
 * Order history in the new design (redesign stage 3, Nov 2026), after the
 * owner-approved demo 9: count cards, tabs with counts, order cards or a board
 * by kitchen state, a date range, search and pages.
 *
 * Presentation only. OrdersHistory keeps the data, the polling and every
 * action; each button here is one of its handlers, offered under the same
 * permission checks. Nothing here changes an order's kitchen status: that
 * stays on the Kitchen screen.
 */

export type BoardActions = {
  onView: (o: any) => void;
  onDocket: (o: any) => void;
  onReceipt: (o: any) => void;
  /** Present only when this person may reopen orders on the till. */
  onOpenInPos?: (o: any) => void;
  /** Present only for refund roles. */
  onRefund?: (o: any) => void;
  onEdit?: (o: any) => void;
  onDelete?: (o: any) => void;
};

const PER_PAGE = 9;

const isOpenBill = (o: any) =>
  ["unpaid", "partially_paid"].includes(o.paymentStatus) && !["cancelled", "refunded"].includes(o.status);
const inKitchen = (o: any) => ["draft", "confirmed", "preparing"].includes(o.status);

const TABS: { id: string; label: string; test: (o: any) => boolean }[] = [
  { id: "all", label: "All orders", test: () => true },
  { id: "open", label: "Open bills", test: isOpenBill },
  { id: "kitchen", label: "In kitchen", test: inKitchen },
  { id: "ready", label: "Ready", test: (o) => o.status === "ready" },
  { id: "completed", label: "Completed", test: (o) => o.status === "completed" },
  { id: "closed", label: "Refunds / cancelled", test: (o) => o.status === "refunded" || o.status === "cancelled" || o.paymentStatus === "refunded" || o.paymentStatus === "partially_refunded" },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "In kitchen", cls: "bg-ui-primary-soft text-ui-primary-text" },
  confirmed: { label: "In kitchen", cls: "bg-ui-primary-soft text-ui-primary-text" },
  preparing: { label: "In kitchen", cls: "bg-ui-primary-soft text-ui-primary-text" },
  ready: { label: "Ready", cls: "bg-ui-success-soft text-ui-success" },
  served: { label: "Served", cls: "bg-ui-info-soft text-ui-info" },
  completed: { label: "Completed", cls: "bg-ui-subtle text-ui-text-2" },
  cancelled: { label: "Cancelled", cls: "bg-ui-danger-soft text-ui-danger" },
  refunded: { label: "Refunded", cls: "bg-ui-danger-soft text-ui-danger" },
};
const PAY: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "Unpaid", cls: "bg-ui-danger-soft text-ui-danger" },
  partially_paid: { label: "Part paid", cls: "bg-ui-primary-soft text-ui-primary-text" },
  paid: { label: "Paid", cls: "bg-ui-success-soft text-ui-success" },
  partially_refunded: { label: "Part refunded", cls: "bg-ui-primary-soft text-ui-primary-text" },
  refunded: { label: "Refunded", cls: "bg-ui-subtle text-ui-text-2" },
};
const TYPE: Record<string, { label: string; icon: typeof UtensilsCrossed; cls: string }> = {
  dine_in: { label: "Dine in", icon: UtensilsCrossed, cls: "bg-ui-primary-soft text-ui-primary-text" },
  takeaway: { label: "Takeaway", icon: ShoppingBag, cls: "bg-ui-success-soft text-ui-success" },
  delivery: { label: "Delivery", icon: Bike, cls: "bg-ui-subtle text-ui-text-2" },
  room_service: { label: "Room service", icon: Hotel, cls: "bg-ui-info-soft text-ui-info" },
};

/** Staff know an order by its docket number (create-order.ts: K- + last 4). */
const docketNo = (orderNumber: string) => `K-${String(orderNumber).slice(-4)}`;
const cedi = (v: unknown) => `GH₵${Number(v || 0).toFixed(2)}`;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function RangePicker({ from, to, onRange }: { from: string; to: string; onRange: (from: string, to: string) => void }) {
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const week = new Date(today);
  week.setDate(today.getDate() - 6);
  const presets: [string, string, string][] = [
    ["Today", isoDay(today), isoDay(today)],
    ["Yesterday", isoDay(yest), isoDay(yest)],
    ["Last 7 days", isoDay(week), isoDay(today)],
    ["All dates", "", ""],
  ];
  const custom = !presets.some(([, f, t]) => f === from && t === to);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div role="group" aria-label="Date range" className="flex gap-1 p-1 rounded-lg border border-ui-border bg-ui-surface">
        {presets.map(([label, f, t]) => {
          const on = f === from && t === to;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => onRange(f, t)}
              className={`h-10 px-3 rounded-md text-[0.8125rem] font-semibold transition ${on ? "bg-ui-primary text-ui-on-primary" : "text-ui-text-2 hover:bg-ui-subtle"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <label className={`h-12 flex items-center gap-1.5 px-2 rounded-lg border bg-ui-surface ${custom ? "border-ui-primary" : "border-ui-border"}`}>
        <CalendarDays className="w-4 h-4 text-ui-muted shrink-0" />
        <span className="sr-only">From</span>
        <input type="date" value={from} onChange={(e) => onRange(e.target.value, to)} className="h-10 bg-transparent text-[0.8125rem] text-ui-text outline-none" />
        <span className="text-ui-muted text-xs">to</span>
        <span className="sr-only">To</span>
        <input type="date" value={to} onChange={(e) => onRange(from, e.target.value)} className="h-10 bg-transparent text-[0.8125rem] text-ui-text outline-none" />
      </label>
    </div>
  );
}

function ActionsMenu({ order, actions, canWorkTill }: { order: any; actions: BoardActions; canWorkTill: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: { label: string; icon: typeof Eye; run: () => void; danger?: boolean }[] = [
    { label: "Order details", icon: Eye, run: () => actions.onView(order) },
  ];
  if (canWorkTill && actions.onOpenInPos && isOpenBill(order)) items.push({ label: "Open on the till (add items or pay)", icon: Wallet, run: () => actions.onOpenInPos!(order) });
  items.push({ label: order.paymentStatus === "paid" ? "Print receipt" : "Print bill", icon: Printer, run: () => actions.onReceipt(order) });
  items.push({ label: "Reprint kitchen docket", icon: ChefHat, run: () => actions.onDocket(order) });
  if (actions.onRefund && Number(order.paidAmount) > 0 && order.paymentStatus !== "refunded") items.push({ label: "Refund…", icon: RotateCcw, run: () => actions.onRefund!(order) });
  if (actions.onEdit) items.push({ label: "Edit order…", icon: Pencil, run: () => actions.onEdit!(order) });
  if (actions.onDelete) items.push({ label: "Delete permanently…", icon: Trash2, run: () => actions.onDelete!(order), danger: true });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for order ${docketNo(order.orderNumber)}`}
        className="w-11 h-11 rounded-full border border-ui-border text-ui-text-2 hover:bg-ui-subtle flex items-center justify-center"
      >
        <MoreVertical className="w-[1.125rem] h-[1.125rem]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 z-20 w-64 rounded-xl border border-ui-border bg-ui-surface shadow-xl p-1.5">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  it.run();
                }}
                className={`w-full min-h-11 px-3 rounded-lg flex items-center gap-2.5 text-left text-sm font-semibold hover:bg-ui-subtle ${it.danger ? "text-ui-danger" : "text-ui-text"}`}
              >
                <Icon className="w-4 h-4 shrink-0" /> {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OrdersBoard(p: {
  orders: any[];
  total: number;
  loading: boolean;
  loadError: string;
  from: string;
  to: string;
  onRange: (from: string, to: string) => void;
  search: string;
  onSearch: (v: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  tables: any[];
  canWorkTill: boolean;
  actions: BoardActions;
  notice?: { text: string; tone: "ok" | "danger"; onClose: () => void } | null;
  readOnlyNote?: string;
}) {
  const [tab, setTab] = useState("all");
  const [view, setView] = useState<"cards" | "board">("cards");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const tableName = useMemo(() => new Map(p.tables.map((t: any) => [t.id, String(t.tableNumber)])), [p.tables]);
  const place = (o: any) => {
    if (o.orderType === "dine_in") {
      const n = o.tableId != null ? tableName.get(o.tableId) : undefined;
      return n ? (/^\d+$/.test(n) ? `Table ${n}` : n) : "No table";
    }
    if (o.orderType === "room_service") return o.roomNumber ? `Room ${o.roomNumber}` : "Room";
    return o.customerName || "Walk-in Guest";
  };

  const q = p.search.trim().toLowerCase();
  const matching = p.orders.filter(
    (o) =>
      !q ||
      String(o.orderNumber).toLowerCase().includes(q) ||
      docketNo(o.orderNumber).toLowerCase().includes(q) ||
      (o.customerName || "").toLowerCase().includes(q) ||
      place(o).toLowerCase().includes(q),
  );
  const tabTest = TABS.find((t) => t.id === tab)?.test ?? (() => true);
  const shown = matching.filter(tabTest);
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const pageRows = shown.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  const stats: { label: string; tab: string; count: number; icon: typeof Clock; cls: string }[] = [
    { label: "In kitchen", tab: "kitchen", count: p.orders.filter(inKitchen).length, icon: ChefHat, cls: "bg-ui-primary-soft text-ui-primary-text" },
    { label: "Ready", tab: "ready", count: p.orders.filter((o) => o.status === "ready").length, icon: BadgeCheck, cls: "bg-ui-success-soft text-ui-success" },
    { label: "Open bills", tab: "open", count: p.orders.filter(isOpenBill).length, icon: Wallet, cls: "bg-ui-danger-soft text-ui-danger" },
    {
      label: "Open bill value",
      tab: "open",
      count: -1,
      icon: Receipt,
      cls: "bg-ui-info-soft text-ui-info",
    },
    { label: "Completed", tab: "completed", count: p.orders.filter((o) => o.status === "completed").length, icon: BadgeCheck, cls: "bg-ui-subtle text-ui-text-2" },
    { label: "Refunds / cancelled", tab: "closed", count: p.orders.filter(TABS[5].test).length, icon: XCircle, cls: "bg-ui-danger-soft text-ui-danger" },
  ];
  const openValue = p.orders
    .filter(isOpenBill)
    .reduce((s, o) => s + Math.max(0, Number(o.totalAmount || 0) - Number(o.paidAmount || 0)), 0);

  const ageOf = (o: any) => {
    const mins = Math.max(0, Math.floor((now - new Date(o.createdAt).getTime()) / 60_000));
    return mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${Math.floor(mins / 1440)} d`;
  };

  const card = (o: any, compact = false) => {
    const t = TYPE[o.orderType] ?? TYPE.takeaway;
    const TIcon = t.icon;
    const s = STATUS[o.status] ?? { label: o.status, cls: "bg-ui-subtle text-ui-text-2" };
    const pay = PAY[o.paymentStatus] ?? { label: o.paymentStatus, cls: "bg-ui-subtle text-ui-text-2" };
    const items: any[] = o.items || [];
    const showAll = !!expanded[o.id];
    const visible = compact ? [] : showAll ? items : items.slice(0, 3);
    const time = new Date(o.createdAt).toLocaleString("en-GH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    return (
      <article key={o.id} className="rounded-xl border border-ui-border bg-ui-surface p-3.5 flex flex-col gap-3" aria-label={`Order ${docketNo(o.orderNumber)}`}>
        <div className="flex items-center gap-3">
          <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${t.cls}`}>
            <TIcon className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => p.actions.onView(o)} title={o.orderNumber} className="text-[0.9375rem] font-bold font-mono text-ui-text hover:underline">
              {docketNo(o.orderNumber)}
            </button>
            <div className="text-[0.8125rem] text-ui-muted truncate">
              {t.label} · {place(o)}
            </div>
          </div>
          <ActionsMenu order={o} actions={p.actions} canWorkTill={p.canWorkTill} />
        </div>
        <div className="flex items-center justify-between text-[0.8125rem]">
          <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${s.cls}`} title="Set on the Kitchen screen">
            {s.label}
          </span>
          <span className="text-ui-text-2 inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {time} · {ageOf(o)}
          </span>
        </div>
        {!compact && (
          <div className="border-t border-ui-border pt-2.5 space-y-1">
            {visible.map((it, i) => (
              <div key={it.id ?? i} className="text-[0.8125rem]">
                <div className="flex justify-between gap-2">
                  <span className="text-ui-text truncate">{it.itemName}</span>
                  <span className="font-semibold text-ui-text shrink-0">× {it.quantity}</span>
                </div>
                {it.specialInstructions && <div className="text-xs text-ui-primary-text">Note: {it.specialInstructions}</div>}
              </div>
            ))}
            {items.length === 0 && <div className="text-[0.8125rem] text-ui-muted">No items</div>}
            {o.notes && <div className="mt-1.5 px-2 py-1 rounded-md bg-ui-primary-soft text-ui-primary-text text-xs font-semibold">Order note: {o.notes}</div>}
            {items.length > 3 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [o.id]: !showAll }))}
                className="h-9 text-[0.8125rem] font-bold text-ui-primary-text"
              >
                {showAll ? "Show fewer" : `+${items.length - 3} more item${items.length - 3 === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-auto">
          <span className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pay.cls}`}>{pay.label}</span>
            <span className="text-[0.9375rem] font-bold font-mono text-ui-text">{cedi(o.totalAmount)}</span>
          </span>
          {p.canWorkTill && p.actions.onOpenInPos && isOpenBill(o) ? (
            <button
              type="button"
              onClick={() => p.actions.onOpenInPos!(o)}
              className="h-11 px-3.5 rounded-lg bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-[0.8125rem] font-bold shrink-0"
            >
              Open on till
            </button>
          ) : (
            <button
              type="button"
              onClick={() => p.actions.onReceipt(o)}
              className="h-11 px-3.5 rounded-lg border border-ui-border-strong text-ui-text text-[0.8125rem] font-semibold shrink-0 inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> {o.paymentStatus === "paid" ? "Receipt" : "Bill"}
            </button>
          )}
        </div>
        {o.userName && !compact && <div className="text-xs text-ui-muted -mt-1">Rung by {o.userName}</div>}
      </article>
    );
  };

  const columns: { label: string; test: (o: any) => boolean; dot: string }[] = [
    { label: "In kitchen", test: inKitchen, dot: "bg-ui-primary" },
    { label: "Ready", test: (o) => o.status === "ready", dot: "bg-ui-success" },
    { label: "Served", test: (o) => o.status === "served", dot: "bg-ui-info" },
    { label: "Completed", test: (o) => o.status === "completed", dot: "bg-ui-muted" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-ui-bg text-ui-text">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 custom-scrollbar">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">Orders</h1>
          <button
            type="button"
            onClick={p.onRefresh}
            aria-label="Refresh orders"
            className="w-11 h-11 rounded-full border border-ui-border bg-ui-surface text-ui-text-2 flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${p.loading ? "animate-spin" : ""}`} />
          </button>
          <span className="text-xs text-ui-muted">Refreshes every 30 seconds</span>
          <div className="flex-1" />
          <RangePicker
            from={p.from}
            to={p.to}
            onRange={(f, t) => {
              setPage(0);
              p.onRange(f, t);
            }}
          />
        </div>
        {p.readOnlyNote && <p className="text-[0.8125rem] text-ui-muted mt-1">{p.readOnlyNote}</p>}

        {p.notice && (
          <div role="status" className={`mt-3 rounded-lg px-3 py-2.5 text-sm font-semibold flex items-center gap-3 ${p.notice.tone === "ok" ? "bg-ui-success-soft text-ui-success" : "bg-ui-danger-soft text-ui-danger"}`}>
            <span className="flex-1">{p.notice.text}</span>
            <button type="button" onClick={p.notice.onClose} className="h-9 px-3 rounded-md border border-current text-xs font-bold">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2.5 mt-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setTab(s.tab);
                  setPage(0);
                }}
                className="h-20 rounded-xl border border-ui-border bg-ui-surface px-3.5 flex items-center justify-between gap-2 text-left hover:border-ui-border-strong"
              >
                <span className="min-w-0">
                  <span className="block text-[0.8125rem] font-semibold text-ui-muted truncate">{s.label}</span>
                  <span className="block text-xl font-bold font-mono">{s.count === -1 ? cedi(openValue) : s.count}</span>
                </span>
                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${s.cls}`}>
                  <Icon className="w-5 h-5" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-4 mb-3">
          <div role="tablist" aria-label="Show" className="flex gap-1.5 flex-wrap flex-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setPage(0);
                }}
                className={`h-10 px-3.5 rounded-full text-[0.8125rem] font-semibold border ${
                  tab === t.id ? "bg-ui-primary border-ui-primary text-ui-on-primary" : "bg-ui-surface border-ui-border text-ui-text-2 hover:bg-ui-subtle"
                }`}
              >
                {t.label} ({matching.filter(t.test).length})
              </button>
            ))}
          </div>
          <div role="group" aria-label="View" className="flex gap-1 p-1 rounded-lg border border-ui-border bg-ui-surface">
            {([
              ["cards", "Cards", LayoutGrid],
              ["board", "Board by kitchen state", Columns3],
            ] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={label}
                onClick={() => setView(v)}
                className={`w-11 h-10 rounded-md flex items-center justify-center ${view === v ? "bg-ui-primary text-ui-on-primary" : "text-ui-text-2 hover:bg-ui-subtle"}`}
              >
                <Icon className="w-[1.125rem] h-[1.125rem]" />
              </button>
            ))}
          </div>
          <label className="relative w-64 max-w-full">
            <span className="sr-only">Search orders</span>
            <Search className="w-4 h-4 text-ui-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={p.search}
              onChange={(e) => {
                setPage(0);
                p.onSearch(e.target.value);
              }}
              placeholder="Docket no., table, guest"
              className="w-full h-11 rounded-lg border border-ui-border-strong bg-ui-surface pl-9 pr-3 text-sm text-ui-text placeholder:text-ui-muted focus:outline-none focus:border-ui-primary"
            />
          </label>
        </div>

        {p.loadError ? (
          <div className="rounded-xl border border-ui-border bg-ui-surface p-6 text-center">
            <p className="text-sm font-semibold text-ui-danger mb-3">Could not load orders: {p.loadError}</p>
            <button type="button" onClick={p.onRefresh} className="h-11 px-4 rounded-lg bg-ui-primary text-ui-on-primary font-bold text-sm">
              Retry
            </button>
          </div>
        ) : p.loading && p.orders.length === 0 ? (
          <p className="text-sm text-ui-muted py-10 text-center">Loading orders…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-ui-muted py-10 text-center">
            {p.orders.length === 0 ? "No orders for these dates." : "No orders match this tab or search."}
          </p>
        ) : view === "cards" ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3 items-start">{pageRows.map((o) => card(o))}</div>
            <nav aria-label="Pages" className="flex items-center justify-end gap-1.5 mt-4 flex-wrap">
              <span className="text-xs text-ui-muted mr-auto">
                Showing {current * PER_PAGE + 1}–{Math.min(shown.length, (current + 1) * PER_PAGE)} of {shown.length}
                {p.orders.length < p.total ? ` (latest ${p.orders.length} of ${p.total} loaded)` : ""}
              </span>
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="h-10 px-3 rounded-lg border border-ui-border bg-ui-surface text-sm font-semibold text-ui-text-2 disabled:opacity-40">
                Prev
              </button>
              {Array.from({ length: pages }, (_, i) => i)
                .filter((i) => pages <= 7 || Math.abs(i - current) <= 2 || i === 0 || i === pages - 1)
                .map((i) => (
                  <button
                    key={i}
                    type="button"
                    aria-current={i === current ? "page" : undefined}
                    onClick={() => setPage(i)}
                    className={`w-10 h-10 rounded-lg text-sm font-bold border ${i === current ? "bg-ui-primary border-ui-primary text-ui-on-primary" : "bg-ui-surface border-ui-border text-ui-text-2"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="h-10 px-3 rounded-lg border border-ui-border bg-ui-surface text-sm font-semibold text-ui-text-2 disabled:opacity-40">
                Next
              </button>
              {p.orders.length < p.total && (
                <button type="button" onClick={p.onLoadMore} disabled={p.loading} className="h-10 px-3 rounded-lg border border-ui-primary text-ui-primary-text text-sm font-bold disabled:opacity-40">
                  Load older orders
                </button>
              )}
            </nav>
          </>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 items-start">
            {columns.map((c) => {
              const list = shown.filter(c.test);
              return (
                <section key={c.label} aria-label={c.label} className="rounded-xl bg-ui-subtle border border-ui-border p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} /> {c.label}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-ui-surface text-ui-text-2">{list.length}</span>
                  </div>
                  {list.length === 0 && <p className="text-xs text-ui-muted px-1 pb-1">None</p>}
                  {list.map((o) => card(o, true))}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
