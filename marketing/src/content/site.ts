/**
 * One content model, four UIs. Every theme renders from this file, so when
 * you pick a direction you only ever edit copy here.
 *
 * Facts below come from the POS itself (README.md, src/lib/brand.ts,
 * src/lib/permissions.ts). Pricing is deliberately number-free until the
 * commercial model is decided — see `pricing`.
 */

export const brand = {
  name: "Lush View POS",
  company: "Lush View Hotel",
  tagline: "Restaurant, Bar & Hospitality POS",
  city: "Accra",
  logo: "/logo.svg",
} as const;

export const nav = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export const cta = {
  primary: "Start a free pilot",
  secondary: "See how a shift runs",
  nav: "Open the till",
  micro: "No card needed · Runs on the tablets you already own · Cash & MoMo",
} as const;

export const trust = ["Cash & MoMo tender", "GRA VAT ready", "Phone, tablet or desktop"] as const;

export type Feature = {
  icon: "wallet" | "chef" | "package" | "receipt" | "wifi" | "devices" | "shield" | "table";
  title: string;
  body: string;
};

export const features: Feature[] = [
  {
    icon: "wallet",
    title: "Cash & MoMo in one drawer",
    body: "Both tenders settle into the same shift, the same cash drawer and the same report. Refunds leave an audit trail.",
  },
  {
    icon: "chef",
    title: "Kitchen display, not paper dockets",
    body: "Send an order and the ticket is on the kitchen screen in the same second — with notes, timers and a bump button.",
  },
  {
    icon: "package",
    title: "Stock that deducts itself",
    body: "Each dish is linked to a recipe. Sell a tilapia and the tilapia count drops; low stock shows before service, not after.",
  },
  {
    icon: "receipt",
    title: "GRA VAT on every receipt",
    body: "VAT and levies are calculated by the till and printed on every receipt, so the accountant gets clean exports.",
  },
  {
    icon: "wifi",
    title: "Works when the network doesn't",
    body: "Orders queue offline and sync when the connection returns. A dropped signal never stops a sale.",
  },
  {
    icon: "devices",
    title: "Phone, tablet or desktop",
    body: "One layout from a 320px phone to the bar's touchscreen. Nothing is feature-limited on a smaller device.",
  },
];

export const steps = [
  {
    n: "01",
    title: "Take the order",
    body: "Tap the table, tap the dish, add the note. On a phone, a tablet or the bar's touchscreen.",
  },
  {
    n: "02",
    title: "Fire to the kitchen",
    body: "The ticket lands on the kitchen screen the second you send it. Stock deducts from the recipe.",
  },
  {
    n: "03",
    title: "Settle & reconcile",
    body: "Cash or MoMo, VAT on the receipt, and a shift report that matches the drawer to the cedi.",
  },
] as const;

export type Tier = {
  name: string;
  price: string;
  period: string;
  blurb: string;
  cta: string;
  featured?: boolean;
  points: string[];
};

/** Number-free on purpose: swap `price` for real figures when the model is set. */
export const pricing: Tier[] = [
  {
    name: "Pilot",
    price: "Free",
    period: "30 days · one venue",
    blurb: "Run a real shift on your own menu before you decide anything.",
    cta: "Start a free pilot",
    points: ["Full till, kitchen screen and stock", "Your menu imported for you", "WhatsApp support during service"],
  },
  {
    name: "Venue licence",
    price: "One-time",
    period: "per venue · no monthly fees",
    blurb: "Own it. The software runs on your hardware, in your building.",
    cta: "Get a quote",
    featured: true,
    points: ["Everything in Pilot", "Unlimited staff accounts & roles", "Offline mode and local backups", "Updates for the first year"],
  },
  {
    name: "Group",
    price: "Talk to us",
    period: "hotels & multi-venue",
    blurb: "Several outlets, one owner dashboard, one accountant export.",
    cta: "Book a call",
    points: ["Everything in Venue licence", "Room-service billing", "Consolidated reports", "On-site training"],
  },
];

export const faq = [
  {
    q: "Does it keep working when the internet drops?",
    a: "Yes. The till keeps taking orders and payments offline; they queue on the device and sync when the connection returns. The kitchen screen on the same local network keeps receiving tickets.",
  },
  {
    q: "Which payments does it take?",
    a: "Cash and mobile money, settled into the same shift and the same drawer report. Each payment is recorded once, even if a receipt is reprinted or a sync is retried.",
  },
  {
    q: "What hardware do we need?",
    a: "Anything with a modern browser: the phones and tablets you already own for waiters, a tablet or screen in the kitchen, and a laptop or touchscreen at the bar. No proprietary terminals.",
  },
  {
    q: "Who can see what?",
    a: "Roles are built in: cashier, cook, inventory officer, accountant, manager and owner. The accountant sees receipts, payments and the drawer ledger read-only; only the owner can delete an order, and a tombstone record is always kept.",
  },
  {
    q: "How is VAT handled?",
    a: "The till calculates VAT and levies on every sale and prints them on the receipt. Reports and CSV exports carry the same figures, so what the accountant files is what the customer was charged.",
  },
] as const;

export const dishes = {
  jollof: { name: "Jollof Rice & Grilled Chicken", img: "/dishes/jollof-rice-grilled-chicken.jpg", price: 65 },
  banku: { name: "Banku & Grilled Tilapia", img: "/dishes/banku-grilled-tilapia.jpg", price: 80 },
  sobolo: { name: "Sobolo", img: "/dishes/sobolo.jpg", price: 12 },
  kelewele: { name: "Kelewele", img: "/dishes/kelewele.jpg", price: 20 },
  suya: { name: "Beef Suya", img: "/dishes/beef-suya.jpg", price: 35 },
  waakye: { name: "Waakye", img: "/dishes/waakye.jpg", price: 45 },
  tilapia: { name: "Grilled Tilapia", img: "/dishes/grilled-tilapia.jpg", price: 70 },
  redred: { name: "Red Red", img: "/dishes/red-red.jpg", price: 40 },
} as const;

/** The open order used by the till mock-ups. */
export const order = {
  table: "Table 7 · Dine-in",
  meta: "Opened 19:42 · Ama (cashier)",
  status: "Sent to kitchen",
  lines: [
    { ...dishes.jollof, note: "1 × · extra shito" },
    { ...dishes.banku, note: "1 × · medium pepper" },
    { ...dishes.sobolo, note: "1 × · chilled" },
  ],
  subtotal: 157,
  tax: 23.55,
  total: 180.55,
  tender: "MoMo",
} as const;

/** The kitchen ticket used by the KDS mock-ups. */
export const ticket = {
  table: "Table 7",
  meta: "Ticket #0412 · fired 19:44 · Ama",
  status: "Cooking",
  items: [
    { name: dishes.jollof.name, note: "extra shito", qty: 1 },
    { name: dishes.banku.name, note: "medium pepper", qty: 1 },
    { name: dishes.kelewele.name, note: "to share", qty: 2 },
  ],
  elapsed: "4 min on the pass",
  target: "target 12 min",
} as const;

/** The printed receipt used by the brutalist mock-up. */
export const receipt = {
  number: "#10422",
  when: "14/10/2026 21:08",
  lines: [
    { qty: 1, name: "Jollof & Grilled Chicken", amount: 65 },
    { qty: 1, name: "Banku & Tilapia", amount: 80 },
    { qty: 2, name: "Kelewele", amount: 40 },
    { qty: 3, name: "Sobolo", amount: 36 },
  ],
  subtotal: 221,
  tax: 33.15,
  total: 254.15,
  tender: "MoMo (MTN) · ****4471",
  footer: "Thank you for visiting Lush View Hotel",
} as const;

export const marqueeChips = [
  "Cash & MoMo tender",
  "Kitchen display screen",
  "Recipe-linked stock",
  "GRA VAT on every receipt",
  "Works offline",
  "Table floor plan",
  "Shift & cash drawer",
  "Room-service billing",
  "Refunds with an audit trail",
  "Phone, tablet & desktop",
  "Role-based access",
  "CSV exports for the accountant",
] as const;

export const ghs = (n: number) =>
  "GH₵ " + n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The four UI directions, used by the gallery and the floating switcher. */
export const themes = [
  {
    id: "aurora",
    n: "01",
    name: "Aurora",
    mood: "dark · glass",
    modelledOn: "Aceternity UI",
    moves: "Aurora background, pointer spotlight, background beams, tilted glass till card",
    swatch: ["#05010f", "#7c3aed", "#22d3ee", "#e879f9"],
  },
  {
    id: "grid",
    n: "02",
    name: "Grid & Shimmer",
    mood: "light · bento",
    modelledOn: "Magic UI",
    moves: "Animated grid, shiny text, shimmer button, marquee, number ticker, border beam",
    swatch: ["#fafafa", "#059669", "#f59e0b", "#09090b"],
  },
  {
    id: "orbs",
    n: "03",
    name: "Orbs",
    mood: "dark · canvas · on-brand",
    modelledOn: "React Bits",
    moves: "Particle constellation, drifting orbs, split-text headline, 3D tilt ticket",
    swatch: ["#020c0a", "#34d399", "#fbbf24", "#0f766e"],
  },
  {
    id: "brutalist",
    n: "04",
    name: "Brutalist",
    mood: "paper · ink",
    modelledOn: "Promter (brutalist module)",
    moves: "Ticker, 3px borders, hard shadows that press in, monospace receipt, sticker",
    swatch: ["#f4efe6", "#111111", "#ffd400", "#ff3d2e"],
  },
] as const;

export type ThemeId = (typeof themes)[number]["id"];
