"use client";

import { useState } from "react";
import { type Ingredient, type IngredientCategory, type Unit } from "../data";
import { ghs } from "../pricing";
import { ingredientOf, lowStock, staffById, stockValueCents, useDemo, type MovementKind } from "../store";
import { Caps, Field, Figure, inputCls, K, Modal, Money, Num, PageHead, Pill, qty3, Rows, Select, Tab, TextLink, whenOf } from "../ui";

const CATS: IngredientCategory[] = ["Produce", "Meat & fish", "Dry goods", "Beverage", "Fuel", "Packaging"];
const KIND_LABEL: Record<MovementKind, string> = { sale: "Sale", waste: "Waste", adjust: "Adjust", receipt: "Delivery", count: "Count" };

export function Stock() {
  const { state, dispatch, now } = useDemo();
  const [cat, setCat] = useState<IngredientCategory | "All" | "Low">("All");
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<string | null>(null);
  const low = lowStock(state);
  const list = state.ingredients.filter((i) => (cat === "All" ? true : cat === "Low" ? i.stock <= i.min : i.category === cat));
  const ledger = state.movements.filter((m) => !ledgerFor || m.ingredientId === ledgerFor).slice(0, 40);
  const todaySales = state.movements.filter((m) => m.kind === "sale" && now - m.at < 24 * 3_600_000).reduce((n, m) => n + Math.abs(m.delta) * (ingredientOf(state, m.ingredientId)?.cost ?? 0), 0);
  const todayWaste = state.movements.filter((m) => m.kind === "waste" && now - m.at < 24 * 3_600_000).reduce((n, m) => n + Math.abs(m.delta) * (ingredientOf(state, m.ingredientId)?.cost ?? 0), 0);

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Ingredient stock" title="What’s in the store." lede="Every sale walks its recipe and draws stock down; deliveries, waste and cycle counts land in the same ledger. Nothing is typed twice.">
        <TextLink tone="fg2" onClick={() => setAdding(true)}>
          New ingredient
        </TextLink>
        <TextLink tone="fg2" onClick={() => setCounting(true)}>
          Cycle count
        </TextLink>
      </PageHead>

      <dl className={`mt-10 grid gap-8 border-y py-8 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 xl:divide-x xl:divide-(--line) ${K.line}`}>
        <Figure label="Stock on hand (valued)">
          <Money cents={stockValueCents(state)} size="lg" />
        </Figure>
        <Figure label="Below minimum" className="xl:pl-8" sub={low.length ? low.map((i) => i.name.split(" (")[0]).slice(0, 3).join(" · ") + (low.length > 3 ? " …" : "") : "everything above its line"} warn={low.length > 0}>
          <Num className={`text-[52px] leading-none tracking-[-.03em] ${low.length ? K.warn : K.fg}`}>{low.length}</Num>
        </Figure>
        <Figure label="Used by sales · 24 h" className="xl:pl-8" sub="at current unit cost">
          <Money cents={Math.round(todaySales * 100)} size="lg" />
        </Figure>
        <Figure label="Waste · 24 h" className="xl:pl-8" sub={todayWaste ? "recorded with a reason" : "nothing thrown away"} warn={todayWaste > 0}>
          <Money cents={Math.round(todayWaste * 100)} size="lg" tone={todayWaste ? "fg" : "fg2"} />
        </Figure>
      </dl>

      <div className="mt-10 grid gap-12 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-16">
        <section>
          <div className="flex flex-wrap gap-7">
            {(["All", "Low", ...CATS] as const).map((c) => (
              <Tab key={c} name="stockcat" on={cat === c} onClick={() => setCat(c)}>
                {c === "Low" ? `Low · ${low.length}` : c}
              </Tab>
            ))}
          </div>
          <div className="mt-6">
            <Rows head={["Ingredient", "Location", "On hand", "Minimum", "Unit cost", "Value", ""]}>
              {list.map((i) => {
                const isLow = i.stock <= i.min;
                return (
                  <tr key={i.id}>
                    <td className="py-3 pr-4">
                      <button type="button" onClick={() => setLedgerFor(ledgerFor === i.id ? null : i.id)} className={`text-left hover:text-(--accent) ${ledgerFor === i.id ? K.accent : ""}`}>
                        <span className="block font-serif text-[16px]">{i.name}</span>
                        <span className={`block text-xs ${K.fg3}`}>
                          {i.category} · {state.suppliers.find((s) => s.id === i.supplierId)?.name ?? "—"}
                        </span>
                      </button>
                    </td>
                    <td className={`py-3 pr-4 text-xs ${K.fg3}`}>{i.location}</td>
                    <td className={`py-3 pr-4 ${isLow ? K.warn : ""}`}>
                      <Num className="text-[18px]">{qty3(i.stock)}</Num> <span className={`text-xs ${K.fg3}`}>{i.unit}</span>
                      {isLow && <span className={`ml-2 text-[11px] font-semibold uppercase tracking-[.14em] ${K.warn}`}>low</span>}
                    </td>
                    <td className={`py-3 pr-4 ${K.fg3}`}>
                      <Num>{qty3(i.min)}</Num> {i.unit}
                    </td>
                    <td className={`py-3 pr-4 ${K.fg2}`}>
                      <Num>{ghs(Math.round(i.cost * 100))}</Num>
                    </td>
                    <td className={`py-3 pr-4 ${K.fg2}`}>
                      <Num>{ghs(Math.round(i.cost * i.stock * 100))}</Num>
                    </td>
                    <td className="py-3 text-right">
                      <TextLink tone="fg3" arrow={false} onClick={() => setAdjusting(i.id)}>
                        Adjust
                      </TextLink>
                    </td>
                  </tr>
                );
              })}
            </Rows>
          </div>
        </section>

        {/* ------------------------------------------------ ledger */}
        <aside className={`border-t pt-6 xl:border-l xl:border-t-0 xl:pl-12 xl:pt-0 ${K.line}`}>
          <div className="flex items-baseline justify-between">
            <Caps>Movement ledger{ledgerFor ? ` · ${ingredientOf(state, ledgerFor)?.name}` : ""}</Caps>
            {ledgerFor && (
              <TextLink tone="fg3" arrow={false} onClick={() => setLedgerFor(null)}>
                all
              </TextLink>
            )}
          </div>
          <ul className={`mt-4 border-t ${K.line}`}>
            {ledger.map((m) => {
              const ing = ingredientOf(state, m.ingredientId);
              return (
                <li key={m.id} className={`border-b py-3 ${K.line2}`}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate">
                      <span className={`mr-2 text-[11px] font-semibold uppercase tracking-[.14em] ${m.kind === "waste" ? K.warn : m.kind === "receipt" ? K.accent : K.fg3}`}>{KIND_LABEL[m.kind]}</span>
                      {ing?.name}
                    </span>
                    <Num className={`shrink-0 text-[16px] ${m.delta < 0 ? K.fg2 : K.accent}`}>
                      {m.delta > 0 ? "+" : "−"}
                      {qty3(Math.abs(m.delta))} {ing?.unit}
                    </Num>
                  </div>
                  <p className={`mt-0.5 truncate text-xs ${K.fg3}`}>
                    {whenOf(m.at, now)} · {m.ref}
                    {m.reason ? ` · ${m.reason}` : ""} · {qty3(m.before)} → {qty3(m.after)} · {staffById(state, m.byId)?.name.split(" ")[0] ?? "system"}
                  </p>
                </li>
              );
            })}
          </ul>
          {!ledger.length && <p className={`mt-6 font-serif text-[20px] italic ${K.fg3}`}>No movements yet.</p>}
        </aside>
      </div>

      <AdjustModal id={adjusting} onClose={() => setAdjusting(null)} />
      <CountModal open={counting} onClose={() => setCounting(false)} />
      <AddIngredient open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AdjustModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const ing = id ? ingredientOf(state, id) : undefined;
  const [kind, setKind] = useState<"waste" | "adjust" | "receipt">("waste");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const n = Number(qty);
  const ok = Boolean(ing && Number.isFinite(n) && n !== 0 && reason.trim().length >= 3);
  return (
    <Modal open={Boolean(ing)} onClose={onClose} kicker={ing ? `${ing.name} · ${qty3(ing.stock)} ${ing.unit} on hand` : undefined} title="Adjust stock">
      {ing && (
        <div className="space-y-7">
          <div className="flex gap-7">
            <Tab name="adj" on={kind === "waste"} onClick={() => setKind("waste")}>
              Waste / spoilage
            </Tab>
            <Tab name="adj" on={kind === "receipt"} onClick={() => setKind("receipt")}>
              Direct delivery
            </Tab>
            <Tab name="adj" on={kind === "adjust"} onClick={() => setKind("adjust")}>
              Correction ±
            </Tab>
          </div>
          <Field label={`Quantity (${ing.unit})`} hint={kind === "waste" ? "Always comes off stock, whatever sign you type." : kind === "receipt" ? "Goods that arrived without a purchase order." : "Positive adds, negative removes."}>
            <input autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={kind === "waste" ? "1.5" : "10"} className={`${inputCls} font-serif text-[40px] lining`} />
          </Field>
          <Field label="Reason" hint="Required — it’s printed in the ledger next to your name.">
            <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 60))} placeholder={kind === "waste" ? "Spoiled in the fridge" : kind === "receipt" ? "Market run, cash receipt" : "Count error"} className={inputCls} />
          </Field>
          <Pill
            tone="accent"
            disabled={!ok}
            right={ok ? `${qty3(Math.max(0, ing.stock + (kind === "waste" ? -Math.abs(n) : n)))} ${ing.unit} after` : undefined}
            onClick={() => {
              dispatch({ type: "stockAdjust", ingredientId: ing.id, delta: n, kind, reason: reason.trim() });
              setQty("");
              setReason("");
              onClose();
            }}
          >
            {kind === "waste" ? "Record waste" : kind === "receipt" ? "Receive" : "Adjust"}
          </Pill>
        </div>
      )}
    </Modal>
  );
}

function CountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const items = state.ingredients.filter((i) => i.category === "Meat & fish" || i.category === "Produce");
  const rows = items.map((i) => {
    const raw = counts[i.id];
    const counted = raw === undefined || raw === "" ? i.stock : Number(raw);
    return { i, counted, diff: Math.round((counted - i.stock) * 1000) / 1000 };
  });
  const variances = rows.filter((r) => r.diff !== 0);
  const valueDiff = variances.reduce((n, r) => n + r.diff * r.i.cost, 0);
  return (
    <Modal open={open} onClose={onClose} kicker="Fridge & freezer · physical count" title="Cycle count" width="max-w-2xl">
      <p className={`text-sm ${K.fg2}`}>Type what you actually counted; leave a line blank to accept the system figure. Variances are written to the ledger as corrections.</p>
      <table className="mt-6 w-full text-sm">
        <thead className={`text-left text-[11px] font-semibold uppercase tracking-[.18em] ${K.fg3}`}>
          <tr className={`border-b ${K.line}`}>
            <th className="py-2 pr-4 font-semibold">Ingredient</th>
            <th className="py-2 pr-4 font-semibold">System</th>
            <th className="py-2 pr-4 font-semibold">Counted</th>
            <th className="py-2 pr-4 text-right font-semibold">Variance</th>
            <th className="py-2 text-right font-semibold">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--line2)">
          {rows.map(({ i, diff }) => (
            <tr key={i.id}>
              <td className="py-2 pr-4">{i.name}</td>
              <td className={`py-2 pr-4 ${K.fg2}`}>
                <Num>{qty3(i.stock)}</Num> <span className={`text-xs ${K.fg3}`}>{i.unit}</span>
              </td>
              <td className="py-2 pr-4">
                <input inputMode="decimal" value={counts[i.id] ?? ""} onChange={(e) => setCounts({ ...counts, [i.id]: e.target.value })} placeholder={qty3(i.stock)} className={`${inputCls} w-24 py-1 font-serif text-[18px] lining`} />
              </td>
              <td className={`py-2 pr-4 text-right ${diff === 0 ? K.fg3 : diff < 0 ? K.warn : K.accent}`}>
                <Num>{diff === 0 ? "—" : `${diff > 0 ? "+" : "−"}${qty3(Math.abs(diff))}`}</Num>
              </td>
              <td className={`py-2 text-right ${diff === 0 ? K.fg3 : K.fg2}`}>
                <Num>{diff === 0 ? "—" : ghs(Math.round(diff * i.cost * 100), true)}</Num>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-7 grid grid-cols-[1fr_auto] items-end gap-8">
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 60))} placeholder="Evening count, freezer 2 defrosting" className={inputCls} />
        </Field>
        <div className="text-right">
          <Caps>{variances.length} variance{variances.length === 1 ? "" : "s"}</Caps>
          <div className="mt-1">
            <Money cents={Math.round(valueDiff * 100)} size="md" tone={valueDiff < 0 ? "fg" : "fg2"} />
          </div>
        </div>
      </div>
      <Pill
        tone="accent"
        className="mt-7"
        onClick={() => {
          dispatch({ type: "stockCount", items: rows.map((r) => ({ ingredientId: r.i.id, counted: r.counted })), note: note.trim() });
          setCounts({});
          setNote("");
          onClose();
        }}
      >
        Save count{variances.length ? ` & correct ${variances.length} line${variances.length > 1 ? "s" : ""}` : ""}
      </Pill>
    </Modal>
  );
}

function AddIngredient({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<IngredientCategory>("Produce");
  const [unit, setUnit] = useState<Unit>("kg");
  const [stock, setStock] = useState("");
  const [min, setMin] = useState("");
  const [cost, setCost] = useState("");
  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id ?? "");
  const ok = name.trim().length >= 2 && Number(cost) > 0 && unit;
  return (
    <Modal open={open} onClose={onClose} kicker="Ingredient stock" title="New ingredient">
      <div className="space-y-7">
        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Ginger (fresh)" className={`${inputCls} font-serif text-[22px]`} />
        </Field>
        <div className="grid grid-cols-3 gap-6">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as IngredientCategory)}>
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Unit">
            <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {(["kg", "L", "pcs", "bag"] as Unit[]).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="Supplier">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Field label="Opening stock">
            <input inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" className={`${inputCls} font-serif text-[22px] lining`} />
          </Field>
          <Field label="Minimum">
            <input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="5" className={`${inputCls} font-serif text-[22px] lining`} />
          </Field>
          <Field label="Cost per unit (GH₵)">
            <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="12.00" className={`${inputCls} font-serif text-[22px] lining`} />
          </Field>
        </div>
        <Pill
          tone="accent"
          disabled={!ok}
          onClick={() => {
            const ingredient: Ingredient = { id: `i${Date.now().toString(36)}`, name: name.trim(), category, unit, stock: Number(stock) || 0, min: Number(min) || 0, cost: Number(cost), supplierId, location: category === "Produce" || category === "Meat & fish" ? "Walk-in fridge" : "Dry store" };
            dispatch({ type: "ingredientAdd", ingredient });
            setName("");
            setStock("");
            setMin("");
            setCost("");
            onClose();
          }}
        >
          Add ingredient
        </Pill>
      </div>
    </Modal>
  );
}
