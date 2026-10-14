"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Ingredient } from "../data";
import { cedi, num } from "../money";
import { useStore } from "../store";
import { Badge, Bar, Card, Field, Modal, Money, Seg, Stat, cx } from "../ui";
import { OfficeHead } from "./Office";

type Filter = "all" | "low" | "out";

export function Ingredients() {
  const { state, api } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [adj, setAdj] = useState<Ingredient | null>(null);
  const status = (i: Ingredient) => (i.onHand <= 0 ? "out" : i.onHand < i.par ? "low" : "ok");
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return state.ingredients.filter((i) => (filter === "all" || status(i) === filter) && (!qq || i.name.toLowerCase().includes(qq))).sort((a, b) => a.onHand / a.par - b.onHand / b.par);
  }, [state.ingredients, filter, q]);
  const value = state.ingredients.reduce((s, i) => s + i.onHand * i.cost, 0);
  const low = state.ingredients.filter((i) => status(i) !== "ok");
  const usedValue = state.ingredients.reduce((s, i) => s + i.deductedToday * i.cost, 0);

  return (
    <div className="page">
      <OfficeHead module="ingredients" title="Ingredients" sub="Stock moves automatically when a dish sells, through its recipe. Adjust here for waste, counts and breakages."
        actions={<><Seg options={[{ id: "all", label: "All", n: state.ingredients.length }, { id: "low", label: "Below par", n: low.filter((i) => status(i) === "low").length }, { id: "out", label: "Out", n: low.filter((i) => status(i) === "out").length }]} value={filter} onChange={setFilter} /><label className="search w-[220px]"><Search size={16} strokeWidth={2.5} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find…" /></label></>} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat tone="forest" label="Stock value" value={<Money v={value} />} sub={`${state.ingredients.length} ingredients at cost`} />
        <Stat tone={low.length ? "terra" : "forest"} label="Below par" value={low.length} sub={low.length ? low.slice(0, 3).map((i) => i.name).join(", ") : "all good"} onClick={() => setFilter("low")} />
        <Stat tone="sun" label="Used today" value={<Money v={usedValue} />} sub="deducted by sales" />
        <Stat tone="cobalt" label="On order" value={state.pos.filter((p) => p.status === "sent").reduce((s, p) => s + p.lines.length, 0)} sub={`${state.pos.filter((p) => p.status === "sent").length} POs in transit`} onClick={() => api.go("purchasing")} />
      </div>

      <Card className="mt-4" pad={false}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Ingredient</th><th>Status</th><th>Level vs par</th><th className="r">On hand</th><th className="r">Par</th><th className="r">Used today</th><th className="r">Unit cost</th><th className="r">Value</th><th>Supplier</th><th /></tr></thead>
            <tbody>
              {list.map((i) => {
                const st = status(i);
                const ratio = Math.min(100, (i.onHand / i.par) * 100);
                return (
                  <tr key={i.id}>
                    <td className="d strong">{i.name}</td>
                    <td><Badge tone={st === "ok" ? "forest" : st === "low" ? "sun" : "terra"}>{st === "ok" ? "OK" : st === "low" ? "Low" : "Out"}</Badge></td>
                    <td><Bar value={ratio} tone={st === "ok" ? "forest" : st === "low" ? "sun" : "terra"} className="w-28" /></td>
                    <td className={cx("r d strong", st !== "ok" && "c-terra")}>{i.onHand} <span className="text-[11px] font-semibold text-[var(--ink3)]">{i.unit}</span></td>
                    <td className="r num text-[var(--ink3)]">{i.par}</td>
                    <td className="r num">{i.deductedToday ? `−${i.deductedToday}` : "—"}</td>
                    <td className="r num">{num(i.cost)}</td>
                    <td className="r num">{num(i.onHand * i.cost)}</td>
                    <td className="text-[var(--ink2)]">{state.suppliers.find((s) => s.id === i.supplierId)?.name}</td>
                    <td className="r"><button type="button" className="btn btn-xs btn-ghost" onClick={() => setAdj(i)}>Adjust</button></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={10}><div className="empty">Nothing here</div></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {adj && <AdjustSheet ing={state.ingredients.find((i) => i.id === adj.id)!} onClose={() => setAdj(null)} />}
    </div>
  );
}

function AdjustSheet({ ing, onClose }: { ing: Ingredient; onClose: () => void }) {
  const { api } = useStore();
  const [mode, setMode] = useState<"waste" | "count" | "receive">("waste");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Spoiled");
  const v = Number.parseFloat(qty) || 0;
  const delta = mode === "waste" ? -v : mode === "receive" ? v : v - ing.onHand;
  const reasons = mode === "waste" ? ["Spoiled", "Burnt / dropped", "Over-portioned", "Staff meal", "Expired"] : mode === "count" ? ["Weekly count", "Spot check", "Correction"] : ["Cash purchase (no PO)", "Transfer from other branch", "Supplier sample"];
  return (
    <Modal title={ing.name} sub={`${ing.onHand} ${ing.unit} on hand · par ${ing.par} ${ing.unit} · ${cedi(ing.cost)} per ${ing.unit}`} onClose={onClose}
      foot={<button type="button" className="btn btn-ink grow" disabled={!qty || delta === 0} onClick={() => { api.adjustStock(ing.id, Math.round(delta * 100) / 100, `${mode === "waste" ? "Waste" : mode === "count" ? "Recount" : "Received"} · ${reason}`); onClose(); }}>{mode === "count" ? `Set to ${v} ${ing.unit} (${delta > 0 ? "+" : ""}${Math.round(delta * 100) / 100})` : `${mode === "waste" ? "Write off" : "Receive"} ${v} ${ing.unit}`}</button>}>
      <Seg options={[{ id: "waste", label: "Waste" }, { id: "count", label: "Recount" }, { id: "receive", label: "Receive" }]} value={mode} onChange={(m) => { setMode(m); setReason(m === "waste" ? "Spoiled" : m === "count" ? "Weekly count" : "Cash purchase (no PO)"); }} className="self-start" />
      <Field label={mode === "count" ? `Counted quantity (${ing.unit})` : `Quantity (${ing.unit})`}><input className="input lg" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" autoFocus placeholder="0" /></Field>
      <Field label="Reason"><select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((r) => <option key={r}>{r}</option>)}</select></Field>
      {v > 0 && <p className="text-[12.5px] font-medium text-[var(--ink3)]">Value {cedi(Math.abs(delta) * ing.cost)} · after this: <b className="c-ink">{Math.round((ing.onHand + delta) * 100) / 100} {ing.unit}</b></p>}
    </Modal>
  );
}
