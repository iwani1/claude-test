"use client";

import { useState } from "react";
import { CATEGORIES } from "../data";
import { ghs } from "../pricing";
import { menuOf, price, shiftTotals, staffById, tableOf, useDemo, type State } from "../store";
import { Bars, Caps, Figure, K, Money, Num, PageHead, Rows, Split, Tab, TextLink, timeOf } from "../ui";
import { TYPE_LABEL } from "./Till";

type Range = "shift" | "today" | "week";

/** Builds a CSV string and triggers a browser download. Returns the row count. */
function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => (typeof c === "string" && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : String(c))).join(",")).join("\n");
  saveText(name, csv);
  return rows.length - 1;
}

/** Hands a text file to the browser; silently skips where there is no real browser (tests). */
export function saveText(name: string, body: string, type = "text/csv;charset=utf-8") {
  try {
    if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    /* downloads are a convenience in the demo, never a failure */
  }
}

export function hourly(state: State, now: number) {
  const start = new Date(now);
  start.setHours(start.getHours() - 11, 0, 0, 0);
  const buckets = Array.from({ length: 12 }, (_, i) => ({ label: `${String((start.getHours() + i) % 24).padStart(2, "0")}h`, value: 0, dim: false }));
  for (const o of state.orders) {
    if (!o.payment) continue;
    const i = Math.floor((o.payment.at - start.getTime()) / 3_600_000);
    if (i >= 0 && i < 12) buckets[i].value += o.payment.amountCents;
  }
  return buckets;
}

export function byCategory(state: State) {
  const map = new Map<string, number>(CATEGORIES.map((c) => [c, 0]));
  for (const o of state.orders) {
    if (!o.payment || o.complimentary) continue;
    for (const l of o.lines) map.set(menuOf(state, l.itemId)?.category ?? "Other", (map.get(menuOf(state, l.itemId)?.category ?? "Other") ?? 0) + l.unitCents * l.qty);
  }
  return [...map.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

export function topDishes(state: State, n = 6) {
  const map = new Map<string, { qty: number; cents: number }>();
  for (const o of state.orders) {
    if (!o.payment) continue;
    for (const l of o.lines) {
      const e = map.get(l.itemId) ?? { qty: 0, cents: 0 };
      e.qty += l.qty;
      e.cents += l.unitCents * l.qty;
      map.set(l.itemId, e);
    }
  }
  return [...map.entries()]
    .map(([id, e]) => ({ id, name: menuOf(state, id)?.name ?? id, ...e }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, n);
}

export function Reports() {
  const { state, dispatch, now } = useDemo();
  const [range, setRange] = useState<Range>("shift");
  const t = shiftTotals(state);
  const mult = range === "shift" ? 1 : range === "today" ? 1.6 : 9.4; // illustrative scaling for the longer ranges
  const scale = (c: number) => Math.round(c * mult);
  const cats = byCategory(state);
  const dishes = topDishes(state);
  const cashiers = Object.values(
    t.paid.reduce<Record<string, { name: string; n: number; cents: number }>>((acc, o) => {
      const id = o.payment!.byId;
      acc[id] ??= { name: staffById(state, id)?.name ?? id, n: 0, cents: 0 };
      acc[id].n += 1;
      acc[id].cents += o.payment!.amountCents;
      return acc;
    }, {}),
  ).sort((a, b) => b.cents - a.cents);

  const exportSales = () => {
    const n = download(
      `lushview-sales-${new Date(now).toISOString().slice(0, 10)}.csv`,
      [["Order", "Time", "Table", "Type", "Cashier", "Items", "Subtotal", "Discount", "Room charge", "VAT", "Tip", "Total", "Tender", "Cash", "MoMo", "Reference", "Refund", "Refund reason"], ...t.paid.map((o) => {
        const p = price(state, o);
        return [o.number, new Date(o.payment!.at).toISOString(), tableOf(state, o.tableId).name, TYPE_LABEL[o.type], staffById(state, o.payment!.byId)?.name ?? "", o.lines.map((l) => `${l.qty}x ${l.name}`).join("; "), (p.subtotalCents / 100).toFixed(2), ((p.discountCents + p.compValueCents) / 100).toFixed(2), (p.roomChargeCents / 100).toFixed(2), (p.taxCents / 100).toFixed(2), (p.tipCents / 100).toFixed(2), (p.totalCents / 100).toFixed(2), o.payment!.method, (o.payment!.cashCents / 100).toFixed(2), (o.payment!.momoCents / 100).toFixed(2), o.payment!.ref, o.refund ? (o.refund.amountCents / 100).toFixed(2) : "", o.refund?.reason ?? ""];
      })],
    );
    dispatch({ type: "exported", what: `Sales CSV · ${n} rows` });
  };
  const exportLedger = () => {
    const acc = state.hardware.accounting;
    const n = download(
      `lushview-${acc === "xero" ? "xero" : "quickbooks"}-journal-${new Date(now).toISOString().slice(0, 10)}.csv`,
      acc === "xero"
        ? [["*Date", "*AccountCode", "Description", "*Debit", "*Credit"], [new Date(now).toLocaleDateString("en-GB"), "1000", "Cash sales", (t.cash / 100).toFixed(2), ""], [new Date(now).toLocaleDateString("en-GB"), "1010", "MoMo sales", (t.momo / 100).toFixed(2), ""], [new Date(now).toLocaleDateString("en-GB"), "4000", "Food & beverage revenue", "", ((t.sales - t.vat - t.tips) / 100).toFixed(2)], [new Date(now).toLocaleDateString("en-GB"), "2200", "VAT output 15%", "", (t.vat / 100).toFixed(2)], [new Date(now).toLocaleDateString("en-GB"), "2300", "Tips payable", "", (t.tips / 100).toFixed(2)]]
        : [["Journal Date", "Account", "Debit", "Credit", "Memo"], [new Date(now).toLocaleDateString("en-GB"), "Undeposited Funds:Cash", (t.cash / 100).toFixed(2), "", "Cash takings"], [new Date(now).toLocaleDateString("en-GB"), "Undeposited Funds:MTN MoMo", (t.momo / 100).toFixed(2), "", "Mobile money takings"], [new Date(now).toLocaleDateString("en-GB"), "Sales:Food & Beverage", "", ((t.sales - t.vat - t.tips) / 100).toFixed(2), "Net revenue"], [new Date(now).toLocaleDateString("en-GB"), "VAT Payable", "", (t.vat / 100).toFixed(2), "VAT 15%"], [new Date(now).toLocaleDateString("en-GB"), "Tips Payable", "", (t.tips / 100).toFixed(2), "Tips"]],
    );
    dispatch({ type: "exported", what: `${acc === "xero" ? "Xero" : "QuickBooks"} journal · ${n} lines` });
  };

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Reports" title="How the day is going." lede="Sales, tenders and food cost from the same ledger the till writes to — no end-of-day re-keying. Export to CSV or straight into your accounting package.">
        <TextLink tone="fg2" onClick={exportLedger}>
          {state.hardware.accounting === "xero" ? "Xero" : "QuickBooks"} journal
        </TextLink>
        <TextLink onClick={exportSales}>Export sales CSV</TextLink>
      </PageHead>

      <div className="mt-10 flex gap-7">
        {(["shift", "today", "week"] as Range[]).map((r) => (
          <Tab key={r} name="range" on={range === r} onClick={() => setRange(r)}>
            {r === "shift" ? "This shift" : r === "today" ? "Today" : "Last 7 days"}
          </Tab>
        ))}
        {range !== "shift" && <span className={`self-center text-xs ${K.fg3}`}>Illustrative — the demo only holds one shift of real orders.</span>}
      </div>

      <dl className={`mt-6 grid gap-8 border-y py-8 sm:grid-cols-2 xl:grid-cols-5 xl:gap-0 xl:divide-x xl:divide-(--line) ${K.line}`}>
        <Figure label="Gross sales" sub={`${scale(t.paid.length)} orders · avg ${ghs(t.avgTicket)}`}>
          <Money cents={scale(t.sales)} size="lg" />
        </Figure>
        <Figure label="Net of refunds" className="xl:pl-8" sub={t.refunds ? `${ghs(scale(t.refunds))} refunded` : "no refunds"}>
          <Money cents={scale(t.net)} size="lg" />
        </Figure>
        <Figure label="VAT collected" className="xl:pl-8" sub={`${state.settings.vatPercent} % · GRA TIN ${state.settings.tin}`}>
          <Money cents={scale(t.vat)} size="lg" tone="fg2" />
        </Figure>
        <Figure label="Value forgone" className="xl:pl-8" sub="discounts + complimentary" warn={t.discounts > scale(t.sales) * 0.08}>
          <Money cents={scale(t.discounts)} size="lg" tone="fg2" />
        </Figure>
        <Figure label="Tips" className="xl:pl-8" sub="untaxed · paid out to staff">
          <Money cents={scale(t.tips)} size="lg" tone="fg2" />
        </Figure>
      </dl>

      <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:gap-16">
        <section>
          <div className="flex items-baseline justify-between">
            <Caps>Takings by hour</Caps>
            <span className={`text-xs ${K.fg3}`}>last 12 hours · hover for figures</span>
          </div>
          <div className="mt-6">
            <Bars data={hourly(state, now)} height={160} format={(v) => ghs(v)} />
          </div>

          <div className="mt-12">
            <Caps>Tender breakdown</Caps>
            <div className="mt-4">
              <Split
                parts={[
                  { label: `Cash ${ghs(scale(t.cash))}`, value: t.cash },
                  { label: `MoMo ${ghs(scale(t.momo))}`, value: t.momo },
                ]}
              />
            </div>
          </div>

          <div className="mt-12">
            <Caps>Revenue by category</Caps>
            <div className="mt-4">
              <Split parts={cats.map(([label, value], i) => ({ label: `${label} ${ghs(scale(value))}`, value, tone: (["accent", "fg2", "fg3"] as const)[i % 3] }))} />
            </div>
          </div>
        </section>

        <section className="space-y-12">
          <div>
            <Caps>Best sellers</Caps>
            <ol className={`mt-4 border-t ${K.line}`}>
              {dishes.map((d, i) => (
                <li key={d.id} className={`flex items-baseline justify-between gap-4 border-b py-3 ${K.line2}`}>
                  <span className="flex items-baseline gap-4">
                    <Num className={`w-5 text-[13px] ${K.fg3}`}>{i + 1}</Num>
                    <span className="font-serif text-[17px]">{d.name}</span>
                  </span>
                  <span className="text-right">
                    <Num className="text-[16px]">{ghs(scale(d.cents))}</Num>
                    <span className={`block text-xs ${K.fg3}`}>{scale(d.qty)} sold</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <Caps>By cashier</Caps>
            <Rows head={["Name", "Orders", "Takings"]}>
              {cashiers.map((c) => (
                <tr key={c.name}>
                  <td className="py-3 pr-4">{c.name}</td>
                  <td className={`py-3 pr-4 ${K.fg2}`}>
                    <Num>{scale(c.n)}</Num>
                  </td>
                  <td className="py-3 text-right">
                    <Num className="text-[16px]">{ghs(scale(c.cents))}</Num>
                  </td>
                </tr>
              ))}
            </Rows>
          </div>
          <div>
            <Caps>Kitchen</Caps>
            <dl className={`mt-4 grid grid-cols-2 gap-6 border-t pt-4 ${K.line}`}>
              <div>
                <dt className={`text-xs ${K.fg3}`}>Average pass time</dt>
                <dd className="mt-1 font-serif text-[28px] leading-none lining">
                  {Math.round(t.avgPassMs / 60000)} <span className={`text-sm ${K.fg3}`}>min</span>
                </dd>
              </div>
              <div>
                <dt className={`text-xs ${K.fg3}`}>Last paid</dt>
                <dd className="mt-1 font-serif text-[28px] leading-none lining">{t.paid.length ? timeOf(Math.max(...t.paid.map((o) => o.payment!.at))) : "—"}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
