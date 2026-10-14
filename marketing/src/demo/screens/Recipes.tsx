"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { type RecipeLine } from "../data";
import { ghs } from "../pricing";
import { ingredientOf, recipeCost, useDemo } from "../store";
import { Caps, inputCls, K, Money, Num, PageHead, Pill, Select, TextLink } from "../ui";

export function Recipes() {
  const { state, dispatch } = useDemo();
  const [sel, setSel] = useState<string>("jollof");
  const dish = state.menu.find((m) => m.id === sel) ?? state.menu[0];
  const [draft, setDraft] = useState<RecipeLine[] | null>(null);
  const lines = draft ?? state.recipes[dish.id] ?? [];
  const cost = lines.reduce((n, l) => n + (ingredientOf(state, l.ingredientId)?.cost ?? 0) * l.qty, 0);
  const pct = dish.price ? (cost / dish.price) * 100 : 0;
  const margin = dish.price - cost;
  const avgPct = (() => {
    const withR = state.menu.filter((m) => state.recipes[m.id]?.length);
    return withR.length ? withR.reduce((n, m) => n + (recipeCost(state, m.id) / m.price) * 100, 0) / withR.length : 0;
  })();

  const pick = (id: string) => {
    setSel(id);
    setDraft(null);
  };
  const setLine = (i: number, patch: Partial<RecipeLine>) => setDraft(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Recipes & costing" title="What each plate costs." lede={`Recipes drive two things: the food-cost figure on every dish, and the stock that leaves the store when it sells. Average food cost today ${avgPct.toFixed(0)} % — the industry target is 28–35 %.`} />

      <div className="mt-10 grid gap-12 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
        {/* ------------------------------------------------ dish list */}
        <ol className={`border-t ${K.line}`}>
          {state.menu.map((m) => {
            const c = recipeCost(state, m.id);
            const p = m.price ? Math.round((c / m.price) * 100) : 0;
            const on = m.id === dish.id;
            return (
              <li key={m.id} className={`border-b ${K.line2}`}>
                <button type="button" onClick={() => pick(m.id)} className={`flex w-full items-baseline justify-between gap-3 py-3 text-left transition-colors ${on ? K.fg : `${K.fg2} hover:text-(--fg)`}`}>
                  <span className={`truncate font-serif text-[16px] ${on ? "italic" : ""}`}>{m.name}</span>
                  <span className={`shrink-0 text-xs ${state.recipes[m.id]?.length ? (p > 35 ? K.warn : K.fg3) : K.fg3}`}>{state.recipes[m.id]?.length ? <Num>{p}%</Num> : "—"}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* ------------------------------------------------ recipe */}
        <motion.section key={dish.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Caps>
                {dish.category} · {dish.station}
              </Caps>
              <h2 className="mt-1 font-serif text-[32px] italic leading-none tracking-[-.02em]">{dish.name}</h2>
            </div>
            <dl className={`grid grid-cols-4 gap-8 border-l pl-8 ${K.line}`}>
              <div>
                <dt>
                  <Caps>Menu price</Caps>
                </dt>
                <dd className="mt-2">
                  <Money cents={Math.round(dish.price * 100)} size="md" />
                </dd>
              </div>
              <div>
                <dt>
                  <Caps>Recipe cost</Caps>
                </dt>
                <dd className="mt-2">
                  <Money cents={Math.round(cost * 100)} size="md" />
                </dd>
              </div>
              <div>
                <dt>
                  <Caps>Food cost</Caps>
                </dt>
                <dd className={`mt-2 font-serif text-[28px] leading-none lining ${pct > 35 ? K.warn : pct > 0 ? K.accent : K.fg3}`}>{lines.length ? `${pct.toFixed(0)}%` : "—"}</dd>
              </div>
              <div>
                <dt>
                  <Caps>Gross margin</Caps>
                </dt>
                <dd className="mt-2">
                  <Money cents={Math.round(margin * 100)} size="md" tone="fg2" />
                </dd>
              </div>
            </dl>
          </div>

          <table className="mt-8 w-full text-sm">
            <thead className={`text-left text-[11px] font-semibold uppercase tracking-[.18em] ${K.fg3}`}>
              <tr className={`border-b ${K.line}`}>
                <th className="py-2 pr-4 font-semibold">Ingredient</th>
                <th className="py-2 pr-4 font-semibold">Per portion</th>
                <th className="py-2 pr-4 font-semibold">Unit cost</th>
                <th className="py-2 pr-4 text-right font-semibold">Cost</th>
                <th className="py-2 text-right font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-(--line2)">
              {lines.map((l, i) => {
                const ing = ingredientOf(state, l.ingredientId);
                return (
                  <tr key={i}>
                    <td className="py-2 pr-4">
                      <Select value={l.ingredientId} onChange={(e) => setLine(i, { ingredientId: e.target.value })} className="py-1.5">
                        {state.ingredients.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="flex items-baseline gap-2">
                        <input inputMode="decimal" value={String(l.qty)} onChange={(e) => setLine(i, { qty: Number(e.target.value) || 0 })} className={`${inputCls} w-24 py-1.5 font-serif text-[18px] lining`} />
                        <span className={`text-xs ${K.fg3}`}>{ing?.unit}</span>
                      </span>
                    </td>
                    <td className={`py-2 pr-4 ${K.fg2}`}>
                      <Num>{ghs(Math.round((ing?.cost ?? 0) * 100))}</Num>
                      <span className={`text-xs ${K.fg3}`}> / {ing?.unit}</span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Num className="text-[16px]">{ghs(Math.round((ing?.cost ?? 0) * l.qty * 100))}</Num>
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => setDraft(lines.filter((_, k) => k !== i))} className={`text-xs ${K.fg3} hover:text-(--bad)`}>
                        remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!lines.length && <p className={`mt-6 font-serif text-[20px] italic ${K.fg3}`}>No recipe yet — this dish sells without touching stock.</p>}

          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
            <TextLink tone="fg2" onClick={() => setDraft([...lines, { ingredientId: state.ingredients.find((x) => !lines.some((l) => l.ingredientId === x.id))?.id ?? state.ingredients[0].id, qty: 0.1 }])}>
              Add an ingredient
            </TextLink>
            {draft && (
              <>
                <Pill
                  tone="accent"
                  size="md"
                  className="!w-auto"
                  onClick={() => {
                    dispatch({ type: "recipeSet", menuItemId: dish.id, lines: draft });
                    setDraft(null);
                  }}
                >
                  Save recipe
                </Pill>
                <TextLink tone="fg3" arrow={false} onClick={() => setDraft(null)}>
                  Discard changes
                </TextLink>
              </>
            )}
            <span className={`ml-auto text-xs ${K.fg3}`}>Auto-deducts on every sale · yields 1 portion</span>
          </div>

          <div className={`mt-10 border-t pt-6 ${K.line}`}>
            <Caps>How deduction works</Caps>
            <p className={`mt-2 max-w-[60ch] text-sm leading-relaxed ${K.fg2}`}>
              When {dish.name} sells, the till walks this list, aggregates ingredients shared across the ticket and writes one stock movement per ingredient referenced to the order number — so the ingredient ledger reads like a kitchen diary, not a database dump.
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

