"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { PayMethod } from "../data";
import { cedi, cediShort, dayLabel, download, hm, noise, num, pct, startOfToday, toCSV } from "../money";
import { totals, useStore } from "../store";
import { Bar, Card, Money, Seg, Stat } from "../ui";
import { OfficeHead } from "./Office";

type Range = "today" | "7d" | "30d";

export function Reports() {
  const { state, api } = useStore();
  const [range, setRange] = useState<Range>("today");
  const vat = state.settings.vat;
  const day0 = startOfToday();

  const r = useMemo(() => {
    const closed = state.orders.filter((o) => o.status === "paid" || o.status === "refunded");
    const voided = state.orders.filter((o) => o.status === "void");
    const T = closed.map((o) => ({ o, t: totals(o, vat) }));
    const gross = T.reduce((s, x) => s + x.t.total, 0);
    const vatAmt = T.reduce((s, x) => s + x.t.vat, 0);
    const discounts = T.reduce((s, x) => s + x.t.discount, 0);
    const refunds = T.reduce((s, x) => s + x.t.refunded, 0);
    const voidValue = voided.reduce((s, o) => s + totals(o, vat).total, 0);
    const service = T.reduce((s, x) => s + x.t.service, 0);
    const net = gross - vatAmt - service - refunds;
    const tender: Record<PayMethod, number> = { cash: 0, momo: 0, ghqr: 0 };
    const momoNet: Record<string, number> = {};
    for (const x of T) for (const p of x.o.payments) { tender[p.method] += p.amount; if (p.method === "momo") momoNet[p.network] = (momoNet[p.network] ?? 0) + p.amount; }
    const byCat = new Map<string, number>();
    const byDish = new Map<string, { name: string; qty: number; rev: number }>();
    const byStaff = new Map<string, { orders: number; rev: number; covers: number }>();
    for (const x of T) {
      const st = byStaff.get(x.o.staffId) ?? { orders: 0, rev: 0, covers: 0 };
      st.orders++; st.rev += x.t.total; st.covers += x.o.guests; byStaff.set(x.o.staffId, st);
      for (const l of x.o.lines) {
        const cat = state.dishes.find((d) => d.id === l.dishId)?.cat ?? "kitchen";
        byCat.set(cat, (byCat.get(cat) ?? 0) + l.price * l.qty);
        const e = byDish.get(l.dishId) ?? { name: l.name, qty: 0, rev: 0 };
        e.qty += l.qty; e.rev += l.price * l.qty; byDish.set(l.dishId, e);
      }
    }
    const covers = T.reduce((s, x) => s + x.o.guests, 0);
    return { closed: T, gross, vatAmt, discounts, refunds, voidValue, voided: voided.length, service, net, tender, momoNet, byCat, byDish, byStaff, covers };
  }, [state.orders, state.dishes, vat]);

  // Synthetic history for 7 / 30 days: deterministic, today = real figures.
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const history = useMemo(() => Array.from({ length: days }, (_, k) => {
    const offset = days - 1 - k;
    if (offset === 0) return { ts: day0, gross: r.gross, orders: r.closed.length };
    const d = new Date(day0 - offset * 86400000);
    const weekend = d.getDay() === 5 || d.getDay() === 6 ? 1.35 : d.getDay() === 0 ? 1.15 : 1;
    const g = Math.round((780000 + noise(d.getDate() + d.getMonth() * 31) * 420000) * weekend);
    return { ts: d.getTime(), gross: g, orders: Math.round(g / 72000) };
  }), [days, day0, r.gross, r.closed.length]);
  const scale = history.reduce((s, h) => s + h.gross, 0) / Math.max(1, r.gross); // scale today's mix to the range
  const S = (v: number) => (range === "today" ? v : Math.round(v * scale));
  const rangeGross = history.reduce((s, h) => s + h.gross, 0);
  const rangeOrders = history.reduce((s, h) => s + h.orders, 0);
  const maxDay = Math.max(1, ...history.map((h) => h.gross));

  const hours = Array.from({ length: 13 }, (_, i) => 11 + i);
  const byHour = hours.map((h) => r.closed.filter((x) => new Date(x.o.closed!).getHours() === h).reduce((s, x) => s + x.t.total, 0));
  const maxHour = Math.max(1, ...byHour);
  const catTotal = [...r.byCat.values()].reduce((a, b) => a + b, 0) || 1;
  const topDishes = [...r.byDish.values()].sort((a, b) => b.rev - a.rev).slice(0, 8);
  const forgone = r.discounts + r.refunds + r.voidValue;

  const exportCSV = () => {
    if (range === "today") {
      const rows: (string | number)[][] = [["Order", "Opened", "Closed", "Table", "Staff", "Guests", "Items", "Subtotal", "Discount", "VAT", "Service", "Total", "Tender", "Refunded", "Status"]];
      for (const { o, t } of r.closed) rows.push([o.id, hm(o.opened), o.closed ? hm(o.closed) : "", o.tableLabel, state.staff.find((s) => s.id === o.staffId)?.name ?? "", o.guests, t.items, num(t.subtotal), num(t.discount), num(t.vat), num(t.service), num(t.total), o.payments.map((p) => (p.method === "cash" ? "Cash" : p.method === "momo" ? `MoMo ${p.network}` : "GhQR")).join("+"), num(t.refunded), o.status]);
      download(`lushview-sales-${new Date(day0).toISOString().slice(0, 10)}.csv`, toCSV(rows));
    } else {
      const rows: (string | number)[][] = [["Date", "Gross sales", "Orders", "Avg ticket"]];
      for (const h of history) rows.push([new Date(h.ts).toISOString().slice(0, 10), num(h.gross), h.orders, num(h.orders ? Math.round(h.gross / h.orders) : 0)]);
      download(`lushview-daily-${days}d.csv`, toCSV(rows));
    }
    api.notify("CSV downloaded", "info");
  };

  return (
    <div className="page">
      <OfficeHead module="reports" title="Reports" sub={range === "today" ? `${r.closed.length} paid orders · ${r.covers} covers · avg ticket ${cedi(r.closed.length ? Math.round(r.gross / r.closed.length) : 0)}` : `${rangeOrders} orders over ${days} days · avg day ${cedi(Math.round(rangeGross / days))}`}
        actions={<><Seg options={[{ id: "today", label: "Today" }, { id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }]} value={range} onChange={setRange} /><button type="button" className="btn btn-ink" onClick={exportCSV}><Download size={16} strokeWidth={2.5} /> Export CSV</button></>} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat tone="sun" label="Gross sales" value={<Money v={range === "today" ? r.gross : rangeGross} />} sub="incl. VAT, after refunds not deducted" />
        <Stat tone="forest" label="Net sales" value={<Money v={S(r.net)} />} sub="excl. VAT, service & refunds" />
        <Stat tone="cobalt" label="VAT collected" value={<Money v={S(r.vatAmt)} />} sub={`${vat}% on goods · GRA`} />
        <Stat tone="terra" label="Value forgone" value={<Money v={S(forgone)} />} sub={`discounts ${cedi(S(r.discounts))} · refunds ${cedi(S(r.refunds))} · voids ${cedi(S(r.voidValue))}`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card title={range === "today" ? "Sales by hour" : `Sales by day · ${days} days`}>
          <div className="chart" data-tone="sun">
            {range === "today"
              ? hours.map((h, i) => <div key={h} className={h === new Date().getHours() ? "is-now" : ""} title={`${h}:00 · ${cedi(byHour[i])}`}><i style={{ height: `${(byHour[i] / maxHour) * 100}%` }} /><span>{h}</span></div>)
              : history.map((h, i) => <div key={h.ts} className={i === history.length - 1 ? "is-now" : ""} title={`${dayLabel(h.ts)} · ${cedi(h.gross)}`}><i style={{ height: `${(h.gross / maxDay) * 100}%` }} />{(days <= 7 || i % 5 === 0 || i === history.length - 1) && <span>{days <= 7 ? dayLabel(h.ts).split(" ")[0] : new Date(h.ts).getDate()}</span>}</div>)}
          </div>
        </Card>
        <Card title="Tender breakdown">
          <div className="flex flex-col gap-3.5">
            {([["cash", "Cash", "forest"], ["momo", "Mobile Money", "sun"], ["ghqr", "GhQR", "cobalt"]] as const).map(([k, label, tone]) => {
              const v = S(r.tender[k]);
              const total = S(r.tender.cash + r.tender.momo + r.tender.ghqr) || 1;
              return (
                <div key={k}>
                  <div className="flex items-baseline justify-between text-[13px]"><span className="d font-bold">{label}</span><span className="font-semibold text-[var(--ink3)]">{pct(v, total)}% · <b className="c-ink">{cedi(v)}</b></span></div>
                  <Bar value={(v / total) * 100} tone={tone} className="mt-1.5" />
                </div>
              );
            })}
            <div className="mt-1 flex flex-wrap gap-2 text-[12px] font-semibold text-[var(--ink3)]">
              {Object.entries(r.momoNet).map(([n, v]) => <span key={n} className="rounded-lg bg-[var(--cream2)] px-2 py-1">{n} {cedi(S(v))}</span>)}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Sales by category">
          <div className="flex h-4 overflow-hidden rounded-full">
            {state.categories.map((c) => <span key={c.key} className="h-full" data-tone={c.key} style={{ width: `${((r.byCat.get(c.key) ?? 0) / catTotal) * 100}%`, background: "var(--c)" }} title={c.name} />)}
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {state.categories.map((c) => <li key={c.key} className="flex items-center justify-between text-[13px]"><span className="flex items-center gap-2 font-bold"><span className="dot" data-tone={c.key} />{c.name}</span><span className="font-semibold text-[var(--ink3)]">{pct(r.byCat.get(c.key) ?? 0, catTotal)}% · <b className="c-ink">{cedi(S(r.byCat.get(c.key) ?? 0))}</b></span></li>)}
          </ul>
        </Card>
        <Card title="Top dishes" pad={false}>
          <table className="tbl">
            <thead><tr><th>Dish</th><th className="r">Qty</th><th className="r">Revenue</th></tr></thead>
            <tbody>{topDishes.map((d) => <tr key={d.name}><td className="strong">{d.name}</td><td className="r num">{S(d.qty)}</td><td className="r d strong">{num(S(d.rev))}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Staff" pad={false}>
          <table className="tbl">
            <thead><tr><th>Name</th><th className="r">Orders</th><th className="r">Covers</th><th className="r">Sales</th><th className="r">Avg</th></tr></thead>
            <tbody>
              {[...r.byStaff.entries()].sort((a, b) => b[1].rev - a[1].rev).map(([id, s]) => <tr key={id}><td className="strong">{state.staff.find((x) => x.id === id)?.name}</td><td className="r num">{S(s.orders)}</td><td className="r num">{S(s.covers)}</td><td className="r d strong">{num(S(s.rev))}</td><td className="r num">{num(s.orders ? Math.round(s.rev / s.orders) : 0)}</td></tr>)}
            </tbody>
          </table>
        </Card>
      </div>

      <p className="mt-4 text-[12px] font-semibold text-[var(--ink3)]">{range === "today" ? "Today's figures are live from the Till." : `Today is live; earlier days are representative history for this demo (${cediShort(Math.round(rangeGross / days))} average).`}</p>
    </div>
  );
}
