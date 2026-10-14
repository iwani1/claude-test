"use client";

import { ghs } from "../pricing";
import { currentUser, lowStock, price, recipeCost, shiftTotals, stockValueCents, tableOf, useDemo, type Screen } from "../store";
import { Bars, Caps, Figure, K, Money, Num, PageHead, Split, TextLink, timeOf, whenOf } from "../ui";
import { byCategory, hourly, topDishes } from "./Reports";

export function Today() {
  const { state, dispatch, now } = useDemo();
  const me = currentUser(state);
  const t = shiftTotals(state);
  const low = lowStock(state);
  const openPos = state.purchaseOrders.filter((p) => p.status === "ordered");
  const latePos = openPos.filter((p) => now > p.expectedAt);
  const kitchenLive = state.tickets.filter((k) => k.status !== "completed");
  const late = kitchenLive.filter((k) => k.status !== "ready" && now - k.firedAt > 15 * 60000);
  const unsent = state.orders.filter((o) => !o.paidAt && o.lines.some((l) => !l.sent));
  const off = state.menu.filter((m) => !m.available);
  const foodCost = (() => {
    let cost = 0;
    let rev = 0;
    for (const o of t.paid) {
      if (o.complimentary) continue;
      for (const l of o.lines) {
        cost += recipeCost(state, l.itemId) * l.qty;
        rev += (l.unitCents * l.qty) / 100;
      }
    }
    return rev ? (cost / rev) * 100 : 0;
  })();
  const hour = new Date(now).getHours();
  const go = (screen: Screen) => dispatch({ type: "screen", screen });
  const attention: { text: string; screen: Screen; tone?: "warn" | "bad" }[] = [];
  if (late.length) attention.push({ text: `${late.length} kitchen ticket${late.length > 1 ? "s" : ""} past 15 minutes`, screen: "kitchen", tone: "bad" });
  if (unsent.length) attention.push({ text: `${unsent.length} table${unsent.length > 1 ? "s" : ""} with items not yet sent to the kitchen`, screen: "till", tone: "warn" });
  if (low.length) attention.push({ text: `${low.length} ingredient${low.length > 1 ? "s" : ""} below minimum · ${low.map((i) => i.name.split(" (")[0]).slice(0, 3).join(", ")}`, screen: "stock", tone: "warn" });
  if (latePos.length) attention.push({ text: `${latePos.map((p) => p.number).join(", ")} overdue from ${state.suppliers.find((s) => s.id === latePos[0].supplierId)?.name}`, screen: "purchasing", tone: "warn" });
  else if (openPos.length) attention.push({ text: `${openPos.map((p) => p.number).join(", ")} expected today — receive it when the van arrives`, screen: "purchasing" });
  if (off.length) attention.push({ text: `${off.length} dish${off.length > 1 ? "es" : ""} off the menu · ${off.map((m) => m.name).join(", ")}`, screen: "menu" });
  if (!state.online) attention.push({ text: "Terminal is offline — MoMo prompts are queued, cash still works", screen: "hardware", tone: "warn" });
  if (t.queued) attention.push({ text: `${t.queued} payment${t.queued > 1 ? "s" : ""} queued while offline, syncing when back`, screen: "drawer", tone: "warn" });
  if (state.shift.closedAt) attention.push({ text: `Shift closed at ${timeOf(state.shift.closedAt)} — open a new one to keep selling`, screen: "drawer" });

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker={`${new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · ${state.settings.name.split(" · ")[0]}`} title={<>Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, {me?.name.split(" ")[0]}.</>} lede={`${ghs(t.sales)} taken so far across ${t.paid.length} bills · ${t.open.length} table${t.open.length === 1 ? "" : "s"} open · ${kitchenLive.length} ticket${kitchenLive.length === 1 ? "" : "s"} on the pass.`} />

      <dl className={`mt-10 grid gap-8 border-y py-8 sm:grid-cols-2 xl:grid-cols-5 xl:gap-0 xl:divide-x xl:divide-(--line) ${K.line}`}>
        <Figure label="Gross sales · this shift" sub={`avg bill ${ghs(t.avgTicket)}`}>
          <Money cents={t.sales} size="lg" />
        </Figure>
        <Figure label="Cash in drawer" className="xl:pl-8" sub={`float ${ghs(state.shift.floatCents)} · ${t.payouts ? `${ghs(t.payouts)} paid out` : "no payouts"}`}>
          <Money cents={t.expectedCents} size="lg" />
        </Figure>
        <Figure label="Food cost · sold items" className="xl:pl-8" sub={foodCost > 35 ? "above the 28–35 % band" : "inside the 28–35 % band"} warn={foodCost > 35}>
          <Num className={`text-[52px] leading-none tracking-[-.03em] ${foodCost > 35 ? K.warn : ""}`}>{foodCost.toFixed(0)}%</Num>
        </Figure>
        <Figure label="Stock on hand" className="xl:pl-8" sub={low.length ? `${low.length} below minimum` : "nothing below minimum"} warn={low.length > 0}>
          <Money cents={stockValueCents(state)} size="lg" tone="fg2" />
        </Figure>
        <Figure label="Kitchen pass" className="xl:pl-8" sub={late.length ? `${late.length} running late` : "nothing late"} warn={late.length > 0}>
          <Num className={`text-[52px] leading-none tracking-[-.03em] ${late.length ? K.warn : ""}`}>
            {Math.round(t.avgPassMs / 60000)}
            <span className={`ml-2 text-[20px] ${K.fg3}`}>min</span>
          </Num>
        </Figure>
      </dl>

      <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-16">
        <section className="space-y-12">
          <div>
            <div className="flex items-baseline justify-between">
              <Caps>Needs a look</Caps>
              <span className={`text-xs ${K.fg3}`}>{attention.length ? `${attention.length} item${attention.length > 1 ? "s" : ""}` : "all quiet"}</span>
            </div>
            <ol className={`mt-4 border-t ${K.line}`}>
              {attention.map((a, i) => (
                <li key={i} className={`border-b ${K.line2}`}>
                  <button type="button" onClick={() => go(a.screen)} className="group flex w-full items-center justify-between gap-6 py-3.5 text-left">
                    <span className="flex items-center gap-4">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.tone === "bad" ? "bg-(--bad)" : a.tone === "warn" ? "bg-(--warn)" : "bg-(--accent)"}`} />
                      <span className="text-sm">{a.text}</span>
                    </span>
                    <span className={`text-xs transition-transform group-hover:translate-x-0.5 ${K.fg3}`}>→</span>
                  </button>
                </li>
              ))}
              {!attention.length && <li className={`py-6 font-serif text-[22px] italic ${K.fg3}`}>Nothing is waiting on you.</li>}
            </ol>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Caps>Takings by hour</Caps>
              <TextLink tone="fg3" arrow onClick={() => go("reports")}>
                Full reports
              </TextLink>
            </div>
            <div className="mt-6">
              <Bars data={hourly(state, now)} height={140} format={(v) => ghs(v)} />
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <Caps>Tenders</Caps>
              <div className="mt-4">
                <Split
                  parts={[
                    { label: `Cash ${ghs(t.cash)}`, value: t.cash },
                    { label: `MoMo ${ghs(t.momo)}`, value: t.momo },
                  ]}
                />
              </div>
            </div>
            <div>
              <Caps>Revenue by category</Caps>
              <div className="mt-4">
                <Split parts={byCategory(state).map(([label, value], i) => ({ label: `${label} ${ghs(value)}`, value, tone: (["accent", "fg2", "fg3"] as const)[i % 3] }))} />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-12">
          <div>
            <div className="flex items-baseline justify-between">
              <Caps>Open tables</Caps>
              <TextLink tone="fg3" onClick={() => go("floor")}>
                Floor
              </TextLink>
            </div>
            <ol className={`mt-4 border-t ${K.line}`}>
              {t.open.map((o) => (
                <li key={o.id} className={`border-b ${K.line2}`}>
                  <button type="button" onClick={() => dispatch({ type: "selectTable", tableId: o.tableId })} className="flex w-full items-baseline justify-between gap-4 py-3 text-left hover:text-(--accent)">
                    <span className="flex items-baseline gap-3">
                      <Num className="text-[20px]">{tableOf(state, o.tableId).code}</Num>
                      <span className={`text-xs ${K.fg3}`}>
                        {Math.floor((now - o.openedAt) / 60000)} min · {o.lines.reduce((n, l) => n + l.qty, 0)} items{o.lines.some((l) => !l.sent) ? " · unsent" : ""}
                      </span>
                    </span>
                    <Num className="text-[16px]">{ghs(price(state, o).totalCents)}</Num>
                  </button>
                </li>
              ))}
              {!t.open.length && <li className={`py-6 font-serif text-[22px] italic ${K.fg3}`}>Every table is settled.</li>}
            </ol>
          </div>

          <div>
            <Caps>Best sellers</Caps>
            <ol className={`mt-4 border-t ${K.line}`}>
              {topDishes(state, 5).map((d, i) => (
                <li key={d.id} className={`flex items-baseline justify-between gap-4 border-b py-3 ${K.line2}`}>
                  <span className="flex items-baseline gap-4">
                    <Num className={`w-5 text-[13px] ${K.fg3}`}>{i + 1}</Num>
                    <span className="font-serif text-[17px]">{d.name}</span>
                  </span>
                  <span className={`text-xs ${K.fg3}`}>
                    {d.qty} sold · <Num className="text-(--fg2)">{ghs(d.cents)}</Num>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Caps>Recent activity</Caps>
              <TextLink tone="fg3" onClick={() => go("audit")}>
                Audit log
              </TextLink>
            </div>
            <ul className={`mt-4 border-t ${K.line}`}>
              {state.audit.slice(0, 6).map((e) => (
                <li key={e.id} className={`border-b py-2.5 text-sm ${K.line2}`}>
                  <span className={`mr-3 text-xs ${K.fg3}`}>{whenOf(e.at, now)}</span>
                  <span className={K.fg2}>{e.userName.split(" ")[0]}</span> <span className={K.fg3}>·</span> {e.action}
                  <span className={`block truncate text-xs ${K.fg3}`}>{e.details}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
