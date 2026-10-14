"use client";

import { ArrowLeftRight, Ban, MoreHorizontal, Printer, Search, Send, ShoppingBag, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isManager, type CatKey, type Discount, type Line, type Order, type PayMethod } from "../data";
import { cedi, hm, num, parseCedi } from "../money";
import { currentUser, openOrderFor, totals, useStore, type PayInput, type Totals } from "../store";
import { Field, Keypad, Modal, Money, PinPad, Stepper, cx, useAmountKeys } from "../ui";

type Sheet =
  | { kind: "pay"; tender: PayMethod | "split" }
  | { kind: "discount" } | { kind: "note"; line: Line } | { kind: "guests" } | { kind: "move" } | { kind: "void" } | { kind: "bill" }
  | { kind: "receipt"; orderId: number; change: number };

export function Till() {
  const { state, api } = useStore();
  const me = currentUser(state)!;
  const [cat, setCat] = useState<CatKey | "all">("kitchen");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const table = state.tables.find((t) => t.id === state.tillTable) ?? null;
  const order = openOrderFor(state, state.tillTable);
  const t = order ? totals(order, state.settings.vat) : null;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current && !document.querySelector(".modal-bg")) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const dishes = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return state.dishes.filter((d) => (qq ? d.name.toLowerCase().includes(qq) || d.desc.toLowerCase().includes(qq) : cat === "all" || d.cat === cat));
  }, [state.dishes, q, cat]);

  const inOrder = new Map<string, number>();
  for (const l of order?.lines ?? []) inOrder.set(l.dishId, (inOrder.get(l.dishId) ?? 0) + l.qty);
  const unsent = order?.lines.filter((l) => !l.sent).length ?? 0;

  const add = (id: string) => {
    if (!table) { api.notify("Pick a table first — or tap Takeaway", "warn"); return; }
    if (table.status === "cleaning") { api.notify(`${table.label} needs clearing first`, "warn"); return; }
    api.addLine(id);
    setPopId(id);
    setTimeout(() => setPopId((p) => (p === id ? null : p)), 400);
  };

  const tenders = state.settings.tenders;

  return (
    <div className="till">
      {/* ------------------------------------------------ categories */}
      <aside className="flex min-h-0 flex-col gap-2.5 py-5 pl-6">
        <h3 className="kicker mb-1">Menu</h3>
        <button type="button" className={cx("cat is-all", cat === "all" && !q && "is-active")} onClick={() => { setCat("all"); setQ(""); }}>
          <span className="cat-name" style={{ fontSize: 15 }}>Everything</span><span className="cat-n">{state.dishes.length}</span>
        </button>
        {state.categories.map((c) => (
          <button key={c.key} type="button" className={cx("cat", cat === c.key && !q && "is-active")} data-tone={c.key} onClick={() => { setCat(c.key); setQ(""); }}>
            <span className="cat-name">{c.name}</span>
            <span className="cat-n">{state.dishes.filter((d) => d.cat === c.key).length}</span>
          </button>
        ))}
        <span className="mt-auto text-[12px] font-semibold text-[var(--ink3)]">{dishes.length} dish{dishes.length === 1 ? "" : "es"}{q ? ` for “${q}”` : ""}</span>
      </aside>

      {/* ------------------------------------------------ dishes */}
      <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3.5 px-5 pt-5">
        <div className="flex items-center gap-2">
          <h3 className="kicker mr-1 flex-none">Tables</h3>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]">
            {state.tables.map((tb) => {
              const o = openOrderFor(state, tb.id);
              const sub = tb.status === "open" && o ? num(totals(o, state.settings.vat).total) : tb.status === "reserved" ? tb.reservation?.time ?? "reserved" : tb.status === "cleaning" ? "clear" : tb.zone === "Takeaway" ? "walk-in" : `${tb.seats} seats`;
              return (
                <button key={tb.id} type="button" className={cx("tchip", `is-${tb.status}`, tb.id === state.tillTable && "is-current")} onClick={() => { api.pickTable(tb.id); setSel(null); }} title={tb.label}>
                  <b>{tb.code}</b><small>{sub}</small>
                </button>
              );
            })}
          </div>
          <label className="search w-[260px] flex-none">
            <Search size={16} strokeWidth={2.5} />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a dish…" aria-label="Search dishes" />
            {q ? <button type="button" className="text-[12px] font-bold" onClick={() => setQ("")}>Clear</button> : <kbd>/</kbd>}
          </label>
        </div>

        <div className="tiles">
          {dishes.length === 0 && <div className="empty col-span-full">Nothing matches “{q}”.</div>}
          {dishes.map((d) => {
            const n = inOrder.get(d.id) ?? 0;
            return (
              <button key={d.id} type="button" className={cx("tile", n > 0 && "in-order", !d.available && "is-off")} data-tone={d.cat} onClick={() => add(d.id)} aria-label={`Add ${d.name}`}>
                {n > 0 && <span key={popId === d.id ? "pop" : "still"} className="tile-badge">{n}</span>}
                <span className="tile-img">
                  {d.img ? <img src={`/dishes/${d.img}.jpg`} alt="" loading="lazy" /> : <span className="ph">{d.name.slice(0, 1)}</span>}
                  <span className="tile-cat">{state.categories.find((c) => c.key === d.cat)?.name}</span>
                  {d.available ? <span className="tile-mins">{d.mins} min</span> : <span className="tile-off">86'd</span>}
                </span>
                <span className="flex flex-col gap-0.5 px-1 pt-2.5">
                  <span className="tile-name">{d.name}</span>
                  <span className="tile-desc">{d.desc}</span>
                </span>
                <span className="mt-2.5 flex items-center justify-between px-1">
                  <span className="tile-price"><small>GH₵</small>{num(d.price).replace(/\.00$/, "")}</span>
                  <span className="tile-add">{n > 0 ? `+1 · ${n} in order` : "+"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------ ticket */}
      <aside className="min-h-0 py-5 pl-2.5 pr-5">
        <div className="ticket">
          <header className="t-head">
            {table ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--ink4)]">{order ? `Order #${order.id} · opened ${hm(order.opened)}` : table.status === "cleaning" ? "Needs clearing" : table.status === "reserved" ? `Reserved · ${table.reservation?.name} ${table.reservation?.time}` : "No order yet"}</div>
                  <div className="t-title mt-1 truncate">{table.label}</div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="tag sun">{table.zone === "Takeaway" ? "Takeaway" : table.zone === "Rooms" ? "Room service" : "Dine-in"}</span>
                    {order && table.zone !== "Takeaway" && (
                      <button type="button" className="tag is-btn" onClick={() => setSheet({ kind: "guests" })}><Users size={11} strokeWidth={3} />{order.guests} guest{order.guests === 1 ? "" : "s"}</button>
                    )}
                    {order && <span className="tag">{t!.items} item{t!.items === 1 ? "" : "s"}</span>}
                  </div>
                </div>
                {order && <TicketMenu onBill={() => setSheet({ kind: "bill" })} onMove={() => setSheet({ kind: "move" })} onVoid={() => setSheet({ kind: "void" })} canVoid={isManager(me.role)} />}
              </div>
            ) : (
              <div>
                <div className="text-[12px] font-semibold text-[var(--ink4)]">Till 1 · {me.name}</div>
                <div className="t-title mt-1">Pick a table</div>
                <div className="mt-2.5 text-[13px] text-[#d6cfbd]">Tap a table above, or start a walk-in order.</div>
              </div>
            )}
          </header>

          <ul className="lines ink-scroll">
            {!table && (
              <li className="px-2 pt-6">
                <button type="button" className="btn btn-sun w-full" onClick={() => api.pickTable("ta")}><ShoppingBag size={16} strokeWidth={2.5} /> Takeaway order</button>
              </li>
            )}
            {table && table.status === "cleaning" && !order && (
              <li className="px-2 pt-6 text-center">
                <p className="text-[13px] text-[#d6cfbd]">The last party has paid. Clear the table to seat the next one.</p>
                <button type="button" className="btn btn-sun mt-4" onClick={() => api.clearTable(table.id)}>Mark {table.label} free</button>
              </li>
            )}
            {table && table.status !== "cleaning" && !order && (
              <li className="empty" style={{ color: "var(--ink4)" }}>Tap a dish to open the order.</li>
            )}
            {order && order.lines.length === 0 && <li className="empty" style={{ color: "var(--ink4)" }}>Nothing on the bill yet.</li>}
            {order?.lines.map((l) => (
              <li key={l.id} className={cx("line", !l.sent && "is-new", l.status === "ready" && "is-ready", sel === l.id && "is-sel")} onClick={() => setSel((s) => (s === l.id ? null : l.id))}>
                <span className="line-qty">{l.qty}</span>
                <span className="min-w-0">
                  <span className="line-name block truncate">{l.name}</span>
                  <span className="line-meta">
                    {l.note ? <button type="button" className="line-note" onClick={(e) => { e.stopPropagation(); setSheet({ kind: "note", line: l }); }}>{l.note}</button> : <button type="button" className="line-link" onClick={(e) => { e.stopPropagation(); setSheet({ kind: "note", line: l }); }}>+ note</button>}
                    <span className={cx("line-state", l.sent ? l.status : "new")}>{l.sent ? (l.status === "new" ? "at the pass" : l.status) : "not sent"}</span>
                  </span>
                </span>
                <span className="line-price">{num(l.price * l.qty)}</span>
                <span className="line-step" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => api.bump(l.id, -1)} aria-label="Remove one">−</button>
                  <button type="button" onClick={() => api.bump(l.id, 1)} aria-label="Add one">+</button>
                </span>
              </li>
            ))}
          </ul>

          <footer className="t-foot">
            <dl className="mx-1 mb-2.5 flex flex-col gap-1.5">
              <div className="tot"><dt>Subtotal</dt><dd>{num(t?.subtotal ?? 0)}</dd></div>
              {t && t.discount > 0 && <div className="tot" style={{ color: "var(--sun)" }}><dt>Discount{order?.discount?.kind === "pct" ? ` ${order.discount.value}%` : ""} · {order?.discount?.reason}</dt><dd>−{num(t.discount)}</dd></div>}
              <div className="tot"><dt>VAT {state.settings.vat}%</dt><dd>{num(t?.vat ?? 0)}</dd></div>
              {t && t.service > 0 && <div className="tot"><dt>Room service</dt><dd>{num(t.service)}</dd></div>}
              <div className="tot tot-grand"><dt>Total</dt><dd><small>GH₵</small>{num(t?.total ?? 0)}</dd></div>
            </dl>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button type="button" className="ghost" disabled={!unsent} onClick={() => api.send()}><Send size={14} strokeWidth={2.5} /> Send to kitchen {unsent > 0 && <span className="n">{unsent}</span>}</button>
              <button type="button" className="ghost" disabled={!order?.lines.length} onClick={() => setSheet({ kind: "discount" })}>{order?.discount ? "Edit discount" : "Discount"}</button>
            </div>
            <div className="mb-2 grid grid-cols-3 gap-2">
              {tenders.cash && <button type="button" className="tender-btn" disabled={!order?.lines.length} onClick={() => setSheet({ kind: "pay", tender: "cash" })}><span className="dot" data-tone="forest" />Cash</button>}
              {tenders.momo && <button type="button" className="tender-btn" disabled={!order?.lines.length} onClick={() => setSheet({ kind: "pay", tender: "momo" })}><span className="dot" data-tone="sun" />MoMo</button>}
              <button type="button" className="tender-btn" disabled={!order?.lines.length} onClick={() => setSheet({ kind: "pay", tender: "split" })}><span className="dot" data-tone="cobalt" />Split</button>
            </div>
            <button type="button" className="charge" disabled={!order?.lines.length} onClick={() => setSheet({ kind: "pay", tender: tenders.cash ? "cash" : "momo" })}>
              <span>Charge</span><span>{cedi(t?.total ?? 0)}</span>
            </button>
          </footer>
        </div>
      </aside>

      {/* ------------------------------------------------ sheets */}
      {sheet?.kind === "pay" && order && t && (
        <PaySheet order={order} t={t} initial={sheet.tender} onClose={() => setSheet(null)} onPaid={(r) => setSheet({ kind: "receipt", orderId: r.orderId, change: r.change })} />
      )}
      {sheet?.kind === "discount" && order && t && <DiscountSheet current={order.discount} subtotal={t.subtotal} onClose={() => setSheet(null)} />}
      {sheet?.kind === "note" && <NoteSheet line={sheet.line} onClose={() => setSheet(null)} />}
      {sheet?.kind === "guests" && order && <GuestsSheet guests={order.guests} onClose={() => setSheet(null)} />}
      {sheet?.kind === "move" && order && <MoveSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === "void" && order && <VoidSheet order={order} onClose={() => setSheet(null)} />}
      {sheet?.kind === "bill" && order && t && (
        <Modal title="Bill preview" sub={`${order.tableLabel} · Order #${order.id}`} onClose={() => setSheet(null)} foot={<><button type="button" className="btn btn-ghost" onClick={() => setSheet(null)}>Close</button><button type="button" className="btn btn-ink grow" onClick={() => { api.print(`Bill #${order.id}`); setSheet(null); }}><Printer size={16} /> Print bill</button></>}>
          <Receipt order={order} t={t} title="BILL — NOT A RECEIPT" />
        </Modal>
      )}
      {sheet?.kind === "receipt" && <ReceiptSheet orderId={sheet.orderId} change={sheet.change} onClose={() => setSheet(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------ pieces */

function TicketMenu({ onBill, onMove, onVoid, canVoid }: { onBill: () => void; onMove: () => void; onVoid: () => void; canVoid: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20" onClick={() => setOpen((v) => !v)} aria-label="Order actions"><MoreHorizontal size={18} /></button>
      {open && (
        <div className="menu" style={{ width: 220 }}>
          <button type="button" className="menu-item c-ink" onClick={() => { setOpen(false); onBill(); }}><span>Print bill</span><Printer size={15} /></button>
          <button type="button" className="menu-item c-ink" onClick={() => { setOpen(false); onMove(); }}><span>Move to another table</span><ArrowLeftRight size={15} /></button>
          <button type="button" className="menu-item danger" disabled={!canVoid} title={canVoid ? "" : "Managers only"} onClick={() => { setOpen(false); onVoid(); }}><span>Void order{canVoid ? "" : " · manager"}</span><Ban size={15} /></button>
        </div>
      )}
    </div>
  );
}

export function Receipt({ order, t, title, change }: { order: Order; t: Totals; title?: string; change?: number }) {
  const { state } = useStore();
  const b = state.settings.business;
  return (
    <div className="receipt">
      <div className="text-center">
        <div className="text-[14px] font-bold">{b.name.toUpperCase()}</div>
        <div>{b.address}</div>
        <div>{b.phone}{state.settings.receipt.showTin ? ` · TIN ${b.tin}` : ""}</div>
      </div>
      <hr />
      {title && <div className="text-center font-bold">{title}</div>}
      <div className="rrow"><span>#{order.id} · {order.tableLabel}</span><span>{hm(order.closed ?? Date.now())}</span></div>
      <div className="rrow"><span>Served by {state.staff.find((s) => s.id === order.staffId)?.name.split(" ")[0]}</span><span>{order.guests} pax</span></div>
      <hr />
      {order.lines.map((l) => (
        <div key={l.id}>
          <div className="rrow"><span>{l.qty} × {l.name}</span><span>{num(l.price * l.qty)}</span></div>
          {l.note && <div className="pl-4 text-[11px] text-neutral-500">— {l.note}</div>}
        </div>
      ))}
      <hr />
      <div className="rrow"><span>Subtotal</span><span>{num(t.subtotal)}</span></div>
      {t.discount > 0 && <div className="rrow"><span>Discount ({order.discount?.reason})</span><span>-{num(t.discount)}</span></div>}
      <div className="rrow"><span>VAT {state.settings.vat}%</span><span>{num(t.vat)}</span></div>
      {t.service > 0 && <div className="rrow"><span>Room service</span><span>{num(t.service)}</span></div>}
      <div className="rrow text-[15px] font-bold"><span>TOTAL</span><span>GH₵ {num(t.total)}</span></div>
      {order.payments.map((p) => (
        <div key={p.id} className="rrow"><span>{p.method === "cash" ? "Cash" : p.method === "momo" ? `MoMo ${p.network} ${p.phone}` : "GhQR"}{p.ref ? ` ${p.ref}` : ""}</span><span>{num(p.method === "cash" ? p.tendered : p.amount)}</span></div>
      ))}
      {change !== undefined && change > 0 && <div className="rrow font-bold"><span>CHANGE</span><span>{num(change)}</span></div>}
      <hr />
      <div className="text-center">{state.settings.receipt.header}</div>
      <div className="text-center text-[11px] text-neutral-500">{state.settings.receipt.footer}</div>
    </div>
  );
}

function PaySheet({ order, t, initial, onClose, onPaid }: { order: Order; t: Totals; initial: PayMethod | "split"; onClose: () => void; onPaid: (r: { orderId: number; change: number }) => void }) {
  const { state, api } = useStore();
  const tenders = state.settings.tenders;
  const [tender, setTender] = useState<PayMethod | "split">(initial);
  const cash = useAmountKeys(0);
  const [network, setNetwork] = useState<"MTN" | "Telecel" | "AT">(tenders.networks.MTN ? "MTN" : tenders.networks.Telecel ? "Telecel" : "AT");
  const [phone, setPhone] = useState("024 ");
  const [splitCash, setSplitCash] = useState("");
  const due = t.total;
  const cashIn = cash.value;
  const short = Math.max(0, due - cashIn);
  const change = Math.max(0, cashIn - due);
  const splitCashP = Math.min(due, parseCedi(splitCash));
  const splitMomo = due - splitCashP;
  const nets = (["MTN", "Telecel", "AT"] as const).filter((n) => tenders.networks[n]);

  const quick = useMemo(() => {
    const set = new Set<number>([due]);
    for (const step of [1000, 2000, 5000, 10000, 20000]) { const v = Math.ceil(due / step) * step; if (v > due) set.add(v); }
    return [...set].sort((a, b) => a - b).slice(0, 4);
  }, [due]);

  const confirm = () => {
    let pays: PayInput[];
    if (tender === "cash") pays = [{ method: "cash", amount: due, tendered: cashIn }];
    else if (tender === "momo") pays = [{ method: "momo", amount: due, network, phone: phone.trim() }];
    else if (tender === "ghqr") pays = [{ method: "ghqr", amount: due }];
    else pays = [...(splitCashP > 0 ? [{ method: "cash" as const, amount: splitCashP, tendered: splitCashP }] : []), ...(splitMomo > 0 ? [{ method: "momo" as const, amount: splitMomo, network, phone: phone.trim() }] : [])];
    const r = api.charge(pays);
    if (r) onPaid(r);
  };
  const ok = tender === "cash" ? cashIn >= due : tender === "momo" ? phone.replace(/\D/g, "").length >= 10 : tender === "split" ? splitCashP > 0 && splitCashP < due : true;

  return (
    <Modal title={<Money v={due} />} sub={`${order.tableLabel} · Order #${order.id} · ${t.items} items`} onClose={onClose}
      foot={<><button type="button" className="btn btn-ghost" onClick={onClose}>Back</button><button type="button" className="btn btn-sun grow" disabled={!ok} onClick={confirm}>
        {tender === "cash" ? (short > 0 ? `Need ${cedi(short)} more` : `Take cash · change ${cedi(change)}`) : tender === "momo" ? `Request ${cedi(due)} from ${network}` : tender === "ghqr" ? "Customer has paid — confirm" : `Confirm split · ${cedi(splitCashP)} cash + ${cedi(splitMomo)} MoMo`}
      </button></>}>
      <div className="grid grid-cols-4 gap-2">
        {tenders.cash && <button type="button" className={cx("tender", tender === "cash" && "is-active")} onClick={() => setTender("cash")}><span className="dot" data-tone="forest" />Cash</button>}
        {tenders.momo && <button type="button" className={cx("tender", tender === "momo" && "is-active")} onClick={() => setTender("momo")}><span className="dot" data-tone="sun" />MoMo</button>}
        {tenders.cash && tenders.momo && <button type="button" className={cx("tender", tender === "split" && "is-active")} onClick={() => setTender("split")}><span className="dot" data-tone="cobalt" />Split</button>}
        {tenders.ghqr && <button type="button" className={cx("tender", tender === "ghqr" && "is-active")} onClick={() => setTender("ghqr")}><span className="dot" data-tone="terra" />GhQR</button>}
      </div>

      {tender === "cash" && (
        <>
          <div className={cx("amount-box", short > 0 && "is-short")}>
            <span className="lbl">Cash tendered</span>
            <span className="val">{cedi(cashIn)}</span>
            <span className="chg">{short > 0 ? "Still due" : "Change due"}<b>{cedi(short > 0 ? short : change)}</b></span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {quick.map((v) => <button key={v} type="button" className="quick" onClick={() => cash.set(v)}>{v === due ? "Exact" : num(v).replace(/\.00$/, "")}</button>)}
          </div>
          <Keypad onKey={cash.key} />
        </>
      )}

      {tender === "momo" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {nets.map((n) => <button key={n} type="button" className={cx("net", `net-${n === "AT" ? "at" : n.toLowerCase()}`, network === n && "is-active")} onClick={() => setNetwork(n)}>{n === "AT" ? "AirtelTigo" : n}</button>)}
          </div>
          <Field label="Customer's MoMo number"><input className="input lg" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="024 000 0000" /></Field>
          <p className="text-[12.5px] font-medium text-[var(--ink3)]">A payment prompt is pushed to the customer's phone. The order closes when {network} confirms — usually under 10 seconds.</p>
        </>
      )}

      {tender === "ghqr" && (
        <>
          <div className="qr" aria-label="GhQR code" />
          <p className="text-center text-[12.5px] font-medium text-[var(--ink3)]">Customer scans with any bank or MoMo app. Amount {cedi(due)} is embedded in the code.</p>
        </>
      )}

      {tender === "split" && (
        <>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Cash part"><input className="input lg" value={splitCash} onChange={(e) => setSplitCash(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus /></Field>
            <div className="flex h-14 items-center justify-between rounded-2xl border-2 border-[var(--line)] bg-white px-4 text-[12px] font-semibold text-[var(--ink3)]">MoMo part<b className="d text-[18px] font-extrabold c-ink">{cedi(splitMomo)}</b></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {nets.map((n) => <button key={n} type="button" className={cx("net", `net-${n === "AT" ? "at" : n.toLowerCase()}`, network === n && "is-active")} onClick={() => setNetwork(n)}>{n === "AT" ? "AirtelTigo" : n}</button>)}
          </div>
          <Field label="Customer's MoMo number"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
        </>
      )}
    </Modal>
  );
}

function ReceiptSheet({ orderId, change, onClose }: { orderId: number; change: number; onClose: () => void }) {
  const { state, api } = useStore();
  const order = state.orders.find((o) => o.id === orderId)!;
  const t = totals(order, state.settings.vat);
  return (
    <Modal title={change > 0 ? <>Change <Money v={change} /></> : "Paid"} sub={`Order #${order.id} · ${order.tableLabel} · ${cedi(t.total)} ${order.payments.map((p) => (p.method === "cash" ? "cash" : p.method === "momo" ? `MoMo ${p.network}` : "GhQR")).join(" + ")}`} onClose={onClose} tone="forest"
      foot={<><button type="button" className="btn btn-ghost" onClick={() => api.print(`Receipt #${order.id}`)}><Printer size={16} /> Print receipt</button><button type="button" className="btn btn-sun grow" onClick={onClose}>Next order</button></>}>
      <Receipt order={order} t={t} change={change} />
    </Modal>
  );
}

function DiscountSheet({ current, subtotal, onClose }: { current: Discount | null; subtotal: number; onClose: () => void }) {
  const { api } = useStore();
  const [kind, setKind] = useState<"pct" | "amt">(current?.kind ?? "pct");
  const [value, setValue] = useState(current ? (current.kind === "pct" ? String(current.value) : num(current.value)) : "10");
  const [reason, setReason] = useState(current?.reason ?? "Regular guest");
  const v = kind === "pct" ? Math.min(100, Math.max(0, Number.parseFloat(value) || 0)) : Math.min(subtotal, parseCedi(value));
  const amount = kind === "pct" ? Math.round((subtotal * v) / 100) : v;
  return (
    <Modal title="Discount" sub={`Comes off the subtotal of ${cedi(subtotal)} before VAT · logged to the audit trail`} onClose={onClose}
      foot={<>{current && <button type="button" className="btn btn-ghost" onClick={() => { api.setDiscount(null); onClose(); }}>Remove</button>}<button type="button" className="btn btn-ink grow" disabled={!v || !reason.trim()} onClick={() => { api.setDiscount({ kind, value: v, reason: reason.trim() }); onClose(); }}>Apply −{cedi(amount)}</button></>}>
      <div className="seg self-start">
        <button type="button" className={cx("seg-btn", kind === "pct" && "is-active")} onClick={() => { setKind("pct"); setValue("10"); }}>Percent</button>
        <button type="button" className={cx("seg-btn", kind === "amt" && "is-active")} onClick={() => { setKind("amt"); setValue("20.00"); }}>Amount</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(kind === "pct" ? ["5", "10", "15", "20"] : ["10.00", "20.00", "50.00", "100.00"]).map((p) => <button key={p} type="button" className={cx("quick", value === p && "border-[var(--ink)] bg-[var(--sun-l)]")} onClick={() => setValue(p)}>{kind === "pct" ? `${p}%` : `GH₵ ${p}`}</button>)}
      </div>
      <Field label={kind === "pct" ? "Percent" : "Amount (GH₵)"}><input className="input lg" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" /></Field>
      <Field label="Reason (required)">
        <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
          {["Regular guest", "Staff meal", "Complaint recovery", "Manager's discretion", "Promotion"].map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

function NoteSheet({ line, onClose }: { line: Line; onClose: () => void }) {
  const { api } = useStore();
  const [note, setNote] = useState(line.note);
  const presets = ["no onions", "extra pepper", "well done", "no pepper", "sauce on the side", "allergy — nuts", "chilled", "takeaway pack"];
  return (
    <Modal title={`Note for ${line.name}`} sub={line.sent ? "This line has already been sent — the kitchen will see the note on the next ticket" : "Prints on the kitchen ticket under the line"} onClose={onClose}
      foot={<>{line.note && <button type="button" className="btn btn-ghost" onClick={() => { api.setNote(line.id, ""); onClose(); }}>Clear</button>}<button type="button" className="btn btn-ink grow" onClick={() => { api.setNote(line.id, note.trim()); onClose(); }}>Save note</button></>}>
      <div className="flex flex-wrap gap-2">{presets.map((p) => <button key={p} type="button" className={cx("pill", note === p && "is-active")} onClick={() => setNote(p)}>{p}</button>)}</div>
      <Field label="Or type"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="e.g. no shito" onKeyDown={(e) => { if (e.key === "Enter") { api.setNote(line.id, note.trim()); onClose(); } }} /></Field>
    </Modal>
  );
}

function GuestsSheet({ guests, onClose }: { guests: number; onClose: () => void }) {
  const { api } = useStore();
  const [g, setG] = useState(guests);
  return (
    <Modal title="Guests at the table" sub="Used for covers and the average spend per head" onClose={onClose} foot={<button type="button" className="btn btn-ink grow" onClick={() => { api.setGuests(g); onClose(); }}>Save</button>}>
      <div className="flex items-center justify-center py-4"><Stepper value={g} onChange={setG} min={1} max={30} /></div>
    </Modal>
  );
}

function MoveSheet({ onClose }: { onClose: () => void }) {
  const { state, api } = useStore();
  const free = state.tables.filter((t) => t.status === "free" && t.id !== state.tillTable && t.zone !== "Takeaway");
  return (
    <Modal title="Move to another table" sub="The open order, its kitchen tickets and the bill follow the guests" onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 pb-2">
        {free.map((t) => <button key={t.id} type="button" className="tcard !min-h-[84px]" onClick={() => { api.moveOrder(t.id); onClose(); }}><span className="tcard-code">{t.code}</span><span className="tcard-seats">{t.zone} · {t.seats} seats</span></button>)}
        {!free.length && <div className="empty col-span-3">No free tables right now</div>}
      </div>
    </Modal>
  );
}

export function VoidSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const { api } = useStore();
  const [reason, setReason] = useState("Guest walked out");
  return (
    <Modal title={`Void order #${order.id}`} sub={`${order.tableLabel} · ${order.lines.length} lines · the table is freed and nothing is charged`} onClose={onClose} tone="terra"
      foot={<><button type="button" className="btn btn-ghost" onClick={onClose}>Keep order</button><button type="button" className="btn btn-terra grow" onClick={() => { api.voidOrder(order.id, reason); onClose(); }}>Void order</button></>}>
      <Field label="Reason (goes to the audit trail)">
        <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
          {["Guest walked out", "Entered on wrong table", "Duplicate order", "Kitchen could not fulfil", "Training / test"].map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

/** Manager PIN gate used by refunds when a cashier is signed in. */
export function ManagerGate({ title, sub, onApproved, onClose }: { title: string; sub: ReactNode; onApproved: (name: string) => void; onClose: () => void }) {
  const { api } = useStore();
  const [err, setErr] = useState(0);
  return (
    <Modal title={title} sub={sub} onClose={onClose} tone="cobalt">
      <div className="mx-auto w-full max-w-[300px] pb-2">
        <div className="mb-4 text-center text-[13px] font-bold text-[var(--ink3)]">{err ? <span className="c-terra">Not a manager PIN</span> : "Manager or owner PIN"}</div>
        <PinPad key={err} onDone={(pin) => { const s = api.verifyPin(pin, ["manager", "owner"]); if (s) onApproved(s.name); else setErr((e) => e + 1); }} />
      </div>
    </Modal>
  );
}
