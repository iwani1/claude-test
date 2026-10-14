"use client";

import { ArrowRight, Printer, Search, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { isManager, type Order, type OrderStatus, type PayMethod } from "../data";
import { cedi, hm, num } from "../money";
import { currentUser, totals, useStore } from "../store";
import { Badge, Field, Modal, ORDER_STATUS, Seg, cx } from "../ui";
import { ManagerGate, Receipt, VoidSheet } from "./Till";

type Filter = "all" | OrderStatus;

export function Orders() {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"refund" | "void" | "receipt" | null>(null);
  const vat = state.settings.vat;

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return [...state.orders].sort((a, b) => b.opened - a.opened).filter((o) => (filter === "all" || o.status === filter) && (!qq || String(o.id).includes(qq) || o.tableLabel.toLowerCase().includes(qq) || o.lines.some((l) => l.name.toLowerCase().includes(qq))));
  }, [state.orders, filter, q]);
  const sel = state.orders.find((o) => o.id === selId) ?? list[0] ?? null;
  const counts = (s: OrderStatus) => state.orders.filter((o) => o.status === s).length;
  const t = sel ? totals(sel, vat) : null;
  const refundable = t ? t.paid - t.refunded : 0;

  return (
    <div className="page grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <div className="page-head">
        <div>
          <div className="kicker" style={{ color: "var(--sun-d)" }}>Service · Orders</div>
          <h1 className="page-title mt-2">Every order today</h1>
          <p className="page-sub">{state.orders.length} orders · {cedi(state.orders.filter((o) => o.status === "paid" || o.status === "refunded").reduce((s, o) => s + totals(o, vat).total, 0))} taken</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg options={[{ id: "all", label: "All" }, { id: "open", label: "Open", n: counts("open") }, { id: "paid", label: "Paid", n: counts("paid") }, { id: "refunded", label: "Refunded", n: counts("refunded") }, { id: "void", label: "Void", n: counts("void") }]} value={filter} onChange={setFilter} />
          <label className="search w-[240px]"><Search size={16} strokeWidth={2.5} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order #, table, dish…" /></label>
        </div>
      </div>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="card tbl-wrap min-h-0 overflow-auto">
          <table className="tbl">
            <thead><tr><th>Order</th><th>Time</th><th>Table</th><th>Items</th><th>Staff</th><th>Tender</th><th className="r">Total</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((o) => {
                const tt = totals(o, vat);
                return (
                  <tr key={o.id} className={cx("is-click", sel?.id === o.id && "is-sel")} onClick={() => setSelId(o.id)}>
                    <td className="d strong">#{o.id}</td>
                    <td>{hm(o.opened)}{o.closed ? ` → ${hm(o.closed)}` : ""}</td>
                    <td className="strong">{o.tableLabel}</td>
                    <td className="max-w-[260px] truncate text-[var(--ink2)]">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ") || "—"}</td>
                    <td>{state.staff.find((s) => s.id === o.staffId)?.name.split(" ")[0]}</td>
                    <td>{o.payments.length ? [...new Set(o.payments.map((p) => (p.method === "cash" ? "Cash" : p.method === "momo" ? `MoMo ${p.network}` : "GhQR")))].join(" + ") : "—"}</td>
                    <td className="r d strong">{num(tt.total)}</td>
                    <td><Badge tone={ORDER_STATUS[o.status].tone}>{o.status === "paid" && tt.refunded > 0 ? "Part-refunded" : ORDER_STATUS[o.status].label}</Badge></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={8}><div className="empty">No orders match</div></td></tr>}
            </tbody>
          </table>
        </div>

        {sel && t && (
          <aside className="card-ink flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-white/10 p-5 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold text-[var(--ink4)]">{sel.tableLabel} · opened {hm(sel.opened)}{sel.closed ? ` · closed ${hm(sel.closed)}` : ""}</div>
                  <div className="d mt-1 text-[28px] font-extrabold leading-none tracking-tight">Order #{sel.id}</div>
                </div>
                <Badge tone={ORDER_STATUS[sel.status].tone} solid>{ORDER_STATUS[sel.status].label}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="tag">{sel.guests} guests</span><span className="tag">{t.items} items</span><span className="tag">by {state.staff.find((s) => s.id === sel.staffId)?.name.split(" ")[0]}</span>
                {sel.discount && <span className="tag sun">−{sel.discount.kind === "pct" ? `${sel.discount.value}%` : cedi(sel.discount.value)} · {sel.discount.reason}</span>}
              </div>
            </div>
            <div className="ink-scroll min-h-0 flex-1 overflow-auto p-5">
              <ul className="flex flex-col gap-2">
                {sel.lines.map((l) => (
                  <li key={l.id} className="flex items-center gap-3">
                    <span className="line-qty !h-8 !w-8 !text-[13px]">{l.qty}</span>
                    <span className="min-w-0 flex-1"><span className="d block truncate text-[14px] font-bold">{l.name}</span>{l.note && <span className="text-[11.5px] c-sun">“{l.note}”</span>}</span>
                    <span className="d font-bold">{num(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 flex flex-col gap-1.5 border-t border-white/10 pt-3">
                <div className="tot"><dt>Subtotal</dt><dd>{num(t.subtotal)}</dd></div>
                {t.discount > 0 && <div className="tot" style={{ color: "var(--sun)" }}><dt>Discount</dt><dd>−{num(t.discount)}</dd></div>}
                <div className="tot"><dt>VAT {vat}%</dt><dd>{num(t.vat)}</dd></div>
                {t.service > 0 && <div className="tot"><dt>Room service</dt><dd>{num(t.service)}</dd></div>}
                <div className="tot tot-grand"><dt>Total</dt><dd className="!text-[28px]"><small>GH₵</small>{num(t.total)}</dd></div>
              </dl>
              {(sel.payments.length > 0 || sel.refunds.length > 0 || sel.status === "void") && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <div className="kicker mb-2" style={{ color: "var(--ink4)" }}>Timeline</div>
                  <ul className="flex flex-col gap-2 text-[13px]">
                    <li className="flex justify-between gap-3"><span><b>{hm(sel.opened)}</b> Opened on {sel.tableLabel}</span></li>
                    {sel.payments.map((p) => <li key={p.id} className="flex justify-between gap-3"><span><b>{hm(p.at)}</b> Paid {p.method === "cash" ? `cash (tendered ${cedi(p.tendered)}, change ${cedi(p.change)})` : p.method === "momo" ? `MoMo ${p.network} ${p.phone} · ${p.ref}` : `GhQR · ${p.ref}`}</span><span className="d font-bold c-forest" style={{ color: "#6fd3b3" }}>{num(p.amount)}</span></li>)}
                    {sel.refunds.map((r) => <li key={r.id} className="flex justify-between gap-3"><span><b>{hm(r.at)}</b> Refund {r.method} · {r.items} · {r.reason} · by {r.by.split(" ")[0]}{r.approvedBy ? `, approved ${r.approvedBy.split(" ")[0]}` : ""}</span><span className="d font-bold" style={{ color: "#ff9a7c" }}>−{num(r.amount)}</span></li>)}
                    {sel.status === "void" && <li><b>{hm(sel.closed ?? sel.opened)}</b> Voided · {sel.voidReason}</li>}
                  </ul>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-4">
              {sel.status === "open" ? (
                <>
                  <button type="button" className="btn btn-sun" onClick={() => { api.pickTable(sel.tableId); api.go("till"); }}>Open in Till <ArrowRight size={16} strokeWidth={3} /></button>
                  <button type="button" className="ghost" disabled={!isManager(me.role)} title={isManager(me.role) ? "" : "Managers only"} onClick={() => setSheet("void")}>Void order</button>
                </>
              ) : (
                <>
                  <button type="button" className="ghost" onClick={() => setSheet("receipt")}><Printer size={15} /> Receipt</button>
                  <button type="button" className="btn btn-sun" disabled={refundable <= 0} onClick={() => setSheet("refund")}><Undo2 size={16} strokeWidth={2.5} /> Refund{refundable > 0 && refundable < t.total ? ` (${cedi(refundable)} left)` : ""}</button>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {sheet === "void" && sel && <VoidSheet order={sel} onClose={() => setSheet(null)} />}
      {sheet === "receipt" && sel && t && (
        <Modal title="Receipt" sub={`Order #${sel.id} · ${sel.tableLabel}`} onClose={() => setSheet(null)} foot={<><button type="button" className="btn btn-ghost" onClick={() => setSheet(null)}>Close</button><button type="button" className="btn btn-ink grow" onClick={() => { api.print(`Receipt #${sel.id} (reprint)`); setSheet(null); }}><Printer size={16} /> Reprint</button></>}>
          <Receipt order={sel} t={t} title="REPRINT" />
        </Modal>
      )}
      {sheet === "refund" && sel && <RefundSheet order={sel} onClose={() => setSheet(null)} />}
    </div>
  );
}

function RefundSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const t = totals(order, state.settings.vat);
  const left = t.paid - t.refunded;
  const [mode, setMode] = useState<"full" | "items">("items");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("Wrong item served");
  const [method, setMethod] = useState<PayMethod>(order.payments[0]?.method ?? "cash");
  const [gate, setGate] = useState(false);

  const factor = t.subtotal ? (t.total - t.service) / t.subtotal : 1; // VAT and discount share per cedi of goods
  const itemsAmount = Math.round(order.lines.reduce((s, l) => s + (picked[l.id] ?? 0) * l.price, 0) * factor);
  const amount = Math.min(left, mode === "full" ? left : itemsAmount);
  const items = mode === "full" ? "Full order" : order.lines.filter((l) => picked[l.id]).map((l) => `${picked[l.id]} × ${l.name}`).join(", ");

  const go = (approvedBy: string) => { api.refund(order.id, amount, method, reason, items, approvedBy); onClose(); };
  const submit = () => (isManager(me.role) ? go("") : setGate(true));

  if (gate) return <ManagerGate title="Manager approval" sub={<>Refund of <b>{cedi(amount)}</b> on order #{order.id} · {reason}</>} onApproved={go} onClose={() => setGate(false)} />;

  return (
    <Modal title="Refund" sub={`Order #${order.id} · ${cedi(left)} refundable · ${isManager(me.role) ? "you can approve this yourself" : "needs a manager's PIN"}`} onClose={onClose} tone="terra"
      foot={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-terra grow" disabled={amount <= 0 || !items} onClick={submit}>Refund {cedi(amount)} {method === "cash" ? "in cash" : method === "momo" ? "to MoMo" : "via GhQR"}</button></>}>
      <Seg options={[{ id: "items", label: "By item" }, { id: "full", label: "Whole order" }]} value={mode} onChange={setMode} className="self-start" />
      {mode === "items" && (
        <ul className="card flex flex-col divide-y-2 divide-[var(--line)] overflow-hidden">
          {order.lines.map((l) => {
            const n = picked[l.id] ?? 0;
            return (
              <li key={l.id} className="flex items-center gap-3 bg-white px-4 py-2.5">
                <span className="min-w-0 flex-1"><span className="d block text-[14px] font-bold">{l.name}</span><span className="text-[12px] font-semibold text-[var(--ink3)]">{l.qty} sold · {cedi(l.price)} each</span></span>
                <span className="stepper"><button type="button" onClick={() => setPicked((p) => ({ ...p, [l.id]: Math.max(0, n - 1) }))}>−</button><b>{n}</b><button type="button" onClick={() => setPicked((p) => ({ ...p, [l.id]: Math.min(l.qty, n + 1) }))}>+</button></span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Reason"><select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{["Wrong item served", "Item not delivered", "Quality complaint", "Guest changed mind", "Charged twice", "Other"].map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Refund via"><select className="select" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}><option value="cash">Cash from drawer</option><option value="momo">MoMo reversal</option><option value="ghqr">GhQR reversal</option></select></Field>
      </div>
      <p className="text-[12.5px] font-medium text-[var(--ink3)]">Refund amounts include the VAT share, so the GRA figures stay right. Cash refunds reduce the drawer's expected cash.</p>
    </Modal>
  );
}
