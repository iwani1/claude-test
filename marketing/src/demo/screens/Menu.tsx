"use client";

import { useState } from "react";
import { CATEGORIES, MENU, type Category, type MenuItem, type Station } from "../data";
import { ghs } from "../pricing";
import { recipeCost, useDemo } from "../store";
import { Caps, Field, inputCls, K, Modal, Num, PageHead, Pill, Rows, Select, Switch, Tab, TextLink } from "../ui";

export function Menu() {
  const { state, dispatch } = useDemo();
  const [cat, setCat] = useState<Category | "All">("All");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const items = state.menu.filter((m) => cat === "All" || m.category === cat);
  const off = state.menu.filter((m) => !m.available).length;
  const sold = (id: string) => state.orders.reduce((n, o) => n + o.lines.filter((l) => l.itemId === id).reduce((k, l) => k + l.qty, 0), 0);

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Catalogue" title="The menu." lede={`${state.menu.length} dishes across ${CATEGORIES.length} categories${off ? ` · ${off} off the menu right now` : " · everything available"}. Switch a dish off here and it greys out on every till within the second.`}>
        <TextLink tone="fg2" onClick={() => setAdding(true)}>
          Add a dish
        </TextLink>
      </PageHead>

      <div className="mt-10 flex gap-7">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <Tab key={c} name="menucat" on={cat === c} onClick={() => setCat(c)}>
            {c}
          </Tab>
        ))}
      </div>

      <div className="mt-6">
        <Rows head={["Dish", "Station", "Prep", "Recipe cost", "Food cost", "Sold today", "Available", "Price"]}>
          {items.map((m) => {
            const cost = recipeCost(state, m.id);
            const pct = m.price ? Math.round((cost / m.price) * 100) : 0;
            return (
              <tr key={m.id}>
                <td className="py-3 pr-4">
                  <button type="button" onClick={() => setEditing(m.id)} className="flex items-center gap-4 text-left hover:text-(--accent)">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image loader */}
                    <img src={m.img} alt="" width={44} height={44} className={`dish h-11 w-11 rounded-lg object-cover ${m.available ? "" : "opacity-40 grayscale"}`} />
                    <span>
                      <span className={`block font-serif text-[17px] ${m.available ? "" : K.fg3}`}>{m.name}</span>
                      <span className={`block text-xs ${K.fg3}`}>{m.category}</span>
                    </span>
                  </button>
                </td>
                <td className={`py-3 pr-4 text-xs uppercase tracking-[.14em] ${K.fg3}`}>{m.station}</td>
                <td className={`py-3 pr-4 ${K.fg2}`}>
                  <Num>{m.prepMinutes}</Num> <span className={`text-xs ${K.fg3}`}>min</span>
                </td>
                <td className={`py-3 pr-4 ${K.fg2}`}>{state.recipes[m.id]?.length ? <Num>{ghs(Math.round(cost * 100))}</Num> : <span className={`text-xs ${K.fg3}`}>no recipe</span>}</td>
                <td className={`py-3 pr-4 ${pct > 35 ? K.warn : K.fg2}`}>{state.recipes[m.id]?.length ? <Num>{pct}%</Num> : "—"}</td>
                <td className={`py-3 pr-4 ${K.fg2}`}>
                  <Num>{sold(m.id)}</Num>
                </td>
                <td className="py-3 pr-4">
                  <Switch on={m.available} onChange={(v) => dispatch({ type: "menuUpdate", id: m.id, patch: { available: v } })} label={m.available ? "On" : "Off"} />
                </td>
                <td className="py-3 text-right">
                  <Num className="text-[18px]">{m.price}</Num>
                </td>
              </tr>
            );
          })}
        </Rows>
      </div>

      <EditDish id={editing} onClose={() => setEditing(null)} />
      <AddDish open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function EditDish({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const m = state.menu.find((x) => x.id === id);
  return (
    <Modal open={Boolean(m)} onClose={onClose} kicker={m?.category} title={m?.name ?? ""}>
      {m && <DishForm key={m.id} initial={m} onSave={(patch) => dispatch({ type: "menuUpdate", id: m.id, patch })} onClose={onClose} />}
    </Modal>
  );
}

function AddDish({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemo();
  return (
    <Modal open={open} onClose={onClose} kicker="Catalogue" title="New dish">
      <DishForm
        initial={{ id: "", name: "", short: "", price: 0, category: "Kitchen", img: MENU[0].img, kitchen: true, station: "kitchen", available: true, prepMinutes: 15 }}
        isNew
        onSave={(patch) => {
          const name = patch.name ?? "New dish";
          dispatch({ type: "menuAdd", item: { id: `m${Date.now().toString(36)}`, name, short: name.length > 18 ? name.slice(0, 16) + "…" : name, price: patch.price ?? 0, category: patch.category ?? "Kitchen", img: patch.img ?? MENU[0].img, kitchen: (patch.station ?? "kitchen") !== "bar", station: patch.station ?? "kitchen", available: true, prepMinutes: patch.prepMinutes ?? 15 } });
        }}
        onClose={onClose}
      />
    </Modal>
  );
}

function DishForm({ initial, isNew = false, onSave, onClose }: { initial: MenuItem; isNew?: boolean; onSave: (patch: Partial<MenuItem>) => void; onClose: () => void }) {
  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState(initial.price ? String(initial.price) : "");
  const [category, setCategory] = useState<Category>(initial.category);
  const [station, setStation] = useState<Station>(initial.station);
  const [prep, setPrep] = useState(String(initial.prepMinutes));
  const [img, setImg] = useState(initial.img);
  const ok = name.trim().length >= 2 && Number(price) > 0;
  return (
    <div className="space-y-7">
      <Field label="Name">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 48))} placeholder="Grilled Octopus" className={`${inputCls} font-serif text-[22px]`} />
      </Field>
      <div className="grid grid-cols-3 gap-6">
        <Field label="Price (GH₵)">
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} font-serif text-[28px] lining`} />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Station">
          <Select value={station} onChange={(e) => setStation(e.target.value as Station)}>
            <option value="kitchen">Kitchen</option>
            <option value="grill">Grill</option>
            <option value="bar">Bar (no ticket)</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-6">
        <Field label="Prep (min)">
          <input inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value.replace(/\D/g, "").slice(0, 3))} className={`${inputCls} font-serif text-[22px] lining`} />
        </Field>
        <Field label="Photo">
          <Select value={img} onChange={(e) => setImg(e.target.value)}>
            {MENU.map((x) => (
              <option key={x.id} value={x.img}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <Caps>{isNew ? "Appears on every till immediately" : `Changes apply to the next bill`}</Caps>
        <Pill
          tone="accent"
          size="md"
          className="!w-auto"
          disabled={!ok}
          onClick={() => {
            onSave({ name: name.trim(), price: Number(price), category, station, prepMinutes: Number(prep) || 15, img });
            onClose();
          }}
        >
          {isNew ? "Add dish" : "Save"}
        </Pill>
      </div>
    </div>
  );
}
