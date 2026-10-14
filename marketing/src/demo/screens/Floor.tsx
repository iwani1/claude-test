"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { type Zone } from "../data";
import { ghs } from "../pricing";
import { price, tableOf, useDemo } from "../store";
import { Caps, Field, inputCls, K, Modal, Money, Num, PageHead, Pill, Select, TextLink, timeOf } from "../ui";

const ZONES: Zone[] = ["Floor", "Terrace", "Bar", "Rooms", "Counter"];

export function Floor() {
  const { state, dispatch, now } = useDemo();
  const [focus, setFocus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const open = state.orders.filter((o) => !o.paidAt);
  const seated = open.reduce((n, o) => n + (tableOf(state, o.tableId).seats || 1), 0);
  const t = focus ? tableOf(state, focus) : null;
  const order = t ? open.find((o) => o.tableId === t.id) : undefined;

  return (
    <div className="px-6 pb-20 pt-8 lg:px-14">
      <PageHead kicker="Dining room" title="The floor, right now." lede={`${open.length} of ${state.tables.length} tables have a bill · about ${seated} covers seated · ${state.tables.filter((x) => x.status === "reserved").length} reserved · ${state.tables.filter((x) => x.status === "cleaning").length} being cleared.`}>
        <TextLink tone="fg2" onClick={() => setAdding(true)}>
          Add a table
        </TextLink>
      </PageHead>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <div className="space-y-12">
          {ZONES.filter((z) => state.tables.some((x) => x.zone === z)).map((zone) => (
            <section key={zone}>
              <div className="flex items-baseline justify-between">
                <Caps>{zone}</Caps>
                <span className={`text-xs ${K.fg3}`}>{state.tables.filter((x) => x.zone === zone && open.some((o) => o.tableId === x.id)).length} open</span>
              </div>
              <ol className={`mt-4 grid grid-cols-2 border-t sm:grid-cols-3 xl:grid-cols-4 ${K.line}`}>
                {state.tables
                  .filter((x) => x.zone === zone)
                  .map((x) => {
                    const o = open.find((oo) => oo.tableId === x.id);
                    const mins = o ? Math.floor((now - o.openedAt) / 60000) : 0;
                    const on = focus === x.id;
                    return (
                      <li key={x.id} className={`border-b ${K.line2}`}>
                        <button type="button" onClick={() => setFocus(x.id)} className={`group flex h-[132px] w-full flex-col justify-between py-4 pr-6 text-left transition-colors ${on ? "" : "hover:bg-(--line2)"}`}>
                          <span className="flex w-full items-start justify-between">
                            <Num className={`text-[34px] font-light leading-none tracking-[-.01em] ${o ? K.fg : x.status === "free" ? K.fg2 : K.fg3} ${on ? "italic" : ""}`}>{x.code}</Num>
                            {o && <span className={`mt-1 h-1.5 w-1.5 rounded-full ${o.lines.some((l) => !l.sent) ? "bg-(--warn)" : "bg-(--accent)"}`} />}
                          </span>
                          <span className="w-full">
                            {o ? (
                              <>
                                <span className="flex items-baseline justify-between">
                                  <Num className="text-[18px]">{(price(state, o).totalCents / 100).toFixed(2)}</Num>
                                  <span className={`text-xs ${mins > 60 ? K.warn : K.fg3}`}>{mins} min</span>
                                </span>
                                <span className={`block truncate text-xs ${K.fg3}`}>
                                  {o.lines.reduce((n, l) => n + l.qty, 0)} items · #{o.number}
                                  {o.customer ? ` · ${o.customer}` : ""}
                                </span>
                              </>
                            ) : (
                              <span className={`block text-xs ${x.status === "reserved" ? K.warn : K.fg3}`}>
                                {x.status === "reserved" ? `Reserved · ${x.reservedFor}` : x.status === "cleaning" ? "Being cleared" : x.seats ? `${x.seats} seats · free` : "Counter"}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </div>

        {/* ------------------------------------------------ table detail */}
        <aside className={`self-start border-t pt-6 lg:sticky lg:top-[124px] lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0 ${K.line}`}>
          {!t && (
            <>
              <p className="font-serif text-[28px] italic leading-tight tracking-[-.02em]">Pick a table.</p>
              <p className={`mt-3 text-sm leading-relaxed ${K.fg2}`}>See its bill, seat guests, move a party to another table, reserve it or mark it cleared.</p>
            </>
          )}
          {t && (
            <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Caps>
                {t.zone} · {t.seats ? `${t.seats} seats` : "counter"}
              </Caps>
              <p className="mt-1 font-serif text-[34px] italic leading-none tracking-[-.02em]">{t.name}</p>
              {order ? (
                <>
                  <p className={`mt-3 text-sm ${K.fg2}`}>
                    #{order.number} · opened {timeOf(order.openedAt)}
                    {order.customer ? ` · ${order.customer}` : ""}
                  </p>
                  <ul className={`mt-5 border-t ${K.line}`}>
                    {order.lines.map((l) => (
                      <li key={l.id} className={`flex justify-between gap-4 border-b py-2 text-sm ${K.line2}`}>
                        <span>
                          {l.name}
                          {l.qty > 1 ? <span className={K.fg3}> × {l.qty}</span> : null}
                        </span>
                        <Num className={K.fg2}>{((l.unitCents * l.qty) / 100).toFixed(2)}</Num>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <Caps>Total due</Caps>
                    <div className="mt-1">
                      <Money cents={price(state, order).totalCents} size="lg" tone="accent" />
                    </div>
                  </div>
                  <div className="mt-7 space-y-4">
                    <Pill tone="accent" right={`#${order.number}`} onClick={() => dispatch({ type: "selectTable", tableId: t.id })}>
                      Open on the till
                    </Pill>
                    <TextLink tone="fg2" onClick={() => setMoving(order.id)}>
                      Move this party to another table
                    </TextLink>
                  </div>
                </>
              ) : (
                <>
                  <p className={`mt-3 text-sm ${K.fg2}`}>{t.status === "reserved" ? `Reserved for ${t.reservedFor}.` : t.status === "cleaning" ? "Being cleared — seat the next party when it’s ready." : "Free."}</p>
                  <div className="mt-8 space-y-4">
                    <Pill tone="accent" onClick={() => dispatch({ type: "selectTable", tableId: t.id })}>
                      Seat guests &amp; start a bill
                    </Pill>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {t.status !== "free" && (
                        <TextLink tone="fg2" arrow={false} onClick={() => dispatch({ type: "tableStatus", tableId: t.id, status: "free" })}>
                          Mark free
                        </TextLink>
                      )}
                      {t.status !== "cleaning" && t.type === "dine_in" && (
                        <TextLink tone="fg2" arrow={false} onClick={() => dispatch({ type: "tableStatus", tableId: t.id, status: "cleaning" })}>
                          Needs clearing
                        </TextLink>
                      )}
                      {t.status !== "reserved" && t.type === "dine_in" && <Reserve tableId={t.id} />}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </aside>
      </div>

      <AddTable open={adding} onClose={() => setAdding(false)} />
      <MoveParty orderId={moving} onClose={() => setMoving(null)} />
    </div>
  );
}

function Reserve({ tableId }: { tableId: string }) {
  const { dispatch } = useDemo();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  if (!open)
    return (
      <TextLink tone="fg2" arrow={false} onClick={() => setOpen(true)}>
        Reserve
      </TextLink>
    );
  return (
    <form
      className="flex w-full items-end gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!who.trim()) return;
        dispatch({ type: "tableStatus", tableId, status: "reserved", reservedFor: who.trim() });
        setOpen(false);
        setWho("");
      }}
    >
      <Field label="Reserved for">
        <input autoFocus value={who} onChange={(e) => setWho(e.target.value.slice(0, 40))} placeholder="Mr Addo · 21:00" className={`${inputCls} text-sm`} />
      </Field>
      <TextLink arrow={false} type="submit" disabled={!who.trim()}>
        Save
      </TextLink>
    </form>
  );
}

function AddTable({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemo();
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("4");
  const [zone, setZone] = useState<Zone>("Terrace");
  return (
    <Modal open={open} onClose={onClose} kicker="Dining room" title="Add a table">
      <div className="space-y-7">
        <Field label="Label" hint="Leave blank to number it automatically.">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="Table 09" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Seats">
            <input inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, "").slice(0, 2))} className={`${inputCls} font-serif text-[28px] lining`} />
          </Field>
          <Field label="Area">
            <Select value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
              {ZONES.filter((z) => z !== "Rooms" && z !== "Counter").map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Pill
          tone="accent"
          disabled={!Number(seats)}
          onClick={() => {
            dispatch({ type: "addTable", name: name.trim(), seats: Number(seats), zone });
            setName("");
            onClose();
          }}
        >
          Add table
        </Pill>
      </div>
    </Modal>
  );
}

function MoveParty({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const order = state.orders.find((o) => o.id === orderId);
  const free = state.tables.filter((t) => t.type === "dine_in" && !state.orders.some((o) => o.tableId === t.id && !o.paidAt) && t.id !== order?.tableId);
  return (
    <Modal open={Boolean(order)} onClose={onClose} kicker={order ? `#${order.number} · ${ghs(price(state, order).totalCents)}` : undefined} title={order ? `Move ${tableOf(state, order.tableId).name}` : ""}>
      {order && (
        <>
          <p className={`text-sm ${K.fg2}`}>The bill, its kitchen ticket and the running total travel with the party.</p>
          <ol className={`mt-5 grid grid-cols-4 gap-x-6 border-t ${K.line}`}>
            {free.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "moveOrder", orderId: order.id, tableId: t.id });
                    onClose();
                  }}
                  className={`w-full border-b py-4 text-left ${K.line2} hover:text-(--accent)`}
                >
                  <Num className="block text-[28px] font-light leading-none">{t.code}</Num>
                  <span className={`mt-1 block text-xs ${K.fg3}`}>
                    {t.seats} seats · {t.status === "reserved" ? "reserved" : t.zone}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </Modal>
  );
}
