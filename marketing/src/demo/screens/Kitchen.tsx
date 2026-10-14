"use client";

import { CircleCheck, Flame, Timer } from "lucide-react";
import { useState } from "react";
import type { Station, Ticket } from "../data";
import { mmss } from "../money";
import { useStore } from "../store";
import { Seg, cx, useNow } from "../ui";

type Filter = "all" | Station;

export function Kitchen() {
  const { state, api } = useStore();
  const now = useNow(1000);
  const [filter, setFilter] = useState<Filter>("all");
  const { warn, urgent } = state.settings.kds;

  const lineOf = (id: string) => state.orders.flatMap((o) => o.lines).find((l) => l.id === id);
  const visible = (t: Ticket) => filter === "all" || t.lineIds.some((id) => lineOf(id)?.station === filter);
  const live = state.tickets.filter((t) => t.status !== "bumped" && visible(t)).sort((a, b) => a.at - b.at);
  const cols: { id: Ticket["status"]; label: string; tone: "cobalt" | "sun" | "forest" }[] = [
    { id: "new", label: "New", tone: "cobalt" }, { id: "cooking", label: "Cooking", tone: "sun" }, { id: "ready", label: "Ready to serve", tone: "forest" },
  ];
  const served = state.tickets.filter((t) => t.status === "bumped" && t.bumpedAt && t.bumpedAt > now - 3600000);
  const avgMin = served.length ? Math.round(served.reduce((s, t) => s + ((t.bumpedAt ?? t.at) - t.at), 0) / served.length / 60000) : 0;

  // All-day counts of what is still to cook
  const allDay = new Map<string, number>();
  for (const t of live) if (t.status !== "ready") for (const id of t.lineIds) { const l = lineOf(id); if (l && (filter === "all" || l.station === filter)) allDay.set(l.name, (allDay.get(l.name) ?? 0) + l.qty); }

  return (
    <div className="kds">
      <header className="flex flex-wrap items-center gap-3 px-6 pt-5 pb-3">
        <div className="mr-2">
          <div className="kicker" style={{ color: "var(--sun)" }}>Kitchen pass · Osu</div>
          <h1 className="d mt-1 text-[26px] font-extrabold leading-none tracking-tight">{live.length ? `${live.length} ticket${live.length === 1 ? "" : "s"} live` : "Pass is clear"}</h1>
        </div>
        <Seg onInk options={[{ id: "all", label: "All stations" }, { id: "kitchen", label: "Kitchen" }, { id: "grill", label: "Grill" }, { id: "bar", label: "Bar" }]} value={filter} onChange={setFilter} />
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
          <span className="rounded-xl bg-white/10 px-3 py-2"><Timer size={13} className="mr-1 inline" />Warn {warn} min · Urgent {urgent} min</span>
          <span className="rounded-xl bg-white/10 px-3 py-2"><CircleCheck size={13} className="mr-1 inline" />{served.length} served last hour{avgMin ? ` · avg ${avgMin} min` : ""}</span>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[1fr_1fr_1fr_220px] gap-4 px-6 pb-5">
        {cols.map((c) => {
          const items = live.filter((t) => t.status === c.id);
          return (
            <section key={c.id} className="flex min-h-0 flex-col">
              <div className="kds-col-head"><span className="flex items-center gap-2"><span className="dot" data-tone={c.tone} />{c.label}</span><span className="n">{items.length}</span></div>
              <div className="kds-col">
                {items.length === 0 && <div className="rounded-2xl border-2 border-dashed border-white/15 p-6 text-center text-[13px] font-semibold text-[var(--ink4)]">{c.id === "new" ? "Nothing waiting" : c.id === "cooking" ? "Nothing on the fire" : "Nothing to run"}</div>}
                {items.map((t) => {
                  const age = now - t.at;
                  const m = age / 60000;
                  const lines = t.lineIds.map(lineOf).filter((l): l is NonNullable<typeof l> => !!l && (filter === "all" || l.station === filter));
                  const order = state.orders.find((o) => o.id === t.orderId);
                  return (
                    <article key={t.id} className={cx("kcard", t.status === "ready" ? "is-ready" : m >= urgent ? "is-urgent" : m >= warn ? "is-warn" : "")}>
                      <div className="kcard-head">
                        <div>
                          <div className="kcard-table">{t.tableLabel}</div>
                          <div className="text-[11.5px] font-semibold text-[var(--ink3)]">#{t.orderId} · {order?.guests ?? 0} pax · {state.staff.find((s) => s.id === order?.staffId)?.name.split(" ")[0]}</div>
                        </div>
                        <span className="kcard-time">{mmss(age)}</span>
                      </div>
                      {lines.map((l) => (
                        <div key={l.id} className="kline">
                          <b>{l.qty}</b>
                          <div><div className="kline-name">{l.name}</div>{l.note && <div className="kline-note">“{l.note}”</div>}</div>
                          <span className="kline-st">{l.station}</span>
                        </div>
                      ))}
                      <div className="kcard-foot">
                        {t.status === "new" && <button type="button" className="kbtn sun" onClick={() => api.ticket(t.id, "cooking")}><Flame size={16} className="mr-1 inline" strokeWidth={2.5} /> Start</button>}
                        {t.status === "cooking" && <button type="button" className="kbtn forest" onClick={() => api.ticket(t.id, "ready")}>Ready</button>}
                        {t.status === "ready" && <button type="button" className="kbtn" onClick={() => api.ticket(t.id, "bumped")}>Served · bump</button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        <aside className="flex min-h-0 flex-col">
          <div className="kds-col-head"><span>All day</span><span className="n">{[...allDay.values()].reduce((a, b) => a + b, 0)}</span></div>
          <div className="kds-col">
            <div className="rounded-2xl bg-white/5 p-3">
              {allDay.size === 0 && <div className="p-3 text-center text-[13px] font-semibold text-[var(--ink4)]">Nothing to cook</div>}
              {[...allDay.entries()].sort((a, b) => b[1] - a[1]).map(([name, qty]) => (
                <div key={name} className="flex items-center justify-between gap-3 border-b border-white/10 py-2 last:border-0">
                  <span className="text-[13px] font-semibold">{name}</span>
                  <span className="d rounded-lg bg-[var(--sun)] px-2 py-0.5 text-[13px] font-extrabold text-[var(--ink)]">{qty}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white/5 p-3 text-[12px] font-semibold text-[var(--ink4)]">
              Tickets turn <span className="c-sun">yellow</span> at {warn} minutes and <span className="c-terra">red</span> at {urgent}. Bumping marks the lines served on the bill.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
