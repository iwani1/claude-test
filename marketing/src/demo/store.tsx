"use client";

/**
 * In-browser state for the demo shift. No backend: everything lives in a
 * reducer, persisted to sessionStorage so a refresh keeps the shift.
 * The shape follows the real POS: orders carry lines; sending fires a kitchen
 * ticket per batch of unsent lines; payments settle into one shift that is
 * closed with a counted-cash audit.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { CASHIER, FIRST_ORDER_NUMBER, MENU_BY_ID, OPENING_FLOAT_CENTS, TABLE_BY_ID, type OrderType } from "./data";
import { priceLines, type Line } from "./pricing";

export type KitchenStatus = "pending" | "preparing" | "ready" | "completed";
export type Screen = "till" | "kitchen" | "drawer";
export type PayMethod = "cash" | "momo";

export type Ticket = {
  id: string;
  orderId: string;
  number: number;
  tableId: string;
  lines: { itemId: string; qty: number; note: string }[];
  status: KitchenStatus;
  firedAt: number;
  startedAt?: number;
  readyAt?: number;
};

export type Payment = {
  method: PayMethod;
  amountCents: number;
  tenderedCents: number;
  changeCents: number;
  ref: string;
  network?: string;
  at: number;
  /** Taken while the terminal was offline and still waiting to sync. */
  queued: boolean;
};

export type Order = {
  id: string;
  number: number;
  tableId: string;
  type: OrderType;
  lines: Line[];
  openedAt: number;
  paidAt?: number;
  payment?: Payment;
};

export type Movement = { id: string; at: number; kind: "float" | "sale" | "payout"; label: string; cashCents: number; momoCents: number };

export type Shift = {
  openedAt: number;
  openedBy: string;
  floatCents: number;
  payouts: { id: string; at: number; amountCents: number; reason: string }[];
  closedAt?: number;
  countedCents?: number;
};

export type Toast = { id: string; text: string; tone: "ok" | "warn" | "info" };

export type State = {
  screen: Screen;
  online: boolean;
  tourOpen: boolean;
  selectedTableId: string | null;
  orders: Order[]; // open and paid, this shift
  tickets: Ticket[];
  shift: Shift;
  nextNumber: number;
  toasts: Toast[];
  /** Set once a queued sale has been synced — the tour checks it. */
  syncedAfterOffline: boolean;
  /** Order whose receipt is on screen after a payment. */
  receiptOrderId: string | null;
  /** Orders numbered from here on were made by the visitor, not the seed. */
  firstUserNumber: number;
};

export type Action =
  | { type: "screen"; screen: Screen }
  | { type: "tour"; open: boolean }
  | { type: "selectTable"; tableId: string | null }
  | { type: "addLine"; itemId: string }
  | { type: "setQty"; lineId: string; qty: number }
  | { type: "setNote"; lineId: string; note: string }
  | { type: "send" }
  | { type: "kitchen"; ticketId: string; status: KitchenStatus }
  | { type: "pay"; method: PayMethod; tenderedCents: number; network?: string }
  | { type: "online"; online: boolean }
  | { type: "payout"; amountCents: number; reason: string }
  | { type: "closeShift"; countedCents: number }
  | { type: "newShift" }
  | { type: "toast"; text: string; tone?: Toast["tone"] }
  | { type: "dismissToast"; id: string }
  | { type: "closeReceipt" }
  | { type: "reset" };

const uid = () => Math.random().toString(36).slice(2, 9);
const MIN = 60_000;

/** A shift that already has some life in it, so Kitchen and Drawer are never empty on first visit. */
export function seed(now = Date.now()): State {
  const shiftStart = now - 128 * MIN;
  let n = FIRST_ORDER_NUMBER;
  const mk = (tableId: string, lines: [string, number, string?][], openedAgo: number, paidAgo: number, method: PayMethod, tendered?: number): Order => {
    const type = TABLE_BY_ID[tableId].type;
    const ls: Line[] = lines.map(([itemId, qty, note]) => ({ id: uid(), itemId, qty, note: note ?? "", sent: true }));
    const total = priceLines(ls, type).totalCents;
    const tenderedCents = tendered ?? total;
    return {
      id: uid(),
      number: n++,
      tableId,
      type,
      lines: ls,
      openedAt: now - openedAgo * MIN,
      paidAt: now - paidAgo * MIN,
      payment: {
        method,
        amountCents: total,
        tenderedCents,
        changeCents: tenderedCents - total,
        ref: method === "momo" ? "MP" + String(482210 + n) : "CSH",
        network: method === "momo" ? "MTN" : undefined,
        at: now - paidAgo * MIN,
        queued: false,
      },
    };
  };
  const paid = [
    mk("t2", [["waakye", 2], ["sobolo", 2, "chilled"]], 110, 74, "cash", 15000),
    mk("bar", [["suya", 3], ["palmwine", 2]], 95, 88, "momo"),
    mk("t4", [["banku", 1, "medium pepper"], ["jollof", 1], ["sobolo", 1]], 70, 41, "momo"),
    mk("t1", [["kelewele", 2], ["puffpuff", 3]], 48, 36, "cash", 10000),
    mk("room12", [["friedrice", 1], ["chicken", 1, "extra pepper sauce"]], 44, 20, "momo"),
  ];
  // Two tables still open: T3 sent 7 min ago (cooking), T5 sent 2 min ago (new).
  const t3: Order = {
    id: uid(),
    number: n++,
    tableId: "t3",
    type: "dine_in",
    openedAt: now - 11 * MIN,
    lines: [
      { id: uid(), itemId: "fufu", qty: 2, note: "", sent: true },
      { id: uid(), itemId: "tilapia", qty: 1, note: "well done", sent: true },
      { id: uid(), itemId: "sobolo", qty: 2, note: "", sent: true },
    ],
  };
  const t5: Order = {
    id: uid(),
    number: n++,
    tableId: "t5",
    type: "dine_in",
    openedAt: now - 4 * MIN,
    lines: [
      { id: uid(), itemId: "kenkey", qty: 1, note: "", sent: true },
      { id: uid(), itemId: "redred", qty: 1, note: "no plantain", sent: true },
    ],
  };
  const tickets: Ticket[] = [
    { id: uid(), orderId: t3.id, number: t3.number, tableId: "t3", lines: t3.lines.filter((l) => MENU_BY_ID[l.itemId].kitchen), status: "preparing", firedAt: now - 7 * MIN, startedAt: now - 6 * MIN },
    { id: uid(), orderId: t5.id, number: t5.number, tableId: "t5", lines: t5.lines, status: "pending", firedAt: now - 2 * MIN },
    ...paid
      .filter((o) => o.lines.some((l) => MENU_BY_ID[l.itemId].kitchen))
      .map((o, i) => ({
        id: uid(),
        orderId: o.id,
        number: o.number,
        tableId: o.tableId,
        lines: o.lines.filter((l) => MENU_BY_ID[l.itemId].kitchen),
        status: "completed" as const,
        firedAt: o.openedAt + 2 * MIN,
        startedAt: o.openedAt + 3 * MIN,
        readyAt: o.openedAt + (9 + i * 2) * MIN,
      })),
  ];
  return {
    screen: "till",
    online: true,
    tourOpen: true,
    selectedTableId: null,
    orders: [...paid, t3, t5],
    tickets,
    shift: { openedAt: shiftStart, openedBy: CASHIER, floatCents: OPENING_FLOAT_CENTS, payouts: [{ id: uid(), at: now - 60 * MIN, amountCents: 8000, reason: "Gas refill (receipt attached)" }] },
    nextNumber: n,
    firstUserNumber: n,
    toasts: [],
    syncedAfterOffline: false,
    receiptOrderId: null,
  };
}

const openOrderFor = (s: State, tableId: string | null) => (tableId ? s.orders.find((o) => o.tableId === tableId && !o.paidAt) : undefined);

function withToast(s: State, text: string, tone: Toast["tone"] = "ok"): State {
  return { ...s, toasts: [...s.toasts.slice(-2), { id: uid(), text, tone }] };
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "screen":
      return { ...s, screen: a.screen };
    case "tour":
      return { ...s, tourOpen: a.open };
    case "selectTable":
      return { ...s, selectedTableId: a.tableId, screen: "till" };
    case "addLine": {
      if (!s.selectedTableId) return withToast(s, "Pick a table first", "warn");
      const now = Date.now();
      let order = openOrderFor(s, s.selectedTableId);
      let orders = s.orders;
      let nextNumber = s.nextNumber;
      if (!order) {
        order = { id: uid(), number: nextNumber++, tableId: s.selectedTableId, type: TABLE_BY_ID[s.selectedTableId].type, lines: [], openedAt: now };
        orders = [...orders, order];
      }
      const existing = order.lines.find((l) => l.itemId === a.itemId && !l.sent && !l.note);
      const lines = existing
        ? order.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
        : [...order.lines, { id: uid(), itemId: a.itemId, qty: 1, note: "", sent: false }];
      return { ...s, nextNumber, orders: orders.map((o) => (o.id === order!.id ? { ...o, lines } : o)) };
    }
    case "setQty": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order) return s;
      const lines = order.lines.map((l) => (l.id === a.lineId ? { ...l, qty: a.qty } : l)).filter((l) => l.qty > 0);
      const orders = lines.length ? s.orders.map((o) => (o.id === order.id ? { ...o, lines } : o)) : s.orders.filter((o) => o.id !== order.id);
      return { ...s, orders };
    }
    case "setNote": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order) return s;
      return { ...s, orders: s.orders.map((o) => (o.id === order.id ? { ...o, lines: o.lines.map((l) => (l.id === a.lineId ? { ...l, note: a.note } : l)) } : o)) };
    }
    case "send": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order) return s;
      const unsent = order.lines.filter((l) => !l.sent);
      if (!unsent.length) return withToast(s, "Nothing new to send", "info");
      const kitchenLines = unsent.filter((l) => MENU_BY_ID[l.itemId].kitchen);
      const tickets = kitchenLines.length
        ? [...s.tickets, { id: uid(), orderId: order.id, number: order.number, tableId: order.tableId, lines: kitchenLines.map(({ itemId, qty, note }) => ({ itemId, qty, note })), status: "pending" as const, firedAt: Date.now() }]
        : s.tickets;
      const next = { ...s, tickets, orders: s.orders.map((o) => (o.id === order.id ? { ...o, lines: o.lines.map((l) => ({ ...l, sent: true })) } : o)) };
      const label = TABLE_BY_ID[order.tableId].label;
      return withToast(
        next,
        kitchenLines.length ? `Ticket #${order.number} fired to the kitchen · ${label}` : `${label}: bar items only — nothing for the kitchen`,
        kitchenLines.length ? "ok" : "info",
      );
    }
    case "kitchen": {
      const now = Date.now();
      return {
        ...s,
        tickets: s.tickets.map((t) =>
          t.id === a.ticketId
            ? { ...t, status: a.status, startedAt: a.status === "preparing" ? now : t.startedAt, readyAt: a.status === "ready" ? now : t.readyAt }
            : t,
        ),
      };
    }
    case "pay": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order || !order.lines.length) return s;
      const now = Date.now();
      const { totalCents } = priceLines(order.lines, order.type);
      const tenderedCents = a.method === "cash" ? a.tenderedCents : totalCents;
      const payment: Payment = {
        method: a.method,
        amountCents: totalCents,
        tenderedCents,
        changeCents: Math.max(0, tenderedCents - totalCents),
        ref: a.method === "momo" ? "MP" + String(482210 + order.number) : "CSH",
        network: a.network,
        at: now,
        queued: !s.online,
      };
      const next: State = {
        ...s,
        selectedTableId: null,
        receiptOrderId: order.id,
        orders: s.orders.map((o) => (o.id === order.id ? { ...o, lines: o.lines.map((l) => ({ ...l, sent: true })), paidAt: now, payment } : o)),
      };
      const label = TABLE_BY_ID[order.tableId].label;
      return withToast(
        next,
        s.online ? `${label} paid · ${a.method === "cash" ? "Cash" : `MoMo ${a.network ?? ""}`.trim()} · #${order.number}` : `${label} paid offline · queued to sync`,
        s.online ? "ok" : "warn",
      );
    }
    case "online": {
      if (a.online === s.online) return s;
      if (!a.online) return withToast({ ...s, online: false }, "Network dropped — the till keeps selling, sales queue on this device", "warn");
      const queued = s.orders.filter((o) => o.payment?.queued).length;
      const orders = s.orders.map((o) => (o.payment?.queued ? { ...o, payment: { ...o.payment, queued: false } } : o));
      const next = { ...s, online: true, orders, syncedAfterOffline: s.syncedAfterOffline || queued > 0 };
      return withToast(next, queued ? `Back online — ${queued} queued sale${queued > 1 ? "s" : ""} synced` : "Back online");
    }
    case "payout":
      return withToast(
        { ...s, shift: { ...s.shift, payouts: [...s.shift.payouts, { id: uid(), at: Date.now(), amountCents: a.amountCents, reason: a.reason }] } },
        "Payout recorded — expected drawer total updated",
        "info",
      );
    case "closeShift":
      return withToast({ ...s, shift: { ...s.shift, closedAt: Date.now(), countedCents: a.countedCents }, selectedTableId: null }, "Shift closed and audited");
    case "newShift":
    case "reset":
      return { ...seed(), tourOpen: s.tourOpen, screen: a.type === "newShift" ? "drawer" : "till" };
    case "toast":
      return withToast(s, a.text, a.tone);
    case "dismissToast":
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
    case "closeReceipt":
      return { ...s, receiptOrderId: null };
    default:
      return s;
  }
}

/* ------------------------------------------------------------ derived */

export function shiftTotals(s: State) {
  const paid = s.orders.filter((o) => o.payment);
  const sum = (f: (o: Order) => number) => paid.reduce((n, o) => n + f(o), 0);
  const cash = sum((o) => (o.payment!.method === "cash" ? o.payment!.amountCents : 0));
  const momo = sum((o) => (o.payment!.method === "momo" ? o.payment!.amountCents : 0));
  const vat = sum((o) => priceLines(o.lines, o.type).taxCents);
  const roomCharges = sum((o) => priceLines(o.lines, o.type).roomChargeCents);
  const payouts = s.shift.payouts.reduce((n, p) => n + p.amountCents, 0);
  const expectedCents = s.shift.floatCents + cash - payouts;
  const served = s.tickets.filter((t) => t.readyAt);
  const avgPassMs = served.length ? served.reduce((n, t) => n + (t.readyAt! - t.firedAt), 0) / served.length : 0;
  const queued = paid.filter((o) => o.payment!.queued).length;
  return { paid, cash, momo, sales: cash + momo, vat, roomCharges, payouts, expectedCents, avgPassMs, queued, open: s.orders.filter((o) => !o.paidAt) };
}

export function movements(s: State): Movement[] {
  const list: Movement[] = [{ id: "float", at: s.shift.openedAt, kind: "float", label: `Opening float · ${s.shift.openedBy}`, cashCents: s.shift.floatCents, momoCents: 0 }];
  for (const o of s.orders) {
    if (!o.payment) continue;
    list.push({
      id: o.id,
      at: o.payment.at,
      kind: "sale",
      label: `#${o.number} · ${TABLE_BY_ID[o.tableId].label} · ${o.payment.method === "cash" ? "Cash" : `MoMo ${o.payment.network ?? ""}`.trim()}${o.payment.queued ? " · queued" : ""}`,
      cashCents: o.payment.method === "cash" ? o.payment.amountCents : 0,
      momoCents: o.payment.method === "momo" ? o.payment.amountCents : 0,
    });
  }
  for (const p of s.shift.payouts) list.push({ id: p.id, at: p.at, kind: "payout", label: `Payout · ${p.reason}`, cashCents: -p.amountCents, momoCents: 0 });
  return list.sort((a, b) => b.at - a.at);
}

/* ------------------------------------------------------------ context */

const KEY = "lushview-demo-v1";
type Ctx = { state: State; dispatch: React.Dispatch<Action>; now: number };
const DemoContext = createContext<Ctx | null>(null);

function restore(): State | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<State>;
    // Ignore saved shifts from an older shape of the demo.
    if (typeof parsed.firstUserNumber !== "number" || !Array.isArray(parsed.orders)) return null;
    return { ...(parsed as State), toasts: [] };
  } catch {
    return null;
  }
}

/** Client-only (the demo route loads it with ssr: false), so the saved shift can be read synchronously. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => restore() ?? seed());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ...state, toasts: [] }));
    } catch {
      /* storage full or blocked: the demo still runs in memory */
    }
  }, [state]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!state.toasts.length) return;
    const t = state.toasts[state.toasts.length - 1];
    const id = setTimeout(() => dispatch({ type: "dismissToast", id: t.id }), 3600);
    return () => clearTimeout(id);
  }, [state.toasts]);

  const value = useMemo(() => ({ state, dispatch, now }), [state, now]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo outside DemoProvider");
  return ctx;
}
