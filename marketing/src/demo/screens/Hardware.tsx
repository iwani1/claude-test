"use client";

import { Banknote, Monitor, Printer, QrCode, Smartphone, Wifi, WifiOff, Zap } from "lucide-react";
import { useState } from "react";
import { useStore } from "../store";
import { Badge, Card, Field, Toggle } from "../ui";
import { OfficeHead } from "./Office";

export function Hardware() {
  const { state, api } = useStore();
  const s = state.settings;
  const [ip, setIp] = useState(s.printer.ip);
  const [port, setPort] = useState(String(s.printer.port));
  const setTender = (patch: Partial<typeof s.tenders>, what: string) => api.saveSettings({ ...s, tenders: { ...s.tenders, ...patch } }, what);
  const setNet = (n: "MTN" | "Telecel" | "AT", v: boolean) => api.saveSettings({ ...s, tenders: { ...s.tenders, networks: { ...s.tenders.networks, [n]: v } } }, `MoMo ${n} ${v ? "enabled" : "disabled"}`);
  const screens = [
    { name: "Kitchen pass", where: "Main kitchen · 15\" tablet", online: true, tickets: state.tickets.filter((t) => t.status !== "bumped").length },
    { name: "Grill station", where: "Outdoor grill · 10\" tablet", online: true, tickets: state.tickets.filter((t) => t.status !== "bumped" && t.lineIds.some((id) => state.orders.flatMap((o) => o.lines).find((l) => l.id === id)?.station === "grill")).length },
    { name: "Bar", where: "Bar counter · receipt printer", online: false, tickets: 0 },
  ];

  return (
    <div className="page">
      <OfficeHead module="hardware" title="Hardware & tenders" sub="What's plugged in and which ways guests can pay. Tender switches change the Till immediately." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Receipt printer" actions={<Badge tone={s.printer.online ? "forest" : "terra"}>{s.printer.online ? <><Wifi size={12} /> Online</> : <><WifiOff size={12} /> Offline</>}</Badge>}>
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-[var(--ink)] text-[var(--sun)]"><Printer size={26} /></span>
            <div className="min-w-0 flex-1">
              <div className="d text-[16px] font-bold">{s.printer.name}</div>
              <div className="text-[12.5px] font-semibold text-[var(--ink3)]">ESC/POS over the network · 80 mm thermal · opens the cash drawer</div>
              <div className="mt-3 grid grid-cols-[1fr_110px] gap-2">
                <Field label="IP address"><input className="input" value={ip} onChange={(e) => setIp(e.target.value)} /></Field>
                <Field label="Port"><input className="input" value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" /></Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-ink" onClick={() => api.print("Test page")}>Test print</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => { api.saveSettings({ ...s, printer: { ...s.printer, ip: ip.trim(), port: Number.parseInt(port, 10) || 9100 } }, `printer ${ip.trim()}:${port}`); }} disabled={ip === s.printer.ip && port === String(s.printer.port)}>Save address</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => api.saveSettings({ ...s, printer: { ...s.printer, online: !s.printer.online } }, `printer marked ${s.printer.online ? "offline" : "online"}`)}>{s.printer.online ? "Simulate offline" : "Bring online"}</button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Cash drawer" actions={<Badge tone="forest">Connected via printer</Badge>}>
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-[var(--forest)] text-white"><Banknote size={26} /></span>
            <div className="flex-1">
              <div className="d text-[16px] font-bold">Drawer kick · RJ11</div>
              <div className="text-[12.5px] font-semibold text-[var(--ink3)]">Fires on every cash sale and cash refund. Manual opens are logged to the audit trail.</div>
              <button type="button" className="btn btn-sm btn-ink mt-3" onClick={() => api.print("Drawer kick (no sale)")}><Zap size={14} /> Open drawer (no sale)</button>
            </div>
          </div>
        </Card>

        <Card title="Kitchen screens" pad={false}>
          <table className="tbl">
            <thead><tr><th>Screen</th><th>Where</th><th>Status</th><th className="r">Live tickets</th></tr></thead>
            <tbody>
              {screens.map((k) => <tr key={k.name}><td className="strong"><Monitor size={14} className="mr-2 inline" />{k.name}</td><td className="text-[var(--ink2)]">{k.where}</td><td><Badge tone={k.online ? "forest" : "terra"}>{k.online ? "Online" : "Offline — printing instead"}</Badge></td><td className="r d strong">{k.tickets}</td></tr>)}
            </tbody>
          </table>
        </Card>

        <Card title="Tenders">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between rounded-2xl border-2 border-[var(--line)] bg-white px-4 py-3"><span className="flex items-center gap-3"><span className="dot" data-tone="forest" /><span><b className="d">Cash</b><span className="block text-[12px] font-semibold text-[var(--ink3)]">GH₵ notes and coins · change calculated at the till</span></span></span><Toggle on={s.tenders.cash} onChange={(v) => setTender({ cash: v }, `Cash ${v ? "enabled" : "disabled"}`)} /></div>
            <div className="rounded-2xl border-2 border-[var(--line)] bg-white px-4 py-3">
              <div className="flex items-center justify-between"><span className="flex items-center gap-3"><span className="dot" data-tone="sun" /><span><b className="d"><Smartphone size={14} className="mr-1 inline" />Mobile Money</b><span className="block text-[12px] font-semibold text-[var(--ink3)]">Push a payment prompt to the guest's phone</span></span></span><Toggle on={s.tenders.momo} onChange={(v) => setTender({ momo: v }, `MoMo ${v ? "enabled" : "disabled"}`)} /></div>
              {s.tenders.momo && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["MTN", "Telecel", "AT"] as const).map((n) => (
                    <label key={n} className="flex items-center justify-between rounded-xl bg-[var(--cream)] px-3 py-2 text-[13px] font-bold"><span>{n === "AT" ? "AirtelTigo" : n}</span><Toggle on={s.tenders.networks[n]} onChange={(v) => setNet(n, v)} sun /></label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-2xl border-2 border-[var(--line)] bg-white px-4 py-3"><span className="flex items-center gap-3"><span className="dot" data-tone="terra" /><span><b className="d"><QrCode size={14} className="mr-1 inline" />GhQR</b><span className="block text-[12px] font-semibold text-[var(--ink3)]">Universal QR · any bank or wallet app · settles next day</span></span></span><Toggle on={s.tenders.ghqr} onChange={(v) => setTender({ ghqr: v }, `GhQR ${v ? "enabled" : "disabled"}`)} /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
