/**
 * Types and seed data for the Lush View demo. One restaurant (Osu, Accra),
 * one busy evening, enough history that every module has something to show.
 */
import { at } from "./money";

/* ------------------------------------------------------------- vocabulary */

export type Role = "owner" | "manager" | "cashier" | "inventory" | "accountant" | "cook";
export type Module =
  | "today" | "till" | "floor" | "kitchen" | "orders" | "drawer"
  | "menu" | "recipes" | "ingredients" | "purchasing"
  | "reports" | "audit"
  | "staff" | "settings" | "hardware";
export type Group = "service" | "stock" | "money" | "setup";
export type Tone = "sun" | "forest" | "terra" | "cobalt" | "ink";
export type Station = "kitchen" | "grill" | "bar";
export type CatKey = "kitchen" | "grill" | "snacks" | "drinks";

export interface ModuleMeta { id: Module; label: string; group: Group; desc: string }

export const MODULES: ModuleMeta[] = [
  { id: "today", label: "Today", group: "service", desc: "The shift at a glance" },
  { id: "till", label: "Till", group: "service", desc: "Take orders and charge" },
  { id: "floor", label: "Floor", group: "service", desc: "Tables, rooms and takeaway" },
  { id: "kitchen", label: "Kitchen", group: "service", desc: "Pass display with timers" },
  { id: "orders", label: "Orders", group: "service", desc: "Every order, refunds and receipts" },
  { id: "drawer", label: "Drawer", group: "service", desc: "Float, payouts and the count" },
  { id: "menu", label: "Menu", group: "stock", desc: "Dishes, prices and availability" },
  { id: "recipes", label: "Recipes & costing", group: "stock", desc: "Plated cost and margin per dish" },
  { id: "ingredients", label: "Ingredients", group: "stock", desc: "Stock on hand, par levels, waste" },
  { id: "purchasing", label: "Purchasing", group: "stock", desc: "Suppliers, purchase orders, GRNs" },
  { id: "reports", label: "Reports", group: "money", desc: "Sales, tenders, value forgone, CSV" },
  { id: "audit", label: "Audit trail", group: "money", desc: "Who did what, when" },
  { id: "staff", label: "Staff & roles", group: "setup", desc: "People, PINs and permissions" },
  { id: "settings", label: "Settings", group: "setup", desc: "Business, VAT, receipts" },
  { id: "hardware", label: "Hardware & tenders", group: "setup", desc: "Printer, drawer, screens, MoMo" },
];

export const GROUPS: Record<Group, { label: string; tone: Tone }> = {
  service: { label: "Service", tone: "sun" },
  stock: { label: "Stock", tone: "forest" },
  money: { label: "Money", tone: "terra" },
  setup: { label: "Setup", tone: "cobalt" },
};

export const ROLE_MODULES: Record<Role, Module[]> = {
  owner: MODULES.map((m) => m.id),
  manager: MODULES.map((m) => m.id).filter((m) => m !== "settings"),
  cashier: ["today", "till", "floor", "kitchen", "orders", "drawer"],
  inventory: ["today", "menu", "recipes", "ingredients", "purchasing", "reports"],
  accountant: ["today", "orders", "drawer", "reports", "audit"],
  cook: ["kitchen"],
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner", manager: "Manager", cashier: "Cashier", inventory: "Inventory", accountant: "Accountant", cook: "Cook",
};

export const HOME: Record<Role, Module> = {
  owner: "today", manager: "today", cashier: "till", inventory: "ingredients", accountant: "reports", cook: "kitchen",
};

export const can = (role: Role | undefined, m: Module) => !!role && ROLE_MODULES[role].includes(m);
export const isManager = (role: Role | undefined) => role === "owner" || role === "manager";

/* --------------------------------------------------------------- entities */

export interface Category { key: CatKey; name: string; station: Station }
export interface Dish { id: string; name: string; desc: string; cat: CatKey; price: number; img: string | null; mins: number; available: boolean }
export interface Ingredient { id: string; name: string; unit: string; onHand: number; par: number; cost: number; supplierId: string; deductedToday: number }
export interface RecipeLine { ingId: string; qty: number }
export interface Supplier { id: string; name: string; contact: string; phone: string; leadDays: number; terms: string; supplies: string }
export type Zone = "Floor" | "Bar" | "Rooms" | "Takeaway";
export type TableStatus = "free" | "open" | "reserved" | "cleaning";
export interface Table { id: string; label: string; code: string; seats: number; zone: Zone; status: TableStatus; reservation: { name: string; time: string; guests: number } | null }
export type LineStatus = "new" | "cooking" | "ready" | "served";
export interface Line { id: string; dishId: string; name: string; price: number; qty: number; note: string; sent: boolean; status: LineStatus; station: Station }
export type PayMethod = "cash" | "momo" | "ghqr";
export interface Payment { id: string; method: PayMethod; amount: number; tendered: number; change: number; network: string; phone: string; ref: string; at: number }
export interface Refund { id: string; amount: number; method: PayMethod; reason: string; by: string; approvedBy: string; at: number; items: string }
export type OrderStatus = "open" | "paid" | "refunded" | "void";
export interface Discount { kind: "pct" | "amt"; value: number; reason: string }
export interface Order {
  id: number; tableId: string; tableLabel: string; guests: number; lines: Line[]; opened: number; closed: number | null;
  status: OrderStatus; discount: Discount | null; service: number; payments: Payment[]; refunds: Refund[]; staffId: string; voidReason: string;
}
export type TicketStatus = "new" | "cooking" | "ready" | "bumped";
export interface Ticket { id: string; orderId: number; tableLabel: string; lineIds: string[]; at: number; status: TicketStatus; startedAt: number | null; readyAt: number | null; bumpedAt: number | null }
export type DrawerKind = "float" | "sale" | "payout" | "payin" | "refund";
export interface DrawerEvent { id: string; kind: DrawerKind; amount: number; note: string; by: string; at: number }
export interface DrawerSession { id: string; openedAt: number; openedBy: string; closedAt: number | null; closedBy: string; float: number; events: DrawerEvent[]; counted: number | null; variance: number | null }
export type POStatus = "draft" | "sent" | "received" | "invoiced";
export interface POLine { ingId: string; qty: number; cost: number; received: number | null }
export interface PO { id: string; supplierId: string; lines: POLine[]; status: POStatus; createdAt: number; sentAt: number | null; receivedAt: number | null; invoice: { no: string; total: number; at: number } | null }
export interface AuditEntry { id: string; at: number; user: string; action: string; entity: string; details: string }
export interface Staff { id: string; name: string; initials: string; role: Role; pin: string; color: Tone; active: boolean; lastSignIn: number | null }
export interface Settings {
  business: { name: string; branch: string; address: string; phone: string; tin: string };
  vat: number; roomService: number;
  receipt: { header: string; footer: string; showTin: boolean };
  printer: { name: string; ip: string; port: number; online: boolean };
  tenders: { cash: boolean; momo: boolean; ghqr: boolean; networks: { MTN: boolean; Telecel: boolean; AT: boolean } };
  kds: { warn: number; urgent: number };
}
export interface Toast { id: number; msg: string; tone: "ok" | "info" | "warn" }

export interface State {
  v: number;
  user: string | null;
  module: Module;
  tillTable: string | null;
  categories: Category[];
  dishes: Dish[];
  ingredients: Ingredient[];
  recipes: Record<string, RecipeLine[]>;
  suppliers: Supplier[];
  tables: Table[];
  orders: Order[];
  tickets: Ticket[];
  drawer: DrawerSession[];
  pos: PO[];
  audit: AuditEntry[];
  staff: Staff[];
  settings: Settings;
  nextOrder: number;
  toast: Toast | null;
  tour: number | null;
}

/* ------------------------------------------------------------------- seed */

let n = 0;
export const uid = (p = "x") => `${p}${(++n).toString(36)}${Date.now().toString(36).slice(-4)}`;

export const CATEGORIES: Category[] = [
  { key: "kitchen", name: "Kitchen", station: "kitchen" },
  { key: "grill", name: "Grill", station: "grill" },
  { key: "snacks", name: "Snacks", station: "kitchen" },
  { key: "drinks", name: "Drinks", station: "bar" },
];

const D = (id: string, name: string, desc: string, cat: CatKey, price: number, img: string | null, mins: number): Dish => ({ id, name, desc, cat, price: price * 100, img, mins, available: true });

export const DISHES: Dish[] = [
  D("waakye", "Waakye", "Rice & beans, shito, gari, boiled egg", "kitchen", 45, "waakye", 12),
  D("jollof", "Jollof & Grilled Chicken", "Smoky party jollof, quarter chicken, salad", "kitchen", 65, "jollof-rice-grilled-chicken", 14),
  D("banku", "Banku & Grilled Tilapia", "Two balls, whole tilapia, pepper & onions", "kitchen", 80, "banku-grilled-tilapia", 18),
  D("fufu", "Fufu & Groundnut Soup", "Cassava-plantain fufu, goat meat", "kitchen", 60, "fufu-groundnut-soup", 15),
  D("kontomire", "Kontomire Stew & Yam", "Cocoyam leaves, agushi, boiled yam", "kitchen", 50, "kontomire", 12),
  D("kenkey", "Kenkey & Fried Fish", "Ga kenkey, fried fish, black shito", "kitchen", 45, "kenkey-fried-fish", 10),
  D("redred", "Red Red", "Black-eyed beans in palm oil, fried plantain", "kitchen", 40, "red-red", 10),
  D("omotuo", "Omo Tuo & Light Soup", "Rice balls, Sunday-style light soup", "kitchen", 55, "omo-tuo", 14),
  D("friedrice", "Fried Rice & Chicken", "Wok-fried rice, vegetables, chicken", "kitchen", 65, "fried-rice-grilled-chicken", 12),
  D("tilapia", "Grilled Tilapia", "Whole tilapia, pepper sauce, sides", "grill", 70, "grilled-tilapia", 20),
  D("chicken", "Grilled Chicken", "Half chicken, suya rub, chips", "grill", 55, "grilled-chicken", 16),
  D("suya", "Beef Suya", "Skewered beef, yaji spice, onions", "grill", 35, "beef-suya", 8),
  D("kelewele", "Kelewele", "Spiced fried plantain, roasted peanuts", "snacks", 20, "kelewele", 6),
  D("meatpie", "Meat Pie", "Flaky pastry, beef mince", "snacks", 15, "meat-pie", 3),
  D("puffpuff", "Puff Puff", "Six golden dough balls", "snacks", 10, "puff-puff", 4),
  D("sobolo", "Sobolo", "Hibiscus & ginger, served chilled", "drinks", 12, "sobolo", 1),
  D("palmwine", "Palm Wine", "Fresh, by the calabash", "drinks", 25, "palm-wine", 1),
];

export const SUPPLIERS: Supplier[] = [
  { id: "makola", name: "Makola Foods", contact: "Auntie Esi", phone: "+233 24 455 1200", leadDays: 1, terms: "Cash on delivery", supplies: "Rice, grains, oils, dry goods" },
  { id: "tema", name: "Tema Cold Store", contact: "Mr. Lartey", phone: "+233 20 311 7788", leadDays: 2, terms: "Net 7", supplies: "Tilapia, beef, poultry" },
  { id: "aburi", name: "Aburi Farms", contact: "Nana Yaa", phone: "+233 27 900 4411", leadDays: 1, terms: "Net 14", supplies: "Plantain, tomatoes, vegetables" },
  { id: "volta", name: "Volta Palm & Cane", contact: "Kobby", phone: "+233 54 622 0909", leadDays: 3, terms: "Cash on delivery", supplies: "Palm wine, hibiscus, ginger" },
];

const I = (id: string, name: string, unit: string, onHand: number, par: number, cost: number, supplierId: string): Ingredient => ({ id, name, unit, onHand, par, cost, supplierId, deductedToday: 0 });

export const INGREDIENTS: Ingredient[] = [
  I("rice", "Rice (perfumed)", "kg", 38, 25, 1800, "makola"),
  I("tomato", "Tomatoes", "kg", 9, 15, 1200, "aburi"),
  I("chicken", "Chicken", "kg", 22, 20, 4200, "tema"),
  I("tilapia", "Tilapia (whole)", "pc", 14, 24, 2800, "tema"),
  I("beef", "Beef (cubed)", "kg", 9, 8, 5500, "tema"),
  I("mince", "Beef mince", "kg", 4, 3, 5000, "tema"),
  I("goat", "Goat meat", "kg", 6, 5, 6000, "tema"),
  I("cassava", "Cassava dough", "kg", 16, 10, 900, "makola"),
  I("corn", "Corn dough", "kg", 20, 12, 850, "makola"),
  I("plantain", "Plantain", "pc", 34, 80, 250, "aburi"),
  I("beans", "Black-eyed beans", "kg", 12, 8, 1600, "makola"),
  I("groundnut", "Groundnut paste", "kg", 6, 5, 2600, "makola"),
  I("kontomire", "Kontomire leaves", "bunch", 10, 8, 500, "aburi"),
  I("yam", "Yam", "tuber", 15, 10, 1500, "aburi"),
  I("palmoil", "Palm oil", "L", 11, 6, 2200, "makola"),
  I("oil", "Vegetable oil", "L", 20, 10, 1900, "makola"),
  I("eggs", "Eggs", "pc", 90, 60, 180, "aburi"),
  I("flour", "Flour", "kg", 25, 10, 1100, "makola"),
  I("sugar", "Sugar", "kg", 8, 6, 1400, "makola"),
  I("hibiscus", "Dried hibiscus", "kg", 1.5, 2, 3000, "volta"),
  I("ginger", "Ginger", "kg", 4, 3, 1500, "volta"),
  I("palmwine", "Palm wine", "L", 14, 10, 1200, "volta"),
  I("yaji", "Suya spice (yaji)", "kg", 2, 1, 4800, "makola"),
  I("gari", "Gari", "kg", 12, 6, 900, "makola"),
  I("pepper", "Pepper & onions", "kg", 5, 4, 1300, "aburi"),
];

const R = (...pairs: [string, number][]): RecipeLine[] => pairs.map(([ingId, qty]) => ({ ingId, qty }));

export const RECIPES: Record<string, RecipeLine[]> = {
  waakye: R(["rice", 0.2], ["beans", 0.1], ["gari", 0.05], ["eggs", 1], ["pepper", 0.03]),
  jollof: R(["rice", 0.25], ["tomato", 0.15], ["chicken", 0.3], ["oil", 0.03], ["pepper", 0.02]),
  banku: R(["corn", 0.25], ["cassava", 0.1], ["tilapia", 1], ["pepper", 0.08]),
  fufu: R(["cassava", 0.3], ["plantain", 1], ["groundnut", 0.08], ["goat", 0.15], ["tomato", 0.05]),
  kontomire: R(["kontomire", 0.5], ["yam", 0.4], ["palmoil", 0.04], ["eggs", 1], ["pepper", 0.02]),
  kenkey: R(["corn", 0.35], ["tilapia", 0.5], ["oil", 0.05], ["pepper", 0.05]),
  redred: R(["beans", 0.2], ["palmoil", 0.05], ["plantain", 2], ["tomato", 0.05], ["oil", 0.03]),
  omotuo: R(["rice", 0.2], ["tomato", 0.1], ["goat", 0.12], ["pepper", 0.03]),
  friedrice: R(["rice", 0.25], ["chicken", 0.25], ["eggs", 1], ["oil", 0.03], ["pepper", 0.04]),
  tilapia: R(["tilapia", 1], ["pepper", 0.08], ["oil", 0.02]),
  chicken: R(["chicken", 0.5], ["yaji", 0.01], ["oil", 0.03], ["plantain", 1]),
  suya: R(["beef", 0.15], ["yaji", 0.01], ["pepper", 0.03]),
  kelewele: R(["plantain", 2], ["ginger", 0.01], ["oil", 0.05]),
  meatpie: R(["flour", 0.08], ["mince", 0.05], ["oil", 0.01]),
  puffpuff: R(["flour", 0.1], ["sugar", 0.02], ["oil", 0.04]),
  sobolo: R(["hibiscus", 0.02], ["ginger", 0.01], ["sugar", 0.03]),
  palmwine: R(["palmwine", 0.5]),
};

const T = (id: string, label: string, code: string, seats: number, zone: Zone, status: TableStatus = "free"): Table => ({ id, label, code, seats, zone, status, reservation: null });

export const TABLES: Table[] = [
  T("t1", "Table 01", "01", 2, "Floor"),
  T("t2", "Table 02", "02", 4, "Floor", "cleaning"),
  T("t3", "Table 03", "03", 4, "Floor", "open"),
  T("t4", "Table 04", "04", 6, "Floor"),
  T("t5", "Table 05", "05", 2, "Floor", "reserved"),
  T("t6", "Table 06", "06", 4, "Floor"),
  T("t7", "Table 07", "07", 8, "Floor", "open"),
  T("t8", "Table 08", "08", 4, "Floor"),
  T("bar", "Bar", "Bar", 6, "Bar", "open"),
  T("r12", "Room 12", "R12", 2, "Rooms"),
  T("r14", "Room 14", "R14", 2, "Rooms"),
  T("ta", "Takeaway", "T/A", 0, "Takeaway"),
];
TABLES[4].reservation = { name: "Mensah party", time: "20:30", guests: 2 };

export const STAFF: Staff[] = [
  { id: "kofi", name: "Kofi Mensah", initials: "KM", role: "owner", pin: "1111", color: "terra", active: true, lastSignIn: at(8, 55) },
  { id: "efua", name: "Efua Asante", initials: "EA", role: "manager", pin: "2222", color: "cobalt", active: true, lastSignIn: at(9, 0) },
  { id: "ama", name: "Ama Owusu", initials: "AO", role: "cashier", pin: "3333", color: "sun", active: true, lastSignIn: at(16, 2) },
  { id: "yaw", name: "Yaw Boateng", initials: "YB", role: "cashier", pin: "3434", color: "forest", active: true, lastSignIn: at(11, 5) },
  { id: "adwoa", name: "Adwoa Darko", initials: "AD", role: "inventory", pin: "4444", color: "cobalt", active: true, lastSignIn: at(10, 20) },
  { id: "kojo", name: "Kojo Appiah", initials: "KA", role: "accountant", pin: "5555", color: "ink", active: true, lastSignIn: at(-48, 0) },
  { id: "kwame", name: "Kwame Tetteh", initials: "KT", role: "cook", pin: "6666", color: "terra", active: true, lastSignIn: at(10, 0) },
];

export const SETTINGS: Settings = {
  business: { name: "Lush View Restaurant & Lounge", branch: "Osu, Accra", address: "12 Oxford Street, Osu, Accra", phone: "+233 30 277 1234", tin: "C0012345678" },
  vat: 15,
  roomService: 3000,
  receipt: { header: "Thank you for dining with us", footer: "Prices include 15% VAT. Medaase!", showTin: true },
  printer: { name: "Epson TM-T20III", ip: "192.168.1.50", port: 9100, online: true },
  tenders: { cash: true, momo: true, ghqr: true, networks: { MTN: true, Telecel: true, AT: true } },
  kds: { warn: 8, urgent: 15 },
};

/* ------------------------------------------------- today's orders & drawer */

const dish = (id: string) => DISHES.find((d) => d.id === id)!;
const station = (id: string) => CATEGORIES.find((c) => c.key === dish(id).cat)!.station;

export function mkLine(dishId: string, qty: number, note = "", sent = true, status: LineStatus = "served"): Line {
  const d = dish(dishId);
  return { id: uid("l"), dishId, name: d.name, price: d.price, qty, note, sent, status: sent ? status : "new", station: station(dishId) };
}

function paid(id: number, tableId: string, staffId: string, opened: number, mins: number, lines: Line[], method: PayMethod, extra: Partial<Order> = {}): Order {
  const table = TABLES.find((t) => t.id === tableId)!;
  const closed = opened + mins * 60000;
  const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const disc = extra.discount ? (extra.discount.kind === "pct" ? Math.round((sub * extra.discount.value) / 100) : extra.discount.value) : 0;
  const net = sub - disc;
  const service = table.zone === "Rooms" ? SETTINGS.roomService : 0;
  const total = net + Math.round(net * 0.15) + service;
  const tendered = method === "cash" ? Math.ceil(total / 1000) * 1000 : total;
  const payment: Payment = {
    id: uid("p"), method, amount: total, tendered, change: tendered - total,
    network: method === "momo" ? ["MTN", "Telecel", "AT"][id % 3] : "", phone: method === "momo" ? `0${[24, 20, 27][id % 3]}${String(1000000 + id * 7919).slice(0, 7)}` : "",
    ref: method === "momo" ? `MP${String(id).slice(-3)}${String(opened).slice(-5)}` : "", at: closed,
  };
  return { id, tableId, tableLabel: table.label, guests: extra.guests ?? 2, lines, opened, closed, status: "paid", discount: extra.discount ?? null, service, payments: [payment], refunds: [], staffId, voidReason: "" };
}

export function seedOrders(now: number): { orders: Order[]; tickets: Ticket[] } {
  const orders: Order[] = [
    paid(10423, "t4", "yaw", at(11, 32), 38, [mkLine("waakye", 2), mkLine("sobolo", 2)], "cash", { guests: 2 }),
    paid(10424, "ta", "yaw", at(11, 50), 9, [mkLine("meatpie", 3), mkLine("puffpuff", 1)], "momo", { guests: 1 }),
    paid(10425, "t1", "yaw", at(12, 10), 44, [mkLine("jollof", 1), mkLine("friedrice", 1), mkLine("sobolo", 2)], "momo", { guests: 2 }),
    paid(10426, "t6", "yaw", at(12, 25), 52, [mkLine("banku", 2), mkLine("kelewele", 1), mkLine("palmwine", 1)], "cash", { guests: 3 }),
    paid(10427, "bar", "yaw", at(13, 5), 30, [mkLine("suya", 4), mkLine("sobolo", 4)], "cash", { guests: 4 }),
    paid(10428, "t8", "yaw", at(13, 20), 48, [mkLine("fufu", 2), mkLine("kontomire", 1), mkLine("sobolo", 3)], "momo", { guests: 3 }),
    paid(10429, "r12", "yaw", at(14, 2), 25, [mkLine("friedrice", 1), mkLine("chicken", 1), mkLine("sobolo", 1)], "ghqr", { guests: 1 }),
    paid(10430, "ta", "ama", at(16, 15), 6, [mkLine("kelewele", 2), mkLine("puffpuff", 2)], "cash", { guests: 1 }),
    paid(10431, "t2", "ama", at(17, 5), 61, [mkLine("tilapia", 2), mkLine("banku", 1), mkLine("palmwine", 2)], "cash", { guests: 4, discount: { kind: "pct", value: 10, reason: "Regular guest" } }),
    paid(10432, "t4", "ama", at(17, 40), 50, [mkLine("jollof", 3), mkLine("sobolo", 3), mkLine("meatpie", 1)], "momo", { guests: 3 }),
    paid(10433, "t1", "ama", at(18, 12), 42, [mkLine("omotuo", 1), mkLine("kenkey", 1), mkLine("sobolo", 2)], "cash", { guests: 2 }),
    paid(10434, "t6", "ama", at(18, 30), 47, [mkLine("redred", 2), mkLine("chicken", 1), mkLine("palmwine", 1)], "momo", { guests: 2 }),
  ];
  // A partial refund on #10428 — one Sobolo was never delivered.
  orders[5].refunds.push({ id: uid("r"), amount: 1380, method: "momo", reason: "Item not delivered", by: "Ama Owusu", approvedBy: "Efua Asante", at: at(14, 25), items: "1 × Sobolo" });

  const m = 60000;
  const t3Lines = [mkLine("banku", 2, "", true, "cooking"), mkLine("kelewele", 1, "no peanuts", true, "cooking"), mkLine("palmwine", 2, "", true, "served")];
  const barLines = [mkLine("suya", 3, "extra pepper", true, "new"), mkLine("sobolo", 3, "", true, "new")];
  const t7Lines = [mkLine("jollof", 1, "", true, "cooking"), mkLine("suya", 1, "no onions", true, "cooking"), mkLine("sobolo", 2, "chilled", false)];
  const open = (id: number, tableId: string, staffId: string, opened: number, guests: number, lines: Line[]): Order => {
    const table = TABLES.find((t) => t.id === tableId)!;
    return { id, tableId, tableLabel: table.label, guests, lines, opened, closed: null, status: "open", discount: null, service: table.zone === "Rooms" ? SETTINGS.roomService : 0, payments: [], refunds: [], staffId, voidReason: "" };
  };
  orders.push(open(10435, "t3", "yaw", now - 24 * m, 4, t3Lines));
  orders.push(open(10436, "bar", "ama", now - 6 * m, 3, barLines));
  orders.push(open(10437, "t7", "ama", now - 11 * m, 4, t7Lines));

  const tickets: Ticket[] = [
    { id: uid("k"), orderId: 10435, tableLabel: "Table 03", lineIds: t3Lines.slice(0, 2).map((l) => l.id), at: now - 17 * m, status: "cooking", startedAt: now - 15 * m, readyAt: null, bumpedAt: null },
    { id: uid("k"), orderId: 10435, tableLabel: "Table 03", lineIds: [t3Lines[2].id], at: now - 17 * m, status: "bumped", startedAt: now - 17 * m, readyAt: now - 16 * m, bumpedAt: now - 16 * m },
    { id: uid("k"), orderId: 10437, tableLabel: "Table 07", lineIds: t7Lines.slice(0, 2).map((l) => l.id), at: now - 7 * m, status: "cooking", startedAt: now - 5 * m, readyAt: null, bumpedAt: null },
    { id: uid("k"), orderId: 10436, tableLabel: "Bar", lineIds: barLines.map((l) => l.id), at: now - 3 * m, status: "new", startedAt: null, readyAt: null, bumpedAt: null },
  ];
  return { orders, tickets };
}

export function seedDrawer(orders: Order[]): DrawerSession[] {
  const events: DrawerEvent[] = [{ id: uid("e"), kind: "float", amount: 120000, note: "Opening float", by: "Efua Asante", at: at(9, 2) }];
  for (const o of orders) {
    for (const p of o.payments) if (p.method === "cash") events.push({ id: uid("e"), kind: "sale", amount: p.amount, note: `#${o.id} · ${o.tableLabel}`, by: STAFF.find((s) => s.id === o.staffId)!.name, at: p.at });
  }
  events.push({ id: uid("e"), kind: "payout", amount: -15000, note: "Gas cylinder refill", by: "Efua Asante", at: at(14, 20) });
  events.sort((a, b) => a.at - b.at);
  return [{ id: uid("d"), openedAt: at(9, 2), openedBy: "Efua Asante", closedAt: null, closedBy: "", float: 120000, events, counted: null, variance: null }];
}

export function seedPOs(): PO[] {
  return [
    { id: "PO-2040", supplierId: "makola", status: "invoiced", createdAt: at(10, 0, -3), sentAt: at(10, 5, -3), receivedAt: at(8, 30, -2), invoice: { no: "INV-7781", total: 234000, at: at(8, 45, -2) },
      lines: [{ ingId: "rice", qty: 50, cost: 1800, received: 50 }, { ingId: "oil", qty: 30, cost: 1900, received: 30 }, { ingId: "flour", qty: 20, cost: 1100, received: 20 }, { ingId: "sugar", qty: 10, cost: 1400, received: 10 }, { ingId: "gari", qty: 20, cost: 900, received: 20 }, { ingId: "beans", qty: 15, cost: 1600, received: 15 }] },
    { id: "PO-2041", supplierId: "tema", status: "sent", createdAt: at(15, 10, -1), sentAt: at(15, 12, -1), receivedAt: null, invoice: null,
      lines: [{ ingId: "tilapia", qty: 30, cost: 2800, received: null }, { ingId: "beef", qty: 10, cost: 5500, received: null }, { ingId: "chicken", qty: 20, cost: 4200, received: null }] },
    { id: "PO-2042", supplierId: "aburi", status: "draft", createdAt: at(10, 40), sentAt: null, receivedAt: null, invoice: null,
      lines: [{ ingId: "plantain", qty: 100, cost: 250, received: null }, { ingId: "tomato", qty: 20, cost: 1200, received: null }] },
  ];
}

export function seedAudit(): AuditEntry[] {
  const A = (atTs: number, user: string, action: string, entity: string, details: string): AuditEntry => ({ id: uid("a"), at: atTs, user, action, entity, details });
  return [
    A(at(8, 55), "Kofi Mensah", "Sign in", "Session", "Owner signed in on Till 1"),
    A(at(9, 0), "Efua Asante", "Sign in", "Session", "Manager signed in on Till 1"),
    A(at(9, 2), "Efua Asante", "Drawer opened", "Drawer", "Opening float GH₵ 1,200.00"),
    A(at(9, 40), "Adwoa Darko", "Stock adjusted", "Ingredient", "Tomatoes −3 kg · Waste (spoiled)"),
    A(at(10, 20), "Adwoa Darko", "Price changed", "Dish", "Grilled Tilapia GH₵ 65.00 → GH₵ 70.00"),
    A(at(10, 40), "Adwoa Darko", "PO created", "Purchasing", "PO-2042 · Aburi Farms · 2 lines"),
    A(at(11, 5), "Yaw Boateng", "Sign in", "Session", "Cashier signed in on Till 1"),
    A(at(14, 20), "Efua Asante", "Payout", "Drawer", "GH₵ 150.00 · Gas cylinder refill"),
    A(at(14, 25), "Ama Owusu", "Refund", "Order #10428", "GH₵ 13.80 MoMo · Item not delivered · approved by Efua Asante"),
    A(at(16, 2), "Ama Owusu", "Sign in", "Session", "Cashier signed in on Till 1"),
    A(at(17, 5), "Ama Owusu", "Discount", "Order #10431", "10% · Regular guest"),
    A(at(17, 30), "Efua Asante", "Dish 86'd", "Dish", "Omo Tuo & Light Soup marked unavailable, then restored 18:00"),
  ];
}

export function seedState(now = Date.now()): State {
  const { orders, tickets } = seedOrders(now);
  return {
    v: 1,
    user: null,
    module: "today",
    tillTable: "t7",
    categories: CATEGORIES,
    dishes: DISHES.map((d) => ({ ...d })),
    ingredients: INGREDIENTS.map((i) => ({ ...i, deductedToday: Math.round(i.par * 0.12 * 10) / 10 })),
    recipes: Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, v.map((l) => ({ ...l }))])),
    suppliers: SUPPLIERS,
    tables: TABLES.map((t) => ({ ...t })),
    orders,
    tickets,
    drawer: seedDrawer(orders),
    pos: seedPOs(),
    audit: seedAudit(),
    staff: STAFF.map((s) => ({ ...s })),
    settings: JSON.parse(JSON.stringify(SETTINGS)) as Settings,
    nextOrder: 10438,
    toast: null,
    tour: null,
  };
}
