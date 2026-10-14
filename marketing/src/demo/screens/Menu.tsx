"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { CatKey, Dish } from "../data";
import { cedi, num, parseCedi, pct } from "../money";
import { recipeCost, useStore } from "../store";
import { Badge, Field, Modal, Toggle, cx } from "../ui";
import { OfficeHead } from "./Office";

const IMAGES = ["waakye", "jollof-rice-grilled-chicken", "banku-grilled-tilapia", "fufu-groundnut-soup", "kontomire", "kenkey-fried-fish", "red-red", "omo-tuo", "fried-rice-grilled-chicken", "grilled-tilapia", "grilled-chicken", "beef-suya", "kelewele", "meat-pie", "puff-puff", "sobolo", "palm-wine"];

export function Menu() {
  const { state, api } = useStore();
  const [cat, setCat] = useState<CatKey | "all">("all");
  const [edit, setEdit] = useState<Dish | "new" | null>(null);
  const dishes = state.dishes.filter((d) => cat === "all" || d.cat === cat);
  const off = state.dishes.filter((d) => !d.available).length;

  return (
    <div className="page">
      <OfficeHead module="menu" title="Menu" sub={`${state.dishes.length} dishes · ${off ? `${off} 86'd tonight` : "everything available"} · prices include VAT at the till`}
        actions={<button type="button" className="btn btn-ink" onClick={() => setEdit("new")}><Plus size={16} strokeWidth={3} /> Add dish</button>} />

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={cx("pill", cat === "all" && "is-active")} onClick={() => setCat("all")}>All · {state.dishes.length}</button>
        {state.categories.map((c) => <button key={c.key} type="button" className={cx("pill", cat === c.key && "is-active")} onClick={() => setCat(c.key)}><span className="dot" data-tone={c.key} />{c.name} · {state.dishes.filter((d) => d.cat === c.key).length}</button>)}
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {dishes.map((d) => {
          const cost = recipeCost(state.recipes[d.id], state.ingredients);
          const margin = d.price ? pct(d.price - cost, d.price) : 0;
          return (
            <article key={d.id} className={cx("tile cursor-default", !d.available && "is-off")} data-tone={d.cat}>
              <button type="button" className="tile-img w-full" onClick={() => setEdit(d)} aria-label={`Edit ${d.name}`}>
                {d.img ? <img src={`/dishes/${d.img}.jpg`} alt="" loading="lazy" /> : <span className="ph">{d.name.slice(0, 1)}</span>}
                <span className="tile-cat">{state.categories.find((c) => c.key === d.cat)?.name}</span>
                <span className="tile-mins">{d.mins} min</span>
                {!d.available && <span className="tile-off">86'd</span>}
              </button>
              <div className="flex flex-col gap-0.5 px-1 pt-2.5">
                <button type="button" className="tile-name text-left hover:underline" onClick={() => setEdit(d)}>{d.name}</button>
                <span className="tile-desc">{d.desc}</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between px-1">
                <span className="tile-price"><small>GH₵</small>{num(d.price).replace(/\.00$/, "")}</span>
                {cost > 0 && <Badge tone={margin >= 65 ? "forest" : margin >= 50 ? "sun" : "terra"}>{margin}% margin</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between border-t-2 border-[var(--line)] px-1 pt-2.5 text-[12px] font-bold text-[var(--ink3)]">
                <span>{d.available ? "On the menu" : "Unavailable tonight"}</span>
                <Toggle on={d.available} onChange={() => api.toggleDish(d.id)} label={`${d.name} available`} />
              </div>
            </article>
          );
        })}
      </div>

      {edit && <DishSheet dish={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function DishSheet({ dish, onClose }: { dish: Dish | null; onClose: () => void }) {
  const { state, api } = useStore();
  const [name, setName] = useState(dish?.name ?? "");
  const [desc, setDesc] = useState(dish?.desc ?? "");
  const [cat, setCat] = useState<CatKey>(dish?.cat ?? "kitchen");
  const [price, setPrice] = useState(dish ? num(dish.price) : "");
  const [mins, setMins] = useState(String(dish?.mins ?? 10));
  const [img, setImg] = useState<string | null>(dish?.img ?? null);
  const p = parseCedi(price);
  const cost = dish ? recipeCost(state.recipes[dish.id], state.ingredients) : 0;
  const save = () => {
    const id = dish?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36).slice(-3);
    api.saveDish({ id, name: name.trim(), desc: desc.trim(), cat, price: p, mins: Math.max(1, Number.parseInt(mins, 10) || 1), img, available: dish?.available ?? true });
    onClose();
  };
  return (
    <Modal title={dish ? dish.name : "New dish"} sub={dish ? `Price changes are logged · plated cost ${cedi(cost)} → ${p ? pct(p - cost, p) : 0}% margin at ${cedi(p)}` : "Appears on the Till immediately"} onClose={onClose} size="w"
      foot={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-ink grow" disabled={!name.trim() || !p} onClick={save}>{dish ? "Save changes" : "Add to menu"}</button></>}>
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <Field label="Name" className="col-span-2"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Tilapia Light Soup" /></Field>
        <Field label="Description" className="col-span-2"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's on the plate" /></Field>
        <Field label="Category"><select className="select" value={cat} onChange={(e) => setCat(e.target.value as CatKey)}>{state.categories.map((c) => <option key={c.key} value={c.key}>{c.name} · {c.station}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (GH₵)"><input className="input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></Field>
          <Field label="Prep (min)"><input className="input" value={mins} onChange={(e) => setMins(e.target.value)} inputMode="numeric" /></Field>
        </div>
      </div>
      <div className="field"><span>Photo</span>
        <div className="grid grid-cols-6 gap-2 md:grid-cols-9">
          <button type="button" className={cx("aspect-square rounded-xl border-2 text-[11px] font-bold", img === null ? "border-[var(--ink)] bg-[var(--sun-l)]" : "border-[var(--line)] bg-white")} onClick={() => setImg(null)}>None</button>
          {IMAGES.map((i) => <button key={i} type="button" className={cx("aspect-square overflow-hidden rounded-xl border-2", img === i ? "border-[var(--ink)]" : "border-transparent")} onClick={() => setImg(i)}><img src={`/dishes/${i}.jpg`} alt="" className="h-full w-full object-cover" /></button>)}
        </div>
      </div>
    </Modal>
  );
}
