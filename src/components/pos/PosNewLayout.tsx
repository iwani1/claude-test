"use client";

import React, { useMemo } from "react";
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
  Trash2,
  User,
  UtensilsCrossed,
  X,
} from "lucide-react";
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
}

const TYPES: [OrderType, string][] = [
  ["dine_in", "Dine in"],
  ["takeaway", "Takeaway"],
  ["delivery", "Delivery"],
  ["room_service", "Room"],
];

const cedi = (n: number) => `GH₵${n.toFixed(2)}`;

export function PosNewLayout(p: PosNewLayoutProps) {
  const cartCount = p.cart.reduce((n, it) => n + it.quantity, 0);
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
      <main className="flex-1 min-w-0 overflow-y-auto p-5 custom-scrollbar">
        {p.showRecentOrders && (
          <RecentOrdersStrip
            tables={p.tables}
            refreshKey={p.recentRefreshKey}
            activeOrderId={p.loadedOrder?.id ?? null}
            onOpenOrder={p.onOpenOrder}
          />
        )}

        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-bold">Menu categories</h2>
          <div className="flex-1" />
          <label className="relative w-72 max-w-full">
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

        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5 mb-5">
          {catCards.map((c) => {
            const on = p.selectedCategory === c.id;
            return (
              <button
                key={String(c.id)}
                type="button"
                onClick={() => p.onSelectCategory(c.id)}
                aria-pressed={on}
                className={`h-28 rounded-xl border flex flex-col items-center justify-center gap-1 px-2 transition ${
                  on ? "border-ui-primary bg-ui-primary-soft" : "border-ui-border bg-ui-surface hover:border-ui-border-strong"
                }`}
              >
                <span className="w-12 h-12 rounded-full overflow-hidden bg-ui-subtle flex items-center justify-center shrink-0">
                  {c.image ? (
                    <Image unoptimized width={96} height={96} src={c.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed className="w-5 h-5 text-ui-muted" />
                  )}
                </span>
                <span className={`text-[0.8125rem] font-bold leading-tight text-center line-clamp-1 ${on ? "text-ui-primary-text" : "text-ui-text"}`}>
                  {c.name}
                </span>
                <span className="text-xs text-ui-muted">{c.count} dishes</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
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
                className={`text-left rounded-xl p-2 pb-3 border bg-ui-surface transition disabled:cursor-not-allowed ${
                  qty ? "border-ui-primary" : "border-ui-border hover:border-ui-border-strong"
                } ${off ? "opacity-60" : ""}`}
              >
                <span className="relative block h-28 rounded-lg overflow-hidden bg-ui-subtle">
                  {item.imageUrl ? (
                    <Image
                      unoptimized
                      width={400}
                      height={300}
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      className={`w-full h-full object-cover ${off ? "grayscale" : ""}`}
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-ui-muted">
                      <Coffee className="w-7 h-7" />
                    </span>
                  )}
                  {qty > 0 && (
                    <span className="absolute top-2 right-2 min-w-7 h-7 px-1.5 rounded-full bg-ui-primary text-ui-on-primary text-xs font-bold flex items-center justify-center">
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
                  <span className="text-base font-bold text-ui-primary-text font-mono">{cedi(Number(item.price))}</span>
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

      {/* ORDER PANEL */}
      <aside aria-label="Order" className="w-[25rem] shrink-0 flex flex-col bg-ui-surface border-l border-ui-border">
        <div className="p-3 border-b border-ui-border space-y-2 shrink-0">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold" title={p.loadedOrder?.orderNumber}>
              {p.loadedOrder ? `Order ${docketNo(p.loadedOrder.orderNumber)}` : "New order"}
            </h2>
            <span className="text-xs text-ui-muted">
              {new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
          {/* responsive-ok: the new layout needs a 64rem+ screen; four short type labels */}
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
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2 custom-scrollbar">
          {p.cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-ui-muted py-8">
              <Receipt className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm font-semibold text-ui-text-2">No items yet</p>
              <p className="text-xs mt-1">Tap a dish to add it.</p>
            </div>
          ) : (
            p.cart.map((it, idx) => (
              <div key={it.cartItemId || idx} className="rounded-lg border border-ui-border px-3 py-2">
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

        <div className="shrink-0 border-t border-ui-border bg-ui-subtle p-3 space-y-2.5">
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
            {p.isComplimentary ? (
              <div className="pt-2 border-t border-dashed border-ui-border-strong">
                <div className="flex justify-between text-base font-bold text-ui-info"><span>Complimentary</span><span className="font-mono">GH₵0.00</span></div>
                <div className="flex justify-between text-xs text-ui-muted"><span>Food value given free</span><span className="font-mono">GH₵{p.compValue}</span></div>
              </div>
            ) : (
              <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-ui-border-strong text-base font-bold">
                <span>Amount to be paid</span>
                <span className="font-mono text-lg text-ui-primary-text">{cedi(p.totalAmount)}</span>
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
              className="w-full h-13 rounded-xl bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-[0.9375rem] font-bold disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.99]"
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
