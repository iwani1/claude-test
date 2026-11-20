"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { CheckCircle2, Coffee, Delete, Percent, Smartphone, Unlock, Wallet, X } from "lucide-react";
import { DynamicButton } from "@/components/interface-studies";

/**
 * The till's pop-ups drawn in the new design (redesign stage 2b): dish
 * options, payment, discount, complimentary breakfast and the shift gate.
 *
 * Presentation only. Every field reads and writes PosTerminal's own state, and
 * every confirm calls PosTerminal's own handler, so the classic and new pop-ups
 * cannot disagree about a price, a payment rule or an approval. The payment
 * confirm keeps the classic rule exactly (see `paymentBlocked`).
 */

const cedi = (n: number) => `GH₵${n.toFixed(2)}`;

/** Overlay + panel with Escape to close and focus moved into the dialog. */
function Dialog({
  label,
  onClose,
  width = "max-w-lg",
  children,
}: {
  label: string;
  onClose: () => void;
  width?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`w-full ${width} my-auto rounded-2xl bg-ui-surface text-ui-text border border-ui-border shadow-2xl outline-none max-h-[94dvh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-11 h-11 rounded-full text-ui-muted hover:text-ui-text hover:bg-ui-subtle flex items-center justify-center shrink-0"
    >
      <X className="w-5 h-5" />
    </button>
  );
}

const tile = (on: boolean) =>
  `rounded-xl border-2 transition text-left ${
    on ? "border-ui-primary bg-ui-primary-soft text-ui-primary-text" : "border-ui-border bg-ui-surface text-ui-text hover:border-ui-border-strong"
  }`;
const fieldCls =
  "w-full h-12 rounded-lg border border-ui-border-strong bg-ui-surface px-3 text-ui-text placeholder:text-ui-muted focus:outline-none focus:border-ui-primary";
const btnSecondary =
  "h-12 px-4 rounded-lg border border-ui-border-strong bg-ui-surface text-ui-text text-sm font-semibold hover:bg-ui-subtle transition";
const btnPrimary =
  "h-12 px-5 rounded-lg bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed";

/* ------------------------------------------------------------------------ */
/* Dish options                                                              */
/* ------------------------------------------------------------------------ */

const NOTE_CHIPS = ["No pepper", "Mild", "Extra pepper", "Extra shito", "No onions", "No ice", "Serve first"];

export function DishOptionsDialog({
  item,
  selections,
  onSelections,
  notes,
  onNotes,
  onCancel,
  onAdd,
}: {
  item: any;
  selections: Record<string, any>;
  onSelections: (s: Record<string, any>) => void;
  notes: string;
  onNotes: (v: string) => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  const extra = Object.values(selections).reduce((s: number, o: any) => s + Number(o?.priceDelta || 0), 0);
  const unit = Number(item.price) + extra;
  const noteList = notes
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const toggleChip = (chip: string) => {
    const has = noteList.includes(chip);
    onNotes((has ? noteList.filter((n) => n !== chip) : [...noteList, chip]).join(", "));
  };
  return (
    <Dialog label={`Options for ${item.name}`} onClose={onCancel} width="max-w-2xl">
      <div className="grid md:grid-cols-[14rem_1fr]">
        <div className="relative h-48 md:h-full min-h-48 bg-ui-subtle md:rounded-l-2xl overflow-hidden">
          {item.imageUrl ? (
            <Image unoptimized width={448} height={448} src={item.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-ui-muted">
              <Coffee className="w-10 h-10" />
            </span>
          )}
        </div>
        <div className="p-5 flex flex-col gap-4 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold leading-tight">{item.name}</h3>
              {item.description && <p className="text-sm text-ui-muted mt-1 leading-relaxed">{item.description}</p>}
              <p className="text-sm font-semibold text-ui-text-2 mt-1">From {cedi(Number(item.price))}</p>
            </div>
            <CloseButton onClick={onCancel} />
          </div>

          {(item.modifiers || []).map((mod: any) => (
            <fieldset key={mod.id}>
              <legend className="w-full flex items-center justify-between text-sm font-bold mb-2">
                <span>{mod.name}</span>
                {mod.isRequired && <span className="text-xs font-bold text-ui-danger">Required</span>}
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(mod.options || []).map((opt: any) => {
                  const on = selections[mod.id]?.id === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onSelections({ ...selections, [mod.id]: on ? null : opt })}
                      className={`${tile(on)} min-h-14 px-3 py-2`}
                    >
                      <span className="block text-sm font-bold leading-tight">{opt.name}</span>
                      <span className="block text-xs font-semibold mt-0.5 opacity-80">
                        {Number(opt.priceDelta) > 0 ? `+${cedi(Number(opt.priceDelta))}` : "No extra"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div>
            <label htmlFor="dish-notes" className="block text-sm font-bold mb-2">
              Kitchen note
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {NOTE_CHIPS.map((chip) => {
                const on = noteList.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleChip(chip)}
                    className={`h-10 px-3 rounded-full border text-[0.8125rem] font-semibold transition ${
                      on ? "border-ui-primary bg-ui-primary-soft text-ui-primary-text" : "border-ui-border text-ui-text-2 hover:bg-ui-subtle"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            <textarea
              id="dish-notes"
              rows={2}
              value={notes}
              onChange={(e) => onNotes(e.target.value)}
              placeholder="Anything else for the kitchen (prints on the docket)"
              className="w-full rounded-lg border border-ui-border-strong bg-ui-surface p-3 text-sm text-ui-text placeholder:text-ui-muted focus:outline-none focus:border-ui-primary"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-ui-border">
            <span className="text-xl font-bold font-mono text-ui-primary-text">{cedi(unit)}</span>
            <div className="flex gap-2">
              <button type="button" onClick={onCancel} className={btnSecondary}>
                Cancel
              </button>
              <button type="button" onClick={onAdd} className={btnPrimary}>
                Add to order
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* Payment                                                                   */
/* ------------------------------------------------------------------------ */

export type PayMethod = "cash" | "momo" | "split";

/** The classic till's rule for when payment can be confirmed, unchanged. */
export function paymentBlocked(method: PayMethod, total: number, cashTendered: string, splitCash: string, splitMomo: string) {
  return (
    (method === "cash" && Number(cashTendered || 0) < total - 0.01) ||
    (method === "split" &&
      (Number(splitCash || 0) <= 0 || Number(splitMomo || 0) <= 0 || Number(splitCash || 0) + Number(splitMomo || 0) < total - 0.01))
  );
}

/** Appends a keypad press to an amount typed in cedis ("12.5" → "12.50"). */
function keyed(current: string, key: string) {
  if (key === "del") return current.slice(0, -1);
  if (key === "clear") return "";
  if (key === ".") return current.includes(".") ? current : (current || "0") + ".";
  const next = current === "0" ? key : current + key;
  const [, dec] = next.split(".");
  if (dec && dec.length > 2) return current;
  return next.length > 9 ? current : next;
}

export function PaymentDialog(p: {
  totalAmount: number;
  summary: { label: string; value: string; tone?: "muted" | "primary" | "success" | "info" }[];
  orderLabel: string;
  method: PayMethod;
  onMethod: (m: PayMethod) => void;
  cashTendered: string;
  onCashTendered: (v: string) => void;
  momoRef: string;
  onMomoRef: (v: string) => void;
  splitCash: string;
  onSplitCash: (v: string) => void;
  splitMomo: string;
  onSplitMomo: (v: string) => void;
  splitCashTendered: string;
  onSplitCashTendered: (v: string) => void;
  onSplitEvenly: () => void;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const total = p.totalAmount;
  const blocked = paymentBlocked(p.method, total, p.cashTendered, p.splitCash, p.splitMomo);
  // Which amount the keypad types into.
  const [target, setTarget] = React.useState<"tendered" | "splitCash" | "splitHanded">("tendered");
  const activeTarget = p.method === "cash" ? "tendered" : p.method === "split" ? (target === "tendered" ? "splitCash" : target) : null;

  // Typing the cash part keeps the MoMo part in step, as on the classic till.
  const setSplitCash = (v: string) => {
    p.onSplitCash(v);
    const c = Number(v || 0);
    if (c >= 0 && c <= total) p.onSplitMomo((total - c).toFixed(2));
  };
  const setSplitMomo = (v: string) => {
    p.onSplitMomo(v);
    const m = Number(v || 0);
    if (m >= 0 && m <= total) p.onSplitCash((total - m).toFixed(2));
  };
  const press = (key: string) => {
    if (activeTarget === "tendered") p.onCashTendered(keyed(p.cashTendered, key));
    else if (activeTarget === "splitCash") setSplitCash(keyed(p.splitCash, key));
    else if (activeTarget === "splitHanded") p.onSplitCashTendered(keyed(p.splitCashTendered, key));
  };

  const change = Math.max(0, Number(p.cashTendered || 0) - total);
  const short = Math.max(0, total - Number(p.cashTendered || 0));
  const covered = Number(p.splitCash || 0) + Number(p.splitMomo || 0);
  const remaining = total - covered;
  const handed = Number(p.splitCashTendered || p.splitCash || 0);
  const splitChange = handed > Number(p.splitCash || 0) ? handed - Number(p.splitCash || 0) : 0;

  const methods: [PayMethod, string, string, typeof Wallet][] = [
    ["cash", "Cash", "Notes & change", Wallet],
    ["momo", "MoMo", "Check the phone", Smartphone],
    ["split", "Cash + MoMo", "Split the bill", Percent],
  ];
  const amountBox = (on: boolean) =>
    `w-full text-left rounded-xl border-2 px-3 py-2 transition ${on ? "border-ui-primary bg-ui-primary-soft" : "border-ui-border bg-ui-surface"}`;

  return (
    <Dialog label="Take payment" onClose={p.onClose} width="max-w-4xl">
      <div className="grid md:grid-cols-2">
        {/* Summary and method */}
        <div className="p-5 border-b md:border-b-0 md:border-r border-ui-border flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-bold">Take payment</h3>
              <p className="text-sm text-ui-muted">{p.orderLabel}</p>
            </div>
            <CloseButton onClick={p.onClose} />
          </div>
          <div className="rounded-xl bg-ui-primary-soft px-4 py-3 flex items-baseline justify-between">
            <span className="text-sm font-bold text-ui-primary-text">Amount to be paid</span>
            <span className="text-2xl font-bold font-mono text-ui-primary-text">{cedi(total)}</span>
          </div>
          <dl className="space-y-1 text-sm">
            {p.summary.map((row) => (
              <div key={row.label} className="flex justify-between">
                <dt className="text-ui-muted">{row.label}</dt>
                <dd
                  className={`font-mono ${
                    row.tone === "primary" ? "text-ui-primary-text" : row.tone === "success" ? "text-ui-success" : row.tone === "info" ? "text-ui-info" : "text-ui-text-2"
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <div>
            <div className="text-sm font-bold mb-2">Payment type</div>
            <div role="radiogroup" aria-label="Payment type" className="grid grid-cols-3 gap-2">
              {methods.map(([m, label, sub, Icon]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={p.method === m}
                  onClick={() => {
                    p.onMethod(m);
                    setTarget(m === "split" ? "splitCash" : "tendered");
                  }}
                  className={`${tile(p.method === m)} h-20 px-2 flex flex-col items-center justify-center gap-1 text-center`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-bold leading-none">{label}</span>
                  <span className="text-[0.6875rem] opacity-80">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tender */}
        <div className="p-5 flex flex-col gap-3">
          {p.method === "cash" && (
            <>
              <div className={amountBox(true)}>
                <div className="text-xs font-bold text-ui-muted">CASH GIVEN BY THE GUEST</div>
                <input
                  aria-label="Cash given by the guest, in cedis"
                  inputMode="decimal"
                  value={p.cashTendered}
                  onChange={(e) => p.onCashTendered(e.target.value)}
                  className="w-full bg-transparent text-3xl font-bold font-mono text-ui-text outline-none"
                />
              </div>
              {/* responsive-ok: new layout only (64rem+ screens); four short note labels */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["Exact", total.toFixed(2)],
                  ["GH₵100", "100"],
                  ["GH₵200", "200"],
                  ["GH₵500", "500"],
                ].map(([l, v]) => (
                  <button key={l} type="button" onClick={() => p.onCashTendered(v)} className={`${btnSecondary} px-1`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className={`flex justify-between items-baseline text-base font-bold ${short > 0.005 ? "text-ui-danger" : "text-ui-success"}`}>
                <span>{short > 0.005 ? "Still short" : "Change to give"}</span>
                <span className="font-mono text-lg">{cedi(short > 0.005 ? short : change)}</span>
              </div>
            </>
          )}

          {p.method === "momo" && (
            <>
              <div className="rounded-xl border border-ui-border bg-ui-subtle p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-ui-success">
                  <CheckCircle2 className="w-4 h-4" /> Check the MoMo transfer on the till phone first
                </div>
                <div className="flex justify-between items-baseline mt-2">
                  <span className="text-sm text-ui-muted">MoMo expected</span>
                  <span className="text-xl font-bold font-mono">{cedi(total)}</span>
                </div>
              </div>
              <label className="block">
                <span className="block text-sm font-bold mb-1">MoMo reference or sender (optional)</span>
                <input value={p.momoRef} onChange={(e) => p.onMomoRef(e.target.value)} placeholder="e.g. sender name or transaction ID" className={fieldCls} />
              </label>
            </>
          )}

          {p.method === "split" && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Cash + MoMo</span>
                <button type="button" onClick={p.onSplitEvenly} className="h-10 px-3 rounded-lg border border-ui-border-strong text-[0.8125rem] font-semibold text-ui-text-2 hover:bg-ui-subtle">
                  50 / 50
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={amountBox(activeTarget === "splitCash")} onClick={() => setTarget("splitCash")}>
                  <div className="text-xs font-bold text-ui-muted">CASH PART</div>
                  <input
                    aria-label="Cash part, in cedis"
                    inputMode="decimal"
                    value={p.splitCash}
                    onFocus={() => setTarget("splitCash")}
                    onChange={(e) => setSplitCash(e.target.value)}
                    className="w-full bg-transparent text-xl font-bold font-mono text-ui-text outline-none"
                  />
                </div>
                <div className={amountBox(false)}>
                  <div className="text-xs font-bold text-ui-muted">MOMO PART</div>
                  <input
                    aria-label="MoMo part, in cedis"
                    inputMode="decimal"
                    value={p.splitMomo}
                    onChange={(e) => setSplitMomo(e.target.value)}
                    className="w-full bg-transparent text-xl font-bold font-mono text-ui-text outline-none"
                  />
                </div>
              </div>
              <div className={amountBox(activeTarget === "splitHanded")} onClick={() => setTarget("splitHanded")}>
                <div className="text-xs font-bold text-ui-muted">CASH HANDED OVER</div>
                <input
                  aria-label="Cash handed over, in cedis"
                  inputMode="decimal"
                  value={p.splitCashTendered}
                  placeholder={p.splitCash || "0.00"}
                  onFocus={() => setTarget("splitHanded")}
                  onChange={(e) => p.onSplitCashTendered(e.target.value)}
                  className="w-full bg-transparent text-xl font-bold font-mono text-ui-text placeholder:text-ui-muted outline-none"
                />
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-ui-muted">Covered</span>
                  <span className={`font-mono font-bold ${Math.abs(remaining) < 0.01 ? "text-ui-success" : "text-ui-primary-text"}`}>
                    {cedi(covered)} / {cedi(total)}
                  </span>
                </div>
                {remaining > 0.01 && (
                  <div className="flex justify-between font-bold text-ui-danger">
                    <span>Still owed</span>
                    <span className="font-mono">{cedi(remaining)}</span>
                  </div>
                )}
                {splitChange > 0 && (
                  <div className="flex justify-between font-bold text-ui-success">
                    <span>Cash change to give</span>
                    <span className="font-mono">{cedi(splitChange)}</span>
                  </div>
                )}
              </div>
              <label className="block">
                <span className="block text-sm font-bold mb-1">MoMo reference or sender (optional)</span>
                <input value={p.momoRef} onChange={(e) => p.onMomoRef(e.target.value)} placeholder="e.g. sender name or transaction ID" className={fieldCls} />
              </label>
            </>
          )}

          {activeTarget && (
            <div className="grid grid-cols-3 gap-2" aria-label="Keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  aria-label={k === "del" ? "Delete" : k === "." ? "Decimal point" : k}
                  className="h-12 rounded-lg border border-ui-border bg-ui-subtle text-ui-text text-xl font-semibold flex items-center justify-center active:scale-95 transition"
                >
                  {k === "del" ? <Delete className="w-5 h-5" /> : k}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1" />
          <DynamicButton
            onClick={p.onConfirm}
            busy={p.isSubmitting}
            busyLabel="Recording payment…"
            fullWidth
            icon={<CheckCircle2 className="w-5 h-5" />}
            disabled={blocked}
            className="w-full h-14 px-4 rounded-xl bg-ui-primary hover:bg-ui-primary-hover text-ui-on-primary font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.99]"
          >
            {p.method === "momo"
              ? `Confirm MoMo payment · ${cedi(total)}`
              : p.method === "cash"
                ? `Confirm cash payment · ${cedi(total)}`
                : `Confirm ${cedi(Number(p.splitCash || 0))} cash + ${cedi(Number(p.splitMomo || 0))} MoMo`}
          </DynamicButton>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* Discount                                                                  */
/* ------------------------------------------------------------------------ */

export function DiscountDialog(p: {
  percent: number;
  onPercent: (v: number) => void;
  amount: number;
  onAmount: (v: number) => void;
  reason: string;
  onReason: (v: string) => void;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog label="Order discount" onClose={p.onApply} width="max-w-md">
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold">Order discount</h3>
            <p className="text-sm text-ui-muted">A percentage or a fixed amount, with a reason.</p>
          </div>
          <CloseButton onClick={p.onApply} />
        </div>
        <div>
          <div className="text-sm font-bold mb-2">Percentage</div>
          {/* responsive-ok: new layout only (64rem+ screens); four "5%"-size labels */}
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((pct) => (
              <button
                key={pct}
                type="button"
                aria-pressed={p.percent === pct}
                onClick={() => {
                  p.onPercent(pct);
                  p.onAmount(0);
                }}
                className={`${tile(p.percent === pct)} h-12 text-center text-sm font-bold`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="block text-sm font-bold mb-1">Or a fixed amount (GH₵)</span>
          <input
            type="number"
            inputMode="decimal"
            step="1.0"
            value={p.amount || ""}
            onChange={(e) => {
              p.onAmount(Number(e.target.value));
              p.onPercent(0);
            }}
            placeholder="0.00"
            className={`${fieldCls} font-mono`}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-bold mb-1">Reason</span>
          <input value={p.reason} onChange={(e) => p.onReason(e.target.value)} placeholder="e.g. guest discount, staff meal" className={fieldCls} />
        </label>
        <div className="flex justify-between gap-2 pt-3 border-t border-ui-border">
          <button type="button" onClick={p.onClear} className="h-12 px-3 rounded-lg text-sm font-semibold text-ui-danger hover:bg-ui-danger-soft">
            Remove discount
          </button>
          <button type="button" onClick={p.onApply} className={btnPrimary}>
            Apply
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* Complimentary breakfast                                                    */
/* ------------------------------------------------------------------------ */

export function CompDialog(p: {
  reason: string;
  onReason: (v: string) => void;
  foodValue: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog label="Complimentary breakfast" onClose={p.onCancel} width="max-w-md">
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-xl bg-ui-info-soft text-ui-info flex items-center justify-center shrink-0">
            <Coffee className="w-6 h-6" />
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-bold">Complimentary breakfast</h3>
            <p className="text-sm text-ui-muted">The guest pays GH₵0.00.</p>
          </div>
          <CloseButton onClick={p.onCancel} />
        </div>
        <div className="rounded-xl bg-ui-info-soft text-ui-info p-3 text-sm space-y-1">
          <p>
            The order is recorded at <b>GH₵0.00</b>: no VAT and no room charge.
          </p>
          <p>Stock is still deducted and the kitchen docket still prints. Every comp is written to the audit log.</p>
        </div>
        <label className="block">
          <span className="block text-sm font-bold mb-1">Reason (printed on the docket)</span>
          <input value={p.reason} onChange={(e) => p.onReason(e.target.value)} className={fieldCls} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {["Room guest breakfast", "Manager comp", "Goodwill / complaint", "Staff meal"].map((r) => (
            <button key={r} type="button" onClick={() => p.onReason(r)} className="h-10 px-3 rounded-full border border-ui-border text-[0.8125rem] font-semibold text-ui-text-2 hover:bg-ui-subtle">
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-sm pt-3 border-t border-ui-border">
          <span className="text-ui-muted">Food value given free</span>
          <span className="font-mono font-bold text-ui-primary-text">{cedi(p.foodValue)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="button" onClick={p.onConfirm} className="h-12 rounded-lg bg-ui-info text-ui-surface text-sm font-bold">
            Mark as comp
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------ */
/* Shift gate                                                                */
/* ------------------------------------------------------------------------ */

export function ShiftGateDialog(p: {
  staffName: string;
  startsWithCash: boolean;
  onStartsWithCash: (v: boolean) => void;
  float: string;
  onFloat: (v: string) => void;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog label="Open your shift" onClose={p.onCancel} width="max-w-md">
      <form onSubmit={p.onSubmit} className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-ui-primary-soft text-ui-primary-text flex items-center justify-center shrink-0">
            <Unlock className="w-5 h-5" />
          </span>
          <h3 className="flex-1 text-lg font-bold">Open your shift first</h3>
        </div>
        <p className="text-sm text-ui-text-2 leading-relaxed">
          {p.staffName}, every sale you ring lands on <b>your own shift</b>: your float, your cash sales, your count at closing.
          Shifts here normally start with an empty drawer, recorded as an opening float of <b>GH₵0.00</b>.
        </p>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-ui-border px-3">
          <input type="checkbox" checked={p.startsWithCash} onChange={(e) => p.onStartsWithCash(e.target.checked)} className="h-5 w-5 accent-[var(--ui-primary)]" />
          <span className="text-sm font-semibold">The drawer starts with cash</span>
        </label>
        {p.startsWithCash && (
          <label className="block">
            <span className="block text-sm font-bold mb-1">Opening float (GH₵)</span>
            <input
              type="number"
              inputMode="decimal"
              step="10.00"
              min="0"
              autoFocus
              value={p.float}
              onChange={(e) => p.onFloat(e.target.value)}
              placeholder="0.00"
              className={`${fieldCls} font-mono text-lg font-bold`}
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onCancel} className={btnSecondary}>
            Not yet
          </button>
          <button type="submit" disabled={p.busy} className={btnPrimary}>
            {p.busy ? "Opening…" : p.startsWithCash ? "Open shift & sell" : "Open shift, zero float"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
