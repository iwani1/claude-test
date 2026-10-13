"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, X, AlertTriangle } from "lucide-react";
import { priceOrder, toCents, fromCents } from "@/lib/pricing-core";
import type { BillingConfig } from "@/lib/pricing-core";

/**
 * Owner-only order editor. The bill is previewed here with the same
 * `priceOrder` the server runs, but the server always re-prices from menu
 * prices on save — this screen never sets a price, only what and how many.
 *
 * When the order was already paid, the footer says what the difference means:
 * collect more, or refund the guest. Nothing is adjusted silently.
 */

type EditLine = {
  key: string;
  menuItemId: number;
  itemName: string;
  basePrice: string;
  modifierTotal: string;
  quantity: number;
  modifiers: any[];
  specialInstructions: string;
};

interface EditOrderModalProps {
  order: any;
  onClose: () => void;
  onSaved: (result: any) => void;
}

const newKey = () => Math.random().toString(36).slice(2);

export function EditOrderModal({ order, onClose, onSaved }: EditOrderModalProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [menu, setMenu] = useState<any[]>([]);
  const [config, setConfig] = useState<BillingConfig | null>(null);

  const [lines, setLines] = useState<EditLine[]>([]);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [orderType, setOrderType] = useState<string>(order.orderType || "dine_in");
  const [roomNumber, setRoomNumber] = useState<string>(order.roomNumber || "");
  const [customerName, setCustomerName] = useState<string>(order.customerName || "");
  const [customerPhone, setCustomerPhone] = useState<string>(order.customerPhone || "");
  const [notes, setNotes] = useState<string>(order.notes || "");
  const [discountMode, setDiscountMode] = useState<"none" | "percent" | "amount">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [tip, setTip] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refundedCents, setRefundedCents] = useState(0);

  // Money already handed back is read from the refund ledger, not from a status
  // label: once anything has been refunded the bill can no longer be re-priced.
  const refunded = refundedCents > 0;
  const collectedCents = Math.max(0, toCents(order.paidAmount || 0) - refundedCents);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/orders/${order.id}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Could not load the order (${r.status})`)))),
      fetch("/api/menu").then((r) => r.json()),
      fetch("/api/billing-config").then((r) => r.json()),
    ])
      .then(([detail, menuData, billing]) => {
        if (cancelled) return;
        const full = detail.order || {};
        setMenu(menuData.menuItems || menuData.items || []);
        setConfig({
          roomChargeCents: Number(billing.roomChargeCents) || 0,
          taxRatePercent: Number(billing.taxRatePercent) || 0,
          compBreakfastEnabled: !!billing.compBreakfastEnabled,
        });
        setLines(
          (full.items || []).map((row: any) => {
            const mods: any[] = Array.isArray(row.modifiers) ? row.modifiers : [];
            const modTotal = mods.reduce((sum, m) => sum + Number(m?.priceDelta || 0), 0);
            return {
              key: newKey(),
              menuItemId: row.menuItemId,
              itemName: row.itemName,
              basePrice: (Number(row.unitPrice) - modTotal).toFixed(2),
              modifierTotal: modTotal.toFixed(2),
              quantity: Number(row.quantity),
              modifiers: mods,
              specialInstructions: row.specialInstructions || "",
            };
          })
        );
        // Prefill money fields the owner can already see on the order.
        const existingDiscount = Number(full.discountAmount || 0);
        if (existingDiscount > 0 && !full.isComplimentary) {
          setDiscountMode("amount");
          setDiscountValue(existingDiscount.toFixed(2));
        }
        setDiscountReason(full.discountReason || "");
        setRefundedCents(toCents(full.refundedAmount || 0));
        const existingTip = Number(full.tipAmount || 0);
        if (existingTip > 0) setTip(existingTip.toFixed(2));
        setOrderType(full.orderType || "dine_in");
        setRoomNumber(full.roomNumber || "");
        setCustomerName(full.customerName || "");
        setCustomerPhone(full.customerPhone || "");
        setNotes(full.notes || "");
      })
      .catch((err) => setLoadError(err?.message || "Could not load the order"))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const preview = useMemo(() => {
    if (!config) return null;
    return priceOrder({
      lines: lines.map((l) => ({ unitPrice: l.basePrice, modifierTotal: l.modifierTotal, quantity: l.quantity })),
      orderType,
      discountCents: discountMode === "amount" ? Math.round(Number(discountValue || 0) * 100) : 0,
      discountPercent: discountMode === "percent" ? Number(discountValue || 0) : 0,
      tipCents: Math.round(Number(tip || 0) * 100),
      isComplimentary: !!order.isComplimentary,
      config,
    });
  }, [config, lines, orderType, discountMode, discountValue, tip, order.isComplimentary]);

  const dueCents = preview ? preview.totalCents - collectedCents : 0;

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? menu.filter((m) => String(m.name).toLowerCase().includes(q)) : menu;
    return list.slice(0, 40);
  }, [menu, search]);

  const addItem = (item: any) => {
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.menuItemId === item.id && l.modifiers.length === 0);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key: newKey(),
          menuItemId: item.id,
          itemName: item.name,
          basePrice: Number(item.price).toFixed(2),
          modifierTotal: "0.00",
          quantity: 1,
          modifiers: [],
          specialInstructions: "",
        },
      ];
    });
    setShowPicker(false);
    setSearch("");
  };

  const changeQty = (key: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const save = async () => {
    if (lines.length === 0) {
      setError("An order needs at least one item.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { customerName, customerPhone, notes, orderType, roomNumber };
      if (!refunded) {
        payload.items = lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          modifiers: (l.modifiers || []).map((m: any) => ({ id: m?.id })).filter((m: any) => m.id !== undefined),
          specialInstructions: l.specialInstructions || "",
        }));
        payload.discountPercent = discountMode === "percent" ? Number(discountValue || 0) : 0;
        payload.discountAmount = discountMode === "amount" ? Number(discountValue || 0) : 0;
        payload.discountReason = discountReason;
        payload.tipAmount = Number(tip || 0);
      }
      const res = await fetch(`/api/orders/${order.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      onSaved(data);
    } catch (err: any) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const money = (cents: number) => `GH₵${fromCents(Math.max(0, cents))}`;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Edit order ${order.orderNumber}`}>
      <div className="w-full max-w-3xl max-h-[92dvh] flex flex-col bg-neutral-900 border border-neutral-700 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Edit order {order.orderNumber}</h2>
            <p className="text-xs text-neutral-400">
              {collectedCents > 0 ? `Already paid GH₵${fromCents(collectedCents)}` : "Not paid yet"} · prices always come from the menu
            </p>
          </div>
          <button onClick={onClose} className="w-11 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center" aria-label="Close editor">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
          {loading && <p className="text-sm text-neutral-400">Loading order…</p>}
          {loadError && <p className="text-sm text-rose-400 font-semibold">{loadError}</p>}

          {!loading && !loadError && (
            <>
              {refunded && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>This order has refunds against it, so items, discount and tip can&apos;t be changed. Customer details and notes can still be saved.</span>
                </div>
              )}

              {/* Order type */}
              <div>
                <p className="text-[0.6875rem] font-bold tracking-[0.12em] text-neutral-500 uppercase mb-2">Order type</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800 text-xs font-bold">
                  {([
                    ["dine_in", "Table"],
                    ["room_service", "Room Service"],
                    ["takeaway", "Takeaway"],
                    ["delivery", "Delivery"],
                  ] as const).map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={`h-12 px-1 rounded-lg transition active:scale-[0.97] ${
                        orderType === type ? "bg-amber-500 text-black" : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {orderType === "room_service" && (
                  <input
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="Room number (required)"
                    className="mt-2 w-full h-12 bg-neutral-800 border border-neutral-700 rounded-xl px-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                )}
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[0.6875rem] font-bold tracking-[0.12em] text-neutral-500 uppercase">Items</p>
                  <button
                    onClick={() => setShowPicker((v) => !v)}
                    disabled={refunded}
                    className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" strokeWidth={3} /> Add item
                  </button>
                </div>

                {showPicker && (
                  <div className="mb-3 p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search the menu…"
                        className="w-full h-12 bg-neutral-800 border border-neutral-700 rounded-xl pl-10 pr-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="mt-2 max-h-56 overflow-y-auto custom-scrollbar divide-y divide-neutral-800">
                      {filteredMenu.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => addItem(item)}
                          className="w-full h-12 px-2 flex items-center justify-between text-left hover:bg-neutral-800 rounded-lg"
                        >
                          <span className="text-sm text-neutral-200">{item.name}</span>
                          <span className="text-sm font-mono text-neutral-400">GH₵{Number(item.price).toFixed(2)}</span>
                        </button>
                      ))}
                      {filteredMenu.length === 0 && <p className="py-3 text-xs text-neutral-500">No menu item matches.</p>}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {lines.map((line) => (
                    <div key={line.key} className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-950 border border-neutral-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{line.itemName}</p>
                        <p className="text-xs text-neutral-500 font-mono">
                          GH₵{Number(line.basePrice).toFixed(2)}
                          {Number(line.modifierTotal) > 0 ? ` + GH₵${Number(line.modifierTotal).toFixed(2)} options` : ""} ea
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => changeQty(line.key, -1)}
                          disabled={refunded}
                          className="w-11 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-200 flex items-center justify-center disabled:opacity-40"
                          aria-label={`Decrease ${line.itemName}`}
                        >
                          <Minus className="w-5 h-5" strokeWidth={3} />
                        </button>
                        <span className="w-9 text-center font-bold text-white font-mono text-base">{line.quantity}</span>
                        <button
                          onClick={() => changeQty(line.key, 1)}
                          disabled={refunded}
                          className="w-11 h-11 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:bg-amber-500 active:text-black text-neutral-200 flex items-center justify-center disabled:opacity-40"
                          aria-label={`Increase ${line.itemName}`}
                        >
                          <Plus className="w-5 h-5" strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => changeQty(line.key, -line.quantity)}
                          disabled={refunded}
                          className="ml-1 w-11 h-11 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center disabled:opacity-40"
                          aria-label={`Remove ${line.itemName}`}
                        >
                          <Trash2 className="w-[18px] h-[18px]" />
                        </button>
                      </div>
                      <div className="w-24 text-right font-mono font-bold text-neutral-200">
                        GH₵{((Number(line.basePrice) + Number(line.modifierTotal)) * line.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  {lines.length === 0 && <p className="text-sm text-neutral-500">No items — add at least one.</p>}
                </div>
              </div>

              {/* Discount and tip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[0.6875rem] font-bold tracking-[0.12em] text-neutral-500 uppercase mb-2">Discount</p>
                  <div className="grid grid-cols-3 gap-1.5 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800 text-xs font-bold mb-2">
                    {([["none", "None"], ["percent", "Percent %"], ["amount", "Amount GH₵"]] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => setDiscountMode(mode)}
                        disabled={refunded || !!order.isComplimentary}
                        className={`h-11 rounded-lg transition ${discountMode === mode ? "bg-amber-500 text-black" : "text-neutral-400 hover:text-white"} disabled:opacity-40`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {discountMode !== "none" && (
                    <input
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      inputMode="decimal"
                      placeholder={discountMode === "percent" ? "e.g. 10" : "e.g. 20.00"}
                      className="w-full h-12 bg-neutral-800 border border-neutral-700 rounded-xl px-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  )}
                  {discountMode !== "none" && (
                    <input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Reason (e.g. staff meal)"
                      className="mt-2 w-full h-12 bg-neutral-800 border border-neutral-700 rounded-xl px-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  )}
                </div>
                <div>
                  <p className="text-[0.6875rem] font-bold tracking-[0.12em] text-neutral-500 uppercase mb-2">Tip</p>
                  <input
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    disabled={refunded}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full h-12 bg-neutral-800 border border-neutral-700 rounded-xl px-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Guest + notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Guest name" className="w-full h-12 bg-neutral-800 border border-neutral-700 rounded-xl px-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500" />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Guest phone" className="w-full h-12 bg-neutral-800 border border-neutral-700 rounded-xl px-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500" />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes (visible on the order)"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-800 bg-neutral-950/60 shrink-0 space-y-3">
          {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}
          {preview && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="text-neutral-400">
                Was <span className="font-mono text-neutral-300">GH₵{Number(order.totalAmount || 0).toFixed(2)}</span>
              </span>
              <span className="text-white font-bold">
                Now <span className="font-mono">GH₵{fromCents(preview.totalCents)}</span>
              </span>
              <span className="text-xs text-neutral-500">
                (subtotal GH₵{fromCents(preview.subtotalCents)} + VAT GH₵{fromCents(preview.taxCents)}
                {preview.roomChargeCents > 0 ? ` + room charge GH₵${fromCents(preview.roomChargeCents)}` : ""}
                {preview.discountCents > 0 ? ` − discount GH₵${fromCents(preview.discountCents)}` : ""}
                {preview.tipCents > 0 ? ` + tip GH₵${fromCents(preview.tipCents)}` : ""})
              </span>
              {collectedCents > 0 && dueCents > 0 && (
                <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold text-xs">
                  Collect {money(dueCents)} more from the guest
                </span>
              )}
              {collectedCents > 0 && dueCents < 0 && (
                <span className="px-3 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 font-semibold text-xs">
                  Below the {money(collectedCents)} already collected — refund this order and ring up the correct bill
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3.5">
            <button onClick={onClose} disabled={saving} className="h-14 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-base font-bold transition active:scale-[0.98] disabled:opacity-40">
              Cancel
            </button>
            <button onClick={save} disabled={saving || loading || !!loadError || dueCents < 0} className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-base font-bold transition active:scale-[0.98] disabled:opacity-40">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
