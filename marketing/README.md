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
| `/demo/` | **Live product demo** — Stage × Gallery look, Day / Evening | the POS itself | a simulated shift in the browser: Till · Kitchen · Drawer, guided by a six-step checklist |

**Demo controls (any page):** keys `1`–`4` jump between directions, `←` `→` cycle, `Esc` returns to the gallery; the floating pill at the bottom does the same with a mouse.

## The live demo (`/demo/`)

An interactive, client-side simulation of the product — no backend, no login, nothing is real. It is
linked from the Orbs page ("Open the till", "Try the live demo", "See how a shift runs") and from the
gallery.

**Look.** A premium-minimal mix of the two till concepts in `../ui-lab/till-concepts/` (B *Stage* +
C *Gallery*): no panels or cards, hairlines instead of boxes, system serif numerals, photography, one
accent colour, one pill button per screen and text links for everything secondary. It ships in two
themes expressed purely as CSS tokens — **Evening** (near-black, mint) and **Day** (white, burnt
amber) — toggled with the sun/moon in the header or the `T` key; the layout never changes.

- **Till** — a strip of table numerals (01–08, Bar, R12, T/A) with the active one underlined; a
  horizontal film-strip of 4:5 dish portraits per category; the bill as a quiet hairline column with
  quantities, kitchen notes, the total as a giant italic numeral, **Charge** and a "Send … to the
  kitchen" link (fires a ticket for kitchen items only).
- **Pay** — Mobile Money (MTN / Telecel / AT, a simulated prompt that approves after ~2 s) or cash
  with quick amounts and change due; a monospace VAT receipt follows.
- **Kitchen** — New → Cooking → Ready columns divided by hairlines, live timers that turn amber after
  8 min and red after 15 (the real KDS thresholds), Start prep → / Mark ready → / Clear.
- **Drawer** — opening float, sales, cash vs MoMo, VAT collected, a ledger of every movement, cash
  payouts with a reason, and "End shift & audit drawer" (expected vs counted → over / short).
- **Online / Offline** in the header: cash sales queue as "taken offline" and sync when you flip back;
  MoMo prompts are refused without a network.
- **Guide** ("Run the shift", a right-hand aside on wide screens) ticks itself from real state and can
  navigate you to each step.
- Keys: `1` `2` `3` switch screens, `G` toggles the guide, `O` toggles offline, `T` flips Day / Evening.
  The shift (and theme) is kept in `sessionStorage`; **Reset** starts a fresh one.

The maths mirrors `src/lib/pricing-core.ts` in the POS: integer pesewas, VAT 15 % on goods plus the
GH₵ 30 room-service charge, change computed from tendered cash. Kitchen status names, the
GH₵ 1,200 opening float and the audit wording follow the real screens. Code lives in
`src/demo/` (`store.tsx` is the whole state machine; `screens/` are the three views; `Tour.tsx` is the
checklist; `ui.tsx` the primitives — `Money`, `Pill`, `TextLink`, `Caps`, `Modal`). The colour tokens
are the `.demo` / `.demo[data-theme="day"]` blocks at the end of `src/app/globals.css`. The route
renders client-side only (`ssr: false`) because the saved shift is read from `sessionStorage` on first
paint.

## Where things live

```
marketing/
├── src/content/site.ts        ← ALL copy, dishes, order/ticket/receipt mock data, pricing, FAQ, theme list
├── src/app/                   routes: / (gallery) · /aurora · /grid · /orbs · /brutalist · /demo
├── src/demo/                  the live demo: data.ts (menu, tables, billing constants) · pricing.ts · store.tsx ·
│                              ui.tsx (hairline / serif primitives) · screens/{Till,Kitchen,Drawer}.tsx · Tour.tsx · DemoShell.tsx
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
