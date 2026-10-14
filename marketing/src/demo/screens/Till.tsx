"use client";

import { AnimatePresence, motion } from "motion/react";
import { Banknote, ChefHat, Check, Loader2, MessageSquareText, Minus, Plus, Receipt, Smartphone, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, MENU, MENU_BY_ID, MOMO_NETWORKS, TABLES, TABLE_BY_ID, type Category } from "../data";
import { ghs, priceLines, type Line } from "../pricing";
import { useDemo, type Order, type PayMethod } from "../store";
import { Btn, Chip, Field, inputCls, Modal, Panel, T, timeOf } from "../ui";

const TYPE_LABEL = { dine_in: "Dine-in", room_service: "Room service", takeaway: "Takeaway" } as const;

export function Till() {
  const { state, dispatch } = useDemo();
  const [category, setCategory] = useState<Category>("Kitchen");
  const [sheet, setSheet] = useState(false);
  const [paying, setPaying] = useState(false);
  const receipt = state.receiptOrderId ? state.orders.find((o) => o.id === state.receiptOrderId) ?? null : null;

  const order = state.orders.find((o) => o.tableId === state.selectedTableId && !o.paidAt);
  const table = state.selectedTableId ? TABLE_BY_ID[state.selectedTableId] : null;
  const priced = order ? priceLines(order.lines, order.type) : null;
  const qtyByItem = (order?.lines ?? []).reduce<Record<string, number>>((m, l) => ({ ...m, [l.itemId]: (m[l.itemId] ?? 0) + l.qty }), {});
  const onPaid = useCallback(() => setPaying(false), []);
  const items = MENU.filter((m) => m.category === category);
  const closed = Boolean(state.shift.closedAt);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
      {/* ------------------------------------------------ left: tables + menu */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Panel className="shrink-0 p-2.5">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className={`text-xs font-semibold uppercase tracking-wider ${T.muted}`}>Tables</p>
            <p className={`text-xs ${T.muted}`}>
              {state.orders.filter((o) => !o.paidAt).length} open · {TABLES.filter((t) => t.type === "dine_in").length - state.orders.filter((o) => !o.paidAt && TABLE_BY_ID[o.tableId].type === "dine_in").length} free
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {TABLES.map((t) => {
              const open = state.orders.find((o) => o.tableId === t.id && !o.paidAt);
              const unsent = open?.lines.some((l) => !l.sent);
              const active = state.selectedTableId === t.id;
              const total = open ? priceLines(open.lines, open.type).totalCents : 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => dispatch({ type: "selectTable", tableId: t.id })}
                  className={`relative shrink-0 rounded-xl border px-3 py-2 text-left transition-all ${
                    active ? "border-emerald-400/60 bg-emerald-400/15 shadow-[0_0_0_3px_rgba(52,211,153,.12)]" : open ? "border-amber-400/30 bg-amber-400/[.07] hover:bg-amber-400/10" : `${T.line} bg-white/[.03] hover:bg-white/[.07]`
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{t.label}</span>
                    {unsent && <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,.9)]" aria-label="unsent items" />}
                  </div>
                  <div className={`text-[.68rem] ${open ? "text-amber-200" : T.muted}`}>{open ? ghs(total) : t.seats ? `${t.seats} seats · ${t.zone}` : t.zone}</div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={`flex shrink-0 items-center gap-1 border-b ${T.line} p-2`}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${category === c ? "bg-emerald-400 text-emerald-950" : `${T.muted} hover:bg-white/5 hover:text-white`}`}
              >
                {c}
              </button>
            ))}
            {!table && <span className={`ml-auto hidden text-xs sm:block ${T.muted}`}>Pick a table, then tap dishes</span>}
            {table && (
              <span className="ml-auto flex items-center gap-2 text-xs">
                <Chip tone={table.type === "room_service" ? "amber" : "mint"}>{TYPE_LABEL[table.type]}</Chip>
                <span className="font-semibold">{table.label}</span>
              </span>
            )}
          </div>
          <div className="grid flex-1 auto-rows-max grid-cols-2 gap-2.5 overflow-y-auto p-2.5 pb-24 sm:grid-cols-3 lg:pb-2.5 xl:grid-cols-4">
            {items.map((m, i) => {
              const qty = qtyByItem[m.id] ?? 0;
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  disabled={closed}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    dispatch({ type: "addLine", itemId: m.id });
                  }}
                  className={`group relative overflow-hidden rounded-xl border text-left transition-colors disabled:opacity-40 ${qty ? "border-emerald-400/50" : `${T.line} hover:border-emerald-50/25`} bg-black/20`}
                >
                  <div className="relative aspect-[3/2] overflow-hidden">
                    <img src={m.img} alt="" width={720} height={480} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020c0a] via-transparent to-transparent" />
                    {!m.kitchen && (
                      <span className="absolute left-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[.6rem] font-bold uppercase tracking-wider text-sky-200 backdrop-blur">Bar</span>
                    )}
                    <AnimatePresence>
                      {qty > 0 && (
                        <motion.span
                          key="q"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          className="absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-emerald-400 px-2 text-xs font-black text-emerald-950 shadow-lg"
                        >
                          {qty}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-end justify-between gap-2 p-2.5">
                    <span className="text-[.82rem] font-semibold leading-tight">{m.short}</span>
                    <span className={`tabular text-sm font-bold ${T.mint}`}>{m.price}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ------------------------------------------------ right: order panel */}
      <Panel className="hidden w-[360px] shrink-0 flex-col overflow-hidden lg:flex xl:w-[380px]">
        <OrderPanel order={order} onCharge={() => setPaying(true)} />
      </Panel>

      {/* mobile cart bar + sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 p-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 shadow-2xl ${T.glassStrong} ${order ? "border-emerald-400/40" : ""}`}
        >
          <span className="flex items-center gap-2 text-sm">
            <Receipt size={16} className={T.mint} />
            {order ? (
              <>
                <b>{TABLE_BY_ID[order.tableId].label}</b>
                <span className={T.muted}>· {order.lines.reduce((n, l) => n + l.qty, 0)} items</span>
              </>
            ) : (
              <span className={T.muted}>{table ? `${table.label} · no items yet` : "No table selected"}</span>
            )}
          </span>
          <span className="tabular font-bold">{priced ? ghs(priced.totalCents) : "—"}</span>
        </button>
      </div>
      <Modal open={sheet} onClose={() => setSheet(false)} title={order ? `${TABLE_BY_ID[order.tableId].label} · #${order.number}` : "Order"} width="max-w-lg">
        <div className="-m-5 flex max-h-[80dvh] flex-col">
          <OrderPanel order={order} compact onCharge={() => { setSheet(false); setPaying(true); }} />
        </div>
      </Modal>

      {order && <PayModal open={paying} order={order} onClose={onPaid} onPaid={onPaid} />}
      <ReceiptModal order={receipt} onClose={() => dispatch({ type: "closeReceipt" })} />
    </div>
  );
}

/* ---------------------------------------------------------------- order panel */

function OrderPanel({ order, onCharge, compact = false }: { order?: Order; onCharge: () => void; compact?: boolean }) {
  const { state, dispatch, now } = useDemo();
  const table = state.selectedTableId ? TABLE_BY_ID[state.selectedTableId] : null;
  const priced = order ? priceLines(order.lines, order.type) : null;
  const unsent = order?.lines.filter((l) => !l.sent).length ?? 0;
  const ticket = order ? [...state.tickets].reverse().find((t) => t.orderId === order.id) : undefined;
  const closed = Boolean(state.shift.closedAt);

  return (
    <>
      {!compact && (
        <div className={`flex items-center justify-between border-b ${T.line} px-4 py-3`}>
          <div>
            <p className={`text-[.68rem] font-semibold uppercase tracking-wider ${T.muted}`}>Current order</p>
            <p className="text-base font-bold">{table ? `${table.label}${order ? ` · #${order.number}` : ""}` : "No table"}</p>
          </div>
          {order && <Chip tone={order.type === "room_service" ? "amber" : "mint"}>{TYPE_LABEL[order.type]}</Chip>}
          {!order && table && <span className={`text-xs ${T.muted}`}>{timeOf(now)}</span>}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!table && (
          <div className={`grid h-full min-h-40 place-items-center text-center text-sm ${T.muted}`}>
            <div>
              <p className="font-serif text-xl italic text-emerald-100/80">Pick a table to start.</p>
              <p className="mt-1">Tap any dish and it lands here with the VAT already worked out.</p>
            </div>
          </div>
        )}
        {table && !order && (
          <div className={`grid h-full min-h-40 place-items-center text-center text-sm ${T.muted}`}>
            <p>
              {table.label} is open. Tap dishes to add them.
              {table.type === "room_service" && <span className="mt-1 block text-amber-200/90">Room service adds a GH₵ 30 charge, taxed with the food.</span>}
            </p>
          </div>
        )}
        {order && (
          <ul className="divide-y divide-emerald-50/[.06]">
            <AnimatePresence initial={false}>
              {order.lines.map((l) => (
                <LineRow key={l.id} line={l} />
              ))}
            </AnimatePresence>
          </ul>
        )}
        {ticket && (
          <p className={`mt-2 flex items-center gap-1.5 rounded-lg border ${T.line} bg-white/[.03] px-2.5 py-1.5 text-xs ${T.muted}`}>
            <ChefHat size={13} className={T.amber} />
            Kitchen: <b className="text-emerald-50">{ticket.status === "pending" ? "ticket waiting" : ticket.status === "preparing" ? "cooking" : ticket.status === "ready" ? "ready on the pass" : "served"}</b>
            {ticket.firedAt && <span className="ml-auto">fired {timeOf(ticket.firedAt)}</span>}
          </p>
        )}
      </div>

      <div className={`shrink-0 border-t ${T.line} bg-black/20 px-4 py-3`}>
        <dl className="space-y-1 text-sm">
          <Row k="Subtotal" v={priced ? ghs(priced.subtotalCents) : "—"} />
          {priced && priced.roomChargeCents > 0 && <Row k="Room service charge" v={ghs(priced.roomChargeCents)} />}
          <Row k="VAT 15 %" v={priced ? ghs(priced.taxCents) : "—"} />
          <div className={`flex items-baseline justify-between border-t ${T.line} pt-2`}>
            <dt className="font-semibold">Total</dt>
            <dd className="tabular text-xl font-black tracking-tight">{priced ? ghs(priced.totalCents) : "GH₵ 0.00"}</dd>
          </div>
        </dl>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn tone="amber" disabled={!order || unsent === 0 || closed} onClick={() => dispatch({ type: "send" })}>
            <ChefHat size={16} /> Send{unsent ? ` ${unsent} new` : ""}
          </Btn>
          <Btn tone="mint" disabled={!order || closed} onClick={onCharge}>
            <Banknote size={16} /> Charge
          </Btn>
        </div>
        {closed && <p className="mt-2 text-center text-xs text-amber-200">Shift is closed — start a new shift from Drawer to keep selling.</p>}
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className={T.muted}>{k}</dt>
      <dd className="tabular">{v}</dd>
    </div>
  );
}

function LineRow({ line }: { line: Line }) {
  const { dispatch } = useDemo();
  const [noting, setNoting] = useState(false);
  const item = MENU_BY_ID[line.itemId];
  return (
    <motion.li layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="py-2">
      <div className="flex items-center gap-2">
        <div className={`flex items-center rounded-lg border ${T.line} bg-black/30`}>
          <button type="button" aria-label="Less" className="grid h-7 w-7 place-items-center hover:text-white" onClick={() => dispatch({ type: "setQty", lineId: line.id, qty: line.qty - 1 })}>
            <Minus size={12} />
          </button>
          <span className="tabular w-5 text-center text-sm font-bold">{line.qty}</span>
          <button type="button" aria-label="More" className="grid h-7 w-7 place-items-center hover:text-white" onClick={() => dispatch({ type: "setQty", lineId: line.id, qty: line.qty + 1 })}>
            <Plus size={12} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <p className={`flex items-center gap-1.5 text-[.68rem] ${T.muted}`}>
            {line.sent ? <span className="text-emerald-300">sent</span> : <span className="text-amber-300">new</span>}
            {line.note && <span className="truncate">· “{line.note}”</span>}
          </p>
        </div>
        <button type="button" aria-label="Note" onClick={() => setNoting((v) => !v)} className={`grid h-7 w-7 place-items-center rounded-lg hover:bg-white/5 ${line.note ? T.amber : T.muted}`}>
          <MessageSquareText size={14} />
        </button>
        <span className="tabular w-16 text-right text-sm font-semibold">{(item.price * line.qty).toFixed(2)}</span>
      </div>
      {noting && (
        <input
          autoFocus
          value={line.note}
          placeholder="Kitchen note — no onions, well done…"
          onChange={(e) => dispatch({ type: "setNote", lineId: line.id, note: e.target.value.slice(0, 60) })}
          onBlur={() => setNoting(false)}
          onKeyDown={(e) => e.key === "Enter" && setNoting(false)}
          className={`${inputCls} mt-2 py-1.5 text-xs`}
        />
      )}
    </motion.li>
  );
}

/* ---------------------------------------------------------------- pay modal */

function PayModal({ open, order, onClose, onPaid }: { open: boolean; order: Order; onClose: () => void; onPaid: () => void }) {
  // The modal unmounts its body when closed, so every opening starts with fresh tendered/method state;
  // closing while a MoMo prompt is out simply cancels it.
  return (
    <Modal open={open} onClose={onClose} title={<span>Charge {TABLE_BY_ID[order.tableId].label} <span className={`font-normal ${T.muted}`}>· #{order.number}</span></span>}>
      <PayBody order={order} onPaid={onPaid} />
    </Modal>
  );
}

function PayBody({ order, onPaid }: { order: Order; onPaid: () => void }) {
  const { state, dispatch } = useDemo();
  const priced = priceLines(order.lines, order.type);
  const total = priced.totalCents;
  const [method, setMethod] = useState<PayMethod>(state.online ? "momo" : "cash");
  const [tendered, setTendered] = useState<number>(total);
  const [custom, setCustom] = useState("");
  const [network, setNetwork] = useState<(typeof MOMO_NETWORKS)[number]>("MTN");
  const [phone, setPhone] = useState("024 123 4567");
  const [momoStage, setMomoStage] = useState<"idle" | "sent" | "ok">("idle");

  // Every dependency is stable while the prompt is out (network pills are disabled, onPaid is memoised).
  useEffect(() => {
    if (momoStage !== "sent") return;
    const a = setTimeout(() => setMomoStage("ok"), 1900);
    const b = setTimeout(() => {
      dispatch({ type: "pay", method: "momo", tenderedCents: total, network });
      onPaid();
    }, 2700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [momoStage, dispatch, total, network, onPaid]);

  const quick = Array.from(new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 20000) * 20000])).filter((v) => v >= total).slice(0, 5);
  const change = Math.max(0, tendered - total);

  return (
    <>
      <div className={`mb-4 flex items-baseline justify-between rounded-2xl border ${T.line} bg-black/30 px-4 py-3`}>
        <span className={T.muted}>Amount due</span>
        <span className="tabular text-3xl font-black tracking-tight">{ghs(total)}</span>
      </div>

      <div className={`mb-4 grid grid-cols-2 gap-1 rounded-xl border ${T.line} bg-black/30 p-1`}>
        {(["momo", "cash"] as PayMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={momoStage !== "idle"}
            onClick={() => setMethod(m)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${method === m ? "bg-emerald-400 text-emerald-950" : `${T.muted} hover:text-white`}`}
          >
            {m === "momo" ? <Smartphone size={15} /> : <Banknote size={15} />}
            {m === "momo" ? "Mobile Money" : "Cash"}
          </button>
        ))}
      </div>

      {method === "cash" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setTendered(q);
                  setCustom("");
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold tabular ${tendered === q && !custom ? "border-emerald-400/60 bg-emerald-400/15" : `${T.line} bg-white/5 hover:bg-white/10`}`}
              >
                {q === total ? "Exact" : ghs(q)}
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
              className={`${inputCls} tabular text-lg font-bold`}
            />
          </Field>
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${tendered < total ? "border-rose-400/30 bg-rose-400/10" : "border-emerald-400/20 bg-emerald-400/10"}`}>
            <span className="text-sm font-semibold">{tendered < total ? "Short by" : "Change due"}</span>
            <span className="tabular text-xl font-black">{ghs(Math.abs(tendered - total))}</span>
          </div>
          {!state.online && (
            <p className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              <WifiOff size={14} /> Offline — this sale is saved on the device and syncs when the network returns.
            </p>
          )}
          <Btn
            tone="mint"
            size="lg"
            className="w-full"
            disabled={tendered < total}
            onClick={() => {
              dispatch({ type: "pay", method: "cash", tenderedCents: tendered });
              onPaid();
            }}
          >
            <Check size={18} /> Take {ghs(tendered)}{change ? ` · give ${ghs(change)} change` : ""}
          </Btn>
        </div>
      )}

      {method === "momo" && (
        <div className="space-y-3">
          {!state.online ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <WifiOff size={15} /> No network — the MoMo prompt can’t be sent.
              </p>
              <p className="mt-1 text-amber-100/80">Take cash instead; it queues on this device and syncs automatically.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {MOMO_NETWORKS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={momoStage !== "idle"}
                    onClick={() => setNetwork(n)}
                    className={`rounded-lg border py-2.5 text-sm font-bold ${network === n ? "border-amber-400/60 bg-amber-400/15 text-amber-100" : `${T.line} bg-white/5 hover:bg-white/10`}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Field label="Customer phone">
                <input value={phone} disabled={momoStage !== "idle"} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={`${inputCls} tabular text-lg font-bold`} />
              </Field>
              <AnimatePresence mode="wait">
                {momoStage === "idle" && (
                  <motion.div key="idle" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Btn tone="mint" size="lg" className="w-full" onClick={() => setMomoStage("sent")}>
                      <Smartphone size={18} /> Send {network} prompt for {ghs(total)}
                    </Btn>
                  </motion.div>
                )}
                {momoStage === "sent" && (
                  <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex items-center gap-3 rounded-xl border ${T.line} bg-black/30 px-4 py-3 text-sm`}>
                    <Loader2 size={18} className="animate-spin text-amber-300" />
                    <div>
                      <p className="font-semibold">Prompt sent to {phone}</p>
                      <p className={T.muted}>Waiting for the customer’s PIN…</p>
                    </div>
                  </motion.div>
                )}
                {momoStage === "ok" && (
                  <motion.div key="ok" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-400 text-emerald-950">
                      <Check size={16} strokeWidth={3} />
                    </span>
                    <div>
                      <p className="font-semibold">Approved · {ghs(total)} received</p>
                      <p className={T.muted}>Ref MP{482210 + order.number} · printing receipt</p>
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

function ReceiptModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { dispatch } = useDemo();
  if (!order || !order.payment) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const p = priceLines(order.lines, order.type);
  const pay = order.payment;
  const dash = "- - - - - - - - - - - - - - - - - - - - - -";
  return (
    <Modal open={Boolean(order)} onClose={onClose} title="Receipt" width="max-w-sm">
      <div className="mx-auto w-full rounded-lg bg-[#f6f3ea] px-5 py-6 font-mono text-[.78rem] leading-5 text-zinc-800 shadow-inner">
        <p className="text-center text-base font-bold tracking-tight">LUSH VIEW HOTEL</p>
        <p className="text-center">Restaurant &amp; Bar · Accra</p>
        <p className="text-center">VAT RECEIPT · #{order.number}</p>
        <p className="text-center">{new Date(pay.at).toLocaleString("en-GB")}</p>
        <p className="text-center">{TABLE_BY_ID[order.tableId].label} · {TYPE_LABEL[order.type]}</p>
        <p className="my-2 text-center text-zinc-400">{dash}</p>
        {order.lines.map((l) => (
          <p key={l.id} className="flex justify-between gap-2">
            <span>
              {l.qty} × {MENU_BY_ID[l.itemId].name}
            </span>
            <span className="tabular">{(MENU_BY_ID[l.itemId].price * l.qty).toFixed(2)}</span>
          </p>
        ))}
        <p className="my-2 text-center text-zinc-400">{dash}</p>
        <p className="flex justify-between"><span>Subtotal</span><span className="tabular">{(p.subtotalCents / 100).toFixed(2)}</span></p>
        {p.roomChargeCents > 0 && <p className="flex justify-between"><span>Room service charge</span><span className="tabular">{(p.roomChargeCents / 100).toFixed(2)}</span></p>}
        <p className="flex justify-between"><span>VAT 15 %</span><span className="tabular">{(p.taxCents / 100).toFixed(2)}</span></p>
        <p className="flex justify-between text-base font-bold"><span>TOTAL</span><span className="tabular">GH₵ {(p.totalCents / 100).toFixed(2)}</span></p>
        <p className="my-2 text-center text-zinc-400">{dash}</p>
        <p className="flex justify-between"><span>{pay.method === "cash" ? "Cash tendered" : `MoMo ${pay.network}`}</span><span className="tabular">{(pay.tenderedCents / 100).toFixed(2)}</span></p>
        {pay.method === "cash" && <p className="flex justify-between"><span>Change</span><span className="tabular">{(pay.changeCents / 100).toFixed(2)}</span></p>}
        {pay.method === "momo" && <p className="flex justify-between"><span>Ref</span><span>{pay.ref}</span></p>}
        {pay.queued && <p className="mt-2 text-center font-bold text-amber-700">* TAKEN OFFLINE · WILL SYNC *</p>}
        <p className="mt-3 text-center">Thank you — medaase</p>
        <p className="mt-3 text-center text-[.65rem] text-zinc-500">Demo receipt · no real transaction</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn onClick={() => { onClose(); dispatch({ type: "screen", screen: "kitchen" }); }}>
          <ChefHat size={15} /> Go to kitchen
        </Btn>
        <Btn tone="mint" onClick={onClose}>
          <Plus size={15} /> New order
        </Btn>
      </div>
    </Modal>
  );
}
