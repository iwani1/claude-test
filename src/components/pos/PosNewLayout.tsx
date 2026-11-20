"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ChefHat,
  Coffee,
  Minus,
  Percent,
  Phone,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  User,
  UtensilsCrossed,
  X,
  ChevronUp,
} from "lucide-react";
import { Money } from "@/components/ui/Money";
import { RecentOrdersStrip, docketNo } from "@/components/pos/RecentOrdersStrip";

export type OrderType = "dine_in" | "room_service" | "takeaway" | "delivery";

/**
 * The till's screen in the new design (redesign stage 2, Nov 2026): recent
 * orders across the top, category cards, dish cards, and the order panel on
 * the right, after the Dreams-style layout the owner chose (canvas demo 8).
 *
 * Markup only. Every value and handler comes from PosTerminal, so the cart,
 * pricing (pricing-core, the server's own maths), kitchen dockets, payments,
 * idempotency keys, manager approvals and the offline queue are exactly the
 * classic till's. The pop-ups (dish options, discount, payment...) are the
 * same shared ones too.
 */
export interface PosNewLayoutProps {
  categories: any[];
  menuItems: any[];
  filteredItems: any[];
  selectedCategory: number | "all";
  onSelectCategory: (c: number | "all") => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  onItem: (item: any) => void;
  cartQtyByItem: Map<number, number>;

  tables: any[];
  cart: any[];
  onQuantity: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  orderType: OrderType;
  onOrderType: (t: OrderType) => void;
  selectedTableId: number | null;
  onTable: (id: number | null) => void;
  roomNumber: string;
  onRoom: (v: string) => void;
  customerName: string;
  onCustomerName: (v: string) => void;
  customerPhone: string;
  onCustomerPhone: (v: string) => void;
  orderNotes: string;
  onOrderNotes: (v: string) => void;
  loadedOrder: { id: number; orderNumber: string; paymentStatus: string; paidAmount: string } | null;

  subtotal: number;
  discount: number;
  taxAmount: number;
  taxRatePercent: number;
  roomCharge: number;
  tipAmount: number;
  onTip: (v: number) => void;
  totalAmount: number;
  isComplimentary: boolean;
  compValue: string;
  compEnabled: boolean;

  onDiscount: () => void;
  onToggleComp: () => void;
  onSettle: () => void;
  onSendComp: () => void;
  onKitchen: () => void;
  onClear: () => void;
  isSubmitting: boolean;

  showRecentOrders: boolean;
  recentRefreshKey: number;
  onOpenOrder: (orderId: number) => void;
  /** Below 64rem (phones, portrait tablets): the order panel becomes a
   *  slide-up sheet opened from a bar with the running total (stage 7). */
  compact?: boolean;
}

const TYPES: [OrderType, string][] = [
  ["dine_in", "Dine in"],
  ["takeaway", "Takeaway"],
  ["delivery", "Delivery"],
  ["room_service", "Room"],
];

const cedi = (n: number) => `GH₵${n.toFixed(2)}`;
const dishes = (n: number) => `${n} ${n === 1 ? "dish" : "dishes"}`;
/** Two letters for a dish with no photo, e.g. "Fried rice" → "FR". */
const initials = (name: string) =>
  String(name)
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function PosNewLayout(p: PosNewLayoutProps) {
  const cartCount = p.cart.reduce((n, it) => n + it.quantity, 0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheet = !!p.compact;
  useEffect(() => {
    if (!sheet || !sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, sheetOpen]);
  const catCards = useMemo(
    () => [
      {
        id: "all" as const,
        name: "All dishes",
        count: p.menuItems.length,
        image: p.menuItems.find((i) => i.imageUrl)?.imageUrl as string | undefined,
      },
      ...p.categories.map((c) => {
        const items = p.menuItems.filter((i) => i.categoryId === c.id);
        return { id: c.id as number, name: c.name as string, count: items.length, image: items.find((i) => i.imageUrl)?.imageUrl as string | undefined };
      }),
    ],
    [p.categories, p.menuItems],
  );
  const catName = useMemo(() => new Map(p.categories.map((c) => [c.id, c.name])), [p.categories]);
  const field =
    "w-full h-11 rounded-lg border border-ui-border-strong bg-ui-surface px-3 text-sm text-ui-text placeholder:text-ui-muted focus:outline-none focus:border-ui-primary";
  // Field names are read out but not drawn: the placeholders and the order
  // type say what each box is, and the height goes to the ordered items.
  const label = "sr-only";

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden bg-ui-bg text-ui-text">
      {/* MENU COLUMN */}
      <main className={`flex-1 min-w-0 overflow-y-auto custom-scrollbar ${sheet ? "p-3 pb-28" : "p-5"}`}>
        {p.showRecentOrders && !sheet && (
          <RecentOrdersStrip
            tables={p.tables}
            refreshKey={p.recentRefreshKey}
            activeOrderId={p.loadedOrder?.id ?? null}
            onOpenOrder={p.onOpenOrder}
          />
        )}

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="text-lg font-bold">Menu</h2>
          <div className="flex-1" />
          <label className="relative w-72 max-w-full grow sm:grow-0">
            <span className="sr-only">Search dishes and drinks</span>
            <Search className="w-4 h-4 text-ui-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={p.searchQuery}
              onChange={(e) => p.onSearch(e.target.value)}
              placeholder="Search dishes, drinks or code"
              className={`${field} pl-9 pr-9`}
            />
            {p.searchQuery && (
              <button
                type="button"
                onClick={() => p.onSearch("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md text-ui-muted hover:text-ui-text flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </label>
        </div>

        {/* Categories as one row of chips (stage 7): the dishes, not the
            category cards, fill the first screen. */}
        <div role="group" aria-label="Menu categories" className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 custom-scrollbar">
          {catCards.map((c) => {
            const on = p.selectedCategory === c.id;
            return (
              <button
                key={String(c.id)}
                type="button"
                onClick={() => p.onSelectCategory(c.id)}
                aria-pressed={on}
                aria-label={`${c.name}, ${dishes(c.count)}`}
                className={`h-12 pl-1.5 pr-3.5 rounded-full border flex items-center gap-2 shrink-0 transition ${
                  on ? "border-ui-primary bg-ui-primary text-ui-on-primary shadow-ui-1" : "border-ui-border bg-ui-surface text-ui-text hover:border-ui-border-strong"
                }`}
              >
                <span className="w-9 h-9 rounded-full overflow-hidden bg-ui-subtle flex items-center justify-center shrink-0">
                  {c.image ? (
                    <Image unoptimized width={72} height={72} src={c.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed className="w-4 h-4 text-ui-muted" />
                  )}
                </span>
                <span className="text-[0.8125rem] font-bold whitespace-nowrap">{c.name}</span>
                <span
                  aria-hidden="true"
                  className={`min-w-6 h-6 px-1.5 rounded-full text-[0.75rem] font-bold flex items-center justify-center ${
                    on ? "bg-black/15" : "bg-ui-subtle text-ui-text-2"
                  }`}
                >
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className={`grid gap-3 ${sheet ? "grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]"}`}>
          {p.filteredItems.map((item) => {
            const qty = p.cartQtyByItem.get(item.id) ?? 0;
            const off = !item.isAvailable;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => p.onItem(item)}
                disabled={off}
                aria-label={`${item.name}, ${cedi(Number(item.price))}${off ? ", unavailable" : qty ? `, ${qty} on the order` : ""}`}
                className={`group text-left rounded-2xl p-2 pb-3 border bg-ui-surface shadow-ui-1 transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed ${
                  qty ? "border-ui-primary ring-2 ring-ui-primary/20" : "border-ui-border hover:border-ui-border-strong hover:-translate-y-0.5"
                } ${off ? "opacity-60" : ""}`}
              >
                <span className="relative block h-28 rounded-xl overflow-hidden bg-ui-subtle">
                  {item.imageUrl ? (
                    <Image
                      unoptimized
                      width={400}
                      height={300}
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      className={`w-full h-full object-cover transition duration-300 group-hover:scale-[1.04] ${off ? "grayscale" : ""}`}
                    />
                  ) : (
                    // No photo yet: the dish's initials on the brand tint, so the
                    // card reads as designed rather than as a missing image.
                    <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ui-primary-soft to-ui-subtle">
                      <span className="text-3xl font-extrabold tracking-tight text-ui-primary-text" aria-hidden="true">
                        {initials(item.name)}
                      </span>
                    </span>
                  )}
                  {qty > 0 && (
                    <span
                      key={qty}
                      className="ui-pop absolute top-2 right-2 min-w-7 h-7 px-1.5 rounded-full bg-ui-primary text-ui-on-primary text-xs font-bold flex items-center justify-center shadow-ui-1"
                    >
                      {qty}
                    </span>
                  )}
                  {off && (
                    <span className="absolute left-2 bottom-2 px-2 py-0.5 rounded-md bg-ui-danger-soft text-ui-danger text-[0.6875rem] font-bold">Unavailable</span>
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 mt-2 px-1 text-xs text-ui-muted">
                  <span className="truncate">{catName.get(item.categoryId) ?? ""}</span>
                  <span className="inline-flex items-center gap-1 capitalize shrink-0">
                    {item.hasRecipe && <ChefHat className="w-3 h-3" aria-label="Has a recipe" />}
                    {item.station || "kitchen"}
                  </span>
                </span>
                <span className="block px-1 mt-1 text-sm font-bold leading-snug line-clamp-2 min-h-[2.5rem]">{item.name}</span>
                <span className="flex items-center justify-between px-1 mt-1">
                  <Money value={item.price} className="text-base font-extrabold text-ui-primary-text" />
                </span>
              </button>
            );
          })}
        </div>
        {p.filteredItems.length === 0 && (
          <div className="py-16 text-center text-ui-muted">
            <Search className="w-9 h-9 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-ui-text-2">No dishes match.</p>
            <p className="text-xs mt-1">Try another category or search.</p>
          </div>
        )}
      </main>

      {/* PHONE ORDER BAR (stage 7): the running total, always in reach;
          tapping it slides the order panel up. Sits above the bottom tabs. */}
      {sheet && !sheetOpen && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={`Open the order: ${cartCount} item${cartCount === 1 ? "" : "s"}, ${cedi(p.totalAmount)}`}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-4 z-20 h-16 pl-2 pr-3 rounded-2xl bg-ui-text text-ui-bg shadow-ui-2 flex items-center gap-3 ui-slide"
        >
          <span className="relative w-12 h-12 rounded-xl bg-ui-primary text-ui-on-primary flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" strokeWidth={2.4} />
            {cartCount > 0 && (
              <span key={cartCount} className="ui-pop absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1 rounded-full bg-ui-bg text-ui-text text-xs font-bold flex items-center justify-center border-2 border-ui-text">
                {cartCount}
              </span>
            )}
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="block text-xs font-semibold opacity-80">{cartCount === 0 ? "Open order" : `${cartCount} item${cartCount === 1 ? "" : "s"}`}</span>
            <span className="block text-lg font-extrabold leading-tight truncate">{cartCount === 0 ? "No items yet" : <Money value={p.totalAmount} />}</span>
          </span>
          <span className="h-11 px-3.5 rounded-xl bg-ui-bg/15 font-bold text-sm inline-flex items-center gap-1.5">
            View <ChevronUp className="w-4 h-4" />
          </span>
        </button>
      )}
      {sheet && sheetOpen && <div className="ui-fade fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[3px]" onClick={() => setSheetOpen(false)} aria-hidden="true" />}

      {/* ORDER PANEL: the right-hand column, or on narrow screens a sheet. */}
      <aside
        aria-label="Order"
        className={
          sheet
            ? `${sheetOpen ? "flex" : "hidden"} ui-sheet fixed inset-x-0 bottom-0 z-40 max-h-[92dvh] flex-col bg-ui-surface rounded-t-3xl shadow-ui-2 overflow-y-auto overscroll-contain`
            : "w-[25rem] shrink-0 flex flex-col bg-ui-surface border-l border-ui-border"
        }
      >
        {sheet && <span aria-hidden="true" className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-ui-border-strong shrink-0" />}
        <div className="p-3 border-b border-ui-border space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold" title={p.loadedOrder?.orderNumber}>
              {p.loadedOrder ? `Order ${docketNo(p.loadedOrder.orderNumber)}` : "New order"}
            </h2>
            {sheet ? (
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close the order and back to the menu"
                className="w-11 h-11 rounded-full text-ui-muted hover:bg-ui-subtle flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <span className="text-xs text-ui-muted">
                {new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          {/* responsive-ok: four short type labels; fits a 360px phone sheet */}
          <div role="tablist" aria-label="Order type" className="grid grid-cols-4 gap-1.5">
            {TYPES.map(([t, l]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={p.orderType === t}
                onClick={() => p.onOrderType(t)}
                className={`h-11 rounded-lg text-[0.8125rem] font-semibold border transition ${
                  p.orderType === t
                    ? "border-ui-primary bg-ui-primary-soft text-ui-primary-text"
                    : "border-ui-border text-ui-text-2 hover:bg-ui-subtle"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {p.orderType === "dine_in" ? (
              <label>
                <span className={label}>Table</span>
                <select value={p.selectedTableId || ""} onChange={(e) => p.onTable(e.target.value ? Number(e.target.value) : null)} className={field}>
                  <option value="">Select table…</option>
                  {p.tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tableNumber} ({t.capacity}p · {t.status})
                    </option>
                  ))}
                </select>
              </label>
            ) : p.orderType === "room_service" ? (
              <label>
                <span className={label}>Room number *</span>
                <input value={p.roomNumber} onChange={(e) => p.onRoom(e.target.value)} placeholder="Room no. *" className={`${field} font-bold`} />
              </label>
            ) : (
              <label>
                <span className={label}>Guest phone</span>
                <span className="relative block">
                  <Phone className="w-3.5 h-3.5 text-ui-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="tel" value={p.customerPhone} onChange={(e) => p.onCustomerPhone(e.target.value)} placeholder="024 410 0000" className={`${field} pl-8`} />
                </span>
              </label>
            )}
            <label>
              <span className={label}>Guest name</span>
              <span className="relative block">
                <User className="w-3.5 h-3.5 text-ui-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={p.customerName} onChange={(e) => p.onCustomerName(e.target.value)} placeholder="Walk-in Guest" className={`${field} pl-8`} />
              </span>
            </label>
          </div>
          <label className="block">
            <span className={label}>Order note (prints on the kitchen docket)</span>
            <input value={p.orderNotes} onChange={(e) => p.onOrderNotes(e.target.value)} placeholder="Order note for the kitchen docket" className={field} />
          </label>
        </div>

        <div className="px-4 pt-3 pb-1 flex items-baseline justify-between shrink-0">
          <span className="text-sm font-bold">Ordered items</span>
          <span className="text-xs text-ui-muted">
            {cartCount} item{cartCount === 1 ? "" : "s"}
          </span>
        </div>
        {p.loadedOrder && (
          <div className="mx-4 mb-2 shrink-0 rounded-lg bg-ui-primary-soft text-ui-primary-text px-3 py-2 text-xs leading-snug">
            <b>{docketNo(p.loadedOrder.orderNumber)}</b>
            {p.loadedOrder.paymentStatus === "partially_paid"
              ? ` · GH₵${Number(p.loadedOrder.paidAmount).toFixed(2)} already paid`
              : " · sent to the kitchen, not yet paid"}
            . Add items, then take payment.
          </div>
        )}
        {/* In the phone sheet the whole sheet scrolls and the totals stay pinned
            at its foot, so the items always get the room they need. */}
        <div className={sheet ? "shrink-0 px-4 pb-3 space-y-2" : "flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2 custom-scrollbar"}>
          {p.cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-ui-muted py-8">
              <Receipt className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm font-semibold text-ui-text-2">No items yet</p>
              <p className="text-xs mt-1">Tap a dish to add it.</p>
            </div>
          ) : (
            p.cart.map((it, idx) => (
              <div key={it.cartItemId || idx} className="ui-in rounded-xl border border-ui-border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight">{it.itemName}</div>
                    {it.modifiers?.length > 0 && (
                      <div className="text-xs text-ui-muted mt-0.5">{it.modifiers.map((m: any) => m.name || m.optionName).join(" · ")}</div>
                    )}
                    {it.specialInstructions && <div className="text-xs text-ui-primary-text mt-0.5">Note: {it.specialInstructions}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => p.onRemove(idx)}
                    aria-label={`Remove ${it.itemName}`}
                    title="Remove (Undo appears afterwards)"
                    className="w-10 h-10 -mt-1 -mr-1 rounded-lg text-ui-danger hover:bg-ui-danger-soft flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-ui-muted font-mono">{cedi(Number(it.unitPrice))} each</span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => p.onQuantity(idx, -1)}
                      aria-label={`One less ${it.itemName}`}
                      className="w-10 h-10 rounded-full border border-ui-border-strong text-ui-text flex items-center justify-center active:scale-95"
                    >
                      <Minus className="w-4 h-4" strokeWidth={2.6} />
                    </button>
                    <span className="w-7 text-center font-bold font-mono">{it.quantity}</span>
                    <button
                      type="button"
                      onClick={() => p.onQuantity(idx, 1)}
                      aria-label={`One more ${it.itemName}`}
                      className="w-10 h-10 rounded-full bg-ui-primary text-ui-on-primary flex items-center justify-center active:scale-95"
                    >
                      <Plus className="w-4 h-4" strokeWidth={2.6} />
                    </button>
                  </span>
                  <span className="w-20 text-right text-sm font-bold font-mono">{cedi(Number(it.totalPrice))}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Adjustments and the breakdown; in the phone sheet these scroll
            with the items and only the amount and the actions stay pinned. */}
        <div className="shrink-0 border-t border-ui-border bg-ui-subtle px-3 pt-3 space-y-2.5">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={p.onDiscount}
              className={`flex-1 h-11 rounded-lg border text-[0.8125rem] font-semibold flex items-center justify-center gap-1.5 ${
                p.discount > 0 ? "border-ui-primary bg-ui-primary-soft text-ui-primary-text" : "border-ui-border-strong bg-ui-surface text-ui-text-2"
              }`}
            >
              <Percent className="w-3.5 h-3.5" /> {p.discount > 0 ? `−${cedi(p.discount)}` : "Discount"}
            </button>
            {[0.05, 0.1, 0.15].map((pct) => {
              const v = p.subtotal * pct;
              const on = Math.abs(p.tipAmount - v) < 0.05 && p.tipAmount > 0;
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => p.onTip(on ? 0 : v)}
                  aria-pressed={on}
                  aria-label={`Tip ${pct * 100}%`}
                  className={`w-14 h-11 rounded-lg border text-[0.8125rem] font-bold ${
                    on ? "border-ui-success bg-ui-success-soft text-ui-success" : "border-ui-border-strong bg-ui-surface text-ui-text-2"
                  }`}
                >
                  {pct * 100}%
                </button>
              );
            })}
          </div>
          {p.orderType === "room_service" && p.compEnabled && (
            <button
              type="button"
              onClick={p.onToggleComp}
              aria-pressed={p.isComplimentary}
              className={`w-full h-11 rounded-lg border text-[0.8125rem] font-semibold flex items-center justify-center gap-2 ${
                p.isComplimentary ? "border-ui-info bg-ui-info-soft text-ui-info" : "border-ui-border-strong bg-ui-surface text-ui-text-2"
              }`}
            >
              <Coffee className="w-4 h-4" />
              {p.isComplimentary ? "Complimentary breakfast · tap to undo" : "Complimentary breakfast (GH₵0.00)"}
            </button>
          )}

          <div className="space-y-0.5 text-[0.8125rem]">
            <div className="flex justify-between text-ui-text-2"><span>Sub total</span><span className="font-mono">{cedi(p.subtotal)}</span></div>
            {p.discount > 0 && !p.isComplimentary && (
              <div className="flex justify-between text-ui-primary-text"><span>Discount</span><span className="font-mono">−{cedi(p.discount)}</span></div>
            )}
            {p.orderType === "room_service" && !p.isComplimentary && (
              <div className="flex justify-between text-ui-info"><span>Room service charge</span><span className="font-mono">{cedi(p.roomCharge)}</span></div>
            )}
            <div className="flex justify-between text-ui-text-2"><span>VAT ({p.taxRatePercent}%)</span><span className="font-mono">{cedi(p.taxAmount)}</span></div>
            {p.tipAmount > 0 && !p.isComplimentary && (
              <div className="flex justify-between text-ui-success"><span>Tip</span><span className="font-mono">+{cedi(p.tipAmount)}</span></div>
            )}
          </div>
        </div>

        <div
          className={`shrink-0 bg-ui-subtle px-3 pt-2 space-y-2.5 ${
            sheet ? "sticky bottom-0 z-10 border-t border-ui-border shadow-ui-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]" : "pb-3"
          }`}
        >
          <div className="text-[0.8125rem]">
            {p.isComplimentary ? (
              <div className="pt-2 border-t border-dashed border-ui-border-strong">
                <div className="flex justify-between text-base font-bold text-ui-info"><span>Complimentary</span><span className="font-mono">GH₵0.00</span></div>
                <div className="flex justify-between text-xs text-ui-muted"><span>Food value given free</span><span className="font-mono">GH₵{p.compValue}</span></div>
              </div>
            ) : (
              <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-ui-border-strong text-base font-bold">
                <span>Amount to be paid</span>
                <Money key={p.totalAmount} value={p.totalAmount} className="ui-fade text-2xl font-extrabold text-ui-primary-text" />
              </div>
            )}
          </div>

          {p.isComplimentary ? (
            <button
              type="button"
              onClick={p.onSendComp}
              disabled={p.cart.length === 0 || p.isSubmitting}
              className="w-full h-13 rounded-xl bg-ui-info text-ui-surface text-[0.9375rem] font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Coffee className="w-5 h-5" /> {p.isSubmitting ? "Sending…" : "Send comp order · GH₵0.00"}
            </button>
          ) : (
            <button
              type="button"
              onClick={p.onSettle}
              disabled={p.cart.length === 0 || p.isSubmitting}
              className="w-full h-13 rounded-xl bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-[0.9375rem] font-bold shadow-ui-1 disabled:shadow-none disabled:bg-ui-border disabled:text-ui-muted disabled:cursor-not-allowed transition active:scale-[0.99]"
            >
              Take payment · {cedi(p.totalAmount)}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={p.onKitchen}
              disabled={p.cart.length === 0 || p.isSubmitting}
              title="Print the kitchen docket without taking payment"
              className="h-11 rounded-lg border border-ui-border-strong bg-ui-surface text-ui-text text-[0.8125rem] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Printer className="w-4 h-4" /> Send to kitchen
            </button>
            <button
              type="button"
              onClick={p.onClear}
              disabled={p.cart.length === 0 || p.isSubmitting}
              title="Clear the current ticket (asks first)"
              className="h-11 rounded-lg border border-ui-border-strong bg-ui-surface text-ui-danger text-[0.8125rem] font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
