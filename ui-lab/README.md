# UI Lab — hero sections to compare against SceneAI

Four hero sections for **Lush View POS**, each built in the style of a different
free UI library, each a **single HTML file with no dependencies**, and each with
the **prompt that reproduces it** — the same "Copy Prompt" workflow SceneAI sells,
but using this product's real copy, dishes and GH₵ totals.

```sh
node ui-lab/serve.mjs        # http://0.0.0.0:4173  (or: npm run ui:lab)
```

Open the root URL for the comparison shell: tabs switch between variants,
Desktop / Tablet / Phone changes the preview width, **Prompt** opens the prompt
drawer with *Copy prompt* / *Download .md*. Keys: `1`–`4`, `←` `→`, `P`, `Esc`.

| # | Variant | Modelled on | Signature moves |
|---|---------|-------------|-----------------|
| 01 | **Aurora** — dark, glass | [Aceternity UI](https://ui.aceternity.com) | aurora background, pointer spotlight, background beams, tilted glass till card, floating badges |
| 02 | **Grid & Shimmer** — light, bento | [Magic UI](https://magicui.design) | animated grid pattern, shiny text, blur-in headline, shimmer button, marquee, number ticker, border beam |
| 03 | **Orbs** — dark, canvas | [React Bits](https://reactbits.dev) | particle constellation with pointer repulsion, drifting orbs, film grain, split-text headline, 3D tilt card |
| 04 | **Brutalist** — paper & ink | [Promter](https://promter.dev/resources/) brutalist module | ticker marquee, 3px borders, hard shadows that press in, monospace receipt, rotating sticker |

## Files

```
ui-lab/
├── index.html, lab.css, lab.js   comparison shell (iframe + tabs + prompt drawer)
├── heroes/0N-*.html              the four heroes — self-contained, copy one anywhere
├── prompts/0N-*.md               the prompt that reproduces each hero (paste into Claude, v0, Lovable, Bolt, Cursor)
└── serve.mjs                     zero-dependency static server
```

## How to use the prompts

1. Open a variant, press **P**, **Copy prompt**.
2. Paste into Claude / v0 / Lovable / Bolt and compare *their* output to the file in `heroes/`.
   That difference is the honest measure of what a prompt library buys you.
3. To re-skin for another product, change only the **Content (use exactly)** block.

## Deliberate boundaries

- **Not part of the POS app.** Nothing under `src/` imports this folder, Next.js does
  not serve it, and the POS's CSP / `frame-ancestors 'none'` is untouched. The lab has
  its own tiny server because the POS is intentionally un-iframeable.
- `serve.mjs` also exposes the repo's `public/` folder at `/assets/` so the mock-ups can
  use the real menu photos and logo. It serves only those two directories and refuses
  path traversal. It is a development tool, not a production server.
- No external fonts, scripts or images: everything renders offline, which is the same
  constraint the POS itself works under.
- All motion honours `prefers-reduced-motion`; decorative layers are `aria-hidden`.

## Next step

The four heroes were ported to a real **Next.js + React + Tailwind + Motion** site with full pages
(features, how it works, pricing, FAQ) in [`../marketing/`](../marketing/README.md).

## Till concepts — round 2 (`till-v2/`)

Three fresh directions for the Till screen, nothing shared with the earlier
A/B/C set except the data. One shared behaviour file (`till.js`: menu, tables,
running bill, VAT, pay sheet with Cash / MoMo / Split) and three completely
separate pages that style it:

| # | Concept | Language |
|---|---------|----------|
| 1 | **Ember** | dark, touch-first iPad POS — coral→orange gradient, category colour dots, icon rail, keypad pay sheet |
| 2 | **Atlas** | light modern SaaS — sidebar with every module, white cards on grey, one blue, stats strip, keyboard hints |
| 3 | **Sunbird** | warm, brand-forward — cream/ink with sunflower, forest, terracotta, cobalt colour blocks; Sora headings; ink ticket panel |

```sh
ROOT_REDIRECT=/till-v2/ node ui-lab/serve.mjs   # opens straight on the chooser
```

The chooser (`till-v2/index.html`) shows all three as live, scaled previews.
**Sunbird was chosen** and is now the language of the full live demo in
`../marketing/src/demo/` (`npm run demo` in `marketing/`, port 3200).
