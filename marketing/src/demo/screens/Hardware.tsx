"use client";

import { useState } from "react";
import { type Hardware as HardwareT } from "../data";
import { shiftTotals, useDemo } from "../store";
import { Caps, Field, inputCls, K, Num, PageHead, Pill, Switch, Tab, TextLink } from "../ui";

export function Hardware() {
  const { state, dispatch } = useDemo();
  const h = state.hardware;
  const [d, setD] = useState<HardwareT>(h);
  const dirty = JSON.stringify(d) !== JSON.stringify(h);
  const t = shiftTotals(state);
  const tenders = Object.values(d.tenders).filter(Boolean).length;
  const set = <K extends keyof HardwareT>(k: K, v: HardwareT[K]) => setD({ ...d, [k]: v });

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Hardware & tenders" title="Printers, payments, connections." lede="Receipts go to an ESC/POS printer on the network or to the browser’s print dialog. Payment methods switched off here disappear from the pay sheet on every till.">
        {dirty && (
          <TextLink tone="fg3" arrow={false} onClick={() => setD(h)}>
            Discard
          </TextLink>
        )}
        <Pill tone="accent" size="md" className="!w-auto" disabled={!dirty || tenders === 0} onClick={() => dispatch({ type: "hardwareSave", patch: d })}>
          Save
        </Pill>
      </PageHead>

      <div className="mt-10 grid gap-14 lg:grid-cols-2 lg:gap-20">
        <section className="space-y-12">
          <div>
            <Caps>Receipt printer</Caps>
            <div className="mt-5 flex gap-7">
              <Tab name="printer" on={d.printerMode === "network"} onClick={() => set("printerMode", "network")}>
                Network ESC/POS
              </Tab>
              <Tab name="printer" on={d.printerMode === "browser"} onClick={() => set("printerMode", "browser")}>
                Browser print
              </Tab>
            </div>
            {d.printerMode === "network" ? (
              <div className="mt-6 grid grid-cols-[1fr_120px] gap-6">
                <Field label="Printer IP" hint="Epson TM-T20 / Xprinter · same Wi-Fi as the till.">
                  <input value={d.printerIp} onChange={(e) => set("printerIp", e.target.value.replace(/[^\d.]/g, "").slice(0, 15))} className={`${inputCls} font-serif text-[22px] lining`} />
                </Field>
                <Field label="Port">
                  <input inputMode="numeric" value={String(d.printerPort)} onChange={(e) => set("printerPort", Number(e.target.value.replace(/\D/g, "").slice(0, 5)) || 9100)} className={`${inputCls} font-serif text-[22px] lining`} />
                </Field>
              </div>
            ) : (
              <p className={`mt-6 text-sm ${K.fg2}`}>Receipts open in the browser’s print dialog — handy for a laptop till or an A4 printer in the office.</p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
              <TextLink tone="fg2" onClick={() => dispatch({ type: "toast", text: d.printerMode === "network" ? `Test page sent to ${d.printerIp}:${d.printerPort} — 42 columns, cutter OK` : "Test page opened in the print dialog", tone: "ok" })}>
                Print a test page
              </TextLink>
              <Switch on={d.kitchenPrinter} onChange={(v) => set("kitchenPrinter", v)} label="Also print kitchen tickets (alongside the screen)" />
            </div>
          </div>

          <div>
            <Caps>Connection</Caps>
            <div className={`mt-5 flex items-center justify-between border-t py-4 ${K.line}`}>
              <div>
                <p className="text-sm">{state.online ? "Online · syncing live" : "Offline · sales queue on this device"}</p>
                <p className={`mt-0.5 text-xs ${K.fg3}`}>{state.online ? `${t.queued ? `${t.queued} queued earlier, now synced · ` : ""}MoMo prompts go out immediately` : `${t.queued} sale${t.queued === 1 ? "" : "s"} waiting to sync · cash works as normal`}</p>
              </div>
              <Switch on={state.online} onChange={(v) => dispatch({ type: "online", online: v })} label={state.online ? "Online" : "Offline"} />
            </div>
            <p className={`mt-3 text-xs ${K.fg3}`}>Toggle this to rehearse a network drop — the same switch is in the header.</p>
          </div>
        </section>

        <section className="space-y-12">
          <div>
            <Caps>Payment methods</Caps>
            <ul className={`mt-5 border-t ${K.line}`}>
              {(
                [
                  ["cash", "Cash", "Drawer kick, change calculated, counted at close"],
                  ["momo", "Mobile money", `MTN · Telecel · AirtelTigo · merchant ${state.settings.momoMerchant}`],
                  ["ghqr", "GhQR", "Guest scans a code on the customer display"],
                  ["split", "Split cash + MoMo", "One bill, two tenders, one receipt"],
                ] as const
              ).map(([k, label, sub]) => (
                <li key={k} className={`flex items-center justify-between gap-6 border-b py-4 ${K.line2}`}>
                  <div>
                    <p className="text-sm">{label}</p>
                    <p className={`mt-0.5 text-xs ${K.fg3}`}>{sub}</p>
                  </div>
                  <Switch on={d.tenders[k]} onChange={(v) => set("tenders", { ...d.tenders, [k]: v })} />
                </li>
              ))}
            </ul>
            {tenders === 0 && <p className={`mt-3 text-xs ${K.warn}`}>Keep at least one payment method on.</p>}
          </div>

          <div>
            <Caps>Accounting export</Caps>
            <div className="mt-5 flex gap-7">
              {(["quickbooks", "xero", "none"] as const).map((a) => (
                <Tab key={a} name="acct" on={d.accounting === a} onClick={() => set("accounting", a)}>
                  {a === "quickbooks" ? "QuickBooks" : a === "xero" ? "Xero" : "None"}
                </Tab>
              ))}
            </div>
            <p className={`mt-4 text-sm ${K.fg2}`}>{d.accounting === "none" ? "Reports still export a plain sales CSV." : `Reports export a ${d.accounting === "xero" ? "Xero manual-journal" : "QuickBooks journal"} CSV: cash and MoMo takings, net revenue, VAT payable and tips payable.`}</p>
          </div>

          <div>
            <Caps>This terminal</Caps>
            <dl className={`mt-5 grid grid-cols-2 gap-y-3 border-t pt-4 text-sm ${K.line}`}>
              <dt className={K.fg3}>Device</dt>
              <dd className="lining">Till 1 · front counter</dd>
              <dt className={K.fg3}>Build</dt>
              <dd className="lining">
                <Num>2026.10</Num> · demo
              </dd>
              <dt className={K.fg3}>Storage</dt>
              <dd className="lining">this browser · local only</dd>
              <dt className={K.fg3}>Last sync</dt>
              <dd className="lining">{state.online ? "just now" : "paused"}</dd>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
