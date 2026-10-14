"use client";

/**
 * The whole demo in one reducer: a simulated branch kept in sessionStorage.
 *
 * The shape follows the real POS: staff with a role matrix; orders carry
 * priced lines; sending fires a kitchen ticket and deducts recipe stock;
 * payments settle into one shift that is closed with a counted-cash audit;
 * purchasing receives goods into the same stock ledger; every action that
 * matters lands in the audit trail with the signed-in user's name.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import {
  FIRST_ORDER_NUMBER,
  HARDWARE,
  INGREDIENTS,
  MENU,
  OPENING_FLOAT_CENTS,
  RECIPES,
  ROLES,
  SETTINGS,
  STAFF,
  SUPPLIERS,
  TABLES,
  type Hardware,
  type Ingredient,
  type MenuItem,
  type OrderType,
  type Perm,
  type RecipeLine,
  type Settings,
  type Staff,
  type Supplier,
  type Table,
  type TableStatus,
  type Zone,
} from "./data";
import { priceOrder, toCents, type Discount, type Line, type Priced } from "./pricing";

export type KitchenStatus = "pending" | "preparing" | "ready" | "completed";
export type Screen = "today" | "till" | "floor" | "kitchen" | "orders" | "drawer" | "reports" | "audit" | "menu" | "recipes" | "stock" | "purchasing" | "staff" | "settings" | "hardware";
export type Theme = "evening" | "day";
export type PayMethod = "cash" | "momo" | "split";

export type Ticket = {
  id: string;
  orderId: string;
  number: number;
  tableId: string;
  lines: { itemId: string; name: string; qty: number; note: string }[];
  status: KitchenStatus;
  firedAt: number;
  startedAt?: number;
  readyAt?: number;
};

export type Payment = {
  method: PayMethod;
  amountCents: number;
  cashCents: number;
  momoCents: number;
  tenderedCents: number;
  changeCents: number;
  ref: string;
  network?: string;
  at: number;
  byId: string;
  /** Taken while the terminal was offline and still waiting to sync. */
  queued: boolean;
};

export type Refund = { amountCents: number; cashCents: number; momoCents: number; reason: string; byId: string; authorizedById: string; at: number };

export type Order = {
  id: string;
  number: number;
  tableId: string;
  type: OrderType;
  lines: Line[];
  openedAt: number;
  byId: string;
  customer?: string;
  discount?: Discount | null;
  tipCents: number;
  complimentary?: { reason: string; approvedBy: string } | null;
  paidAt?: number;
  payment?: Payment;
  refund?: Refund;
};

export type Shift = {
  openedAt: number;
  openedBy: string;
  floatCents: number;
  payouts: { id: string; at: number; amountCents: number; reason: string; byId: string }[];
  closedAt?: number;
  closedBy?: string;
  countedCents?: number;
};

export type MovementKind = "sale" | "waste" | "adjust" | "receipt" | "count";
export type StockMovement = { id: string; at: number; ingredientId: string; kind: MovementKind; delta: number; before: number; after: number; ref: string; reason?: string; byId: string };
export type StockCount = { id: string; at: number; byId: string; note: string; items: { ingredientId: string; system: number; counted: number }[] };

export type PurchaseOrder = {
  id: string;
  number: string;
  supplierId: string;
  at: number;
  byId: string;
  status: "ordered" | "received";
  items: { ingredientId: string; qty: number; unitCost: number; received?: number }[];
  expectedAt: number;
  invoice?: string;
  receivedAt?: number;
  receivedById?: string;
};

export type AuditEvent = { id: string; at: number; userId: string | null; userName: string; action: string; entity: "order" | "payment" | "shift" | "stock" | "menu" | "staff" | "settings" | "system"; details: string };

export type Toast = { id: string; text: string; tone: "ok" | "warn" | "info" };

export type Flags = { firstUser: string | null; refunded: boolean; settingsSaved: boolean; exported: boolean; poReceived: boolean; switchedRole: boolean; stockAdjusted: boolean; staffAdded: boolean; shiftClosed: boolean };
const NO_FLAGS: Flags = { firstUser: null, refunded: false, settingsSaved: false, exported: false, poReceived: false, switchedRole: false, stockAdjusted: false, staffAdded: false, shiftClosed: false };

export type State = {
  screen: Screen;
  theme: Theme;
  online: boolean;
  tourOpen: boolean;
  userId: string | null;
  staff: Staff[];
  menu: MenuItem[];
  tables: Table[];
  selectedTableId: string | null;
  orders: Order[]; // open and paid, this shift
  tickets: Ticket[];
  shift: Shift;
  nextNumber: number;
  ingredients: Ingredient[];
  recipes: Record<string, RecipeLine[]>;
  movements: StockMovement[];
  counts: StockCount[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  nextPo: number;
  settings: Settings;
  hardware: Hardware;
  audit: AuditEvent[];
  toasts: Toast[];
  flags: Flags;
  /** Set once a queued sale has been synced — the tour checks it. */
  syncedAfterOffline: boolean;
  /** Order whose receipt is on screen after a payment. */
  receiptOrderId: string | null;
  /** Orders numbered from here on were made by the visitor, not the seed. */
  firstUserNumber: number;
};

export type Action =
  | { type: "screen"; screen: Screen }
  | { type: "theme"; theme: Theme }
  | { type: "tour"; open: boolean }
  | { type: "signIn"; userId: string }
  | { type: "signOut" }
  | { type: "selectTable"; tableId: string | null }
  | { type: "tableStatus"; tableId: string; status: TableStatus; reservedFor?: string }
  | { type: "addTable"; name: string; seats: number; zone: Zone }
  | { type: "moveOrder"; orderId: string; tableId: string }
  | { type: "addLine"; itemId: string }
  | { type: "setQty"; lineId: string; qty: number }
  | { type: "setNote"; lineId: string; note: string }
  | { type: "setDiscount"; discount: Discount | null }
  | { type: "setTip"; tipCents: number }
  | { type: "setComp"; comp: { reason: string; approvedBy: string } | null }
  | { type: "setCustomer"; name: string }
  | { type: "send" }
  | { type: "kitchen"; ticketId: string; status: KitchenStatus }
  | { type: "pay"; method: PayMethod; tenderedCents?: number; cashCents?: number; network?: string }
  | { type: "refund"; orderId: string; amountCents: number; reason: string; authorizedById: string }
  | { type: "online"; online: boolean }
  | { type: "payout"; amountCents: number; reason: string }
  | { type: "closeShift"; countedCents: number }
  | { type: "newShift" }
  | { type: "menuUpdate"; id: string; patch: Partial<MenuItem> }
  | { type: "menuAdd"; item: MenuItem }
  | { type: "recipeSet"; menuItemId: string; lines: RecipeLine[] }
  | { type: "stockAdjust"; ingredientId: string; delta: number; kind: "waste" | "adjust" | "receipt"; reason: string }
  | { type: "stockCount"; items: { ingredientId: string; counted: number }[]; note: string }
  | { type: "ingredientAdd"; ingredient: Ingredient }
  | { type: "poCreate"; supplierId: string; items: { ingredientId: string; qty: number; unitCost: number }[]; expectedDays: number }
  | { type: "poReceive"; poId: string; received: { ingredientId: string; qty: number }[]; invoice: string }
  | { type: "supplierAdd"; supplier: Supplier }
  | { type: "staffAdd"; staff: Staff }
  | { type: "staffUpdate"; id: string; patch: Partial<Staff> }
  | { type: "settingsSave"; patch: Partial<Settings> }
  | { type: "hardwareSave"; patch: Partial<Hardware> }
  | { type: "exported"; what: string }
  | { type: "toast"; text: string; tone?: Toast["tone"] }
  | { type: "dismissToast"; id: string }
  | { type: "closeReceipt" }
  | { type: "reset" };

const uid = () => Math.random().toString(36).slice(2, 9);
const MIN = 60_000;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/* ------------------------------------------------------------ helpers */

export const staffById = (s: State, id: string | null | undefined) => (id ? s.staff.find((u) => u.id === id) : undefined);
export const currentUser = (s: State) => staffById(s, s.userId);
export const can = (s: State, perm: Perm) => {
  const u = currentUser(s);
  return Boolean(u && ROLES[u.role].can.includes(perm));
};
export const tableOf = (s: State, id: string) => s.tables.find((t) => t.id === id) ?? TABLES[0];
export const menuOf = (s: State, id: string) => s.menu.find((m) => m.id === id) ?? MENU[0];
export const ingredientOf = (s: State, id: string) => s.ingredients.find((i) => i.id === id);
export const billing = (s: State) => ({ taxRatePercent: s.settings.vatPercent, roomChargeCents: s.settings.roomChargeCents });
export const price = (s: State, o: Order): Priced => priceOrder(o, billing(s));
export const recipeCost = (s: State, menuItemId: string) => (s.recipes[menuItemId] ?? []).reduce((sum, r) => sum + (ingredientOf(s, r.ingredientId)?.cost ?? 0) * r.qty, 0);
export const lowStock = (s: State) => s.ingredients.filter((i) => i.stock <= i.min);
export const stockValueCents = (s: State) => s.ingredients.reduce((sum, i) => sum + toCents(i.cost * i.stock), 0);
export const openOrderFor = (s: State, tableId: string | null) => (tableId ? s.orders.find((o) => o.tableId === tableId && !o.paidAt) : undefined);
export const landing = (s: State): Screen => (can(s, "pos") ? (can(s, "reports") ? "today" : "till") : can(s, "stock") ? "stock" : "reports");

function withToast(s: State, text: string, tone: Toast["tone"] = "ok"): State {
  return { ...s, toasts: [...s.toasts.slice(-2), { id: uid(), text, tone }] };
}

function log(s: State, now: number, action: string, entity: AuditEvent["entity"], details: string, userId: string | null = s.userId): State {
  const user = staffById(s, userId);
  return { ...s, audit: [{ id: uid(), at: now, userId, userName: user?.name ?? "System", action, entity, details }, ...s.audit].slice(0, 400) };
}

function moveStock(s: State, now: number, ingredientId: string, delta: number, kind: MovementKind, ref: string, reason?: string): State {
  const ing = ingredientOf(s, ingredientId);
  if (!ing || delta === 0) return s;
  const before = ing.stock;
  const after = round3(Math.max(0, before + delta));
  return {
    ...s,
    ingredients: s.ingredients.map((i) => (i.id === ingredientId ? { ...i, stock: after } : i)),
    movements: [{ id: uid(), at: now, ingredientId, kind, delta: round3(after - before), before, after, ref, reason, byId: s.userId ?? "system" }, ...s.movements].slice(0, 400),
  };
}

/** Walk each line's recipe once, aggregate per ingredient, write one movement each — like inventory-deduction.ts. */
function deductFor(s: State, now: number, order: Order, lines: Line[]): State {
  const totals = new Map<string, number>();
  for (const l of lines) for (const r of s.recipes[l.itemId] ?? []) totals.set(r.ingredientId, (totals.get(r.ingredientId) ?? 0) + r.qty * l.qty);
  let next = s;
  for (const [ingredientId, qty] of totals) next = moveStock(next, now, ingredientId, -qty, "sale", `#${order.number}`);
  const ids = new Set(lines.map((l) => l.id));
  return { ...next, orders: next.orders.map((o) => (o.id === order.id ? { ...o, lines: o.lines.map((l) => (ids.has(l.id) ? { ...l, deducted: true } : l)) } : o)) };
}

function newLine(s: State, itemId: string): Line {
  const m = menuOf(s, itemId);
  return { id: uid(), itemId, name: m.name, unitCents: toCents(m.price), qty: 1, note: "", sent: false, deducted: false };
}

/* ------------------------------------------------------------ reducer */

export function reducer(s: State, a: Action): State {
  return step(s, a, Date.now());
}

function step(s: State, a: Action, now: number): State {
  switch (a.type) {
    case "screen":
      return { ...s, screen: a.screen };
    case "theme":
      return { ...s, theme: a.theme };
    case "tour":
      return { ...s, tourOpen: a.open };

    /* ---------------------------------------------------------- people */
    case "signIn": {
      const u = staffById(s, a.userId);
      if (!u || !u.active || !ROLES[u.role].terminal) return withToast(s, "That account cannot sign in to a terminal", "warn");
      const flags: Flags = { ...s.flags, firstUser: s.flags.firstUser ?? u.id, switchedRole: s.flags.switchedRole || (s.flags.firstUser !== null && s.flags.firstUser !== u.id) };
      const next: State = { ...s, userId: u.id, staff: s.staff.map((x) => (x.id === u.id ? { ...x, lastLogin: now } : x)), flags };
      return log({ ...next, screen: landing(next), selectedTableId: null }, now, "signed_in", "system", `${u.name} signed in as ${ROLES[u.role].short}`, u.id);
    }
    case "signOut":
      return log({ ...s, userId: null, selectedTableId: null }, now, "signed_out", "system", `${currentUser(s)?.name ?? "Someone"} signed out`);

    /* ----------------------------------------------------------- floor */
    case "selectTable": {
      const t = a.tableId ? tableOf(s, a.tableId) : null;
      const tables = t && t.status === "cleaning" ? s.tables.map((x) => (x.id === t.id ? { ...x, status: "free" as const } : x)) : s.tables;
      return { ...s, tables, selectedTableId: a.tableId, screen: "till" };
    }
    case "tableStatus": {
      if (openOrderFor(s, a.tableId)) return withToast(s, "Settle the bill before changing that table", "warn");
      const t = tableOf(s, a.tableId);
      const next = { ...s, tables: s.tables.map((x) => (x.id === a.tableId ? { ...x, status: a.status, reservedFor: a.status === "reserved" ? a.reservedFor : undefined } : x)) };
      return log(next, now, "table_status", "order", `${t.name} marked ${a.status}${a.reservedFor ? ` for ${a.reservedFor}` : ""}`);
    }
    case "addTable": {
      const n = s.tables.filter((t) => t.type === "dine_in").length + 1;
      const code = String(n).padStart(2, "0");
      const table: Table = { id: `t${uid()}`, label: `T${n}`, code, name: a.name || `Table ${code}`, seats: a.seats, type: "dine_in", zone: a.zone, status: "free" };
      return withToast(log({ ...s, tables: [...s.tables.filter((t) => t.type === "dine_in"), table, ...s.tables.filter((t) => t.type !== "dine_in")] }, now, "table_added", "settings", `${table.name} added · ${a.seats} seats · ${a.zone}`), `${table.name} added to the ${a.zone.toLowerCase()}`);
    }
    case "moveOrder": {
      const order = s.orders.find((o) => o.id === a.orderId && !o.paidAt);
      if (!order || openOrderFor(s, a.tableId)) return withToast(s, "That table already has a bill", "warn");
      const from = tableOf(s, order.tableId).name;
      const to = tableOf(s, a.tableId);
      const next: State = {
        ...s,
        orders: s.orders.map((o) => (o.id === order.id ? { ...o, tableId: a.tableId, type: to.type } : o)),
        tickets: s.tickets.map((t) => (t.orderId === order.id ? { ...t, tableId: a.tableId } : t)),
        selectedTableId: a.tableId,
      };
      return withToast(log(next, now, "order_moved", "order", `#${order.number} moved from ${from} to ${to.name}`), `#${order.number} moved to ${to.name}`);
    }

    /* ------------------------------------------------------------ till */
    case "addLine": {
      if (!s.selectedTableId) return withToast(s, "Pick a table first", "warn");
      const m = menuOf(s, a.itemId);
      if (!m.available) return withToast(s, `${m.short} is off the menu right now`, "warn");
      let order = openOrderFor(s, s.selectedTableId);
      let orders = s.orders;
      let nextNumber = s.nextNumber;
      let next = s;
      if (!order) {
        order = { id: uid(), number: nextNumber++, tableId: s.selectedTableId, type: tableOf(s, s.selectedTableId).type, lines: [], openedAt: now, byId: s.userId ?? "ama", tipCents: 0 };
        orders = [...orders, order];
        next = log(s, now, "order_opened", "order", `#${order.number} opened on ${tableOf(s, order.tableId).name}`);
      }
      const existing = order.lines.find((l) => l.itemId === a.itemId && !l.sent && !l.note);
      const lines = existing ? order.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l)) : [...order.lines, newLine(s, a.itemId)];
      return { ...next, nextNumber, orders: orders.map((o) => (o.id === order!.id ? { ...o, lines } : o)) };
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
    case "setDiscount": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order) return s;
      const next = { ...s, orders: s.orders.map((o) => (o.id === order.id ? { ...o, discount: a.discount, complimentary: a.discount ? null : o.complimentary } : o)) };
      return a.discount ? log(next, now, "discount_applied", "order", `#${order.number}: ${a.discount.kind === "percent" ? `${a.discount.value} %` : `GH₵ ${a.discount.value}`} off — ${a.discount.reason}`) : next;
    }
    case "setTip": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order) return s;
      return { ...s, orders: s.orders.map((o) => (o.id === order.id ? { ...o, tipCents: Math.max(0, a.tipCents) } : o)) };
    }
    case "setComp": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order) return s;
      const next = { ...s, orders: s.orders.map((o) => (o.id === order.id ? { ...o, complimentary: a.comp, discount: a.comp ? null : o.discount, tipCents: a.comp ? 0 : o.tipCents } : o)) };
      return a.comp ? log(next, now, "complimentary", "order", `#${order.number} marked complimentary — ${a.comp.reason} (approved by ${a.comp.approvedBy})`) : next;
    }
    case "setCustomer": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order) return s;
      return { ...s, orders: s.orders.map((o) => (o.id === order.id ? { ...o, customer: a.name } : o)) };
    }
    case "send": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order) return s;
      const unsent = order.lines.filter((l) => !l.sent);
      if (!unsent.length) return withToast(s, "Nothing new to send", "info");
      const kitchenLines = unsent.filter((l) => menuOf(s, l.itemId).kitchen);
      const tickets = kitchenLines.length
        ? [...s.tickets, { id: uid(), orderId: order.id, number: order.number, tableId: order.tableId, lines: kitchenLines.map(({ itemId, name, qty, note }) => ({ itemId, name, qty, note })), status: "pending" as const, firedAt: now }]
        : s.tickets;
      let next: State = { ...s, tickets, orders: s.orders.map((o) => (o.id === order.id ? { ...o, lines: o.lines.map((l) => ({ ...l, sent: true })) } : o)) };
      next = deductFor(next, now, order, unsent.filter((l) => !l.deducted));
      next = log(next, now, "order_sent", "order", `#${order.number}: ${unsent.reduce((n, l) => n + l.qty, 0)} items sent${kitchenLines.length ? ` · ticket fired` : ""}`);
      const label = tableOf(s, order.tableId).name;
      return withToast(next, kitchenLines.length ? `Ticket #${order.number} fired to the kitchen · ${label}` : `${label}: bar items only — nothing for the kitchen`, kitchenLines.length ? "ok" : "info");
    }
    case "kitchen":
      return {
        ...s,
        tickets: s.tickets.map((t) => (t.id === a.ticketId ? { ...t, status: a.status, startedAt: a.status === "preparing" ? now : t.startedAt, readyAt: a.status === "ready" ? now : t.readyAt } : t)),
      };
    case "pay": {
      const order = openOrderFor(s, s.selectedTableId);
      if (!order || !order.lines.length) return s;
      const { totalCents } = price(s, order);
      const cashCents = a.method === "cash" ? totalCents : a.method === "split" ? Math.min(totalCents, Math.max(0, a.cashCents ?? 0)) : 0;
      const momoCents = totalCents - cashCents;
      const tenderedCents = a.method === "cash" ? Math.max(totalCents, a.tenderedCents ?? totalCents) : totalCents;
      const payment: Payment = {
        method: a.method,
        amountCents: totalCents,
        cashCents,
        momoCents,
        tenderedCents,
        changeCents: Math.max(0, tenderedCents - totalCents),
        ref: momoCents > 0 ? "MP" + String(482210 + order.number) : "CSH",
        network: momoCents > 0 ? a.network : undefined,
        at: now,
        byId: s.userId ?? "ama",
        queued: !s.online,
      };
      let next: State = {
        ...s,
        selectedTableId: null,
        receiptOrderId: order.id,
        orders: s.orders.map((o) => (o.id === order.id ? { ...o, lines: o.lines.map((l) => ({ ...l, sent: true })), paidAt: now, payment } : o)),
        tables: s.tables.map((t) => (t.id === order.tableId && t.type === "dine_in" ? { ...t, status: "cleaning" as const } : t)),
      };
      next = deductFor(next, now, order, order.lines.filter((l) => !l.deducted));
      const how = a.method === "cash" ? "Cash" : a.method === "momo" ? `MoMo ${a.network ?? ""}`.trim() : `Split cash ${(cashCents / 100).toFixed(2)} + MoMo ${(momoCents / 100).toFixed(2)}`;
      next = log(next, now, order.complimentary ? "complimentary_closed" : "payment_taken", "payment", `#${order.number} · GH₵ ${(totalCents / 100).toFixed(2)} · ${how}${!s.online ? " · offline, queued" : ""}`);
      const label = tableOf(s, order.tableId).name;
      return withToast(next, s.online ? `${label} paid · ${how} · #${order.number}` : `${label} paid offline · queued to sync`, s.online ? "ok" : "warn");
    }
    case "refund": {
      const order = s.orders.find((o) => o.id === a.orderId);
      if (!order || !order.payment || order.refund) return withToast(s, "That order cannot be refunded", "warn");
      const amount = Math.min(order.payment.amountCents, Math.max(0, a.amountCents));
      if (!amount) return s;
      // Refund in the tender it was paid with: cash first, then MoMo, like refund-balance.ts.
      const cashCents = Math.min(amount, order.payment.cashCents);
      const refund: Refund = { amountCents: amount, cashCents, momoCents: amount - cashCents, reason: a.reason, byId: s.userId ?? "ama", authorizedById: a.authorizedById, at: now };
      const auth = staffById(s, a.authorizedById)?.name ?? "manager";
      const next = log({ ...s, orders: s.orders.map((o) => (o.id === order.id ? { ...o, refund } : o)), flags: { ...s.flags, refunded: true } }, now, "refund_issued", "payment", `#${order.number}: GH₵ ${(amount / 100).toFixed(2)} refunded — ${a.reason} (authorised by ${auth})`);
      return withToast(next, `GH₵ ${(amount / 100).toFixed(2)} refunded on #${order.number}${cashCents ? " · take it from the drawer" : ""}`);
    }
    case "online": {
      if (a.online === s.online) return s;
      if (!a.online) return withToast(log({ ...s, online: false }, now, "offline", "system", "Network lost — terminal switched to offline queue"), "Network dropped — the till keeps selling, sales queue on this device", "warn");
      const queued = s.orders.filter((o) => o.payment?.queued).length;
      const orders = s.orders.map((o) => (o.payment?.queued ? { ...o, payment: { ...o.payment, queued: false } } : o));
      const next = log({ ...s, online: true, orders, syncedAfterOffline: s.syncedAfterOffline || queued > 0 }, now, "online", "system", queued ? `Back online — ${queued} queued sale(s) synced` : "Back online");
      return withToast(next, queued ? `Back online — ${queued} queued sale${queued > 1 ? "s" : ""} synced` : "Back online");
    }

    /* ---------------------------------------------------------- drawer */
    case "payout":
      return withToast(
        log({ ...s, shift: { ...s.shift, payouts: [...s.shift.payouts, { id: uid(), at: now, amountCents: a.amountCents, reason: a.reason, byId: s.userId ?? "ama" }] } }, now, "cash_payout", "shift", `GH₵ ${(a.amountCents / 100).toFixed(2)} paid out — ${a.reason}`),
        "Payout recorded — expected drawer total updated",
        "info",
      );
    case "closeShift": {
      const t = shiftTotals(s);
      const diff = a.countedCents - t.expectedCents;
      const next = { ...s, shift: { ...s.shift, closedAt: now, closedBy: currentUser(s)?.name ?? s.shift.openedBy, countedCents: a.countedCents }, selectedTableId: null, flags: { ...s.flags, shiftClosed: true } };
      return withToast(log(next, now, "shift_closed", "shift", `Counted GH₵ ${(a.countedCents / 100).toFixed(2)} against GH₵ ${(t.expectedCents / 100).toFixed(2)} expected · ${diff === 0 ? "balanced" : diff > 0 ? `over ${(diff / 100).toFixed(2)}` : `short ${(-diff / 100).toFixed(2)}`}`), "Shift closed and audited");
    }
    case "newShift": {
      if (!s.shift.closedAt) return withToast(s, "Close the current shift first", "warn");
      const me = currentUser(s)?.name ?? s.shift.openedBy;
      const next: State = { ...s, shift: { openedAt: now, openedBy: me, floatCents: OPENING_FLOAT_CENTS, payouts: [] }, tickets: s.tickets.filter((t) => t.status !== "completed"), selectedTableId: null, screen: "drawer" };
      return withToast(log(next, now, "shift_opened", "shift", `Shift opened with a GH₵ ${(OPENING_FLOAT_CENTS / 100).toFixed(2)} float`), "New shift opened — yesterday's orders stay in the history");
    }
    case "reset": {
      const fresh = seed(now);
      return { ...fresh, theme: s.theme, tourOpen: s.tourOpen };
    }

    /* ------------------------------------------------------- menu & stock */
    case "menuUpdate": {
      const m = menuOf(s, a.id);
      const next = { ...s, menu: s.menu.map((x) => (x.id === a.id ? { ...x, ...a.patch, kitchen: (a.patch.station ?? x.station) !== "bar" } : x)) };
      const changed = (Object.keys(a.patch) as (keyof MenuItem)[]).filter((k) => a.patch[k] !== m[k]);
      const what = "available" in a.patch ? (a.patch.available ? "back on the menu" : "marked unavailable (86’d)") : changed.includes("price") ? `price GH₵ ${m.price} → GH₵ ${a.patch.price}` : changed.length ? `${changed.join(", ")} updated` : "saved without changes";
      return withToast(log(next, now, "menu_updated", "menu", `${m.name} ${what}`), `${m.short} ${what}`, "available" in a.patch && !a.patch.available ? "warn" : "ok");
    }
    case "menuAdd":
      return withToast(log({ ...s, menu: [...s.menu, a.item] }, now, "menu_added", "menu", `${a.item.name} added at GH₵ ${a.item.price}`), `${a.item.name} added to ${a.item.category}`);
    case "recipeSet":
      return withToast(log({ ...s, recipes: { ...s.recipes, [a.menuItemId]: a.lines.filter((l) => l.qty > 0) } }, now, "recipe_saved", "menu", `Recipe for ${menuOf(s, a.menuItemId).name} saved · ${a.lines.length} ingredients`), "Recipe saved — new cost applies to the next sale");
    case "stockAdjust": {
      const ing = ingredientOf(s, a.ingredientId);
      if (!ing) return s;
      const delta = a.kind === "waste" ? -Math.abs(a.delta) : a.delta;
      const next = moveStock(s, now, a.ingredientId, delta, a.kind, a.kind === "waste" ? "waste" : a.kind === "receipt" ? "delivery" : "adjustment", a.reason);
      return withToast(log({ ...next, flags: { ...s.flags, stockAdjusted: true } }, now, a.kind === "waste" ? "waste_recorded" : "stock_adjusted", "stock", `${ing.name}: ${delta > 0 ? "+" : ""}${round3(delta)} ${ing.unit} — ${a.reason}`), `${ing.name} ${delta > 0 ? "+" : ""}${round3(delta)} ${ing.unit}`, a.kind === "waste" ? "warn" : "ok");
    }
    case "stockCount": {
      let next = s;
      const items = a.items.map((it) => ({ ingredientId: it.ingredientId, system: ingredientOf(s, it.ingredientId)?.stock ?? 0, counted: it.counted }));
      for (const it of items) if (it.counted !== it.system) next = moveStock(next, now, it.ingredientId, it.counted - it.system, "count", "cycle count", a.note || "Physical count");
      const variance = items.filter((it) => it.counted !== it.system).length;
      next = { ...next, counts: [{ id: uid(), at: now, byId: s.userId ?? "adwoa", note: a.note, items }, ...s.counts], flags: { ...s.flags, stockAdjusted: true } };
      return withToast(log(next, now, "stock_counted", "stock", `Cycle count · ${items.length} lines · ${variance} variance${variance === 1 ? "" : "s"}`), variance ? `Count saved — ${variance} line${variance > 1 ? "s" : ""} corrected` : "Count saved — everything matched");
    }
    case "ingredientAdd":
      return withToast(log({ ...s, ingredients: [...s.ingredients, a.ingredient] }, now, "ingredient_added", "stock", `${a.ingredient.name} added · ${a.ingredient.stock} ${a.ingredient.unit}`), `${a.ingredient.name} added`);
    case "poCreate": {
      const number = `PO-${String(s.nextPo).padStart(4, "0")}`;
      const po: PurchaseOrder = { id: uid(), number, supplierId: a.supplierId, at: now, byId: s.userId ?? "adwoa", status: "ordered", items: a.items.filter((i) => i.qty > 0), expectedAt: now + a.expectedDays * 24 * 60 * MIN };
      if (!po.items.length) return withToast(s, "Add at least one line", "warn");
      const total = po.items.reduce((n, i) => n + i.qty * i.unitCost, 0);
      return withToast(log({ ...s, purchaseOrders: [po, ...s.purchaseOrders], nextPo: s.nextPo + 1 }, now, "po_created", "stock", `${number} to ${s.suppliers.find((x) => x.id === a.supplierId)?.name} · GH₵ ${total.toFixed(2)}`), `${number} sent to the supplier`);
    }
    case "poReceive": {
      const po = s.purchaseOrders.find((p) => p.id === a.poId);
      if (!po || po.status === "received") return s;
      let next = s;
      for (const r of a.received) if (r.qty > 0) next = moveStock(next, now, r.ingredientId, r.qty, "receipt", po.number, a.invoice ? `Invoice ${a.invoice}` : undefined);
      const items = po.items.map((i) => ({ ...i, received: a.received.find((r) => r.ingredientId === i.ingredientId)?.qty ?? 0 }));
      next = { ...next, purchaseOrders: next.purchaseOrders.map((p) => (p.id === po.id ? { ...p, status: "received", items, invoice: a.invoice, receivedAt: now, receivedById: s.userId ?? "adwoa" } : p)), flags: { ...s.flags, poReceived: true } };
      const short = items.filter((i) => (i.received ?? 0) < i.qty).length;
      return withToast(log(next, now, "goods_received", "stock", `GRN for ${po.number}${a.invoice ? ` · invoice ${a.invoice}` : ""} · ${items.length} lines${short ? ` · ${short} short` : ""}`), `${po.number} received into stock${short ? ` — ${short} line${short > 1 ? "s" : ""} short` : ""}`, short ? "warn" : "ok");
    }
    case "supplierAdd":
      return withToast(log({ ...s, suppliers: [...s.suppliers, a.supplier] }, now, "supplier_added", "stock", `${a.supplier.name} added · ${a.supplier.terms}`), `${a.supplier.name} added`);

    /* ------------------------------------------------------ team & system */
    case "staffAdd":
      return withToast(log({ ...s, staff: [...s.staff, a.staff], flags: { ...s.flags, staffAdded: true } }, now, "staff_added", "staff", `${a.staff.name} added as ${ROLES[a.staff.role].label}`), `${a.staff.name} can sign in with PIN ${a.staff.pin}`);
    case "staffUpdate": {
      const u = staffById(s, a.id);
      if (!u) return s;
      const what = "role" in a.patch ? `role → ${ROLES[a.patch.role!].label}` : "pin" in a.patch ? "PIN changed" : "active" in a.patch ? (a.patch.active ? "re-activated" : "deactivated") : "updated";
      const next = { ...s, staff: s.staff.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) };
      return withToast(log(next, now, "staff_updated", "staff", `${u.name}: ${what}`), `${u.name}: ${what}`);
    }
    case "settingsSave": {
      const keys = Object.keys(a.patch) as (keyof Settings)[];
      const changed = keys.filter((k) => a.patch[k] !== s.settings[k]);
      const next = { ...s, settings: { ...s.settings, ...a.patch }, flags: { ...s.flags, settingsSaved: true } };
      return withToast(log(next, now, "settings_saved", "settings", changed.length ? `Changed ${changed.join(", ")}` : "Settings confirmed without changes"), "Settings saved — new bills use them immediately");
    }
    case "hardwareSave":
      return withToast(log({ ...s, hardware: { ...s.hardware, ...a.patch, tenders: { ...s.hardware.tenders, ...(a.patch.tenders ?? {}) } } }, now, "hardware_saved", "settings", `Hardware & tenders updated`), "Hardware settings saved");
    case "exported":
      return withToast(log({ ...s, flags: { ...s.flags, exported: true } }, now, "report_exported", "system", a.what), `${a.what} downloaded`);

    /* ------------------------------------------------------------ misc */
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

/** Everything the drawer and reports count is windowed to the current shift; older orders stay in the history. */
export function shiftTotals(s: State) {
  const from = s.shift.openedAt;
  const paid = s.orders.filter((o) => o.payment && o.payment.at >= from);
  const sum = (f: (o: Order) => number) => paid.reduce((n, o) => n + f(o), 0);
  const cash = sum((o) => o.payment!.cashCents);
  const momo = sum((o) => o.payment!.momoCents);
  const refunded = s.orders.filter((o) => o.refund && o.refund.at >= from);
  const refundsCash = refunded.reduce((n, o) => n + o.refund!.cashCents, 0);
  const refundsMomo = refunded.reduce((n, o) => n + o.refund!.momoCents, 0);
  const vat = sum((o) => price(s, o).taxCents);
  const tips = sum((o) => price(s, o).tipCents);
  const discounts = sum((o) => price(s, o).discountCents + price(s, o).compValueCents);
  const roomCharges = sum((o) => price(s, o).roomChargeCents);
  const payouts = s.shift.payouts.reduce((n, p) => n + p.amountCents, 0);
  const expectedCents = s.shift.floatCents + cash - payouts - refundsCash;
  const served = s.tickets.filter((t) => t.readyAt);
  const avgPassMs = served.length ? served.reduce((n, t) => n + (t.readyAt! - t.firedAt) / served.length, 0) : 0;
  const queued = paid.filter((o) => o.payment!.queued).length;
  const sales = cash + momo;
  return { paid, cash, momo, sales, net: sales - refundsCash - refundsMomo, refunds: refundsCash + refundsMomo, refundsCash, vat, tips, discounts, roomCharges, payouts, expectedCents, avgPassMs, queued, open: s.orders.filter((o) => !o.paidAt), avgTicket: paid.length ? Math.round(sales / paid.length) : 0 };
}

export type DrawerLine = { id: string; at: number; kind: "float" | "sale" | "payout" | "refund"; label: string; cashCents: number; momoCents: number };

export function drawerLines(s: State): DrawerLine[] {
  const list: DrawerLine[] = [{ id: "float", at: s.shift.openedAt, kind: "float", label: `Opening float · ${s.shift.openedBy}`, cashCents: s.shift.floatCents, momoCents: 0 }];
  for (const o of s.orders) {
    if (!o.payment) continue;
    const how = o.payment.method === "cash" ? "Cash" : o.payment.method === "momo" ? `MoMo ${o.payment.network ?? ""}`.trim() : "Split cash + MoMo";
    if (o.payment.at >= s.shift.openedAt) list.push({ id: o.id, at: o.payment.at, kind: "sale", label: `#${o.number} · ${tableOf(s, o.tableId).label} · ${how}${o.payment.queued ? " · queued" : ""}${o.complimentary ? " · complimentary" : ""}`, cashCents: o.payment.cashCents, momoCents: o.payment.momoCents });
    if (o.refund && o.refund.at >= s.shift.openedAt) list.push({ id: `${o.id}-r`, at: o.refund.at, kind: "refund", label: `Refund #${o.number} · ${o.refund.reason}`, cashCents: -o.refund.cashCents, momoCents: -o.refund.momoCents });
  }
  for (const p of s.shift.payouts) list.push({ id: p.id, at: p.at, kind: "payout", label: `Payout · ${p.reason}`, cashCents: -p.amountCents, momoCents: 0 });
  return list.sort((a, b) => b.at - a.at);
}

/* --------------------------------------------------------------- seed */

/** A branch that already has a day's life in it, so no screen is ever empty on first visit. */
export function seed(now = Date.now()): State {
  const shiftStart = now - 200 * MIN;
  let s: State = {
    screen: "till",
    theme: "evening",
    online: true,
    tourOpen: true,
    userId: null,
    staff: STAFF.map((u) => ({ ...u })),
    menu: MENU.map((m) => ({ ...m })),
    tables: TABLES.map((t) => ({ ...t })),
    selectedTableId: null,
    orders: [],
    tickets: [],
    shift: { openedAt: shiftStart, openedBy: "Ama Owusu", floatCents: OPENING_FLOAT_CENTS, payouts: [] },
    nextNumber: FIRST_ORDER_NUMBER,
    ingredients: INGREDIENTS.map((i) => ({ ...i })),
    recipes: Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, v.map((l) => ({ ...l }))])),
    movements: [],
    counts: [],
    suppliers: SUPPLIERS.map((x) => ({ ...x })),
    purchaseOrders: [],
    nextPo: 416,
    settings: { ...SETTINGS },
    hardware: { ...HARDWARE, tenders: { ...HARDWARE.tenders } },
    audit: [],
    toasts: [],
    flags: { ...NO_FLAGS },
    syncedAfterOffline: false,
    receiptOrderId: null,
    firstUserNumber: FIRST_ORDER_NUMBER,
  };
  const at = (minsAgo: number) => now - minsAgo * MIN;
  const as = (userId: string) => {
    s = { ...s, userId };
  };
  const run = (a: Action, minsAgo: number) => {
    s = step(s, a, at(minsAgo));
  };

  // Yesterday evening: Adwoa raised two purchase orders; Makola's arrived this morning.
  as("adwoa");
  run({ type: "poCreate", supplierId: "makola", items: [{ ingredientId: "rice", qty: 25, unitCost: 14 }, { ingredientId: "vegoil", qty: 10, unitCost: 28 }], expectedDays: 1 }, 26 * 60);
  run({ type: "poCreate", supplierId: "darko", items: [{ ingredientId: "chicken", qty: 20, unitCost: 48 }, { ingredientId: "beef", qty: 10, unitCost: 65 }], expectedDays: 1 }, 25 * 60);
  const makola = s.purchaseOrders.find((p) => p.supplierId === "makola")!;
  run({ type: "poReceive", poId: makola.id, received: [{ ingredientId: "rice", qty: 25 }, { ingredientId: "vegoil", qty: 10 }], invoice: "MK-20931" }, 9 * 60 + 40);
  run({ type: "stockAdjust", ingredientId: "tomato", delta: 1.5, kind: "waste", reason: "Bruised on delivery, rejected" }, 9 * 60 + 20);

  // The shift: Ama opened the drawer, then service.
  as("ama");
  s = log(s, shiftStart, "shift_opened", "shift", "Shift opened with a GH₵ 1,200.00 float", "ama");
  s = log(s, shiftStart, "signed_in", "system", "Ama Owusu signed in as Cashier", "ama");

  type Sale = { table: string; lines: [string, number, string?][]; opened: number; paid: number; method: PayMethod; tendered?: number; cash?: number; network?: string; discount?: Discount; comp?: { reason: string; approvedBy: string }; tip?: number; customer?: string; by?: string };
  const sales: Sale[] = [
    { table: "t2", lines: [["waakye", 2], ["sobolo", 2, "chilled"]], opened: 190, paid: 160, method: "cash", tendered: 15000 },
    { table: "bar", lines: [["suya", 3], ["palmwine", 2]], opened: 180, paid: 170, method: "momo", network: "MTN" },
    { table: "t4", lines: [["banku", 1, "medium pepper"], ["jollof", 1], ["sobolo", 1]], opened: 150, paid: 120, method: "momo", network: "Telecel" },
    { table: "t1", lines: [["kelewele", 2], ["puffpuff", 3]], opened: 140, paid: 128, method: "cash", tendered: 10000 },
    { table: "room12", lines: [["friedrice", 1], ["chicken", 1, "extra pepper sauce"]], opened: 130, paid: 105, method: "momo", network: "MTN", customer: "Mr Ofori" },
    { table: "t6", lines: [["tilapia", 2], ["redred", 1], ["palmwine", 2]], opened: 120, paid: 95, method: "split", cash: 20000, network: "MTN", tip: 1000 },
    { table: "t8", lines: [["jollof", 4], ["chicken", 2], ["sobolo", 6]], opened: 115, paid: 80, method: "momo", network: "AT", discount: { kind: "percent", value: 10, reason: "Hotel guests — B&B rate" }, by: "yaw" },
    { table: "takeaway", lines: [["meatpie", 4], ["puffpuff", 6]], opened: 100, paid: 97, method: "cash" },
    { table: "room12", lines: [["waakye", 1], ["sobolo", 1]], opened: 95, paid: 90, method: "cash", comp: { reason: "Complimentary breakfast · room 12", approvedBy: "Efua Boateng" } },
    { table: "t3", lines: [["fufu", 1], ["omotuo", 1], ["sobolo", 2]], opened: 90, paid: 62, method: "cash", tendered: 20000 },
    { table: "bar", lines: [["palmwine", 3]], opened: 75, paid: 70, method: "momo", network: "MTN", by: "yaw" },
    { table: "t7", lines: [["kenkey", 2], ["kelewele", 1]], opened: 70, paid: 50, method: "cash", tendered: 12000 },
  ];
  for (const sale of sales) {
    as(sale.by ?? "ama");
    run({ type: "selectTable", tableId: sale.table }, sale.opened);
    for (const [itemId, qty, note] of sale.lines) {
      for (let i = 0; i < qty; i++) run({ type: "addLine", itemId }, sale.opened);
      if (note) {
        const order = openOrderFor(s, sale.table)!;
        const line = order.lines.find((l) => l.itemId === itemId)!;
        run({ type: "setNote", lineId: line.id, note }, sale.opened);
      }
    }
    if (sale.customer) run({ type: "setCustomer", name: sale.customer }, sale.opened);
    run({ type: "send" }, sale.opened - 1);
    if (sale.discount) run({ type: "setDiscount", discount: sale.discount }, sale.paid + 1);
    if (sale.comp) run({ type: "setComp", comp: sale.comp }, sale.paid + 1);
    if (sale.tip) run({ type: "setTip", tipCents: sale.tip }, sale.paid + 1);
    run({ type: "pay", method: sale.method, tenderedCents: sale.tendered, cashCents: sale.cash, network: sale.network }, sale.paid);
    run({ type: "closeReceipt" }, sale.paid);
    // Kitchen worked the tickets: ready a few minutes after firing.
    const order = s.orders.find((o) => o.tableId === sale.table && o.paidAt === at(sale.paid))!;
    s = {
      ...s,
      tickets: s.tickets.map((t) => (t.orderId === order.id ? { ...t, status: "completed", startedAt: t.firedAt + 1 * MIN, readyAt: t.firedAt + (7 + (order.number % 5)) * MIN } : t)),
      tables: s.tables.map((t) => (t.id === sale.table && t.status === "cleaning" ? { ...t, status: "free" } : t)),
    };
  }
  // Two cold kelewele on T7 — Efua authorised a refund.
  const t7 = s.orders.find((o) => o.tableId === "t7" && o.payment)!;
  as("ama");
  run({ type: "refund", orderId: t7.id, amountCents: 2000, reason: "Kelewele served cold", authorizedById: "efua" }, 45);
  run({ type: "payout", amountCents: 8000, reason: "Gas refill (receipt attached)" }, 60);
  s = log(s, at(58), "signed_in", "system", "Efua Boateng signed in as Manager", "efua");

  // Two tables still open: T3 sent 7 min ago (cooking), T5 sent 2 min ago (new).
  as("ama");
  run({ type: "selectTable", tableId: "t3" }, 11);
  run({ type: "addLine", itemId: "fufu" }, 11);
  run({ type: "addLine", itemId: "fufu" }, 11);
  run({ type: "addLine", itemId: "tilapia" }, 11);
  run({ type: "setNote", lineId: openOrderFor(s, "t3")!.lines[1].id, note: "well done" }, 11);
  run({ type: "addLine", itemId: "sobolo" }, 11);
  run({ type: "addLine", itemId: "sobolo" }, 11);
  run({ type: "send" }, 7);
  s = { ...s, tickets: s.tickets.map((t) => (t.status === "pending" && t.tableId === "t3" ? { ...t, status: "preparing", startedAt: at(6) } : t)) };
  run({ type: "selectTable", tableId: "t5" }, 4);
  run({ type: "addLine", itemId: "kenkey" }, 4);
  run({ type: "addLine", itemId: "redred" }, 4);
  run({ type: "setNote", lineId: openOrderFor(s, "t5")!.lines[1].id, note: "no plantain" }, 4);
  run({ type: "send" }, 2);

  // T2 is being cleared, T6 is booked for later; nothing is selected and nobody is signed in.
  s = {
    ...s,
    tables: s.tables.map((t) => (t.id === "t2" ? { ...t, status: "cleaning" } : t)),
    userId: null,
    selectedTableId: null,
    screen: "till",
    toasts: [],
    flags: { ...NO_FLAGS },
    syncedAfterOffline: false,
    receiptOrderId: null,
    firstUserNumber: s.nextNumber,
  };
  return s;
}

/* ------------------------------------------------------------ context */

export const KEY = "lushview-demo-v3";
type Ctx = { state: State; dispatch: React.Dispatch<Action>; now: number };
const DemoContext = createContext<Ctx | null>(null);

function restore(): State | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<State>;
    // Ignore saved shifts from an older shape of the demo.
    if (typeof parsed.firstUserNumber !== "number" || !Array.isArray(parsed.orders) || !Array.isArray(parsed.ingredients) || !parsed.settings) return null;
    return { ...(parsed as State), flags: { ...NO_FLAGS, ...(parsed.flags ?? {}) }, theme: parsed.theme === "day" ? "day" : "evening", toasts: [] };
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
