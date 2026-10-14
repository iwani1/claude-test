"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { RecipeLine } from "../data";
import { cedi, num, parseCedi, pct } from "../money";
import { recipeCost, useStore } from "../store";
import { Badge, Bar, Card, Field, cx } from "../ui";
import { OfficeHead } from "./Office";

const TARGET = 65;

export function Recipes() {
  const { state, api } = useStore();
  const [selId, setSelId] = useState(state.dishes[1]?.id ?? state.dishes[0]?.id);
  const dish = state.dishes.find((d) => d.id === selId) ?? state.dishes[0];
  const [lines, setLines] = useState<RecipeLine[]>(state.recipes[dish.id] ?? []);
  const [whatIf, setWhatIf] = useState(num(dish.price));
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setLines(state.recipes[dish.id] ?? []); setWhatIf(num(dish.price)); setDirty(false); }, [dish.id, dish.price, state.recipes]);

  const cost = recipeCost(lines, state.ingredients);
  const margin = pct(dish.price - cost, dish.price);
  const wi = parseCedi(whatIf);
  const wiMargin = wi ? pct(wi - cost, wi) : 0;
  const unused = state.ingredients.filter((i) => !lines.some((l) => l.ingId === i.id));
  const avgMargin = Math.round(state.dishes.reduce((s, d) => s + pct(d.price - recipeCost(state.recipes[d.id], state.ingredients), d.price), 0) / state.dishes.length);

  const setLine = (i: number, patch: Partial<RecipeLine>) => { setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l))); setDirty(true); };

  return (
    <div className="page">
      <OfficeHead module="recipes" title="Recipes & costing" sub={`Average gross margin ${avgMargin}% across ${state.dishes.length} dishes · target ${TARGET}% · costs from current ingredient prices`} />
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card pad={false} className="max-h-[72vh] overflow-auto">
          <ul>
            {state.dishes.map((d) => {
              const c = recipeCost(state.recipes[d.id], state.ingredients);
              const m = pct(d.price - c, d.price);
              return (
                <li key={d.id}>
                  <button type="button" className={cx("flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-left hover:bg-[var(--cream)]", d.id === dish.id && "bg-[var(--sun-l)]")} onClick={() => setSelId(d.id)}>
                    <span className="h-11 w-11 flex-none overflow-hidden rounded-xl" data-tone={d.cat} style={{ boxShadow: "inset 0 0 0 3px var(--c)" }}>{d.img && <img src={`/dishes/${d.img}.jpg`} alt="" className="h-full w-full object-cover p-[3px]" style={{ borderRadius: 12 }} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="d block truncate text-[14px] font-bold">{d.name}</span>
                      <span className="mt-1 flex items-center gap-2 text-[11.5px] font-semibold text-[var(--ink3)]"><Bar value={m} tone={m >= TARGET ? "forest" : m >= 50 ? "sun" : "terra"} className="w-20 !h-2" />{m}% · cost {num(c)}</span>
                    </span>
                    <span className="d text-[14px] font-bold">{num(d.price).replace(/\.00$/, "")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="block stat !min-h-[100px]" data-tone="ink"><span className="stat-label">Menu price</span><span className="stat-value !text-[26px]"><small>GH₵</small>{num(dish.price)}</span></div>
            <div className="block stat !min-h-[100px]" data-tone="sun"><span className="stat-label">Plated cost</span><span className="stat-value !text-[26px]"><small>GH₵</small>{num(cost)}</span></div>
            <div className="block stat !min-h-[100px]" data-tone={margin >= TARGET ? "forest" : margin >= 50 ? "sun" : "terra"}><span className="stat-label">Gross margin</span><span className="stat-value !text-[26px]">{margin}%</span></div>
            <div className="block stat !min-h-[100px]" data-tone="cobalt"><span className="stat-label">Profit per plate</span><span className="stat-value !text-[26px]"><small>GH₵</small>{num(dish.price - cost)}</span></div>
          </div>

          <Card title={<>{dish.name} <span className="ml-2 text-[12px] font-semibold text-[var(--ink3)]">{lines.length} ingredients</span></>} actions={<div className="flex gap-2">{dirty && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setLines(state.recipes[dish.id] ?? []); setDirty(false); }}>Discard</button>}<button type="button" className="btn btn-sm btn-ink" disabled={!dirty} onClick={() => { api.saveRecipe(dish.id, lines.filter((l) => l.qty > 0)); setDirty(false); }}>Save recipe</button></div>} pad={false}>
            <table className="tbl">
              <thead><tr><th>Ingredient</th><th className="r">Qty</th><th>Unit</th><th className="r">Unit cost</th><th className="r">Line cost</th><th className="r">Share</th><th /></tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const ing = state.ingredients.find((x) => x.id === l.ingId);
                  const lc = Math.round((ing?.cost ?? 0) * l.qty);
                  return (
                    <tr key={l.ingId}>
                      <td className="strong">
                        <select className="select !h-9 !text-[13px]" value={l.ingId} onChange={(e) => setLine(i, { ingId: e.target.value })}>
                          {[ing, ...unused].filter((x): x is NonNullable<typeof x> => !!x).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </td>
                      <td className="r"><input className="input !h-9 !w-24 !px-2 text-right" value={l.qty} inputMode="decimal" onChange={(e) => setLine(i, { qty: Math.max(0, Number.parseFloat(e.target.value) || 0) })} /></td>
                      <td className="text-[var(--ink3)]">{ing?.unit}</td>
                      <td className="r num">{num(ing?.cost ?? 0)}</td>
                      <td className="r d strong">{num(lc)}</td>
                      <td className="r"><Bar value={cost ? (lc / cost) * 100 : 0} tone="cobalt" className="ml-auto w-16 !h-2" /></td>
                      <td className="r"><button type="button" className="btn btn-xs btn-soft" onClick={() => { setLines((ls) => ls.filter((_, k) => k !== i)); setDirty(true); }} aria-label="Remove"><Trash2 size={13} /></button></td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={7}>
                    <button type="button" className="btn btn-sm btn-ghost" disabled={!unused.length} onClick={() => { setLines((ls) => [...ls, { ingId: unused[0].id, qty: 0.1 }]); setDirty(true); }}><Plus size={14} strokeWidth={3} /> Add ingredient</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card title="What if the price were…">
            <div className="grid items-end gap-4 md:grid-cols-[180px_1fr]">
              <Field label="Price (GH₵)"><input className="input lg" value={whatIf} onChange={(e) => setWhatIf(e.target.value)} inputMode="decimal" /></Field>
              <div className="flex flex-wrap items-center gap-3 pb-1">
                <Badge tone={wiMargin >= TARGET ? "forest" : wiMargin >= 50 ? "sun" : "terra"} solid>{wiMargin}% margin</Badge>
                <span className="text-[13px] font-semibold text-[var(--ink3)]">profit {cedi(wi - cost)} per plate · to hit {TARGET}% you need <b className="c-ink">{cedi(Math.ceil(cost / (1 - TARGET / 100) / 100) * 100)}</b></span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
