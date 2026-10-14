"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, MOMO_NETWORKS, ROLES, type Category, type Settings as SettingsT } from "../data";
import { ghs, priceOrder, type Discount, type Line } from "../pricing";
import { can, currentUser, menuOf, price, staffById, tableOf, useDemo, type Order, type PayMethod } from "../store";
import { Caps, Field, inputCls, K, Modal, Money, Num, Pill, Tab, TextLink, timeOf } from "../ui";

export const TYPE_LABEL = { dine_in: "dine‑in", room_service: "room service", takeaway: "takeaway" } as const;

export function Till() {
  const { state, dispatch } = useDemo();
  const [category, setCategory] = useState<Category>("Kitchen");
  const [sheet, setSheet] = useState(false);
  const [paying, setPaying] = useState(false);
  const onPaid = useCallback(() => setPaying(false), []);

  const order = state.orders.find((o) => o.tableId === state.selectedTableId && !o.paidAt);
  const table = state.selectedTableId ? tableOf(state, state.selectedTableId) : null;
  const receipt = state.receiptOrderId ? (state.orders.find((o) => o.id === state.receiptOrderId) ?? null) : null;
  const priced = order ? price(state, order) : null;
  const qtyByItem = (order?.lines ?? []).reduce<Record<string, number>>((m, l) => ({ ...m, [l.itemId]: (m[l.itemId] ?? 0) + l.qty }), {});
  const items = state.menu.filter((m) => m.category === category);
  const closed = Boolean(state.shift.closedAt);

  return (
    <div className="pb-28 lg:pb-12">
      {/* ------------------------------------------------ table strip */}
      <section className={`flex items-end justify-between gap-8 border-b ${K.line} px-6 pb-5 pt-6 lg:px-14`}>
        <ol className="no-bar flex items-baseline gap-7 overflow-x-auto pr-4">
          {state.tables.map((t) => {
            const open = state.orders.find((o) => o.tableId === t.id && !o.paidAt);
            const active = state.selectedTableId === t.id;
            const unsent = open?.lines.some((l) => !l.sent);
            return (
              <li key={t.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "selectTable", tableId: t.id })}
                  title={open ? `${t.name} · ${ghs(price(state, open).totalCents)}` : `${t.name} · ${t.status === "reserved" ? `reserved · ${t.reservedFor}` : t.status === "cleaning" ? "being cleared" : t.seats ? `${t.seats} seats` : t.zone}`}
                  className={`relative pb-2 font-serif text-[30px] font-light leading-none tracking-[-.01em] transition-colors ${active ? `${K.fg} italic` : open ? `${K.fg} hover:text-(--accent)` : t.status !== "free" ? `${K.fg3} opacity-60 hover:opacity-100` : `${K.fg3} hover:text-(--fg2)`}`}
                >
                  {t.code}
                  {open && !active && <span className={`absolute -right-2.5 top-1.5 h-1.5 w-1.5 rounded-full ${unsent ? "bg-(--warn)" : "bg-(--accent)"}`} />}
                  {active && <motion.span layoutId="table-underline" className="absolute inset-x-0 bottom-0 h-0.5 bg-(--accent)" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                </button>
              </li>
            );
          })}
        </ol>
        <p className={`hidden shrink-0 text-sm md:block ${K.fg2}`}>
          {table ? (
            <>
              <Num italic className="mr-3 text-[22px] text-(--fg)">
                {table.name}
              </Num>
              {table.zone}
              {table.seats ? ` · ${table.seats} seats` : ""}
              {order ? ` · opened ${timeOf(order.openedAt)} · #${order.number}` : table.status === "reserved" ? ` · reserved for ${table.reservedFor}` : " · free"}
            </>
          ) : (
            <>
              <Num italic className="mr-3 text-[22px] text-(--fg)">
                {state.orders.filter((o) => !o.paidAt).length} open
              </Num>
              pick a table to start
            </>
          )}
        </p>
      </section>

      <div className="grid gap-12 px-6 pt-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14 lg:px-14">
        {/* ------------------------------------------------ menu film-strip */}
        <section className="min-w-0">
          <div className="flex items-baseline gap-7">
            {CATEGORIES.map((c) => (
              <Tab key={c} name="cat" on={category === c} onClick={() => setCategory(c)}>
                {c}
              </Tab>
            ))}
            <span className={`ml-auto hidden text-xs sm:block ${K.fg3}`}>{table ? "Tap a dish to add it" : "Pick a table, then tap a dish"}</span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={category} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.25 }} className="no-bar -mr-6 mt-6 flex snap-x gap-5 overflow-x-auto pr-6 lg:-mr-14 lg:pr-14">
              {items.map((m, i) => {
                const qty = qtyByItem[m.id] ?? 0;
                const off = !m.available;
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    disabled={closed || off}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => dispatch({ type: "addLine", itemId: m.id })}
                    className={`group w-[200px] shrink-0 snap-start text-left xl:w-[220px] ${closed ? "opacity-40" : ""}`}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-(--line2)">
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image loader */}
                      <img src={m.img} alt="" width={720} height={480} loading="lazy" className={`dish h-full w-full object-cover ${off ? "opacity-30 grayscale" : ""}`} />
                      <AnimatePresence>
                        {qty > 0 && (
                          <motion.span key="q" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="absolute right-3 top-3 grid h-7 min-w-7 place-items-center rounded-full bg-(--accent) px-2 text-xs font-extrabold text-(--accent-ink)">
                            {qty}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {off && (
                        <span className="absolute inset-x-0 bottom-0 p-3">
                          <Caps tone="fg2">Off the menu</Caps>
                        </span>
                      )}
                    </div>
                    <h3 className={`mt-3.5 font-serif text-[19px] leading-[1.2] tracking-[-.01em] ${off ? K.fg3 : ""}`}>{m.name}</h3>
                    <p className={`mt-1 flex items-baseline justify-between text-[13px] ${K.fg3}`}>
                      <span>{m.station === "bar" ? "Bar" : m.station === "grill" ? "Grill" : "Kitchen"}</span>
                      <Num className={`text-[18px] ${off ? K.fg3 : "text-(--fg)"}`}>{m.price}</Num>
                    </p>
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
          <div className={`mt-6 flex items-center gap-4 text-xs ${K.fg3}`}>
            <span>
              {items.length} in {category}
              {items.some((m) => !m.available) ? ` · ${items.filter((m) => !m.available).length} off` : ""}
            </span>
            <i className={`h-px flex-1 border-t ${K.line}`} />
            <span>scroll →</span>
          </div>
        </section>

        {/* ------------------------------------------------ bill column (desktop) */}
        <aside className={`hidden min-h-[560px] flex-col border-l ${K.line} pl-12 lg:flex`}>
          <Bill order={order} onCharge={() => setPaying(true)} />
        </aside>
      </div>

      {/* ------------------------------------------------ bill (phones / tablets) */}
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t ${K.line} bg-(--bg) px-6 py-3 lg:hidden`}>
        <button type="button" onClick={() => setSheet(true)} className="flex w-full items-center justify-between">
          <span className={`text-sm ${K.fg2}`}>{order ? `${tableOf(state, order.tableId).name} · ${order.lines.reduce((n, l) => n + l.qty, 0)} items` : table ? `${table.name} · nothing yet` : "No table"}</span>
          <span className="flex items-center gap-4">
            {priced && <Money cents={priced.totalCents} size="md" />}
            <span className={`text-sm font-semibold ${K.accent}`}>Open →</span>
          </span>
        </button>
      </div>
      <Modal open={sheet} onClose={() => setSheet(false)} kicker={order ? `#${order.number}` : undefined} title={table ? table.name : "Order"} width="max-w-lg">
        <div className="flex min-h-[50dvh] flex-col">
          <Bill
            order={order}
            compact
            onCharge={() => {
              setSheet(false);
              setPaying(true);
            }}
          />
        </div>
      </Modal>

      {order && <PayModal open={paying} order={order} onClose={onPaid} onPaid={onPaid} />}
      <ReceiptModal order={receipt} onClose={() => dispatch({ type: "closeReceipt" })} />
    </div>
  );
}

/* ---------------------------------------------------------------- bill */

function Bill({ order, onCharge, compact = false }: { order?: Order; onCharge: () => void; compact?: boolean }) {
  const { state, dispatch } = useDemo();
  const table = state.selectedTableId ? tableOf(state, state.selectedTableId) : null;
  const priced = order ? price(state, order) : null;
  const unsent = order?.lines.filter((l) => !l.sent) ?? [];
  const unsentKitchen = unsent.filter((l) => menuOf(state, l.itemId).kitchen).length;
  const ticket = order ? [...state.tickets].reverse().find((t) => t.orderId === order.id) : undefined;
  const closed = Boolean(state.shift.closedAt);
  const [extra, setExtra] = useState<"discount" | "tip" | "comp" | "guest" | null>(null);

  return (
    <>
      {!compact && (
        <div className="flex items-baseline justify-between">
          <Caps>{table ? `${table.name} · ${order ? TYPE_LABEL[order.type] : TYPE_LABEL[table.type]}` : "Bill"}</Caps>
          {order && <span className={`text-xs ${K.fg3}`}>{order.customer ? order.customer : `#${order.number}`}</span>}
        </div>
      )}

      {!table && (
        <div className="mt-10">
          <p className="font-serif text-[34px] italic leading-tight tracking-[-.02em]">Pick a table.</p>
          <p className={`mt-3 max-w-[26ch] text-sm leading-relaxed ${K.fg2}`}>Tap a numeral in the strip above, then a dish. The bill builds itself here with VAT already worked out.</p>
        </div>
      )}
      {table && !order && (
        <div className="mt-10">
          <p className="font-serif text-[34px] italic leading-tight tracking-[-.02em]">{table.name} is open.</p>
          <p className={`mt-3 max-w-[26ch] text-sm leading-relaxed ${K.fg2}`}>
            Tap dishes to add them.
            {table.type === "room_service" && <span className="mt-2 block">Room service adds a {ghs(state.settings.roomChargeCents)} charge, taxed with the food.</span>}
          </p>
        </div>
      )}

      {order && (
        <ul className="mt-3">
          <AnimatePresence initial={false}>
            {order.lines.map((l) => (
              <LineRow key={l.id} line={l} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {priced && order && (
        <dl className={`mt-5 space-y-1.5 text-[13px] ${K.fg3}`}>
          <Sum label="Subtotal" cents={priced.subtotalCents} />
          {priced.discountCents > 0 && !priced.complimentary && <Sum label={`Discount · ${order.discount?.reason ?? ""}`} cents={-priced.discountCents} />}
          {priced.complimentary && <Sum label={`Complimentary · ${order.complimentary?.reason ?? ""}`} cents={-priced.compValueCents} />}
          {priced.roomChargeCents > 0 && <Sum label="Room service charge" cents={priced.roomChargeCents} />}
          <Sum label={`VAT ${state.settings.vatPercent} %`} cents={priced.taxCents} />
          {priced.tipCents > 0 && <Sum label="Tip (untaxed)" cents={priced.tipCents} />}
        </dl>
      )}

      {order && (
        <div className={`mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs ${K.fg3}`}>
          {(["discount", "tip", "comp", "guest"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                if (k === "comp" && order.complimentary) {
                  dispatch({ type: "setComp", comp: null });
                  setExtra(null);
                } else setExtra(extra === k ? null : k);
              }}
              className={`transition-colors hover:text-(--fg) ${extra === k ? K.fg : ""}`}
            >
              {k === "discount" ? (order.discount ? "edit discount" : "discount") : k === "tip" ? (order.tipCents ? "edit tip" : "tip") : k === "comp" ? (order.complimentary ? "undo complimentary" : "complimentary") : order.customer ? "guest name" : "add guest name"}
            </button>
          ))}
        </div>
      )}
      {order && extra && <Extras kind={extra} order={order} onDone={() => setExtra(null)} />}

      {ticket && (
        <p className={`mt-4 text-xs ${K.fg3}`}>
          Kitchen · {ticket.status === "pending" ? "ticket waiting" : ticket.status === "preparing" ? "cooking" : ticket.status === "ready" ? "ready on the pass" : "served"} · fired {timeOf(ticket.firedAt)}
        </p>
      )}

      <div className="mt-auto pt-8">
        <Caps className="block">Total due</Caps>
        <div className="mt-1">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={priced?.totalCents ?? 0} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <Money cents={priced?.totalCents ?? 0} size="xl" tone={priced ? "accent" : "fg2"} />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-7 space-y-4">
          <Pill tone="accent" right={priced?.complimentary ? "Close · GH₵ 0" : "Cash · MoMo"} disabled={!order || closed} onClick={onCharge}>
            {priced?.complimentary ? "Close bill" : "Charge"}
          </Pill>
          <div className="flex items-center justify-between gap-3 px-1">
            <TextLink disabled={!order || unsentKitchen === 0 || closed} onClick={() => dispatch({ type: "send" })}>
              {!order ? "Send to the kitchen" : unsentKitchen > 0 ? `Send ${unsentKitchen} dish${unsentKitchen > 1 ? "es" : ""} to the kitchen` : unsent.length > 0 ? "Bar items only — nothing to fire" : "Kitchen has everything"}
            </TextLink>
            {unsent.length > unsentKitchen && unsentKitchen > 0 && <span className={`text-xs ${K.fg3}`}>drinks stay at the bar</span>}
          </div>
          {closed && <p className={`text-xs ${K.warn}`}>Shift is closed — start a new shift from Drawer to keep selling.</p>}
        </div>
      </div>
    </>
  );
}

function Sum({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="truncate">{label}</dt>
      <dd className="shrink-0">
        <Num>{cents < 0 ? `−${(-cents / 100).toFixed(2)}` : (cents / 100).toFixed(2)}</Num>
      </dd>
    </div>
  );
}

/** Discount, tip, complimentary and guest name — the small things a real bill needs, kept out of the way until asked for. */
function Extras({ kind, order, onDone }: { kind: "discount" | "tip" | "comp" | "guest"; order: Order; onDone: () => void }) {
  const { state, dispatch } = useDemo();
  const [kindD, setKindD] = useState<Discount["kind"]>(order.discount?.kind ?? "percent");
  const [value, setValue] = useState(order.discount ? String(order.discount.value) : "");
  const [reason, setReason] = useState(order.discount?.reason ?? "");
  const [tip, setTip] = useState(order.tipCents ? (order.tipCents / 100).toFixed(2) : "");
  const [guest, setGuest] = useState(order.customer ?? "");
  const [pin, setPin] = useState("");
  const manager = can(state, "refund");
  const me = currentUser(state);
  const authBy = manager ? me : state.staff.find((u) => u.pin && u.pin === pin && ROLES[u.role].can.includes("refund"));

  if (kind === "guest")
    return (
      <form
        className="mt-3 flex items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "setCustomer", name: guest.trim() });
          onDone();
        }}
      >
        <Field label="Guest name">
          <input autoFocus value={guest} onChange={(e) => setGuest(e.target.value.slice(0, 40))} placeholder="Mr Ofori · room 12" className={`${inputCls} text-sm`} />
        </Field>
        <TextLink arrow={false} type="submit">
          Save
        </TextLink>
      </form>
    );
  if (kind === "tip")
    return (
      <form
        className="mt-3 flex items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "setTip", tipCents: Math.round(Number(tip || 0) * 100) });
          onDone();
        }}
      >
        <Field label="Tip (GH₵, not taxed)">
          <input autoFocus inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="10.00" className={`${inputCls} font-serif text-[22px] lining`} />
        </Field>
        <TextLink arrow={false} type="submit">
          Save
        </TextLink>
      </form>
    );
  if (kind === "comp") {
    return (
      <form
        className="mt-3 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!authBy || !reason.trim()) return;
          dispatch({ type: "setComp", comp: { reason: reason.trim(), approvedBy: authBy.name } });
          onDone();
        }}
      >
        <Field label="Why is this on the house?">
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value.slice(0, 60))} placeholder="Complimentary breakfast · room 12" className={`${inputCls} text-sm`} />
        </Field>
        {!manager && (
          <Field label="Manager PIN to approve" hint="Cashiers can’t comp a bill alone — Efua’s PIN is 2222.">
            <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="••••" className={`${inputCls} font-serif text-[22px] lining`} />
          </Field>
        )}
        <div className="flex items-center gap-6">
          <TextLink arrow={false} type="submit" disabled={!authBy || !reason.trim()}>
            Mark complimentary{authBy ? ` · ${authBy.name.split(" ")[0]} approves` : ""}
          </TextLink>
          <TextLink tone="fg3" arrow={false} onClick={onDone}>
            Cancel
          </TextLink>
        </div>
      </form>
    );
  }
  return (
    <form
      className="mt-3 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const v = Number(value);
        if (!Number.isFinite(v) || v <= 0 || !reason.trim()) return;
        dispatch({ type: "setDiscount", discount: { kind: kindD, value: v, reason: reason.trim() } });
        onDone();
      }}
    >
      <div className="flex gap-6">
        <Tab name="disc" on={kindD === "percent"} onClick={() => setKindD("percent")}>
          Percent
        </Tab>
        <Tab name="disc" on={kindD === "fixed"} onClick={() => setKindD("fixed")}>
          Fixed GH₵
        </Tab>
      </div>
      <div className="grid grid-cols-[100px_1fr] gap-5">
        <Field label={kindD === "percent" ? "Off %" : "Off GH₵"}>
          <input autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kindD === "percent" ? "10" : "20.00"} className={`${inputCls} font-serif text-[22px] lining`} />
        </Field>
        <Field label="Reason (printed)">
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 60))} placeholder="Hotel guests — B&B rate" className={`${inputCls} text-sm`} />
        </Field>
      </div>
      <div className="flex items-center gap-6">
        <TextLink arrow={false} type="submit" disabled={!value || !reason.trim()}>
          Apply discount
        </TextLink>
        {order.discount && (
          <TextLink
            tone="fg3"
            arrow={false}
            onClick={() => {
              dispatch({ type: "setDiscount", discount: null });
              onDone();
            }}
          >
            Remove
          </TextLink>
        )}
        <TextLink tone="fg3" arrow={false} onClick={onDone}>
          Cancel
        </TextLink>
      </div>
    </form>
  );
}

function LineRow({ line }: { line: Line }) {
  const { dispatch } = useDemo();
  const [noting, setNoting] = useState(false);
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className={`border-b ${K.line2} py-3`}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 text-[15px]">
          {line.name}
          {line.qty > 1 && <span className={`ml-2 text-[13px] ${K.fg3}`}>× {line.qty}</span>}
          {!line.sent && <span className={`ml-2 text-[11px] font-semibold uppercase tracking-[.14em] ${K.warn}`}>new</span>}
        </p>
        <Num className={`shrink-0 text-[18px] ${K.fg2}`}>{((line.unitCents * line.qty) / 100).toFixed(2)}</Num>
      </div>
      {line.note && !noting && <p className={`mt-0.5 font-serif text-[14px] italic ${K.fg3}`}>“{line.note}”</p>}
      {noting ? (
        <input
          autoFocus
          value={line.note}
          placeholder="Kitchen note — no onions, well done…"
          onChange={(e) => dispatch({ type: "setNote", lineId: line.id, note: e.target.value.slice(0, 60) })}
          onBlur={() => setNoting(false)}
          onKeyDown={(e) => e.key === "Enter" && setNoting(false)}
          className={`${inputCls} mt-1 py-1.5 text-sm`}
        />
      ) : (
        <div className={`mt-1 flex items-center gap-4 text-xs ${K.fg3}`}>
          <span className="flex items-center gap-2">
            <button type="button" aria-label="Less" className="px-1 hover:text-(--fg)" onClick={() => dispatch({ type: "setQty", lineId: line.id, qty: line.qty - 1 })}>
              −
            </button>
            <Num className="text-sm text-(--fg2)">{line.qty}</Num>
            <button type="button" aria-label="More" className="px-1 hover:text-(--fg)" onClick={() => dispatch({ type: "setQty", lineId: line.id, qty: line.qty + 1 })}>
              +
            </button>
          </span>
          <button type="button" className="hover:text-(--fg)" onClick={() => setNoting(true)}>
            {line.note ? "edit note" : "note"}
          </button>
        </div>
      )}
    </motion.li>
  );
}

/* ---------------------------------------------------------------- pay */

function PayModal({ open, order, onClose, onPaid }: { open: boolean; order: Order; onClose: () => void; onPaid: () => void }) {
  const { state } = useDemo();
  // The modal unmounts its body when closed, so every opening starts with fresh state;
  // closing while a MoMo prompt is out simply cancels it.
  return (
    <Modal open={open} onClose={onClose} kicker={`#${order.number} · ${TYPE_LABEL[order.type]}${order.customer ? ` · ${order.customer}` : ""}`} title={`${order.complimentary ? "Close" : "Charge"} ${tableOf(state, order.tableId).name}`}>
      <PayBody order={order} onPaid={onPaid} />
    </Modal>
  );
}

function PayBody({ order, onPaid }: { order: Order; onPaid: () => void }) {
  const { state, dispatch } = useDemo();
  const total = price(state, order).totalCents;
  const tenders = state.hardware.tenders;
  const [method, setMethod] = useState<PayMethod>(state.online && tenders.momo ? "momo" : "cash");
  const [tendered, setTendered] = useState<number>(total);
  const [custom, setCustom] = useState("");
  const [cashPart, setCashPart] = useState("");
  const [network, setNetwork] = useState<(typeof MOMO_NETWORKS)[number]>("MTN");
  const [phone, setPhone] = useState("024 123 4567");
  const [stage, setStage] = useState<"idle" | "sent" | "ok">("idle");
  const splitCash = Math.min(total, Math.max(0, Math.round(Number(cashPart || 0) * 100)));
  const splitMomo = total - splitCash;

  // Every dependency is stable while the prompt is out (network pills are disabled, onPaid is memoised).
  useEffect(() => {
    if (stage !== "sent") return;
    const a = setTimeout(() => setStage("ok"), 1900);
    const b = setTimeout(() => {
      dispatch(method === "split" ? { type: "pay", method: "split", cashCents: splitCash, network } : { type: "pay", method: "momo", network });
      onPaid();
    }, 2700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [stage, dispatch, method, splitCash, network, onPaid]);

  if (total === 0)
    return (
      <div className="space-y-6">
        <p className={`text-sm leading-relaxed ${K.fg2}`}>
          Nothing to collect — this bill is complimentary ({order.complimentary?.reason}). The food value of {ghs(price(state, order).compValueCents)} is kept for the owner’s report.
        </p>
        <Pill
          tone="accent"
          onClick={() => {
            dispatch({ type: "pay", method: "cash" });
            onPaid();
          }}
        >
          Close the bill
        </Pill>
      </div>
    );

  const quick = Array.from(new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 20000) * 20000]))
    .filter((v) => v >= total)
    .slice(0, 5);
  const change = Math.max(0, tendered - total);
  const momoBlocked = !state.online;

  return (
    <>
      <div className={`flex items-end justify-between border-b ${K.line} pb-5`}>
        <Caps>Amount due</Caps>
        <Money cents={total} size="lg" />
      </div>

      <div className="mt-6 flex gap-7">
        {tenders.momo && (
          <Tab name="pay" on={method === "momo"} disabled={stage !== "idle"} onClick={() => setMethod("momo")}>
            Mobile Money
          </Tab>
        )}
        {tenders.cash && (
          <Tab name="pay" on={method === "cash"} disabled={stage !== "idle"} onClick={() => setMethod("cash")}>
            Cash
          </Tab>
        )}
        {tenders.split && (
          <Tab name="pay" on={method === "split"} disabled={stage !== "idle"} onClick={() => setMethod("split")}>
            Split
          </Tab>
        )}
      </div>

      {method === "cash" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setTendered(q);
                  setCustom("");
                }}
                className={`rounded-full border px-4 py-2 font-serif text-[16px] lining transition-colors ${tendered === q && !custom ? "border-(--accent) text-(--accent)" : `${K.line} ${K.fg2} hover:text-(--fg)`}`}
              >
                {q === total ? "Exact" : (q / 100).toLocaleString("en-GH")}
              </button>
            ))}
          </div>
          <Field label="Amount tendered (GH₵)">
            <input
              inputMode="decimal"
              value={custom}
              placeholder={(total / 100).toFixed(2)}
              onChange={(e) => {
                setCustom(e.target.value);
                const v = Number(e.target.value);
                setTendered(Number.isFinite(v) && v > 0 ? Math.round(v * 100) : total);
              }}
              className={`${inputCls} font-serif text-[32px] lining`}
            />
          </Field>
          <div className={`flex items-baseline justify-between border-t ${K.line} pt-4`}>
            <span className={`text-sm ${tendered < total ? K.bad : K.fg2}`}>{tendered < total ? "Short by" : "Change due"}</span>
            <Money cents={Math.abs(tendered - total)} size="md" />
          </div>
          {!state.online && <p className={`text-xs ${K.warn}`}>Offline — this sale is saved on the device and syncs when the network returns.</p>}
          <Pill
            tone="accent"
            disabled={tendered < total}
            right={change ? `give ${ghs(change)}` : undefined}
            onClick={() => {
              dispatch({ type: "pay", method: "cash", tenderedCents: tendered });
              onPaid();
            }}
          >
            Take {ghs(tendered)}
          </Pill>
        </div>
      )}

      {(method === "momo" || method === "split") && (
        <div className="mt-6 space-y-6">
          {method === "split" && (
            <div className="grid grid-cols-2 gap-6">
              <Field label="Cash portion (GH₵)">
                <input autoFocus inputMode="decimal" value={cashPart} disabled={stage !== "idle"} onChange={(e) => setCashPart(e.target.value)} placeholder="0.00" className={`${inputCls} font-serif text-[28px] lining`} />
              </Field>
              <Field label="MoMo portion">
                <div className="py-2.5">
                  <Money cents={splitMomo} size="md" />
                </div>
              </Field>
            </div>
          )}
          {momoBlocked && splitMomo > 0 ? (
            <div className={`text-sm ${K.warn}`}>
              <p className="font-semibold">No network — the MoMo prompt can’t be sent.</p>
              <p className={`mt-1 ${K.fg2}`}>Take cash instead; it queues on this device and syncs automatically.</p>
            </div>
          ) : (
            <>
              {splitMomo > 0 && (
                <>
                  <div className="flex gap-2">
                    {MOMO_NETWORKS.map((n) => (
                      <button key={n} type="button" disabled={stage !== "idle"} onClick={() => setNetwork(n)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${network === n ? "border-(--accent) text-(--accent)" : `${K.line} ${K.fg2} hover:text-(--fg)`}`}>
                        {n}
                      </button>
                    ))}
                    {tenders.ghqr && <span className={`self-center text-xs ${K.fg3}`}>or GhQR at the till</span>}
                  </div>
                  <Field label="Customer phone">
                    <input value={phone} disabled={stage !== "idle"} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={`${inputCls} font-serif text-[28px] lining`} />
                  </Field>
                </>
              )}
              <AnimatePresence mode="wait" initial={false}>
                {stage === "idle" && (
                  <motion.div key="idle" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {splitMomo > 0 ? (
                      <Pill tone="accent" right={method === "split" ? `cash ${ghs(splitCash)} + MoMo ${ghs(splitMomo)}` : ghs(total)} onClick={() => setStage("sent")}>
                        Send {network} prompt
                      </Pill>
                    ) : (
                      <Pill
                        tone="accent"
                        right={ghs(total)}
                        onClick={() => {
                          dispatch({ type: "pay", method: "cash" });
                          onPaid();
                        }}
                      >
                        All cash — take it
                      </Pill>
                    )}
                  </motion.div>
                )}
                {stage === "sent" && (
                  <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex items-center gap-4 border-t ${K.line} pt-5 text-sm`}>
                    <span className="h-4 w-4 animate-spin rounded-full border border-(--fg3) border-t-(--accent)" />
                    <div>
                      <p>Prompt sent to {phone}</p>
                      <p className={K.fg3}>Waiting for the customer’s PIN…</p>
                    </div>
                  </motion.div>
                )}
                {stage === "ok" && (
                  <motion.div key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center gap-4 border-t ${K.line} pt-5 text-sm`}>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-(--accent) text-xs font-black text-(--accent-ink)">✓</span>
                    <div>
                      <p>Approved · {ghs(splitMomo)} received</p>
                      <p className={K.fg3}>Ref MP{482210 + order.number} · printing receipt</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- receipt */

export function Receipt({ order, settings }: { order: Order; settings?: SettingsT }) {
  const { state } = useDemo();
  const cfg = settings ?? state.settings;
  const p = settings ? priceOrder(order, { taxRatePercent: settings.vatPercent, roomChargeCents: settings.roomChargeCents }) : price(state, order);
  const pay = order.payment!;
  const dash = "- - - - - - - - - - - - - - - - - - - - - -";
  const by = staffById(state, pay.byId)?.name.split(" ")[0] ?? "";
  return (
    <div className="mx-auto w-full rounded-md bg-[#f6f3ea] px-6 py-7 font-mono text-[.78rem] leading-5 text-zinc-800 shadow-[inset_0_0_0_1px_rgba(0,0,0,.04)]">
      <p className="text-center text-base font-bold tracking-tight">{cfg.receiptHeader}</p>
      <p className="text-center">{cfg.address}</p>
      <p className="text-center">TIN {cfg.tin} · VAT RECEIPT · #{order.number}</p>
      <p className="text-center">{new Date(pay.at).toLocaleString("en-GB")}</p>
      <p className="text-center">
        {tableOf(state, order.tableId).name} · {TYPE_LABEL[order.type]}
        {order.customer ? ` · ${order.customer}` : ""}
        {by ? ` · served by ${by}` : ""}
      </p>
      <p className="my-2 text-center text-zinc-400">{dash}</p>
      {order.lines.map((l) => (
        <p key={l.id} className="flex justify-between gap-2">
          <span>
            {l.qty} × {l.name}
          </span>
          <span>{((l.unitCents * l.qty) / 100).toFixed(2)}</span>
        </p>
      ))}
      <p className="my-2 text-center text-zinc-400">{dash}</p>
      <p className="flex justify-between"><span>Subtotal</span><span>{(p.subtotalCents / 100).toFixed(2)}</span></p>
      {p.discountCents > 0 && !p.complimentary && <p className="flex justify-between"><span>Discount ({order.discount?.reason})</span><span>−{(p.discountCents / 100).toFixed(2)}</span></p>}
      {p.complimentary && <p className="flex justify-between"><span>COMPLIMENTARY · {order.complimentary?.reason}</span><span>−{(p.compValueCents / 100).toFixed(2)}</span></p>}
      {p.roomChargeCents > 0 && <p className="flex justify-between"><span>Room service charge</span><span>{(p.roomChargeCents / 100).toFixed(2)}</span></p>}
      <p className="flex justify-between"><span>VAT {cfg.vatPercent} %</span><span>{(p.taxCents / 100).toFixed(2)}</span></p>
      {p.tipCents > 0 && <p className="flex justify-between"><span>Tip</span><span>{(p.tipCents / 100).toFixed(2)}</span></p>}
      <p className="flex justify-between text-base font-bold"><span>TOTAL</span><span>GH₵ {(p.totalCents / 100).toFixed(2)}</span></p>
      <p className="my-2 text-center text-zinc-400">{dash}</p>
      {pay.cashCents > 0 && <p className="flex justify-between"><span>Cash{pay.method === "cash" ? " tendered" : ""}</span><span>{((pay.method === "cash" ? pay.tenderedCents : pay.cashCents) / 100).toFixed(2)}</span></p>}
      {pay.method === "cash" && pay.changeCents > 0 && <p className="flex justify-between"><span>Change</span><span>{(pay.changeCents / 100).toFixed(2)}</span></p>}
      {pay.momoCents > 0 && <p className="flex justify-between"><span>MoMo {pay.network}</span><span>{(pay.momoCents / 100).toFixed(2)}</span></p>}
      {pay.momoCents > 0 && <p className="flex justify-between"><span>Ref</span><span>{pay.ref}</span></p>}
      {order.refund && <p className="mt-2 flex justify-between font-bold text-rose-700"><span>REFUNDED · {order.refund.reason}</span><span>−{(order.refund.amountCents / 100).toFixed(2)}</span></p>}
      {pay.queued && <p className="mt-2 text-center font-bold text-amber-700">* TAKEN OFFLINE · WILL SYNC *</p>}
      <p className="mt-3 text-center">{cfg.receiptFooter}</p>
      <p className="mt-3 text-center text-[.65rem] text-zinc-500">Demo receipt · no real transaction</p>
    </div>
  );
}

function ReceiptModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { dispatch } = useDemo();
  return (
    <Modal open={Boolean(order && order.payment)} onClose={onClose} kicker={order?.payment ? `#${order.number} · paid ${timeOf(order.payment.at)}` : undefined} title="Receipt" width="max-w-[420px]">
      {order?.payment && (
        <>
          <Receipt order={order} />
          <div className="mt-6 flex items-center justify-between">
            <TextLink
              tone="fg2"
              onClick={() => {
                onClose();
                dispatch({ type: "screen", screen: "kitchen" });
              }}
            >
              Go to kitchen
            </TextLink>
            <Pill tone="accent" size="md" className="!w-auto" onClick={onClose}>
              New order
            </Pill>
          </div>
        </>
      )}
    </Modal>
  );
}
