"use client";

import React from "react";
import { Eye, ShieldCheck } from "lucide-react";
import { Dialog, DialogHeader, btnDanger, btnSecondary, fieldCls, labelCls } from "@/components/ui/NewDialog";

/**
 * Order history's dialogs in the new design (redesign stage 4d): order
 * details, and the manager-approved refund. Presentation only: the details
 * are the order the server returned, and the refund form is OrdersHistory's
 * own state and submit (idempotency key, tender caps, the lock that only
 * allows retrying the same refund after an unknown result).
 */

const cedi = (v: unknown) => `GH₵${Number(v || 0).toFixed(2)}`;
const docketNo = (orderNumber: string) => `K-${String(orderNumber).slice(-4)}`;
const TYPE_LABEL: Record<string, string> = { dine_in: "Dine in", takeaway: "Takeaway", delivery: "Delivery", room_service: "Room service" };
const words = (v: unknown) => String(v || "").replace(/_/g, " ");

export function OrderDetailsDialog({ order, tables, onClose }: { order: any; tables: any[]; onClose: () => void }) {
  const table = order.tableId != null ? tables.find((t: any) => t.id === order.tableId) : null;
  const place =
    order.orderType === "dine_in"
      ? table
        ? /^\d+$/.test(String(table.tableNumber))
          ? `Table ${table.tableNumber}`
          : table.tableNumber
        : "No table"
      : order.orderType === "room_service"
        ? `Room ${order.roomNumber || "—"}`
        : null;
  const due = Number(order.totalAmount) - Number(order.paidAmount);
  const pb = order.paymentBreakdown || {};
  const facts: [string, React.ReactNode][] = [
    ["Date & time", new Date(order.createdAt).toLocaleString("en-GH")],
    ["Type", `${TYPE_LABEL[order.orderType] ?? words(order.orderType)}${place ? ` · ${place}` : ""}`],
    ["Guest", order.customerName || "Walk-in Guest"],
    ["Rung by", order.userName || "Unknown"],
    ["Kitchen", <span key="s" className="capitalize">{words(order.status)}</span>],
    ["Payment", <span key="p" className="capitalize">{words(order.paymentStatus)}</span>],
  ];
  return (
    <Dialog label={`Order ${docketNo(order.orderNumber)} details`} onClose={onClose} width="max-w-lg">
      <div className="p-5 space-y-4">
        <DialogHeader
          icon={<Eye className="w-5 h-5" />}
          title={`Order ${docketNo(order.orderNumber)}`}
          sub={<span className="font-mono break-all text-xs">{order.orderNumber}</span>}
          onClose={onClose}
        />
        <dl className="grid grid-cols-2 gap-2">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-ui-subtle px-3 py-2">
              <dt className="text-xs font-semibold text-ui-muted">{k}</dt>
              <dd className="text-sm font-semibold mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <div className="text-sm font-bold mb-1.5">Items</div>
          <ul className="rounded-lg border border-ui-border divide-y divide-ui-border">
            {(order.items || []).map((it: any, i: number) => (
              <li key={it.id ?? i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{it.itemName || it.name}</span>
                  <span className="block text-xs text-ui-muted">
                    {cedi(it.unitPrice ?? it.price)} each{it.specialInstructions ? ` · Note: ${it.specialInstructions}` : ""}
                  </span>
                </span>
                <span className="font-semibold">× {it.quantity}</span>
                <span className="w-20 text-right font-mono font-bold">{cedi(it.totalPrice ?? Number(it.unitPrice ?? 0) * Number(it.quantity ?? 1))}</span>
              </li>
            ))}
            {(order.items || []).length === 0 && <li className="px-3 py-3 text-sm text-ui-muted">No items</li>}
          </ul>
        </div>
        {order.notes && <p className="rounded-lg bg-ui-primary-soft text-ui-primary-text px-3 py-2 text-sm">Order note: {order.notes}</p>}
        <dl className="space-y-1 text-sm border-t border-ui-border pt-3">
          <div className="flex justify-between text-base font-bold">
            <dt>Total</dt>
            <dd className="font-mono">{cedi(order.totalAmount)}</dd>
          </div>
          <div className="flex justify-between text-ui-text-2">
            <dt>Paid</dt>
            <dd className="font-mono">{cedi(order.paidAmount)}</dd>
          </div>
          {Number(pb.cash) > 0 && (
            <div className="flex justify-between text-ui-success">
              <dt>· in cash</dt>
              <dd className="font-mono">{cedi(pb.cash)}</dd>
            </div>
          )}
          {Number(pb.momo) > 0 && (
            <div className="flex justify-between text-ui-info">
              <dt>· by MoMo</dt>
              <dd className="font-mono">{cedi(pb.momo)}</dd>
            </div>
          )}
          {Number(pb.other) > 0 && (
            <div className="flex justify-between text-ui-text-2">
              <dt>· other</dt>
              <dd className="font-mono">{cedi(pb.other)}</dd>
            </div>
          )}
          {Number(order.refundedAmount) > 0 && (
            <div className="flex justify-between text-ui-danger">
              <dt>
                Refunded
                {(Number(pb.refundedCash) > 0 || Number(pb.refundedMomo) > 0) && ` (cash ${cedi(pb.refundedCash)} · MoMo ${cedi(pb.refundedMomo)})`}
              </dt>
              <dd className="font-mono">{cedi(order.refundedAmount)}</dd>
            </div>
          )}
          {due > 0 && (
            <div className="flex justify-between font-bold text-ui-danger">
              <dt>Still to pay</dt>
              <dd className="font-mono">{cedi(due)}</dd>
            </div>
          )}
        </dl>
        {(pb.payments || []).length > 0 && (
          <div>
            <div className="text-sm font-bold mb-1.5">Payments received</div>
            <ul className="rounded-lg border border-ui-border divide-y divide-ui-border">
              {pb.payments.map((pay: any, i: number) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 text-[0.8125rem]">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pay.method === "cash" ? "bg-ui-success-soft text-ui-success" : pay.method === "momo" ? "bg-ui-info-soft text-ui-info" : "bg-ui-subtle text-ui-text-2"}`}>
                    {pay.method === "momo" ? "MoMo" : words(pay.method)}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-ui-text-2">
                    {new Date(pay.createdAt).toLocaleString("en-GH")}
                    {pay.referenceNumber ? ` · Ref ${pay.referenceNumber}` : ""}
                  </span>
                  <span className="font-mono font-bold">{cedi(pay.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" onClick={onClose} className={`${btnSecondary} w-full`}>
          Close
        </button>
      </div>
    </Dialog>
  );
}

export function RefundDialog(p: {
  order: any;
  limits: { cashRemaining: string; momoRemaining: string };
  cash: string;
  onCash: (v: string) => void;
  momo: string;
  onMomo: (v: string) => void;
  reason: string;
  onReason: (v: string) => void;
  pin: string;
  onPin: (v: string) => void;
  returnStock: boolean;
  onReturnStock: (v: boolean) => void;
  locked: boolean;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const total = Number(p.cash || 0) + Number(p.momo || 0);
  return (
    <Dialog label="Refund with manager approval" onClose={p.onCancel} width="max-w-md">
      <form onSubmit={p.onSubmit} className="p-5 space-y-4">
        <DialogHeader
          icon={<ShieldCheck className="w-5 h-5" />}
          tone="danger"
          title="Refund"
          sub={`Order ${docketNo(p.order.orderNumber)} · total ${cedi(p.order.totalAmount)}`}
          onClose={p.onCancel}
        />
        <p className="rounded-lg bg-ui-primary-soft text-ui-primary-text px-3 py-2 text-sm">
          Record the money actually given back. Cash comes off the current drawer automatically, so do not add a payout. Send a MoMo refund and check it separately.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={labelCls}>Cash back</span>
            <input aria-label="Cash refund" type="number" inputMode="decimal" min="0" step="0.01" max={p.limits.cashRemaining} required disabled={p.locked} value={p.cash} onChange={(e) => p.onCash(e.target.value)} className={`${fieldCls} font-mono font-bold`} />
            <span className="text-xs text-ui-muted">up to {cedi(p.limits.cashRemaining)}</span>
          </label>
          <label className="block">
            <span className={labelCls}>MoMo back</span>
            <input aria-label="MoMo refund" type="number" inputMode="decimal" min="0" step="0.01" max={p.limits.momoRemaining} required disabled={p.locked} value={p.momo} onChange={(e) => p.onMomo(e.target.value)} className={`${fieldCls} font-mono font-bold`} />
            <span className="text-xs text-ui-muted">up to {cedi(p.limits.momoRemaining)}</span>
          </label>
        </div>
        <div className="flex justify-between text-sm font-bold rounded-lg bg-ui-subtle px-3 py-2">
          <span>Refund total</span>
          <span className="font-mono">{cedi(total)}</span>
        </div>
        {p.locked && !p.busy && (
          <p role="alert" className="rounded-lg bg-ui-danger-soft text-ui-danger px-3 py-2 text-sm font-semibold">
            Retry the same request to find out whether it went through, before starting another refund.
          </p>
        )}
        <label className="block">
          <span className={labelCls}>Reason</span>
          <input required disabled={p.locked} value={p.reason} onChange={(e) => p.onReason(e.target.value)} placeholder="e.g. wrong dish served, guest complaint" className={fieldCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Manager PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            required
            value={p.pin}
            onChange={(e) => p.onPin(e.target.value)}
            className={`${fieldCls} font-mono text-center text-xl tracking-[0.4em]`}
          />
          <span className="text-xs text-ui-muted">The 6–8 digit approval PIN of a manager or the owner.</span>
        </label>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-ui-border px-3">
          <input type="checkbox" disabled={p.locked} checked={p.returnStock} onChange={(e) => p.onReturnStock(e.target.checked)} className="h-5 w-5 accent-[var(--ui-primary)]" />
          <span className="text-sm font-semibold">Put the dish&apos;s ingredients back into stock</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={p.busy} className={btnDanger}>
            {p.busy ? "Recording…" : p.locked ? "Retry same refund" : "Approve & refund"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
