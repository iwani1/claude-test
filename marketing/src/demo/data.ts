/**
 * Demo fixtures. The menu mirrors the photo set shipped with the POS
 * (public/menu-images/preview.html); prices are illustrative.
 * Business rules (VAT 15 %, GH₵30 room-service charge, GH₵1,200 opening float,
 * kitchen status names, 8/15-minute ticket thresholds) match the real app.
 */

export type Category = "Kitchen" | "Grill" | "Snacks" | "Drinks";
export const CATEGORIES: Category[] = ["Kitchen", "Grill", "Snacks", "Drinks"];

export type MenuItem = { id: string; name: string; short: string; price: number; category: Category; img: string; kitchen: boolean };

const item = (id: string, name: string, short: string, price: number, category: Category, img: string, kitchen = true): MenuItem => ({
  id,
  name,
  short,
  price,
  category,
  img: `/dishes/${img}.jpg`,
  kitchen,
});

export const MENU: MenuItem[] = [
  item("waakye", "Waakye", "Waakye", 45, "Kitchen", "waakye"),
  item("jollof", "Jollof Rice & Grilled Chicken", "Jollof & Chicken", 65, "Kitchen", "jollof-rice-grilled-chicken"),
  item("banku", "Banku & Grilled Tilapia", "Banku & Tilapia", 80, "Kitchen", "banku-grilled-tilapia"),
  item("fufu", "Fufu & Groundnut Soup", "Fufu & G/nut", 60, "Kitchen", "fufu-groundnut-soup"),
  item("kontomire", "Kontomire (Palava Sauce)", "Kontomire", 50, "Kitchen", "kontomire"),
  item("kenkey", "Kenkey & Fried Fish", "Kenkey & Fish", 45, "Kitchen", "kenkey-fried-fish"),
  item("redred", "Red Red with Fried Plantain", "Red Red", 40, "Kitchen", "red-red"),
  item("omotuo", "Omo Tuo with Soup", "Omo Tuo", 55, "Kitchen", "omo-tuo"),
  item("friedrice", "Fried Rice & Grilled Chicken", "Fried Rice & Chicken", 65, "Kitchen", "fried-rice-grilled-chicken"),
  item("tilapia", "Grilled Tilapia", "Grilled Tilapia", 70, "Grill", "grilled-tilapia"),
  item("chicken", "Grilled Chicken", "Grilled Chicken", 55, "Grill", "grilled-chicken"),
  item("suya", "Beef Suya", "Beef Suya", 35, "Grill", "beef-suya"),
  item("kelewele", "Kelewele", "Kelewele", 20, "Snacks", "kelewele"),
  item("meatpie", "Meat Pie", "Meat Pie", 15, "Snacks", "meat-pie"),
  item("puffpuff", "Puff Puff (Bofrot)", "Puff Puff", 10, "Snacks", "puff-puff"),
  item("sobolo", "Sobolo (Hibiscus Drink)", "Sobolo", 12, "Drinks", "sobolo", false),
  item("palmwine", "Palm Wine", "Palm Wine", 25, "Drinks", "palm-wine", false),
];

export const MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(MENU.map((m) => [m.id, m]));

export type OrderType = "dine_in" | "room_service" | "takeaway";
export type Table = { id: string; label: string; code: string; name: string; seats: number; type: OrderType; zone: "Floor" | "Terrace" | "Bar" | "Rooms" | "Counter" };

export const TABLES: Table[] = [
  { id: "t1", label: "T1", code: "01", name: "Table 01", seats: 2, type: "dine_in", zone: "Floor" },
  { id: "t2", label: "T2", code: "02", name: "Table 02", seats: 2, type: "dine_in", zone: "Floor" },
  { id: "t3", label: "T3", code: "03", name: "Table 03", seats: 4, type: "dine_in", zone: "Floor" },
  { id: "t4", label: "T4", code: "04", name: "Table 04", seats: 4, type: "dine_in", zone: "Floor" },
  { id: "t5", label: "T5", code: "05", name: "Table 05", seats: 6, type: "dine_in", zone: "Terrace" },
  { id: "t6", label: "T6", code: "06", name: "Table 06", seats: 4, type: "dine_in", zone: "Terrace" },
  { id: "t7", label: "T7", code: "07", name: "Table 07", seats: 4, type: "dine_in", zone: "Terrace" },
  { id: "t8", label: "T8", code: "08", name: "Table 08", seats: 8, type: "dine_in", zone: "Terrace" },
  { id: "bar", label: "Bar", code: "Bar", name: "The bar", seats: 6, type: "dine_in", zone: "Bar" },
  { id: "room12", label: "Room 12", code: "R12", name: "Room 12", seats: 2, type: "room_service", zone: "Rooms" },
  { id: "takeaway", label: "Takeaway", code: "T/A", name: "Takeaway", seats: 0, type: "takeaway", zone: "Counter" },
];

export const TABLE_BY_ID: Record<string, Table> = Object.fromEntries(TABLES.map((t) => [t.id, t]));

/** Same defaults as src/lib/pricing.ts in the POS. */
export const BILLING = { taxRatePercent: 15, roomChargeCents: 3000 } as const;
export const OPENING_FLOAT_CENTS = 120000; // GH₵1,200.00 — the drawer's default
export const CASHIER = "Ama";
export const FIRST_ORDER_NUMBER = 10423; // the marketing receipt mock is #10422
export const MOMO_NETWORKS = ["MTN", "Telecel", "AT"] as const;
