"use client";

import { RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import type { Settings as SettingsT } from "../data";
import { cedi, num, parseCedi } from "../money";
import { useStore } from "../store";
import { Card, Field, Toggle } from "../ui";
import { OfficeHead } from "./Office";

export function Settings() {
  const { state, api } = useStore();
  const [s, setS] = useState<SettingsT>(() => JSON.parse(JSON.stringify(state.settings)) as SettingsT);
  const [room, setRoom] = useState(num(state.settings.roomService));
  const dirty = JSON.stringify({ ...s, roomService: parseCedi(room) }) !== JSON.stringify(state.settings);
  const patch = <K extends keyof SettingsT>(k: K, v: Partial<SettingsT[K]>) => setS((x) => ({ ...x, [k]: typeof x[k] === "object" ? { ...(x[k] as object), ...v } : v }));
  const save = () => {
    const next = { ...s, roomService: parseCedi(room) };
    const changed: string[] = [];
    if (next.vat !== state.settings.vat) changed.push(`VAT ${state.settings.vat}% → ${next.vat}%`);
    if (next.roomService !== state.settings.roomService) changed.push(`room service ${cedi(state.settings.roomService)} → ${cedi(next.roomService)}`);
    if (JSON.stringify(next.business) !== JSON.stringify(state.settings.business)) changed.push("business details");
    if (JSON.stringify(next.receipt) !== JSON.stringify(state.settings.receipt)) changed.push("receipt text");
    api.saveSettings(next, changed.join(", ") || "no material change");
  };

  return (
    <div className="page">
      <OfficeHead module="settings" title="Settings" sub="Business identity, tax and receipts. Owner only — every change is logged."
        actions={<><button type="button" className="btn btn-ghost" disabled={!dirty} onClick={() => { setS(JSON.parse(JSON.stringify(state.settings)) as SettingsT); setRoom(num(state.settings.roomService)); }}>Discard</button><button type="button" className="btn btn-ink" disabled={!dirty} onClick={save}><Save size={16} /> Save changes</button></>} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Business">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trading name" className="col-span-2"><input className="input" value={s.business.name} onChange={(e) => patch("business", { name: e.target.value })} /></Field>
            <Field label="Branch"><input className="input" value={s.business.branch} onChange={(e) => patch("business", { branch: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={s.business.phone} onChange={(e) => patch("business", { phone: e.target.value })} /></Field>
            <Field label="Address" className="col-span-2"><input className="input" value={s.business.address} onChange={(e) => patch("business", { address: e.target.value })} /></Field>
            <Field label="GRA TIN" hint="Printed on every receipt when enabled below"><input className="input" value={s.business.tin} onChange={(e) => patch("business", { tin: e.target.value })} /></Field>
          </div>
        </Card>

        <Card title="Tax & charges">
          <div className="grid grid-cols-2 gap-3">
            <Field label="VAT rate (%)" hint="Applied to goods after discounts; tips are never taxed"><input className="input lg" value={s.vat} inputMode="decimal" onChange={(e) => setS((x) => ({ ...x, vat: Math.max(0, Math.min(50, Number.parseFloat(e.target.value) || 0)) }))} /></Field>
            <Field label="Room-service charge (GH₵)" hint="Added to orders on Rooms, not taxed"><input className="input lg" value={room} inputMode="decimal" onChange={(e) => setRoom(e.target.value)} /></Field>
          </div>
          <div className="mt-4 rounded-2xl bg-[var(--cream2)] p-4 text-[13px]">
            <div className="kicker mb-2">Worked example</div>
            Jollof 65.00 + Sobolo 12.00 = 77.00 · VAT {s.vat}% = {num(Math.round(7700 * s.vat / 100))} · <b>total {cedi(7700 + Math.round(7700 * s.vat / 100))}</b>{parseCedi(room) ? ` · in a room ${cedi(7700 + Math.round(7700 * s.vat / 100) + parseCedi(room))}` : ""}
          </div>
        </Card>

        <Card title="Receipts">
          <div className="grid gap-3">
            <Field label="Header line"><input className="input" value={s.receipt.header} onChange={(e) => patch("receipt", { header: e.target.value })} /></Field>
            <Field label="Footer line"><input className="input" value={s.receipt.footer} onChange={(e) => patch("receipt", { footer: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-2xl border-2 border-[var(--line)] bg-white px-4 py-3"><span className="font-bold">Print GRA TIN on receipts</span><Toggle on={s.receipt.showTin} onChange={(v) => patch("receipt", { showTin: v })} /></div>
          </div>
        </Card>

        <Card title="Kitchen display">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Warn after (min)"><input className="input lg" value={s.kds.warn} inputMode="numeric" onChange={(e) => patch("kds", { warn: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })} /></Field>
            <Field label="Urgent after (min)"><input className="input lg" value={s.kds.urgent} inputMode="numeric" onChange={(e) => patch("kds", { urgent: Math.max(2, Number.parseInt(e.target.value, 10) || 2) })} /></Field>
          </div>
          <p className="mt-3 text-[12.5px] font-medium text-[var(--ink3)]">Tickets turn yellow at the warning and red at urgent, on every pass screen.</p>
        </Card>

        <Card title="Demo data" className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[60ch] text-[13px] text-[var(--ink2)]">Everything you do here is saved in this browser only. Reset puts the restaurant back to the start of tonight's service: three open tables, twelve paid orders, one drawer, a couple of purchase orders.</p>
            <button type="button" className="btn btn-terra" onClick={() => { if (confirm("Reset the demo? All changes in this browser are lost.")) api.reset(); }}><RotateCcw size={16} /> Reset demo data</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
