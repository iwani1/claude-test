"use client";

import { ArrowRight, CalendarDays, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import type { Table, Zone } from "../data";
import { ago, cedi, num } from "../money";
import { openOrderFor, totals, useStore } from "../store";
import { Field, Modal, Stepper, cx, useNow } from "../ui";

const ZONES: Zone[] = ["Floor", "Bar", "Rooms", "Takeaway"];

export function Floor() {
  const { state, api } = useStore();
  const now = useNow(30000);
  const [sel, setSel] = useState<Table | null>(null);
  const counts = { open: 0, free: 0, reserved: 0, cleaning: 0 };
  for (const t of state.tables) counts[t.status]++;
  const covers = state.orders.filter((o) => o.status === "open").reduce((s, o) => s + o.guests, 0);
  const floorValue = state.orders.filter((o) => o.status === "open").reduce((s, o) => s + totals(o, state.settings.vat).total, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker" style={{ color: "var(--sun-d)" }}>Service · Floor</div>
          <h1 className="page-title mt-2">The floor</h1>
          <p className="page-sub">{covers} guests seated · {cedi(floorValue)} on open bills</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="pill is-active">{counts.open} open</span>
          <span className="pill">{counts.free} free</span>
          <span className="pill" style={{ borderColor: "var(--cobalt)", color: "var(--cobalt)" }}>{counts.reserved} reserved</span>
          <span className="pill">{counts.cleaning} to clear</span>
        </div>
      </div>

      {ZONES.map((z) => {
        const tables = state.tables.filter((t) => t.zone === z);
        if (!tables.length) return null;
        return (
          <section key={z} className="mb-7">
            <h2 className="kicker mb-3">{z}</h2>
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {tables.map((t) => {
                const o = openOrderFor(state, t.id);
                const tot = o ? totals(o, state.settings.vat) : null;
                const mins = o ? Math.round((now - o.opened) / 60000) : 0;
                const unsent = o?.lines.filter((l) => !l.sent).length ?? 0;
                return (
                  <button key={t.id} type="button" className={cx("tcard", `is-${t.status}`, t.status === "open" && mins > 90 && "is-hot")} onClick={() => setSel(t)}>
                    <span className="flex items-start justify-between">
                      <span className="tcard-code">{t.code}</span>
                      <span className="tcard-seats flex items-center gap-1"><Users size={12} strokeWidth={3} />{o ? o.guests : t.seats}</span>
                    </span>
                    {t.status === "open" && o && tot && (
                      <span>
                        <span className="tcard-total block">{cedi(tot.total)}</span>
                        <span className="tcard-foot mt-1"><span>{tot.items} items · {mins} min</span>{unsent > 0 && <span className="rounded-md bg-[var(--ink)] px-1.5 py-0.5 text-[10px] text-[var(--cream)]">{unsent} unsent</span>}</span>
                      </span>
                    )}
                    {t.status === "free" && <span className="tcard-foot"><span>{t.zone === "Takeaway" ? "Walk-ins" : "Free"}</span><span className="opacity-60">Tap to seat</span></span>}
                    {t.status === "reserved" && t.reservation && <span><span className="d block text-[16px] font-extrabold">{t.reservation.time}</span><span className="tcard-foot mt-0.5"><span className="truncate">{t.reservation.name}</span><span>{t.reservation.guests} pax</span></span></span>}
                    {t.status === "cleaning" && <span className="tcard-foot"><span className="flex items-center gap-1.5"><Sparkles size={13} /> Needs clearing</span></span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {sel && <TableSheet table={state.tables.find((t) => t.id === sel.id)!} onClose={() => setSel(null)} />}
    </div>
  );
}

function TableSheet({ table, onClose }: { table: Table; onClose: () => void }) {
  const { state, api } = useStore();
  const o = openOrderFor(state, table.id);
  const [guests, setGuests] = useState(table.reservation?.guests ?? Math.min(2, Math.max(1, table.seats)));
  const [mode, setMode] = useState<"main" | "reserve">("main");
  const [name, setName] = useState("");
  const [time, setTime] = useState("20:00");
  const t = o ? totals(o, state.settings.vat) : null;

  if (mode === "reserve") {
    return (
      <Modal title={`Reserve ${table.label}`} sub="Shows dashed blue on the floor until the party is seated" onClose={onClose} tone="cobalt"
        foot={<><button type="button" className="btn btn-ghost" onClick={() => setMode("main")}>Back</button><button type="button" className="btn btn-cobalt grow" disabled={!name.trim()} onClick={() => { api.reserve(table.id, name.trim(), time, guests); onClose(); }}>Reserve</button></>}>
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Mensah party" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time"><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field label="Guests"><div className="pt-1"><Stepper value={guests} onChange={setGuests} min={1} max={30} /></div></Field>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={table.label} sub={`${table.zone} · ${table.seats ? `${table.seats} seats` : "walk-in counter"} · ${table.status === "open" ? "open" : table.status === "reserved" ? `reserved for ${table.reservation?.name} at ${table.reservation?.time}` : table.status === "cleaning" ? "needs clearing" : "free"}`} onClose={onClose}>
      {o && t && (
        <>
          <div className="card-soft p-4">
            <div className="flex items-baseline justify-between"><span className="d text-[15px] font-bold">Order #{o.id}</span><span className="text-[12px] font-semibold text-[var(--ink3)]">opened {ago(o.opened)} ago · {o.guests} guests</span></div>
            <ul className="mt-2 flex flex-col gap-1 text-[13px]">
              {o.lines.map((l) => <li key={l.id} className="flex justify-between"><span><b className="d">{l.qty}×</b> {l.name}{l.note ? <span className="text-[var(--ink3)]"> — {l.note}</span> : ""}{!l.sent && <span className="c-terra font-bold"> · unsent</span>}</span><span className="num">{num(l.price * l.qty)}</span></li>)}
              {!o.lines.length && <li className="text-[var(--ink3)]">Nothing ordered yet</li>}
            </ul>
            <div className="mt-3 flex justify-between border-t-2 border-dotted border-[var(--line2)] pt-2"><span className="font-bold">Total incl. VAT</span><span className="d text-[18px] font-extrabold">{cedi(t.total)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-sun" onClick={() => { api.pickTable(table.id); api.go("till"); }}>Open in Till <ArrowRight size={16} strokeWidth={3} /></button>
            <button type="button" className="btn btn-ghost" onClick={() => { api.print(`Bill #${o.id}`); }}>Print bill</button>
          </div>
        </>
      )}
      {!o && table.status === "cleaning" && (
        <button type="button" className="btn btn-sun btn-lg" onClick={() => { api.clearTable(table.id); onClose(); }}><Sparkles size={18} /> Mark {table.label} free</button>
      )}
      {!o && table.status !== "cleaning" && (
        <>
          {table.zone !== "Takeaway" && (
            <div className="flex items-center justify-between rounded-2xl border-2 border-[var(--line)] bg-white px-4 py-3">
              <span className="font-bold">Guests</span>
              <Stepper value={guests} onChange={setGuests} min={1} max={30} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-sun" onClick={() => { api.seat(table.id, table.zone === "Takeaway" ? 1 : guests); onClose(); }}>{table.status === "reserved" ? "Seat the party" : table.zone === "Takeaway" ? "New takeaway" : "Seat & order"} <ArrowRight size={16} strokeWidth={3} /></button>
            {table.status === "reserved" ? (
              <button type="button" className="btn btn-ghost" onClick={() => { api.clearTable(table.id); onClose(); }}>Cancel reservation</button>
            ) : table.zone !== "Takeaway" ? (
              <button type="button" className="btn btn-ghost" onClick={() => setMode("reserve")}><CalendarDays size={16} /> Reserve</button>
            ) : null}
          </div>
        </>
      )}
    </Modal>
  );
}
