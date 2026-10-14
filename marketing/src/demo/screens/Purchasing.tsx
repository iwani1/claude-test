"use client";

import { Phone, Plus, Send, Truck } from "lucide-react";
import { useState } from "react";
import type { PO, POLine } from "../data";
import { cedi, num, parseCedi, stamp } from "../money";
import { useStore } from "../store";
import { Badge, Card, Field, Modal, PO_STATUS, cx } from "../ui";
import { OfficeHead } from "./Office";

export function Purchasing() {
  const { state, api } = useStore();
  const [sheet, setSheet] = useState<{ kind: "new"; supplierId?: string } | { kind: "receive"; po: PO } | { kind: "invoice"; po: PO } | null>(null);
  const poTotal = (po: PO) => po.lines.reduce((s, l) => s + l.qty * l.cost, 0);
  const pos = [...state.pos].sort((a, b) => b.createdAt - a.createdAt);
  const low = state.ingredients.filter((i) => i.onHand < i.par);

  return (
    <div className="page">
      <OfficeHead module="purchasing" title="Purchasing" sub={`${state.suppliers.length} suppliers · ${pos.filter((p) => p.status === "sent").length} orders in transit · ${low.length} ingredients below par`}
        actions={<button type="button" className="btn btn-ink" onClick={() => setSheet({ kind: "new" })}><Plus size={16} strokeWidth={3} /> New purchase order</button>} />

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {state.suppliers.map((s) => {
          const items = state.ingredients.filter((i) => i.supplierId === s.id);
          const lowHere = items.filter((i) => i.onHand < i.par);
          return (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><div className="d text-[16px] font-bold">{s.name}</div><div className="text-[12px] font-semibold text-[var(--ink3)]">{s.supplies}</div></div>
                <Badge tone={lowHere.length ? "terra" : "forest"}>{lowHere.length ? `${lowHere.length} low` : "stocked"}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-[var(--ink2)]">
                <span className="flex items-center gap-1"><Phone size={12} />{s.contact} · {s.phone}</span>
                <span className="flex items-center gap-1"><Truck size={12} />{s.leadDays} day lead · {s.terms}</span>
              </div>
              <button type="button" className="btn btn-sm btn-soft mt-3 w-full" onClick={() => setSheet({ kind: "new", supplierId: s.id })}>Order from {s.name.split(" ")[0]}{lowHere.length ? ` · ${lowHere.length} suggested` : ""}</button>
            </div>
          );
        })}
      </div>

      <Card className="mt-4" title="Purchase orders" pad={false}>
        <table className="tbl">
          <thead><tr><th>PO</th><th>Supplier</th><th>Lines</th><th className="r">Value</th><th>Created</th><th>Status</th><th>Invoice</th><th className="r">Next step</th></tr></thead>
          <tbody>
            {pos.map((po) => {
              const sup = state.suppliers.find((s) => s.id === po.supplierId);
              return (
                <tr key={po.id}>
                  <td className="d strong">{po.id}</td>
                  <td className="strong">{sup?.name}</td>
                  <td className="max-w-[320px] truncate text-[var(--ink2)]">{po.lines.map((l) => `${l.qty} ${state.ingredients.find((i) => i.id === l.ingId)?.unit} ${state.ingredients.find((i) => i.id === l.ingId)?.name}`).join(", ")}</td>
                  <td className="r d strong">{num(poTotal(po))}</td>
                  <td>{stamp(po.createdAt)}</td>
                  <td><Badge tone={PO_STATUS[po.status].tone}>{PO_STATUS[po.status].label}</Badge></td>
                  <td className="text-[var(--ink2)]">{po.invoice ? `${po.invoice.no} · ${cedi(po.invoice.total)}` : "—"}</td>
                  <td className="r">
                    {po.status === "draft" && <button type="button" className="btn btn-xs btn-cobalt" onClick={() => api.sendPO(po.id)}><Send size={12} /> Send</button>}
                    {po.status === "sent" && <button type="button" className="btn btn-xs btn-sun" onClick={() => setSheet({ kind: "receive", po })}>Receive (GRN)</button>}
                    {po.status === "received" && <button type="button" className="btn btn-xs btn-forest" onClick={() => setSheet({ kind: "invoice", po })}>Record invoice</button>}
                    {po.status === "invoiced" && <span className="text-[12px] font-bold text-[var(--ink3)]">Complete</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {sheet?.kind === "new" && <NewPOSheet supplierId={sheet.supplierId} onClose={() => setSheet(null)} />}
      {sheet?.kind === "receive" && <ReceiveSheet po={sheet.po} onClose={() => setSheet(null)} />}
      {sheet?.kind === "invoice" && <InvoiceSheet po={sheet.po} onClose={() => setSheet(null)} />}
    </div>
  );
}

function NewPOSheet({ supplierId, onClose }: { supplierId?: string; onClose: () => void }) {
  const { state, api } = useStore();
  const lowBy = (sid: string) => state.ingredients.filter((i) => i.supplierId === sid && i.onHand < i.par);
  const [sup, setSup] = useState(supplierId ?? [...state.suppliers].sort((a, b) => lowBy(b.id).length - lowBy(a.id).length)[0].id);
  const suggest = (sid: string): POLine[] => lowBy(sid).map((i) => ({ ingId: i.id, qty: Math.ceil((i.par * 1.5 - i.onHand) * 10) / 10, cost: i.cost, received: null }));
  const [lines, setLines] = useState<POLine[]>(() => suggest(sup));
  const items = state.ingredients.filter((i) => i.supplierId === sup);
  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0);
  const unused = items.filter((i) => !lines.some((l) => l.ingId === i.id));
  return (
    <Modal title="New purchase order" sub="Lines below par are suggested at 1.5 × par" onClose={onClose} size="w"
      foot={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-ink grow" disabled={!lines.length || lines.some((l) => l.qty <= 0)} onClick={() => { api.createPO(sup, lines); onClose(); }}>Draft PO · {cedi(total)}</button></>}>
      <Field label="Supplier"><select className="select" value={sup} onChange={(e) => { setSup(e.target.value); setLines(suggest(e.target.value)); }}>{state.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.supplies}</option>)}</select></Field>
      <table className="tbl card overflow-hidden">
        <thead><tr><th>Ingredient</th><th className="r">On hand</th><th className="r">Par</th><th className="r">Order qty</th><th className="r">Unit cost</th><th className="r">Line</th><th /></tr></thead>
        <tbody>
          {lines.map((l, i) => {
            const ing = state.ingredients.find((x) => x.id === l.ingId)!;
            return (
              <tr key={l.ingId}>
                <td className="strong">{ing.name}</td><td className={cx("r num", ing.onHand < ing.par && "c-terra font-bold")}>{ing.onHand}</td><td className="r num text-[var(--ink3)]">{ing.par}</td>
                <td className="r"><input className="input !h-9 !w-20 !px-2 text-right" value={l.qty} inputMode="decimal" onChange={(e) => setLines((ls) => ls.map((x, k) => (k === i ? { ...x, qty: Math.max(0, Number.parseFloat(e.target.value) || 0) } : x)))} /> <span className="text-[11px] text-[var(--ink3)]">{ing.unit}</span></td>
                <td className="r num">{num(l.cost)}</td><td className="r d strong">{num(l.qty * l.cost)}</td>
                <td className="r"><button type="button" className="btn btn-xs btn-soft" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}>×</button></td>
              </tr>
            );
          })}
          <tr><td colSpan={7}>
            {unused.length ? (
              <select className="select !h-9 !w-auto !text-[13px]" value="" onChange={(e) => { const ing = state.ingredients.find((x) => x.id === e.target.value); if (ing) setLines((ls) => [...ls, { ingId: ing.id, qty: ing.par, cost: ing.cost, received: null }]); }}>
                <option value="">+ Add ingredient…</option>{unused.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.onHand}/{i.par} {i.unit})</option>)}
              </select>
            ) : <span className="text-[12px] font-semibold text-[var(--ink3)]">All of this supplier's items are on the order</span>}
          </td></tr>
        </tbody>
      </table>
    </Modal>
  );
}

function ReceiveSheet({ po, onClose }: { po: PO; onClose: () => void }) {
  const { state, api } = useStore();
  const [rec, setRec] = useState<Record<string, number>>(() => Object.fromEntries(po.lines.map((l) => [l.ingId, l.qty])));
  const short = po.lines.filter((l) => (rec[l.ingId] ?? 0) < l.qty);
  return (
    <Modal title={`Receive ${po.id}`} sub={`Goods received note · ${state.suppliers.find((s) => s.id === po.supplierId)?.name} · stock goes up by what you actually count`} onClose={onClose} size="w"
      foot={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-sun grow" onClick={() => { api.receivePO(po.id, rec); onClose(); }}>Confirm GRN{short.length ? ` · ${short.length} short` : ""}</button></>}>
      <table className="tbl card overflow-hidden">
        <thead><tr><th>Ingredient</th><th className="r">Ordered</th><th className="r">Received</th><th className="r">Variance</th></tr></thead>
        <tbody>
          {po.lines.map((l) => {
            const ing = state.ingredients.find((x) => x.id === l.ingId)!;
            const r = rec[l.ingId] ?? 0;
            return (
              <tr key={l.ingId}>
                <td className="strong">{ing.name}</td><td className="r num">{l.qty} {ing.unit}</td>
                <td className="r"><input className="input !h-9 !w-24 !px-2 text-right" value={r} inputMode="decimal" onChange={(e) => setRec((x) => ({ ...x, [l.ingId]: Math.max(0, Number.parseFloat(e.target.value) || 0) }))} /></td>
                <td className={cx("r d strong", r < l.qty ? "c-terra" : r > l.qty ? "c-cobalt" : "c-forest")}>{r === l.qty ? "✓" : `${r > l.qty ? "+" : ""}${Math.round((r - l.qty) * 100) / 100}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

function InvoiceSheet({ po, onClose }: { po: PO; onClose: () => void }) {
  const { state, api } = useStore();
  const expected = po.lines.reduce((s, l) => s + (l.received ?? l.qty) * l.cost, 0);
  const [no, setNo] = useState(`INV-${7800 + state.pos.length}`);
  const [total, setTotal] = useState(num(expected));
  const v = parseCedi(total);
  const diff = v - expected;
  return (
    <Modal title={`Supplier invoice · ${po.id}`} sub={`Expected ${cedi(expected)} from the GRN quantities at PO prices`} onClose={onClose}
      foot={<button type="button" className="btn btn-forest grow" disabled={!no.trim() || !v} onClick={() => { api.invoicePO(po.id, no.trim(), v); onClose(); }}>Record {cedi(v)}</button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Invoice number"><input className="input" value={no} onChange={(e) => setNo(e.target.value)} /></Field>
        <Field label="Invoice total (GH₵)"><input className="input" value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" /></Field>
      </div>
      {diff !== 0 && v > 0 && <div className="alert" data-tone={Math.abs(diff) > expected * 0.02 ? "terra" : "sun"}><span className="dot" /><span className="text-[13px] font-semibold">Invoice is {diff > 0 ? "higher" : "lower"} than the GRN by {cedi(Math.abs(diff))} — flagged for the accountant.</span></div>}
    </Modal>
  );
}
