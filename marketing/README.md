# Lush View POS — marketing site (four UI directions)

A static marketing site for the POS, built with **Next.js 16 · React 19 · Tailwind v4 · Motion**.
Four complete landing pages — hero, features, how it works, pricing, FAQ, CTA — render from
**one content file**, so choosing a direction never means rewriting copy.

```sh
cd marketing
npm install
npm run dev        # http://0.0.0.0:3100  — gallery at /, demos at /aurora /grid /orbs /brutalist
npm run build      # static export to ./out (plain HTML/CSS/JS, host anywhere)
npm run typecheck
```

| Route | Direction | Modelled on | Signature moves |
|---|---|---|---|
| `/aurora/` | **01 Aurora** — dark · glass | Aceternity UI | aurora blobs, pointer spotlight, falling beams, tilted glass till card, floating badges |
| `/grid/` | **02 Grid & Shimmer** — light · bento | Magic UI | animated grid cells, shiny text, blur-in headline, shimmer CTA, double marquee, number ticker, border beam |
| `/orbs/` | **03 Orbs** — dark · canvas · on-brand | React Bits | particle constellation with pointer repulsion, drifting orbs, film grain, split-text headline, 3D tilt KDS ticket |
| `/brutalist/` | **04 Brutalist** — paper · ink | Promter | ticker band, 3px borders, hard shadows that press in, monospace receipt with torn edge, wobbling sticker |

**Demo controls (any page):** keys `1`–`4` jump between directions, `←` `→` cycle, `Esc` returns to the gallery; the floating pill at the bottom does the same with a mouse.

## Where things live

```
marketing/
├── src/content/site.ts        ← ALL copy, dishes, order/ticket/receipt mock data, pricing, FAQ, theme list
├── src/app/                   routes: / (gallery) · /aurora · /grid · /orbs · /brutalist
├── src/themes/<id>/Hero.tsx   the hero for that direction
├── src/themes/<id>/Page.tsx   the full page: features · how · pricing · FAQ · CTA · footer · switcher
├── src/components/shared/     Reveal, SplitText, Marquee, NumberTicker, Faq, Particles, ThemeSwitcher, Icon
├── src/app/globals.css        Tailwind theme tokens, keyframes, custom utilities (conic-sweep, border-beam, press, torn…)
└── public/dishes/             720×480 copies of the POS menu photos (the originals stay in ../public/menu-images)
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
WhatsApp link. Everything else stays.
