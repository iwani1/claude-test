# Lush View POS — marketing site (four UI directions)

A static marketing site for the POS, built with **Next.js 16 · React 19 · Tailwind v4 · Motion**.
Four complete landing pages — hero, features, how it works, pricing, FAQ, CTA — render from
**one content file**, so choosing a direction never means rewriting copy.

```sh
cd marketing
npm install
npm run dev        # http://0.0.0.0:3100  — gallery at /, pages at /aurora /grid /orbs /brutalist, live demo at /demo
npm run build      # static export to ./out (plain HTML/CSS/JS, host anywhere)
npm start          # serve ./out on :3100 with the zero-dependency server in scripts/
npm run demo       # serve ./out on :3200 with / redirecting straight to the live demo
npm run typecheck
```

| Route | Direction | Modelled on | Signature moves |
|---|---|---|---|
| `/aurora/` | **01 Aurora** — dark · glass | Aceternity UI | aurora blobs, pointer spotlight, falling beams, tilted glass till card, floating badges |
| `/grid/` | **02 Grid & Shimmer** — light · bento | Magic UI | animated grid cells, shiny text, blur-in headline, shimmer CTA, double marquee, number ticker, border beam |
| `/orbs/` | **03 Orbs** — dark · canvas · on-brand | React Bits | particle constellation with pointer repulsion, drifting orbs, film grain, split-text headline, 3D tilt KDS ticket |
| `/brutalist/` | **04 Brutalist** — paper · ink | Promter | ticker band, 3px borders, hard shadows that press in, monospace receipt with torn edge, wobbling sticker |
| `/demo/` | **Live product demo** — *Sunbird*: cream & ink, sunflower / forest / terracotta / cobalt colour blocks, Sora + Inter | the POS itself | the whole system simulated in the browser: sign-in & roles, Today, Till, Floor, Kitchen, Orders & refunds, Drawer, Menu, Recipes & costing, Ingredients, Purchasing, Reports (CSV), Audit trail, Staff & roles, Settings, Hardware & tenders — with a guided tour |

**Demo controls (any page):** keys `1`–`4` jump between directions, `←` `→` cycle, `Esc` returns to the gallery; the floating pill at the bottom does the same with a mouse.

## The live demo (`/demo/`)

An interactive, client-side simulation of the **whole product** — no backend, nothing is real. It is
linked from the Orbs page ("Open the till", "Try the live demo", "See how a shift runs") and from the
gallery. `npm run demo` serves it on :3200 with `/` redirecting straight to it.

**Look — "Sunbird".** The warm, brand-forward concept from `../ui-lab/till-v2/3-sunbird.html`, carried
through every module: cream canvas, ink panels, four brand colours (sunflower, forest, terracotta,
cobalt) used as *colour blocks* rather than accents, a kente-stripe band under the header, Sora for
display type and Inter for everything else, 2px borders and big radii. Service modules sit in the
header; the **Back office** button (or `B`) opens a full-screen launcher of colour tiles grouped Stock ·
Money · Setup. The design system is one file, `src/demo/sunbird.css`; layout uses Tailwind utilities.
Fonts are self-hosted via `@fontsource-variable/{sora,inter}` so the export works offline.

**Sign in.** Pick a person, type the PIN (keyboard works). The role decides which modules exist for
that person — the same matrix as `src/lib/permissions.ts`:

| Person | Role | PIN | Sees |
| --- | --- | --- | --- |
| Kofi Mensah | Owner | `1111` | everything |
| Efua Asante | Manager | `2222` | everything except Settings |
| Ama Owusu · Yaw Boateng | Cashiers | `3333` · `3434` | Today · Till · Floor · Kitchen · Orders · Drawer |
| Adwoa Darko | Inventory | `4444` | Today · Menu · Recipes · Ingredients · Purchasing · Reports |
| Kojo Appiah | Accountant | `5555` | Today · Orders · Drawer · Reports · Audit |
| Kwame Tetteh | Cook | `6666` | Kitchen only |

**Modules.**

- **Today** — greeting, four colour-block stats (sales, open tables, pass, drawer), sales by hour,
  a "Needs a decision" list that deep-links (late tickets, unsent items, stock below par, no drawer,
  86'd dishes), top dishes, open tables, back-office shortcuts.
- **Till** — category colour blocks, table strip, photo tiles framed in their category colour, the
  bill as an ink panel; hover/tap a line for ± steppers, notes with presets, discounts with a reason,
  guests, move table, print bill, void (managers). **Charge** → pay sheet with Cash keypad and change
  due, MoMo by network (MTN / Telecel / AirtelTigo), Split, GhQR → receipt. Unsent items are sent
  automatically on charge; cashiers cannot remove a sent line (managers can — logged as a void).
- **Floor** — tables by zone (Floor, Bar, Rooms, Takeaway): yellow open with total and minutes,
  dashed blue reserved, stripes to clear. Seat with a guest count, reserve, cancel, clear, open in Till.
- **Kitchen** — ink screen, New → Cooking → Ready columns, live mm:ss timers, yellow at 8 min and red
  at 15 (configurable), station filter, all-day counts. Bumping marks the bill lines served.
- **Orders** — every order with filters and search; detail panel with lines, totals, payments and a
  timeline; reprint; **refund** by item or whole order (VAT share included) — a cashier is asked for a
  manager PIN; void open orders (managers).
- **Drawer** — expected cash = float + cash sales − payouts − cash refunds, event ledger with running
  balance, pay in / pay out with reasons, **count by denomination** → variance → Z summary; sessions
  history; open a new drawer with a float.
- **Menu** — dish cards with margin badges, availability switches (86'd greys the Till tile), edit
  prices (logged), add dishes with a photo.
- **Recipes & costing** — ingredient lines per dish, plated cost, gross margin vs a 65 % target,
  what-if pricing. Sales deduct stock through these recipes on payment.
- **Ingredients** — on hand vs par with status bars, used today, value; waste / recount / receive
  adjustments with reasons.
- **Purchasing** — suppliers with low-stock counts; POs Draft → Sent → Received (GRN, stock goes up by
  what you count) → Invoiced (variance flagged); new PO pre-filled from items below par.
- **Reports** — Today / 7 days / 30 days; gross, net, VAT, value forgone; by hour or day, tender
  breakdown with MoMo networks, categories, top dishes, staff; **CSV export** (real download).
- **Audit trail** — Timestamp · User · Action · Entity · Details, filters by person and action,
  search, CSV. Every sale, refund, void, discount, price change, stock move, PO step and sign-in lands here.
- **Staff & roles** — people with role badges and last sign-in, add / edit (unique 4-digit PIN,
  deactivate), the permissions matrix.
- **Settings** (owner) — business and GRA TIN, VAT % and room-service charge with a worked example,
  receipt text, KDS thresholds, reset.
- **Hardware & tenders** — ESC/POS printer (IP:9100, test print, offline simulation), drawer kick,
  kitchen screens, tender switches that change the Till's pay sheet immediately.
- **Tour** — avatar menu → "Take the tour": 14 steps that walk the modules.

Keys: `1`–`6` service modules, `B` back office, `/` search on the Till, `Esc` closes sheets. State is
kept in `localStorage` (`lushview-sunbird-v1`); **Reset demo data** (avatar menu or Settings) restores
the opening state: 12 paid orders, a partial refund, a payout, three open tables with kitchen tickets
at different ages, a reservation, a table to clear, three purchase orders at different stages.

The maths mirrors the POS: integer pesewas, VAT 15 % on goods after discounts plus the GH₵ 30
room-service charge, recipe deduction aggregated per ingredient on payment, expected cash = float +
cash − payouts − cash refunds.

Code lives in `src/demo/`: `data.ts` (types + seed), `money.ts` (pesewa maths, time, CSV), `store.tsx`
(state, every action, audit logging, persistence), `ui.tsx` (primitives: `Money`, `Badge`, `Stat`,
`Card`, `Field`, `Toggle`, `Seg`, `Stepper`, `Modal`, `Keypad`, `PinPad`), `Shell.tsx` (header, nav,
launcher, user menu, toast), `Tour.tsx`, `screens/*.tsx` (one file per module, `Office.tsx` is the
back-office page header), `sunbird.css` (the design system). The route renders client-side only
(`ssr: false`) because the saved state is read from `localStorage` on first paint.

## Where things live

```
marketing/
├── src/content/site.ts        ← ALL copy, dishes, order/ticket/receipt mock data, pricing, FAQ, theme list
├── src/app/                   routes: / (gallery) · /aurora · /grid · /orbs · /brutalist · /demo
├── src/demo/                  the live demo (Sunbird): data.ts · money.ts · store.tsx · ui.tsx · Shell.tsx · Tour.tsx ·
│                              screens/ (16 modules) · sunbird.css (the design system)
├── src/themes/<id>/Hero.tsx   the hero for that direction
├── src/themes/<id>/Page.tsx   the full page: features · how · pricing · FAQ · CTA · footer · switcher
├── src/components/shared/     Reveal, SplitText, Marquee, NumberTicker, Faq, Particles, ThemeSwitcher, Icon
├── src/app/globals.css        Tailwind theme tokens, keyframes, custom utilities (conic-sweep, border-beam, press, torn…)
└── public/dishes/             720×480 copies of all 17 POS menu photos (the originals stay in ../public/menu-images)
```

## Decisions worth knowing

- **Separate app, same repo.** The POS is a login-gated terminal with `frame-ancestors 'none'`, a service
  worker and a body that never scrolls — the wrong host for a marketing page. This folder has its own
  `package.json`, builds to static files, and shares nothing with the POS runtime. The root `tsconfig`
  and ESLint config exclude it so the POS's CI stays scoped.
- **No webfonts, no third-party scripts.** The landing pages use system font stacks only (Inter where
  installed); the demo self-hosts Sora and Inter from npm (`@fontsource-variable`), so nothing is fetched
  from a third party at runtime; every animation is CSS or Motion. The export is ~2 MB including photos.
- **Pricing is number-free** (`Free` / `One-time` / `Talk to us`) until the commercial model is decided.
  Change `pricing` in `site.ts` — nothing else.
- **Accessibility:** every decorative layer is `aria-hidden`; mock-ups carry `role="img"` labels; the FAQ
  is a real accordion (`aria-expanded`/`aria-controls`); all motion honours `prefers-reduced-motion`.
- **Prototype lineage:** the four heroes started as dependency-free HTML in `../ui-lab/`, each with the
  prompt that reproduces it. Those remain useful for testing other AI tools against the same brief.

## Picking one

When a direction is chosen: delete the other three `src/themes/*` folders and their routes, move the
winner's `Page` to `src/app/page.tsx`, drop `ThemeSwitcher`, and point the real CTAs at a form or
WhatsApp link. Everything else stays. The live demo has its own look (see above) and is independent
of the landing-page direction; to recolour it, edit the tokens at the top of `src/demo/sunbird.css` —
every demo component reads those variables and nothing else.
