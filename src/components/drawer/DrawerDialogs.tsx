"use client";

import React from "react";
import { ArrowDownRight, Lock, Unlock } from "lucide-react";
import { Dialog, DialogHeader, btnDanger, btnPrimary, btnSecondary, fieldCls, labelCls } from "@/components/ui/NewDialog";

/**
 * The cash drawer's dialogs in the new design (redesign stage 4d): open a
 * shift, record a payout, count and close. Presentation only: every field is
 * ShiftCashDrawer's state, every submit its handler, and the figures (float,
 * cash sales, cash out, expected) are the ones it computes.
 */

const cedi = (n: number) => `GH₵${n.toFixed(2)}`;

export function OpenShiftDialog(p: {
  startsWithCash: boolean;
  onStartsWithCash: (v: boolean) => void;
  float: string;
  onFloat: (v: string) => void;
  notes: string;
  onNotes: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog label="Open my shift" onClose={p.onCancel} width="max-w-md">
      <form onSubmit={p.onSubmit} className="p-5 space-y-4">
        <DialogHeader icon={<Unlock className="w-5 h-5" />} title="Open my shift" sub="Sales you ring from now land on this shift." onClose={p.onCancel} />
        <div className="rounded-xl bg-ui-success-soft text-ui-success px-4 py-3 flex items-baseline justify-between">
          <span className="text-sm font-bold">Opening float</span>
          <span className="text-2xl font-bold font-mono">{cedi(p.startsWithCash ? Number(p.float || 0) : 0)}</span>
        </div>
        <p className="text-sm text-ui-text-2">Shifts here normally start with an empty drawer, recorded as a float of GH₵0.00.</p>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-ui-border px-3">
          <input type="checkbox" checked={p.startsWithCash} onChange={(e) => p.onStartsWithCash(e.target.checked)} className="h-5 w-5 accent-[var(--ui-primary)]" />
          <span className="text-sm font-semibold">The drawer starts with cash</span>
        </label>
        {p.startsWithCash && (
          <label className="block">
            <span className={labelCls}>Starting float (GH₵)</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" required autoFocus value={p.float} onChange={(e) => p.onFloat(e.target.value)} className={`${fieldCls} font-mono text-lg font-bold`} />
          </label>
        )}
        <label className="block">
          <span className={labelCls}>Shift notes (optional)</span>
          <input value={p.notes} onChange={(e) => p.onNotes(e.target.value)} placeholder="e.g. lunch shift, till 1" className={fieldCls} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary}>
            Open shift
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function PayoutDialog(p: {
  amount: string;
  onAmount: (v: string) => void;
  reason: string;
  onReason: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const reasons = ["Market shopping", "Ice", "Gas refill", "Safe drop", "Staff advance"];
  return (
    <Dialog label="Cash drop or payout" onClose={p.onCancel} width="max-w-md">
      <form onSubmit={p.onSubmit} className="p-5 space-y-4">
        <DialogHeader icon={<ArrowDownRight className="w-5 h-5" />} tone="danger" title="Cash drop / payout" sub="Cash taken out of the drawer for something other than a refund." onClose={p.onCancel} />
        <label className="block">
          <span className={labelCls}>Amount (GH₵)</span>
          <input type="number" inputMode="decimal" step="0.01" min="0.01" required autoFocus placeholder="0.00" value={p.amount} onChange={(e) => p.onAmount(e.target.value)} className={`${fieldCls} font-mono text-lg font-bold`} />
        </label>
        <label className="block">
          <span className={labelCls}>What it was for</span>
          <input required value={p.reason} onChange={(e) => p.onReason(e.target.value)} placeholder="e.g. tomatoes from the market, ice block" className={fieldCls} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <button key={r} type="button" onClick={() => p.onReason(r)} className="h-10 px-3 rounded-full border border-ui-border text-[0.8125rem] font-semibold text-ui-text-2 hover:bg-ui-subtle">
              {r}
            </button>
          ))}
        </div>
        <p className="text-[0.8125rem] text-ui-muted">Refunds are taken off the drawer automatically. Do not record them here.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnDanger}>
            Record payout
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function CloseShiftDialog(p: {
  forColleague: string | null;
  opening: number;
  cashSales: number;
  outflows: number;
  expected: number;
  counted: string;
  onCounted: (v: string) => void;
  notes: string;
  onNotes: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const counted = Number(p.counted || 0);
  const variance = counted - p.expected;
  const exact = Math.abs(variance) < 0.01;
  return (
    <Dialog label="Count and close the shift" onClose={p.onCancel} width="max-w-md">
      <form onSubmit={p.onSubmit} className="p-5 space-y-4">
        <DialogHeader icon={<Lock className="w-5 h-5" />} title={p.forColleague ? `Close ${p.forColleague}'s shift` : "Count & close my shift"} sub="Count the notes and coins in the drawer and enter the total." onClose={p.onCancel} />
        {p.forColleague && (
          <p className="rounded-lg bg-ui-primary-soft text-ui-primary-text px-3 py-2 text-sm">
            Count the cash <b>{p.forColleague}</b> hands over and enter it below.
          </p>
        )}
        <dl className="rounded-xl border border-ui-border divide-y divide-ui-border text-sm">
          <div className="flex justify-between px-3 py-2">
            <dt className="text-ui-muted">Opening float</dt>
            <dd className="font-mono">{cedi(p.opening)}</dd>
          </div>
          <div className="flex justify-between px-3 py-2">
            <dt className="text-ui-muted">Cash sales</dt>
            <dd className="font-mono text-ui-success">+{cedi(p.cashSales)}</dd>
          </div>
          <div className="flex justify-between px-3 py-2">
            <dt className="text-ui-muted">Cash out (payouts, refunds)</dt>
            <dd className="font-mono text-ui-danger">−{cedi(p.outflows)}</dd>
          </div>
          <div className="flex justify-between px-3 py-2.5 bg-ui-subtle font-bold">
            <dt>Should be in the drawer</dt>
            <dd className="font-mono text-ui-primary-text">{cedi(p.expected)}</dd>
          </div>
        </dl>
        <label className="block">
          <span className={labelCls}>Cash counted (GH₵)</span>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" step="0.01" min="0" required autoFocus value={p.counted} onChange={(e) => p.onCounted(e.target.value)} className={`${fieldCls} font-mono text-lg font-bold`} />
            <button type="button" onClick={() => p.onCounted(p.expected.toFixed(2))} className={`${btnSecondary} shrink-0`}>
              Exact
            </button>
          </div>
        </label>
        <div
          role="status"
          className={`rounded-lg px-3 py-2.5 text-sm font-bold flex justify-between ${exact ? "bg-ui-success-soft text-ui-success" : variance > 0 ? "bg-ui-info-soft text-ui-info" : "bg-ui-danger-soft text-ui-danger"}`}
        >
          <span>{exact ? "Drawer balances" : variance > 0 ? "Over" : "Short"}</span>
          <span className="font-mono">{exact ? cedi(0) : `${variance > 0 ? "+" : "−"}${cedi(Math.abs(variance))}`}</span>
        </div>
        <label className="block">
          <span className={labelCls}>Notes {exact ? "(optional)" : "(say why it is over or short)"}</span>
          <input value={p.notes} onChange={(e) => p.onNotes(e.target.value)} placeholder="e.g. hand-over to the evening shift" className={fieldCls} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary}>
            Close shift
          </button>
        </div>
      </form>
    </Dialog>
  );
}
