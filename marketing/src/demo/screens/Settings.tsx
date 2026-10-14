"use client";

import { useState } from "react";
import { type Settings as SettingsT } from "../data";
import { ghs, toCents } from "../pricing";
import { useDemo } from "../store";
import { Caps, Field, inputCls, K, Money, Num, PageHead, Pill, Switch, TextLink } from "../ui";
import { Receipt } from "./Till";

export function Settings() {
  const { state, dispatch } = useDemo();
  const s = state.settings;
  const [d, setD] = useState<SettingsT>(s);
  const dirty = (Object.keys(s) as (keyof SettingsT)[]).some((k) => s[k] !== d[k]);
  const set = <K extends keyof SettingsT>(k: K, v: SettingsT[K]) => setD({ ...d, [k]: v });
  const sample = state.orders.find((o) => o.payment && o.type === "dine_in" && !o.refund) ?? state.orders.find((o) => o.payment);
  const sampleVat = 100 * (d.vatPercent / 100);

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Restaurant settings" title="How the bill is built." lede="Tax, charges and receipt wording. Changes apply to the next bill priced — nothing already paid is touched, and every save is written to the audit log.">
        {dirty && (
          <TextLink tone="fg3" arrow={false} onClick={() => setD(s)}>
            Discard
          </TextLink>
        )}
        <Pill tone="accent" size="md" className="!w-auto" disabled={!dirty} onClick={() => dispatch({ type: "settingsSave", patch: d })}>
          Save settings
        </Pill>
      </PageHead>

      <div className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20">
        <div className="space-y-14">
          <section>
            <Caps>Business</Caps>
            <div className="mt-5 grid gap-7 sm:grid-cols-2">
              <Field label="Trading name">
                <input value={d.name} onChange={(e) => set("name", e.target.value.slice(0, 60))} className={inputCls} />
              </Field>
              <Field label="GRA TIN" hint="Printed on every receipt.">
                <input value={d.tin} onChange={(e) => set("tin", e.target.value.toUpperCase().slice(0, 15))} className={`${inputCls} lining`} />
              </Field>
              <Field label="Address">
                <input value={d.address} onChange={(e) => set("address", e.target.value.slice(0, 80))} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-6">
                <Field label="Phone">
                  <input value={d.phone} onChange={(e) => set("phone", e.target.value.slice(0, 16))} className={`${inputCls} lining`} />
                </Field>
                <Field label="Email">
                  <input value={d.email} onChange={(e) => set("email", e.target.value.slice(0, 48))} className={inputCls} />
                </Field>
              </div>
            </div>
          </section>

          <section>
            <Caps>Tax & charges</Caps>
            <div className="mt-5 grid gap-7 sm:grid-cols-3">
              <Field label="VAT %" hint={`On GH₵ 100 of food: ${ghs(toCents(sampleVat))} tax`}>
                <input inputMode="decimal" value={String(d.vatPercent)} onChange={(e) => set("vatPercent", Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className={`${inputCls} font-serif text-[28px] lining`} />
              </Field>
              <Field label="Service charge %" hint="0 keeps tips voluntary.">
                <input inputMode="decimal" value={String(d.serviceChargePercent)} onChange={(e) => set("serviceChargePercent", Math.min(25, Math.max(0, Number(e.target.value) || 0)))} className={`${inputCls} font-serif text-[28px] lining`} />
              </Field>
              <Field label="Room-service charge (GH₵)" hint="Added to every room bill before VAT.">
                <input inputMode="decimal" value={(d.roomChargeCents / 100).toFixed(2)} onChange={(e) => set("roomChargeCents", toCents(Math.max(0, Number(e.target.value) || 0)))} className={`${inputCls} font-serif text-[28px] lining`} />
              </Field>
            </div>
            <div className="mt-7">
              <Switch on={d.compBreakfast} onChange={(v) => set("compBreakfast", v)} label="Complimentary breakfast for hotel guests — the till can zero a room bill with a manager’s approval" />
            </div>
          </section>

          <section>
            <Caps>Mobile money</Caps>
            <div className="mt-5 grid gap-7 sm:grid-cols-2">
              <Field label="Merchant number" hint="Shown on the MoMo prompt and the receipt.">
                <input value={d.momoMerchant} onChange={(e) => set("momoMerchant", e.target.value.slice(0, 16))} className={`${inputCls} font-serif text-[22px] lining`} />
              </Field>
              <Field label="Default network">
                <div className="flex gap-6 pt-2">
                  {["MTN", "Telecel", "AirtelTigo"].map((n) => (
                    <button key={n} type="button" onClick={() => set("momoNetwork", n)} className={`text-sm transition-colors ${d.momoNetwork === n ? `${K.fg} underline underline-offset-4 decoration-(--accent)` : `${K.fg3} hover:text-(--fg)`}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          <section>
            <Caps>Receipt</Caps>
            <div className="mt-5 grid gap-7 sm:grid-cols-2">
              <Field label="Header line">
                <input value={d.receiptHeader} onChange={(e) => set("receiptHeader", e.target.value.slice(0, 32))} className={`${inputCls} uppercase tracking-[.1em]`} />
              </Field>
              <Field label="Footer line">
                <input value={d.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value.slice(0, 48))} className={inputCls} />
              </Field>
            </div>
          </section>
        </div>

        <aside className={`self-start border-t pt-6 lg:sticky lg:top-[124px] lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0 ${K.line}`}>
          <Caps>Live preview</Caps>
          <p className={`mt-1 text-xs ${K.fg3}`}>A paid bill from this shift, printed with the draft settings.</p>
          <div className="mt-5">{sample ? <Receipt order={sample} settings={d} /> : <p className={`font-serif italic ${K.fg3}`}>No paid bill yet.</p>}</div>
          <dl className={`mt-6 grid grid-cols-2 gap-4 border-t pt-4 text-xs ${K.line} ${K.fg3}`}>
            <div>
              <dt>Room bill of GH₵ 100</dt>
              <dd className="mt-1">
                <Money cents={Math.round((10000 + d.roomChargeCents) * (1 + d.vatPercent / 100))} size="sm" tone="fg2" />
              </dd>
            </div>
            <div>
              <dt>Tax on GH₵ 100 dine-in</dt>
              <dd className="mt-1 font-serif text-[18px] lining text-(--fg2)">
                <Num>{ghs(toCents(sampleVat))}</Num>
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
