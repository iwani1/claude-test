"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import {
  HOME, can, isManager, seedState, uid,
  type Discount, type Dish, type DrawerEvent, type Ingredient, type Line, type Module, type Order, type POLine, type PayMethod,
  type Payment, type RecipeLine, type Role, type Settings, type Staff, type State, type Table, type Ticket, type Toast,
} from "./data";
import { cedi } from "./money";

export const KEY = "lushview-sunbird-v1";

/* ------------------------------------------------------------- totals */

export interface Totals { subtotal: number; discount: number; net: number; vat: number; service: number; total: number; paid: number; refunded: number; due: number; items: number }

export function totals(o: Pick<Order, "lines" | "discount" | "service" | "payments" | "refunds">, vatRate: number): Totals {
  const subtotal = o.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const discount = o.discount ? Math.min(subtotal, o.discount.kind === "pct" ? Math.round((subtotal * o.discount.value) / 100) : o.discount.value) : 0;
  const net = subtotal - discount;
  const vat = Math.round((net * vatRate) / 100);
  const service = o.lines.length ? o.service : 0;
  const total = net + vat + service;
  const paid = o.payments.reduce((s, p) => s + p.amount, 0);
  const refunded = o.refunds.reduce((s, r) => s + r.amount, 0);
  return { subtotal, discount, net, vat, service, total, paid, refunded, due: Math.max(0, total - paid), items: o.lines.reduce((s, l) => s + l.qty, 0) };
}

export function recipeCost(lines: RecipeLine[] | undefined, ingredients: Ingredient[]): number {
  if (!lines) return 0;
  return Math.round(lines.reduce((s, l) => s + (ingredients.find((i) => i.id === l.ingId)?.cost ?? 0) * l.qty, 0));
}

export function drawerExpected(session: { float: number; events: DrawerEvent[] }): number {
  return session.events.reduce((s, e) => s + e.amount, 0);
}

export const staffName = (s: State, id: string | null) => s.staff.find((x) => x.id === id)?.name ?? "—";
export const currentUser = (s: State): Staff | undefined => s.staff.find((x) => x.id === s.user);
export const openOrderFor = (s: State, tableId: string | null) => (tableId ? s.orders.find((o) => o.tableId === tableId && o.status === "open") : undefined);
export const openDrawer = (s: State) => s.drawer.find((d) => d.closedAt === null);

/* ------------------------------------------------------------ reducer */

type Update = (s: State) => State;
let toastSeq = 1;

function log(s: State, action: string, entity: string, details: string): State {
  return { ...s, audit: [{ id: uid("a"), at: Date.now(), user: currentUser(s)?.name ?? "System", action, entity, details }, ...s.audit] };
}
function toast(s: State, msg: string, tone: Toast["tone"] = "ok"): State {
  return { ...s, toast: { id: toastSeq++, msg, tone } };
}
function patchOrder(s: State, id: number, fn: (o: Order) => Order): State {
  return { ...s, orders: s.orders.map((o) => (o.id === id ? fn(o) : o)) };
}
function patchTable(s: State, id: string, fn: (t: Table) => Table): State {
  return { ...s, tables: s.tables.map((t) => (t.id === id ? fn(t) : t)) };
}
function drawerEvent(s: State, ev: Omit<DrawerEvent, "id" | "at" | "by">): State {
  const d = openDrawer(s);
  if (!d) return s;
  const e: DrawerEvent = { ...ev, id: uid("e"), at: Date.now(), by: currentUser(s)?.name ?? "System" };
  return { ...s, drawer: s.drawer.map((x) => (x.id === d.id ? { ...x, events: [...x.events, e] } : x)) };
}
function stationFor(s: State, dish: Dish) {
  return s.categories.find((c) => c.key === dish.cat)?.station ?? "kitchen";
}
/** Create a kitchen ticket for every unsent line of an order. */
function sendOrder(s: State, orderId: number): State {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return s;
  const unsent = o.lines.filter((l) => !l.sent);
  if (!unsent.length) return s;
  const ticket: Ticket = { id: uid("k"), orderId, tableLabel: o.tableLabel, lineIds: unsent.map((l) => l.id), at: Date.now(), status: "new", startedAt: null, readyAt: null, bumpedAt: null };
  let next = patchOrder(s, orderId, (x) => ({ ...x, lines: x.lines.map((l) => (l.sent ? l : { ...l, sent: true, status: "new" })) }));
  next = { ...next, tickets: [...next.tickets, ticket] };
  return log(next, "Sent to kitchen", `Order #${orderId}`, unsent.map((l) => `${l.qty} × ${l.name}`).join(", "));
}
function deductStock(s: State, o: Order): State {
  const used = new Map<string, number>();
  for (const l of o.lines) for (const r of s.recipes[l.dishId] ?? []) used.set(r.ingId, (used.get(r.ingId) ?? 0) + r.qty * l.qty);
  if (!used.size) return s;
  return { ...s, ingredients: s.ingredients.map((i) => (used.has(i.id) ? { ...i, onHand: Math.round((i.onHand - used.get(i.id)!) * 100) / 100, deductedToday: Math.round((i.deductedToday + used.get(i.id)!) * 100) / 100 } : i)) };
}

function load(): State {
  const fresh = seedState();
  if (typeof window === "undefined") return fresh;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as State;
      if (saved.v === fresh.v) return { ...saved, toast: null };
    }
  } catch {
    /* ignore */
  }
  return fresh;
}

/* ---------------------------------------------------------------- api */

export interface PayInput { method: PayMethod; amount: number; tendered?: number; network?: string; phone?: string }

export function useStoreValue() {
  const [state, apply] = useReducer((s: State, u: Update) => u(s), undefined, load);

  useEffect(() => {
    try {
      const { toast: _t, ...rest } = state;
      void _t;
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* quota or private mode — the demo still runs in memory */
    }
  }, [state]);

  useEffect(() => {
    if (!state.toast) return;
    const id = state.toast.id;
    const t = setTimeout(() => apply((s) => (s.toast?.id === id ? { ...s, toast: null } : s)), 2800);
    return () => clearTimeout(t);
  }, [state.toast]);

  const run = useCallback((u: Update) => apply(u), []);
  // Latest state for the few actions that must answer synchronously (PIN checks, charge result).
  const stateRef = useRef(state);
  stateRef.current = state;

  const api = useMemo(() => {
    const me = (s: State) => currentUser(s);
    return {
      /* ---- session & navigation */
      signIn(staffId: string, pin: string): boolean {
        const st = stateRef.current.staff.find((x) => x.id === staffId);
        if (!st || !st.active || st.pin !== pin) return false;
        run((s) => {
          const next: State = { ...s, user: staffId, module: HOME[st.role], staff: s.staff.map((x) => (x.id === staffId ? { ...x, lastSignIn: Date.now() } : x)) };
          return log(next, "Sign in", "Session", `${st.name} signed in on Till 1`);
        });
        return true;
      },
      signOut() {
        run((s) => ({ ...log(s, "Sign out", "Session", `${me(s)?.name} signed out`), user: null, tour: null }));
      },
      verifyPin(pin: string, roles: Role[]): Staff | null {
        return stateRef.current.staff.find((x) => x.active && x.pin === pin && roles.includes(x.role)) ?? null;
      },
      go(m: Module) {
        run((s) => (can(me(s)?.role, m) ? { ...s, module: m } : toast(s, "Your role can't open that module", "warn")));
      },
      setTour(step: number | null) {
        run((s) => ({ ...s, tour: step }));
      },
      notify(msg: string, tone: Toast["tone"] = "info") {
        run((s) => toast(s, msg, tone));
      },
      reset() {
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        window.location.reload();
      },

      /* ---- till */
      pickTable(tableId: string | null) {
        run((s) => ({ ...s, tillTable: tableId }));
      },
      seat(tableId: string, guests: number) {
        run((s) => {
          const t = s.tables.find((x) => x.id === tableId);
          if (!t) return s;
          if (openOrderFor(s, tableId)) return { ...s, tillTable: tableId, module: "till" };
          const id = s.nextOrder;
          const order: Order = { id, tableId, tableLabel: t.label, guests, lines: [], opened: Date.now(), closed: null, status: "open", discount: null, service: t.zone === "Rooms" ? s.settings.roomService : 0, payments: [], refunds: [], staffId: s.user ?? "", voidReason: "" };
          let next: State = { ...s, orders: [...s.orders, order], nextOrder: id + 1, tillTable: tableId, module: "till" };
          next = patchTable(next, tableId, (x) => ({ ...x, status: "open", reservation: null }));
          return log(next, "Order opened", `Order #${id}`, `${t.label} · ${guests} guest${guests === 1 ? "" : "s"}`);
        });
      },
      addLine(dishId: string) {
        run((s) => {
          const dish = s.dishes.find((d) => d.id === dishId);
          if (!dish || !s.tillTable) return s;
          if (!dish.available) return toast(s, `${dish.name} is 86'd — not available tonight`, "warn");
          let next = s;
          let o = openOrderFor(next, s.tillTable);
          if (!o) {
            const t = s.tables.find((x) => x.id === s.tillTable)!;
            const id = s.nextOrder;
            o = { id, tableId: t.id, tableLabel: t.label, guests: t.zone === "Takeaway" ? 1 : 2, lines: [], opened: Date.now(), closed: null, status: "open", discount: null, service: t.zone === "Rooms" ? s.settings.roomService : 0, payments: [], refunds: [], staffId: s.user ?? "", voidReason: "" };
            next = { ...next, orders: [...next.orders, o], nextOrder: id + 1 };
            next = patchTable(next, t.id, (x) => ({ ...x, status: "open", reservation: null }));
            next = log(next, "Order opened", `Order #${id}`, `${t.label}`);
          }
          const existing = o.lines.find((l) => l.dishId === dishId && !l.sent && !l.note);
          const line: Line = existing ? { ...existing, qty: existing.qty + 1 } : { id: uid("l"), dishId, name: dish.name, price: dish.price, qty: 1, note: "", sent: false, status: "new", station: stationFor(s, dish) };
          return patchOrder(next, o.id, (x) => ({ ...x, lines: existing ? x.lines.map((l) => (l.id === line.id ? line : l)) : [...x.lines, line] }));
        });
      },
      bump(lineId: string, delta: 1 | -1) {
        run((s) => {
          const o = openOrderFor(s, s.tillTable);
          if (!o) return s;
          const line = o.lines.find((l) => l.id === lineId);
          if (!line) return s;
          if (delta < 0 && line.sent && !isManager(me(s)?.role)) return toast(s, "Sent items need a manager to void — ask Efua or Kofi", "warn");
          const qty = line.qty + delta;
          let next = patchOrder(s, o.id, (x) => ({ ...x, lines: qty <= 0 ? x.lines.filter((l) => l.id !== lineId) : x.lines.map((l) => (l.id === lineId ? { ...l, qty } : l)) }));
          if (delta < 0 && line.sent) next = log(next, "Item voided", `Order #${o.id}`, `1 × ${line.name} removed after sending`);
          return next;
        });
      },
      setNote(lineId: string, note: string) {
        run((s) => {
          const o = openOrderFor(s, s.tillTable);
          return o ? patchOrder(s, o.id, (x) => ({ ...x, lines: x.lines.map((l) => (l.id === lineId ? { ...l, note } : l)) })) : s;
        });
      },
      setGuests(guests: number) {
        run((s) => {
          const o = openOrderFor(s, s.tillTable);
          return o ? patchOrder(s, o.id, (x) => ({ ...x, guests })) : s;
        });
      },
      setDiscount(d: Discount | null) {
        run((s) => {
          const o = openOrderFor(s, s.tillTable);
          if (!o) return s;
          const next = patchOrder(s, o.id, (x) => ({ ...x, discount: d }));
          return d ? log(next, "Discount", `Order #${o.id}`, `${d.kind === "pct" ? `${d.value}%` : cedi(d.value)} · ${d.reason}`) : log(next, "Discount removed", `Order #${o.id}`, "");
        });
      },
      send() {
        run((s) => {
          const o = openOrderFor(s, s.tillTable);
          if (!o) return s;
          const n = o.lines.filter((l) => !l.sent).length;
          return n ? toast(sendOrder(s, o.id), `${n} item${n === 1 ? "" : "s"} sent to the kitchen`) : s;
        });
      },
      moveOrder(toTableId: string) {
        run((s) => {
          const o = openOrderFor(s, s.tillTable);
          const to = s.tables.find((t) => t.id === toTableId);
          if (!o || !to || openOrderFor(s, toTableId)) return toast(s, "That table already has an open order", "warn");
          let next = patchOrder(s, o.id, (x) => ({ ...x, tableId: to.id, tableLabel: to.label }));
          next = { ...next, tickets: next.tickets.map((t) => (t.orderId === o.id ? { ...t, tableLabel: to.label } : t)) };
          next = patchTable(next, o.tableId, (t) => ({ ...t, status: "free" }));
          next = patchTable(next, to.id, (t) => ({ ...t, status: "open", reservation: null }));
          next = { ...next, tillTable: to.id };
          return toast(log(next, "Order moved", `Order #${o.id}`, `${o.tableLabel} → ${to.label}`), `Moved to ${to.label}`);
        });
      },
      charge(payments: PayInput[]): { orderId: number; change: number } | null {
        const cur = stateRef.current;
        const target = openOrderFor(cur, cur.tillTable);
        if (!target || !target.lines.length) return null;
        const result = { orderId: target.id, change: payments.reduce((c, p) => c + (p.method === "cash" ? Math.max(0, (p.tendered ?? p.amount) - p.amount) : 0), 0) };
        run((s) => {
          const o0 = openOrderFor(s, s.tillTable);
          if (!o0 || !o0.lines.length) return s;
          let next = sendOrder(s, o0.id);
          const o = next.orders.find((x) => x.id === o0.id)!;
          const t = totals(o, next.settings.vat);
          const now = Date.now();
          const pays: Payment[] = payments.map((p) => {
            const tendered = p.tendered ?? p.amount;
            const ch = p.method === "cash" ? Math.max(0, tendered - p.amount) : 0;
            return { id: uid("p"), method: p.method, amount: p.amount, tendered, change: ch, network: p.network ?? "", phone: p.phone ?? "", ref: p.method === "momo" ? `MP${String(o.id).slice(-3)}${String(now).slice(-5)}` : p.method === "ghqr" ? `QR${String(now).slice(-6)}` : "", at: now };
          });
          next = patchOrder(next, o.id, (x) => ({ ...x, payments: pays, status: "paid", closed: now, lines: x.lines.map((l) => ({ ...l, sent: true })) }));
          const table = next.tables.find((x) => x.id === o.tableId)!;
          next = patchTable(next, o.tableId, (x) => ({ ...x, status: table.zone === "Takeaway" ? "free" : "cleaning" }));
          for (const p of pays) if (p.method === "cash") next = drawerEvent(next, { kind: "sale", amount: p.amount, note: `#${o.id} · ${o.tableLabel}` });
          next = deductStock(next, o);
          next = { ...next, tillTable: null };
          const how = pays.map((p) => `${p.method === "cash" ? "Cash" : p.method === "momo" ? `MoMo ${p.network}` : "GhQR"} ${cedi(p.amount)}`).join(" + ");
          return log(next, "Sale", `Order #${o.id}`, `${o.tableLabel} · ${cedi(t.total)} · ${how}`);
        });
        return result;
      },

      /* ---- floor */
      reserve(tableId: string, name: string, time: string, guests: number) {
        run((s) => log(patchTable(s, tableId, (t) => ({ ...t, status: "reserved", reservation: { name, time, guests } })), "Reservation", s.tables.find((t) => t.id === tableId)?.label ?? "", `${name} · ${time} · ${guests} guests`));
      },
      clearTable(tableId: string) {
        run((s) => toast(patchTable(s, tableId, (t) => ({ ...t, status: "free", reservation: null })), "Table is free"));
      },

      /* ---- kitchen */
      ticket(id: string, to: "cooking" | "ready" | "bumped") {
        run((s) => {
          const tk = s.tickets.find((t) => t.id === id);
          if (!tk) return s;
          const now = Date.now();
          const lineStatus = to === "cooking" ? "cooking" : to === "ready" ? "ready" : "served";
          const tickets = s.tickets.map((t) => (t.id === id ? { ...t, status: to, startedAt: to === "cooking" ? now : t.startedAt, readyAt: to === "ready" ? now : t.readyAt, bumpedAt: to === "bumped" ? now : t.bumpedAt } : t));
          const next = patchOrder({ ...s, tickets }, tk.orderId, (o) => ({ ...o, lines: o.lines.map((l) => (tk.lineIds.includes(l.id) ? { ...l, status: lineStatus } : l)) }));
          return to === "bumped" ? log(next, "Ticket served", `Order #${tk.orderId}`, `${tk.tableLabel} · ${Math.round((now - tk.at) / 60000)} min from send`) : next;
        });
      },

      /* ---- orders */
      refund(orderId: number, amount: number, method: PayMethod, reason: string, items: string, approvedBy: string) {
        run((s) => {
          const o = s.orders.find((x) => x.id === orderId);
          if (!o) return s;
          const t = totals(o, s.settings.vat);
          const amt = Math.min(amount, t.paid - t.refunded);
          if (amt <= 0) return toast(s, "Nothing left to refund on this order", "warn");
          const r = { id: uid("r"), amount: amt, method, reason, by: me(s)?.name ?? "", approvedBy, at: Date.now(), items };
          let next = patchOrder(s, orderId, (x) => ({ ...x, refunds: [...x.refunds, r], status: t.refunded + amt >= t.paid ? "refunded" : x.status }));
          if (method === "cash") next = drawerEvent(next, { kind: "refund", amount: -amt, note: `Refund #${orderId} · ${reason}` });
          next = log(next, "Refund", `Order #${orderId}`, `${cedi(amt)} ${method === "cash" ? "cash" : method === "momo" ? "MoMo" : "GhQR"} · ${reason}${approvedBy ? ` · approved by ${approvedBy}` : ""}`);
          return toast(next, `Refunded ${cedi(amt)}`);
        });
      },
      voidOrder(orderId: number, reason: string) {
        run((s) => {
          const o = s.orders.find((x) => x.id === orderId);
          if (!o || o.status !== "open") return s;
          let next = patchOrder(s, orderId, (x) => ({ ...x, status: "void", closed: Date.now(), voidReason: reason }));
          next = patchTable(next, o.tableId, (t) => ({ ...t, status: "free" }));
          next = { ...next, tickets: next.tickets.map((t) => (t.orderId === orderId && t.status !== "bumped" ? { ...t, status: "bumped", bumpedAt: Date.now() } : t)), tillTable: next.tillTable === o.tableId ? null : next.tillTable };
          return toast(log(next, "Order voided", `Order #${orderId}`, `${o.tableLabel} · ${reason}`), `Order #${orderId} voided`);
        });
      },
      print(what: string) {
        run((s) => toast(log(s, "Printed", "Printer", what), `${what} → ${s.settings.printer.name} (${s.settings.printer.ip}:${s.settings.printer.port})`, "info"));
      },

      /* ---- drawer */
      cashMove(kind: "payout" | "payin", amount: number, note: string) {
        run((s) => {
          const signed = kind === "payout" ? -amount : amount;
          return toast(log(drawerEvent(s, { kind, amount: signed, note }), kind === "payout" ? "Payout" : "Pay in", "Drawer", `${cedi(amount)} · ${note}`), `${kind === "payout" ? "Paid out" : "Paid in"} ${cedi(amount)}`);
        });
      },
      closeDrawer(counted: number) {
        run((s) => {
          const d = openDrawer(s);
          if (!d) return s;
          const variance = counted - drawerExpected(d);
          const next: State = { ...s, drawer: s.drawer.map((x) => (x.id === d.id ? { ...x, closedAt: Date.now(), closedBy: me(s)?.name ?? "", counted, variance } : x)) };
          return log(next, "Drawer closed", "Drawer", `Counted ${cedi(counted)} · expected ${cedi(drawerExpected(d))} · variance ${cedi(variance)}`);
        });
      },
      openDrawer(float: number) {
        run((s) => {
          if (openDrawer(s)) return s;
          const by = me(s)?.name ?? "";
          const session = { id: uid("d"), openedAt: Date.now(), openedBy: by, closedAt: null, closedBy: "", float, events: [{ id: uid("e"), kind: "float" as const, amount: float, note: "Opening float", by, at: Date.now() }], counted: null, variance: null };
          return toast(log({ ...s, drawer: [...s.drawer, session] }, "Drawer opened", "Drawer", `Opening float ${cedi(float)}`), "Drawer open");
        });
      },

      /* ---- menu & stock */
      saveDish(d: Dish) {
        run((s) => {
          const prev = s.dishes.find((x) => x.id === d.id);
          const dishes = prev ? s.dishes.map((x) => (x.id === d.id ? d : x)) : [...s.dishes, d];
          let next: State = { ...s, dishes };
          if (!prev) next = log(next, "Dish added", "Dish", `${d.name} · ${cedi(d.price)}`);
          else if (prev.price !== d.price) next = log(next, "Price changed", "Dish", `${d.name} ${cedi(prev.price)} → ${cedi(d.price)}`);
          else next = log(next, "Dish updated", "Dish", d.name);
          return toast(next, prev ? "Dish saved" : `${d.name} added to the menu`);
        });
      },
      toggleDish(id: string) {
        run((s) => {
          const d = s.dishes.find((x) => x.id === id);
          if (!d) return s;
          const next: State = { ...s, dishes: s.dishes.map((x) => (x.id === id ? { ...x, available: !x.available } : x)) };
          return log(next, d.available ? "Dish 86'd" : "Dish restored", "Dish", d.name);
        });
      },
      saveRecipe(dishId: string, lines: RecipeLine[]) {
        run((s) => toast(log({ ...s, recipes: { ...s.recipes, [dishId]: lines } }, "Recipe updated", "Recipe", `${s.dishes.find((d) => d.id === dishId)?.name} · ${lines.length} ingredients`), "Recipe saved"));
      },
      adjustStock(ingId: string, delta: number, reason: string) {
        run((s) => {
          const i = s.ingredients.find((x) => x.id === ingId);
          if (!i) return s;
          const next: State = { ...s, ingredients: s.ingredients.map((x) => (x.id === ingId ? { ...x, onHand: Math.max(0, Math.round((x.onHand + delta) * 100) / 100) } : x)) };
          return toast(log(next, "Stock adjusted", "Ingredient", `${i.name} ${delta > 0 ? "+" : ""}${delta} ${i.unit} · ${reason}`), "Stock updated");
        });
      },

      /* ---- purchasing */
      createPO(supplierId: string, lines: POLine[]) {
        run((s) => {
          const num = 2040 + s.pos.length;
          const po = { id: `PO-${num}`, supplierId, lines, status: "draft" as const, createdAt: Date.now(), sentAt: null, receivedAt: null, invoice: null };
          return toast(log({ ...s, pos: [...s.pos, po] }, "PO created", "Purchasing", `${po.id} · ${s.suppliers.find((x) => x.id === supplierId)?.name} · ${lines.length} lines`), `${po.id} drafted`);
        });
      },
      sendPO(id: string) {
        run((s) => toast(log({ ...s, pos: s.pos.map((p) => (p.id === id ? { ...p, status: "sent", sentAt: Date.now() } : p)) }, "PO sent", "Purchasing", id), `${id} sent to supplier`));
      },
      receivePO(id: string, received: Record<string, number>) {
        run((s) => {
          const po = s.pos.find((p) => p.id === id);
          if (!po) return s;
          const ingredients = s.ingredients.map((i) => (received[i.id] ? { ...i, onHand: Math.round((i.onHand + received[i.id]) * 100) / 100 } : i));
          const pos = s.pos.map((p) => (p.id === id ? { ...p, status: "received" as const, receivedAt: Date.now(), lines: p.lines.map((l) => ({ ...l, received: received[l.ingId] ?? 0 })) } : p));
          const lines = po.lines.map((l) => `${s.ingredients.find((i) => i.id === l.ingId)?.name} ${received[l.ingId] ?? 0}/${l.qty}`).join(", ");
          return toast(log({ ...s, ingredients, pos }, "GRN", "Purchasing", `${id} received · ${lines}`), "Goods received — stock updated");
        });
      },
      invoicePO(id: string, no: string, total: number) {
        run((s) => toast(log({ ...s, pos: s.pos.map((p) => (p.id === id ? { ...p, status: "invoiced", invoice: { no, total, at: Date.now() } } : p)) }, "Supplier invoice", "Purchasing", `${id} · ${no} · ${cedi(total)}`), "Invoice recorded"));
      },

      /* ---- setup */
      saveStaff(st: Staff) {
        run((s) => {
          const prev = s.staff.find((x) => x.id === st.id);
          const staff = prev ? s.staff.map((x) => (x.id === st.id ? st : x)) : [...s.staff, st];
          return toast(log({ ...s, staff }, prev ? "Staff updated" : "Staff added", "Staff", `${st.name} · ${st.role}${prev && prev.pin !== st.pin ? " · PIN reset" : ""}${prev && prev.active !== st.active ? (st.active ? " · reactivated" : " · deactivated") : ""}`), prev ? "Saved" : `${st.name} added`);
        });
      },
      saveSettings(settings: Settings, what: string) {
        run((s) => toast(log({ ...s, settings }, "Settings changed", "Settings", what), "Settings saved"));
      },
    };
  }, [run]);

  return { state, api };
}

export type Api = ReturnType<typeof useStoreValue>["api"];
const Ctx = createContext<{ state: State; api: Api } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}
