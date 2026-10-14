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
| `/demo/` | **Live product demo** — Stage × Gallery look, Day / Evening | the POS itself | the whole system simulated in the browser: sign-in & roles, till, floor, kitchen, orders & refunds, drawer, menu, recipes, stock, purchasing, reports, audit, staff, settings, hardware — guided by a 13-step tour |

**Demo controls (any page):** keys `1`–`4` jump between directions, `←` `→` cycle, `Esc` returns to the gallery; the floating pill at the bottom does the same with a mouse.

## The live demo (`/demo/`)

An interactive, client-side simulation of the **whole product** — no backend, nothing is real. It is
linked from the Orbs page ("Open the till", "Try the live demo", "See how a shift runs") and from the
gallery. `npm run demo` serves it on :3200 with `/` redirecting straight to it.

**Look.** A premium-minimal mix of the two till concepts in `../ui-lab/till-concepts/` (B *Stage* +
C *Gallery*): no panels or cards, hairlines instead of boxes, system serif numerals, photography, one
accent colour, one pill button per screen and text links for everything secondary. Two themes expressed
purely as CSS tokens — **Evening** (near-black, mint) and **Day** (white, burnt amber) — toggled with
the sun/moon in the header or the `T` key; the layout never changes.

**Sign in.** The demo opens on a PIN screen. Pick a person; the role decides which areas the header
shows (the same matrix as `src/lib/permissions.ts`):

| Person | Role | PIN | Sees |
| --- | --- | --- | --- |
| Kofi Mensah | Owner | `1111` | everything |
| Efua Boateng | Manager | `2222` | everything except Settings / Hardware |
| Ama Owusu · Yaw Darko | Cashiers | `3333` · `3434` | Till · Floor · Kitchen · Orders · Drawer |
| Adwoa Nkrumah | Inventory | `4444` | Today · Menu · Recipes · Ingredients · Purchasing · Reports |
| Kojo Appiah | Accountant | `5555` | Today · Orders · Drawer · Reports · Audit |
| Kwame Asante | Cook | — | no terminal login (greyed out) |

"Skip the PIN" is there for impatient visitors; a physical keyboard types the PIN too.

**Areas** (header → second row):

- **Today** — the owner's morning page: gross sales, cash in drawer, food cost of what sold, stock
  value, kitchen pass time; a "Needs a look" list that deep-links to the problem (late tickets,
  unsent items, low stock, overdue deliveries, 86'd dishes, offline queue); takings by hour, tenders,
  categories, open tables, best sellers, recent audit events.
- **Service** — **Till** (table strip, dish film-strip, hairline bill, Extras: discount / tip /
  complimentary with manager PIN / guest name; Charge → cash, MoMo prompt, split, GhQR; VAT receipt),
  **Floor** (tables by zone with running totals and minutes, seat / reserve / clear / move a party /
  add a table), **Kitchen** (New → Cooking → Ready, 8 / 15-minute thresholds), **Orders** (history,
  search, reprint, **refund** with reason — a cashier needs a manager's PIN).
- **Stock** — **Menu** (availability switches that grey the dish on every till, prices, recipe cost
  and food-cost %, add / edit dishes), **Recipes & costing** (per-portion ingredients, unit cost,
  food cost % vs the 28–35 % band, gross margin; sales auto-deduct stock), **Ingredients** (stock on
  hand valued, low-stock list, waste / correction / direct-delivery adjustments with a reason, cycle
  count with variance valuation, the movement ledger), **Purchasing** (purchase orders, "fill from low
  stock", goods receipt against a supplier invoice with short-delivery handling, suppliers).
- **Money** — **Drawer** (float, sales, payouts, refunds, expected vs counted, close shift / start a
  new one — history is kept, the shift window moves), **Reports** (gross / net / VAT / value forgone /
  tips, takings by hour, tender and category splits, best sellers, by cashier, kitchen pass time;
  **real CSV downloads** — sales export and a QuickBooks / Xero journal), **Audit trail**
  (append-only: Timestamp · User · Action · Entity · Details, filter, search, export).
- **Setup** — **Staff & roles** (team list, activate / deactivate, add people with a unique PIN, the
  permission matrix), **Settings** (name, GRA TIN, VAT %, service charge, room-service charge,
  complimentary breakfast, MoMo merchant, receipt header / footer — with a live receipt preview),
  **Hardware & tenders** (ESC/POS printer IP:9100 or browser print, kitchen printer, which tenders the
  pay sheet offers, accounting export target, the Online / Offline switch).
- **Online / Offline** in the header: cash sales queue as "taken offline" and sync when you flip back;
  MoMo prompts are refused without a network.
- **Guide** ("Run the whole system", a right-hand aside on wide screens) is a 13-step tour in three
  chapters — *Front of house* (sign in, order, send, pass, MoMo, offline sale), *Back office* (receive
  PO-0417, 86 a dish, refund, change settings, export CSV) and *End of day* (close the shift, hand over
  to a cashier). Steps tick themselves from real state and "Take me there" navigates — or signs you out
  with a hint when the step needs a different role.
- Keys: `1` `2` `3` jump to Till / Kitchen / Drawer, `G` toggles the guide, `O` toggles offline, `T`
  flips Day / Evening. Everything is kept in `sessionStorage`; **Reset** starts a fresh day.

The maths mirrors the POS: integer pesewas, VAT 15 % on goods plus the GH₵ 30 room-service charge
(`src/lib/pricing-core.ts`), recipe deduction aggregated per ingredient on send / pay
(`src/lib/inventory-deduction.ts`), expected cash = float + cash − payouts − cash refunds. Kitchen status
names, the GH₵ 1,200 opening float, PO / GRN / cycle-count vocabulary and the audit wording follow the
real screens. The seed is a branch mid-shift: 12 paid bills, a refund, a payout, two open tables, a
received and an outstanding purchase order, a waste entry — so no screen is empty on first visit.

Code lives in `src/demo/`: `data.ts` (menu, tables, staff, ingredients, recipes, suppliers, settings,
hardware), `pricing.ts`, `store.tsx` (the whole state machine — one reducer, every action logged to the
audit trail; `seed()` replays real actions to build the opening state), `ui.tsx` (hairline / serif
primitives: `Money`, `Pill`, `TextLink`, `Caps`, `Modal`, `PageHead`, `Rows`, `Figure`, `Bars`, `Split`,
`Switch`, `PinPad`), `screens/*.tsx` (one file per area), `Tour.tsx` and `DemoShell.tsx` (header, groups,
permissions, keyboard). The colour tokens are the `.demo` / `.demo[data-theme="day"]` blocks at the end
of `src/app/globals.css`. The route renders client-side only (`ssr: false`) because the saved day is read
from `sessionStorage` on first paint.

## Where things live

```
marketing/
├── src/content/site.ts        ← ALL copy, dishes, order/ticket/receipt mock data, pricing, FAQ, theme list
├── src/app/                   routes: / (gallery) · /aurora · /grid · /orbs · /brutalist · /demo
├── src/demo/                  the live demo: data.ts (menu, tables, staff, stock, suppliers, settings) · pricing.ts · store.tsx ·
│                              ui.tsx (hairline / serif primitives) · screens/ (16 areas) · Tour.tsx · DemoShell.tsx
├── src/themes/<id>/Hero.tsx   the hero for that direction
├── src/themes/<id>/Page.tsx   the full page: features · how · pricing · FAQ · CTA · footer · switcher
├── src/components/shared/     Reveal, SplitText, Marquee, NumberTicker, Faq, Particles, ThemeSwitcher, Icon
├── src/app/globals.css        Tailwind theme tokens, keyframes, custom utilities (conic-sweep, border-beam, press, torn…),
│                              the demo's Evening / Day colour tokens (.demo blocks)
└── public/dishes/             720×480 copies of all 17 POS menu photos (the originals stay in ../public/menu-images)
```

## Decisions worth knowing

- **Separate app, same repo.** The POS is a login-gated terminal with `frame-ancestors 'none'`, a service
  worker and a body that never scrolls — the wrong host for a marketing page. This folder has its own
  `package.json`, builds to static files, and shares nothing with the POS runtime. The root `tsconfig`
  and ESLint config exclude it so the POS's CI stays scoped.
- **No webfonts, no third-party scripts.** System font stacks only (Inter where installed); every
  animation is CSS or Motion. The export is ~2 MB including photos.
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
of the landing-page direction; to recolour it, edit the `.demo` token blocks in `src/app/globals.css` —
every demo component reads those variables and nothing else.
