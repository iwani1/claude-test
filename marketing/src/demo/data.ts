/**
 * Demo fixtures for the whole system: menu, floor, staff & roles, ingredients,
 * recipes, suppliers, settings. Business rules (VAT 15 %, GH₵30 room-service
 * charge, GH₵1,200 opening float, kitchen status names, 8/15-minute ticket
 * thresholds, the role matrix) mirror the real POS; names and numbers are
 * illustrative.
 */

/* ------------------------------------------------------------------ menu */

export type Category = "Kitchen" | "Grill" | "Snacks" | "Drinks";
export const CATEGORIES: Category[] = ["Kitchen", "Grill", "Snacks", "Drinks"];
export type Station = "kitchen" | "grill" | "bar";

export type MenuItem = {
  id: string;
  name: string;
  short: string;
  price: number;
  category: Category;
  img: string;
  /** Fires to the kitchen pass (bar items never do). */
  kitchen: boolean;
  station: Station;
  available: boolean;
  prepMinutes: number;
};

const item = (id: string, name: string, short: string, price: number, category: Category, img: string, station: Station = "kitchen", prepMinutes = 15): MenuItem => ({
  id,
  name,
  short,
  price,
  category,
  img: `/dishes/${img}.jpg`,
  kitchen: station !== "bar",
  station,
  available: true,
  prepMinutes,
});

export const MENU: MenuItem[] = [
  item("waakye", "Waakye", "Waakye", 45, "Kitchen", "waakye", "kitchen", 12),
  item("jollof", "Jollof Rice & Grilled Chicken", "Jollof & Chicken", 65, "Kitchen", "jollof-rice-grilled-chicken", "kitchen", 15),
  item("banku", "Banku & Grilled Tilapia", "Banku & Tilapia", 80, "Kitchen", "banku-grilled-tilapia", "kitchen", 20),
  item("fufu", "Fufu & Groundnut Soup", "Fufu & G/nut", 60, "Kitchen", "fufu-groundnut-soup", "kitchen", 15),
  item("kontomire", "Kontomire (Palava Sauce)", "Kontomire", 50, "Kitchen", "kontomire", "kitchen", 15),
  item("kenkey", "Kenkey & Fried Fish", "Kenkey & Fish", 45, "Kitchen", "kenkey-fried-fish", "kitchen", 12),
  item("redred", "Red Red with Fried Plantain", "Red Red", 40, "Kitchen", "red-red", "kitchen", 12),
  item("omotuo", "Omo Tuo with Soup", "Omo Tuo", 55, "Kitchen", "omo-tuo", "kitchen", 15),
  item("friedrice", "Fried Rice & Grilled Chicken", "Fried Rice & Chicken", 65, "Kitchen", "fried-rice-grilled-chicken", "kitchen", 15),
  item("tilapia", "Grilled Tilapia", "Grilled Tilapia", 70, "Grill", "grilled-tilapia", "grill", 20),
  item("chicken", "Grilled Chicken", "Grilled Chicken", 55, "Grill", "grilled-chicken", "grill", 18),
  item("suya", "Beef Suya", "Beef Suya", 35, "Grill", "beef-suya", "grill", 10),
  item("kelewele", "Kelewele", "Kelewele", 20, "Snacks", "kelewele", "kitchen", 8),
  item("meatpie", "Meat Pie", "Meat Pie", 15, "Snacks", "meat-pie", "kitchen", 5),
  item("puffpuff", "Puff Puff (Bofrot)", "Puff Puff", 10, "Snacks", "puff-puff", "kitchen", 5),
  item("sobolo", "Sobolo (Hibiscus Drink)", "Sobolo", 12, "Drinks", "sobolo", "bar", 2),
  item("palmwine", "Palm Wine", "Palm Wine", 25, "Drinks", "palm-wine", "bar", 2),
];

export const MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(MENU.map((m) => [m.id, m]));

/* ----------------------------------------------------------------- floor */

export type OrderType = "dine_in" | "room_service" | "takeaway";
export type Zone = "Floor" | "Terrace" | "Bar" | "Rooms" | "Counter";
export type TableStatus = "free" | "reserved" | "cleaning";
export type Table = { id: string; label: string; code: string; name: string; seats: number; type: OrderType; zone: Zone; status: TableStatus; reservedFor?: string };

export const TABLES: Table[] = [
  { id: "t1", label: "T1", code: "01", name: "Table 01", seats: 2, type: "dine_in", zone: "Floor", status: "free" },
  { id: "t2", label: "T2", code: "02", name: "Table 02", seats: 2, type: "dine_in", zone: "Floor", status: "cleaning" },
  { id: "t3", label: "T3", code: "03", name: "Table 03", seats: 4, type: "dine_in", zone: "Floor", status: "free" },
  { id: "t4", label: "T4", code: "04", name: "Table 04", seats: 4, type: "dine_in", zone: "Floor", status: "free" },
  { id: "t5", label: "T5", code: "05", name: "Table 05", seats: 6, type: "dine_in", zone: "Terrace", status: "free" },
  { id: "t6", label: "T6", code: "06", name: "Table 06", seats: 4, type: "dine_in", zone: "Terrace", status: "reserved", reservedFor: "Mrs Quartey · 20:30" },
  { id: "t7", label: "T7", code: "07", name: "Table 07", seats: 4, type: "dine_in", zone: "Terrace", status: "free" },
  { id: "t8", label: "T8", code: "08", name: "Table 08", seats: 8, type: "dine_in", zone: "Terrace", status: "free" },
  { id: "bar", label: "Bar", code: "Bar", name: "The bar", seats: 6, type: "dine_in", zone: "Bar", status: "free" },
  { id: "room12", label: "Room 12", code: "R12", name: "Room 12", seats: 2, type: "room_service", zone: "Rooms", status: "free" },
  { id: "takeaway", label: "Takeaway", code: "T/A", name: "Takeaway", seats: 0, type: "takeaway", zone: "Counter", status: "free" },
];

export const TABLE_BY_ID: Record<string, Table> = Object.fromEntries(TABLES.map((t) => [t.id, t]));

/* --------------------------------------------------------------- billing */

export const BILLING = { taxRatePercent: 15, roomChargeCents: 3000 } as const;
export const OPENING_FLOAT_CENTS = 120000; // GH₵1,200.00 — the drawer's default
export const FIRST_ORDER_NUMBER = 10423; // the marketing receipt mock is #10422
export const MOMO_NETWORKS = ["MTN", "Telecel", "AT"] as const;

/* ---------------------------------------------------------- staff & roles */

export type Role = "owner" | "manager" | "cashier" | "cook" | "inventory" | "accountant";
export type Perm = "pos" | "kds" | "orders" | "drawer" | "reports" | "menu" | "stock" | "staff" | "settings" | "audit" | "refund";

/** The real matrix from src/lib/permissions.ts, reduced to what the demo screens need. */
export const ROLES: Record<Role, { label: string; short: string; terminal: boolean; can: Perm[] }> = {
  owner: { label: "Super Admin / Owner", short: "Owner", terminal: true, can: ["pos", "kds", "orders", "drawer", "reports", "menu", "stock", "staff", "settings", "audit", "refund"] },
  manager: { label: "Restaurant Manager", short: "Manager", terminal: true, can: ["pos", "kds", "orders", "drawer", "reports", "menu", "stock", "staff", "audit", "refund"] },
  cashier: { label: "Cashier / Front-of-House", short: "Cashier", terminal: true, can: ["pos", "kds", "orders", "drawer"] },
  cook: { label: "Kitchen Staff (no terminal access)", short: "Kitchen", terminal: false, can: [] },
  inventory: { label: "Inventory Officer", short: "Stock", terminal: true, can: ["reports", "menu", "stock"] },
  accountant: { label: "Accountant / Finance", short: "Finance", terminal: true, can: ["reports", "orders", "drawer", "audit"] },
};
export const ROLE_ORDER: Role[] = ["owner", "manager", "cashier", "cook", "inventory", "accountant"];

export type Staff = { id: string; name: string; role: Role; pin: string; phone: string; email: string; active: boolean; lastLogin?: number };

export const STAFF: Staff[] = [
  { id: "kofi", name: "Kofi Mensah", role: "owner", pin: "1111", phone: "024 400 1100", email: "kofi@lushview.gh", active: true },
  { id: "efua", name: "Efua Boateng", role: "manager", pin: "2222", phone: "020 311 2200", email: "efua@lushview.gh", active: true },
  { id: "ama", name: "Ama Owusu", role: "cashier", pin: "3333", phone: "055 122 3300", email: "ama@lushview.gh", active: true },
  { id: "yaw", name: "Yaw Darko", role: "cashier", pin: "3434", phone: "024 877 3400", email: "yaw@lushview.gh", active: true },
  { id: "kwame", name: "Kwame Asante", role: "cook", pin: "", phone: "027 650 5500", email: "kitchen@lushview.gh", active: true },
  { id: "adwoa", name: "Adwoa Nkrumah", role: "inventory", pin: "4444", phone: "050 909 4400", email: "adwoa@lushview.gh", active: true },
  { id: "kojo", name: "Kojo Appiah", role: "accountant", pin: "5555", phone: "026 118 5500", email: "accounts@lushview.gh", active: true },
];
export const CASHIER = "Ama";

/* ----------------------------------------------------------- ingredients */

export type Unit = "kg" | "L" | "pcs" | "bag";
export type IngredientCategory = "Produce" | "Meat & fish" | "Dry goods" | "Beverage" | "Fuel" | "Packaging";
export type Ingredient = { id: string; name: string; category: IngredientCategory; unit: Unit; stock: number; min: number; cost: number; supplierId: string; location: string };

const ing = (id: string, name: string, category: IngredientCategory, unit: Unit, stock: number, min: number, cost: number, supplierId: string, location = "Dry store"): Ingredient => ({ id, name, category, unit, stock, min, cost, supplierId, location });

export const INGREDIENTS: Ingredient[] = [
  ing("rice", "Rice (long grain)", "Dry goods", "kg", 48, 20, 14, "makola"),
  ing("tomato", "Tomatoes", "Produce", "kg", 9, 12, 18, "agbogbloshie", "Walk-in fridge"),
  ing("onion", "Onions", "Produce", "kg", 15, 8, 10, "agbogbloshie", "Walk-in fridge"),
  ing("pepper", "Scotch bonnet pepper", "Produce", "kg", 4, 2, 24, "agbogbloshie", "Walk-in fridge"),
  ing("chicken", "Chicken (whole, fresh)", "Meat & fish", "kg", 22, 10, 48, "darko", "Walk-in fridge"),
  ing("tilapia", "Tilapia (whole)", "Meat & fish", "pcs", 14, 10, 32, "tema", "Freezer"),
  ing("beef", "Beef (boneless)", "Meat & fish", "kg", 6, 8, 65, "darko", "Freezer"),
  ing("fish", "Fried fish (herrings)", "Meat & fish", "pcs", 30, 20, 9, "tema", "Freezer"),
  ing("fufu", "Cassava & plantain fufu mix", "Dry goods", "kg", 25, 10, 9, "makola"),
  ing("groundnut", "Groundnut paste", "Dry goods", "kg", 7, 5, 40, "makola"),
  ing("beans", "Black-eyed beans", "Dry goods", "kg", 18, 10, 16, "makola"),
  ing("flour", "Flour", "Dry goods", "kg", 20, 10, 11, "makola"),
  ing("palmoil", "Palm oil", "Dry goods", "L", 11, 6, 30, "makola"),
  ing("vegoil", "Vegetable oil", "Dry goods", "L", 20, 10, 28, "makola"),
  ing("plantain", "Plantain", "Produce", "pcs", 60, 30, 2.5, "agbogbloshie"),
  ing("kontomire", "Kontomire leaves", "Produce", "kg", 5, 3, 15, "agbogbloshie", "Walk-in fridge"),
  ing("hibiscus", "Dried hibiscus", "Beverage", "kg", 4, 2, 55, "makola"),
  ing("palmwine", "Palm wine", "Beverage", "L", 30, 15, 12, "kokrobite", "Bar fridge"),
  ing("charcoal", "Charcoal", "Fuel", "bag", 3, 4, 70, "accragas", "Yard"),
  ing("gas", "LPG", "Fuel", "kg", 24, 12, 14, "accragas", "Yard"),
  ing("packs", "Takeaway packs", "Packaging", "pcs", 400, 200, 1.2, "makola"),
];
export const INGREDIENT_BY_ID: Record<string, Ingredient> = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

/** Per-portion recipes: ingredientId → quantity in the ingredient's unit. */
export type RecipeLine = { ingredientId: string; qty: number };
export const RECIPES: Record<string, RecipeLine[]> = {
  waakye: [{ ingredientId: "rice", qty: 0.2 }, { ingredientId: "beans", qty: 0.1 }, { ingredientId: "tomato", qty: 0.08 }, { ingredientId: "onion", qty: 0.03 }, { ingredientId: "fish", qty: 1 }],
  jollof: [{ ingredientId: "rice", qty: 0.25 }, { ingredientId: "tomato", qty: 0.15 }, { ingredientId: "onion", qty: 0.05 }, { ingredientId: "pepper", qty: 0.01 }, { ingredientId: "chicken", qty: 0.3 }, { ingredientId: "vegoil", qty: 0.03 }],
  banku: [{ ingredientId: "tilapia", qty: 1 }, { ingredientId: "tomato", qty: 0.1 }, { ingredientId: "onion", qty: 0.05 }, { ingredientId: "pepper", qty: 0.02 }, { ingredientId: "charcoal", qty: 0.02 }],
  fufu: [{ ingredientId: "fufu", qty: 0.35 }, { ingredientId: "groundnut", qty: 0.12 }, { ingredientId: "chicken", qty: 0.2 }, { ingredientId: "tomato", qty: 0.05 }],
  kontomire: [{ ingredientId: "kontomire", qty: 0.2 }, { ingredientId: "palmoil", qty: 0.05 }, { ingredientId: "onion", qty: 0.05 }, { ingredientId: "fish", qty: 1 }, { ingredientId: "plantain", qty: 2 }],
  kenkey: [{ ingredientId: "fish", qty: 2 }, { ingredientId: "pepper", qty: 0.02 }, { ingredientId: "tomato", qty: 0.05 }, { ingredientId: "onion", qty: 0.03 }],
  redred: [{ ingredientId: "beans", qty: 0.2 }, { ingredientId: "palmoil", qty: 0.05 }, { ingredientId: "plantain", qty: 2 }, { ingredientId: "onion", qty: 0.03 }],
  omotuo: [{ ingredientId: "rice", qty: 0.25 }, { ingredientId: "groundnut", qty: 0.12 }, { ingredientId: "chicken", qty: 0.2 }],
  friedrice: [{ ingredientId: "rice", qty: 0.25 }, { ingredientId: "vegoil", qty: 0.04 }, { ingredientId: "onion", qty: 0.04 }, { ingredientId: "chicken", qty: 0.3 }],
  tilapia: [{ ingredientId: "tilapia", qty: 1 }, { ingredientId: "pepper", qty: 0.02 }, { ingredientId: "onion", qty: 0.05 }, { ingredientId: "charcoal", qty: 0.03 }],
  chicken: [{ ingredientId: "chicken", qty: 0.45 }, { ingredientId: "pepper", qty: 0.01 }, { ingredientId: "charcoal", qty: 0.02 }],
  suya: [{ ingredientId: "beef", qty: 0.18 }, { ingredientId: "onion", qty: 0.04 }, { ingredientId: "pepper", qty: 0.01 }, { ingredientId: "charcoal", qty: 0.02 }],
  kelewele: [{ ingredientId: "plantain", qty: 2 }, { ingredientId: "vegoil", qty: 0.05 }, { ingredientId: "pepper", qty: 0.01 }],
  meatpie: [{ ingredientId: "flour", qty: 0.12 }, { ingredientId: "beef", qty: 0.05 }, { ingredientId: "onion", qty: 0.02 }, { ingredientId: "vegoil", qty: 0.02 }],
  puffpuff: [{ ingredientId: "flour", qty: 0.06 }, { ingredientId: "vegoil", qty: 0.03 }],
  sobolo: [{ ingredientId: "hibiscus", qty: 0.02 }],
  palmwine: [{ ingredientId: "palmwine", qty: 0.5 }],
};

/* ------------------------------------------------------------- suppliers */

export type Supplier = { id: string; name: string; contact: string; phone: string; terms: string; leadDays: number };
export const SUPPLIERS: Supplier[] = [
  { id: "makola", name: "Makola Grains & Oils", contact: "Auntie Esi", phone: "024 555 0101", terms: "Net 14", leadDays: 2 },
  { id: "darko", name: "Darko Farms", contact: "Nana Darko", phone: "020 555 0202", terms: "Net 7", leadDays: 1 },
  { id: "tema", name: "Tema Fish Market", contact: "Bra Kwesi", phone: "027 555 0303", terms: "Cash on delivery", leadDays: 1 },
  { id: "agbogbloshie", name: "Agbogbloshie Produce", contact: "Maame Adjoa", phone: "055 555 0404", terms: "Cash on delivery", leadDays: 1 },
  { id: "kokrobite", name: "Kokrobite Tappers", contact: "Uncle Tetteh", phone: "026 555 0505", terms: "Cash on delivery", leadDays: 2 },
  { id: "accragas", name: "Accra Gas & Charcoal", contact: "Mr Lartey", phone: "030 555 0606", terms: "Net 30", leadDays: 3 },
];
export const SUPPLIER_BY_ID: Record<string, Supplier> = Object.fromEntries(SUPPLIERS.map((s) => [s.id, s]));

/* -------------------------------------------------------------- settings */

export type Settings = {
  name: string;
  address: string;
  phone: string;
  email: string;
  tin: string;
  vatPercent: number;
  serviceChargePercent: number;
  roomChargeCents: number;
  compBreakfast: boolean;
  momoMerchant: string;
  momoNetwork: string;
  receiptHeader: string;
  receiptFooter: string;
};
export const SETTINGS: Settings = {
  name: "Lush View Hotel · Restaurant & Bar",
  address: "12 Oxford Street, Osu, Accra",
  phone: "030 274 1100",
  email: "restaurant@lushview.gh",
  tin: "C0012345678",
  vatPercent: 15,
  serviceChargePercent: 0,
  roomChargeCents: 3000,
  compBreakfast: true,
  momoMerchant: "0244 000 111",
  momoNetwork: "MTN",
  receiptHeader: "LUSH VIEW HOTEL",
  receiptFooter: "Thank you — medaase",
};

export type Hardware = {
  printerIp: string;
  printerPort: number;
  printerMode: "network" | "browser";
  kitchenPrinter: boolean;
  tenders: { cash: boolean; momo: boolean; split: boolean; ghqr: boolean };
  accounting: "quickbooks" | "xero" | "none";
};
export const HARDWARE: Hardware = {
  printerIp: "192.168.1.50",
  printerPort: 9100,
  printerMode: "network",
  kitchenPrinter: true,
  tenders: { cash: true, momo: true, split: true, ghqr: true },
  accounting: "quickbooks",
};
