"use client";

import { AlertTriangle, ArrowRight, ChefHat, Flame, Leaf, Wallet } from "lucide-react";
import { GROUPS, MODULES, can, type CatKey, type Module } from "../data";
import { cedi, cediShort, hm, startOfToday } from "../money";
import { currentUser, drawerExpected, openDrawer, totals, useStore } from "../store";
import { Bar, Card, Money, Stat, useNow } from "../ui";

export function Today() {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const now = useNow(30000);
  const vat = state.settings.vat;
  const day = startOfToday(now);

  const closed = state.orders.filter((o) => (o.status === "paid" || o.status === "refunded") && (o.closed ?? 0) >= day);
  const gross = closed.reduce((s, o) => s + totals(o, vat).total, 0);
  const refunded = closed.reduce((s, o) => s + totals(o, vat).refunded, 0);
  const openOrders = state.orders.filter((o) => o.status === "open");
  const openValue = openOrders.reduce((s, o) => s + totals(o, vat).total, 0);
  const queue = state.tickets.filter((t) => t.status === "new" || t.status === "cooking");
  const oldest = queue.reduce((m, t) => Math.min(m, t.at), now);
  const drawer = openDrawer(state);
  const avg = closed.length ? Math.round(gross / closed.length) : 0;
  const covers = closed.reduce((s, o) => s + o.guests, 0);

  // Sales by hour (11:00 → 23:00)
  const hours = Array.from({ length: 13 }, (_, i) => 11 + i);
  const byHour = hours.map((h) => closed.filter((o) => new Date(o.closed!).getHours() === h).reduce((s, o) => s + totals(o, vat).total, 0));
  const maxHour = Math.max(1, ...byHour);
  const nowHour = new Date(now).getHours();

  // Top dishes by revenue
  const dishMap = new Map<string, { name: string; qty: number; rev: number; cat: string }>();
  for (const o of closed) for (const l of o.lines) {
    const e = dishMap.get(l.dishId) ?? { name: l.name, qty: 0, rev: 0, cat: state.dishes.find((d) => d.id === l.dishId)?.cat ?? "kitchen" };
    e.qty += l.qty; e.rev += l.qty * l.price; dishMap.set(l.dishId, e);
  }
  const top = [...dishMap.values()].sort((a, b) => b.rev - a.rev).slice(0, 6);
  const topMax = top[0]?.rev ?? 1;

  // Attention list
  const low = state.ingredients.filter((i) => i.onHand < i.par);
  const out = low.filter((i) => i.onHand <= 0);
  const unsent = openOrders.filter((o) => o.lines.some((l) => !l.sent));
  const late = queue.filter((t) => now - t.at > state.settings.kds.urgent * 60000);
  const offMenu = state.dishes.filter((d) => !d.available);
  const alerts: { tone: "terra" | "sun" | "cobalt" | "forest"; text: string; module: Module; cta: string }[] = [];
  if (late.length) alerts.push({ tone: "terra", text: `${late.length} ticket${late.length === 1 ? "" : "s"} over ${state.settings.kds.urgent} min at the pass — ${late.map((t) => t.tableLabel).join(", ")}`, module: "kitchen", cta: "Open the pass" });
  if (unsent.length) alerts.push({ tone: "sun", text: `${unsent.length} table${unsent.length === 1 ? " has" : "s have"} items not yet sent to the kitchen — ${unsent.map((o) => o.tableLabel).join(", ")}`, module: "till", cta: "Go to Till" });
  if (out.length) alerts.push({ tone: "terra", text: `Out of stock: ${out.map((i) => i.name).join(", ")}`, module: "ingredients", cta: "Ingredients" });
  else if (low.length) alerts.push({ tone: "cobalt", text: `${low.length} ingredient${low.length === 1 ? "" : "s"} below par — ${low.slice(0, 3).map((i) => i.name).join(", ")}${low.length > 3 ? "…" : ""}`, module: "purchasing", cta: "Raise a PO" });
  if (!drawer) alerts.push({ tone: "sun", text: "No cash drawer is open — open one with a float before taking cash", module: "drawer", cta: "Open drawer" });
  if (offMenu.length) alerts.push({ tone: "cobalt", text: `86'd tonight: ${offMenu.map((d) => d.name).join(", ")}`, module: "menu", cta: "Menu" });
  if (!alerts.length) alerts.push({ tone: "forest", text: "All clear — kitchen is on time, stock is above par and the drawer is open.", module: "reports", cta: "Reports" });

  const greet = nowHour < 12 ? "Good morning" : nowHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker" style={{ color: "var(--sun-d)" }}>Today · {new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="page-title mt-2">{greet}, {me.name.split(" ")[0]}.</h1>
          <p className="page-sub">{closed.length} orders · {covers} covers · service since 11:30</p>
        </div>
        <div className="flex gap-2">
          {can(me.role, "till") && <button type="button" className="btn btn-sun" onClick={() => api.go("till")}>Open the Till <ArrowRight size={16} strokeWidth={3} /></button>}
          <button type="button" className="btn btn-ghost" onClick={() => api.setTour(0)}>Take the tour</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat tone="sun" label="Sales today" value={<Money v={gross} />} sub={refunded ? `${cedi(refunded)} refunded` : `${closed.length} paid orders`} onClick={can(me.role, "reports") ? () => api.go("reports") : undefined} />
        <Stat tone="forest" label="Open tables" value={<>{openOrders.length}<small className="ml-2">/ {state.tables.length}</small></>} sub={`${cedi(openValue)} on the floor`} onClick={can(me.role, "floor") ? () => api.go("floor") : undefined} />
        <Stat tone="terra" label="At the pass" value={queue.length} sub={queue.length ? `oldest ${Math.round((now - oldest) / 60000)} min` : "kitchen is clear"} onClick={can(me.role, "kitchen") ? () => api.go("kitchen") : undefined} />
        <Stat tone="cobalt" label="In the drawer" value={drawer ? <Money v={drawerExpected(drawer)} /> : "Closed"} sub={drawer ? `float ${cedi(drawer.float)} · avg ticket ${cedi(avg)}` : "open with a float"} onClick={can(me.role, "drawer") ? () => api.go("drawer") : undefined} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Sales by hour" actions={<span className="text-[12px] font-bold text-[var(--ink3)]">peak {hm(day + hours[byHour.indexOf(Math.max(...byHour))] * 3600000)} · {cediShort(Math.max(...byHour))}</span>}>
          <div className="chart" data-tone="sun">
            {hours.map((h, i) => (
              <div key={h} className={h === nowHour ? "is-now" : ""} title={`${h}:00 · ${cedi(byHour[i])}`}>
                <i style={{ height: `${(byHour[i] / maxHour) * 100}%` }} />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Needs a decision" actions={<AlertTriangle size={16} className="c-terra" />}>
          <div className="flex flex-col gap-2.5">
            {alerts.map((a, i) => (
              <div key={i} className="alert" data-tone={a.tone}>
                <span className="dot" />
                <span className="flex-1 text-[13px] font-semibold">{a.text}</span>
                {can(me.role, a.module) && <button type="button" className="btn btn-xs btn-ink" onClick={() => api.go(a.module)}>{a.cta}</button>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Top dishes" actions={<Flame size={16} className="c-terra" />}>
          <div className="flex flex-col gap-3">
            {top.map((t) => (
              <div key={t.name}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="d font-bold">{t.name}</span>
                  <span className="font-semibold text-[var(--ink3)]">{t.qty} × · <b className="c-ink">{cedi(t.rev)}</b></span>
                </div>
                <Bar value={(t.rev / topMax) * 100} tone={t.cat as CatKey} className="mt-1.5" />
              </div>
            ))}
          </div>
        </Card>

        <Card title="On the floor now" actions={<ChefHat size={16} className="c-forest" />} pad={false}>
          <div className="px-5 pb-3">
            {openOrders.length === 0 && <div className="empty">No open tables</div>}
            {openOrders.map((o) => {
              const t = totals(o, vat);
              const s = o.lines.filter((l) => !l.sent).length;
              return (
                <button key={o.id} type="button" className="list-row w-full text-left hover:bg-[var(--cream)]" onClick={() => { if (can(me.role, "till")) { api.pickTable(o.tableId); api.go("till"); } }}>
                  <span className="d w-20 text-[15px] font-extrabold">{o.tableLabel.replace("Table ", "T·")}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-[var(--ink3)]">
                    <span className="block truncate c-ink">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ") || "Nothing ordered yet"}</span>
                    {o.guests} guests · {Math.round((now - o.opened) / 60000)} min{s ? <span className="c-terra"> · {s} unsent</span> : ""}
                  </span>
                  <span className="d text-[15px] font-bold">{cedi(t.total)}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="Back office" actions={<Leaf size={16} className="c-forest" />}>
          <div className="grid grid-cols-2 gap-2.5">
            {MODULES.filter((m) => m.group !== "service").map((m) => {
              const ok = can(me.role, m.id);
              return (
                <button key={m.id} type="button" disabled={!ok} className="block is-btn p-3.5 text-left disabled:opacity-40" data-tone={GROUPS[m.group].tone} onClick={() => api.go(m.id)}>
                  <span className="d block text-[14px] font-extrabold leading-tight">{m.label}</span>
                  <span className="mt-1 block text-[11px] font-semibold opacity-80">{m.desc}</span>
                </button>
              );
            })}
          </div>
          {drawer && (
            <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-[var(--ink3)]"><Wallet size={14} /> Drawer opened {hm(drawer.openedAt)} by {drawer.openedBy}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
