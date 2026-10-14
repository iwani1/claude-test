# Hero · 03 Orbs (dark, canvas, React Bits-style)

Build an immersive dark hero section for **Lush View POS**, a restaurant, bar and room-service point-of-sale used in Accra, Ghana. Output a **single self-contained HTML file** (inline CSS, vanilla JS and one `<canvas>`; no frameworks, fonts or CDNs). The feel is React Bits: a living background, a typographic headline that animates in, and one interactive 3D card.

## Layout
- Full-viewport section, centred column (max 900px): tag pill → headline → subhead → two CTAs. Below it a stacked card mock-up (max 420px), then a three-cell "facts" strip (max 1120px) with 1px dividers. Nav on top: logo + "Lush View POS", four quiet links (hidden under 860px), pill button "Open the till".

## Visual system
- Background `#020c0a` (near-black green). Text `#ecfdf5`, muted `#8fb3a6`, mint `#34d399` / `#6ee7b7`, amber `#fbbf24`, hairline `rgba(236,253,245,.1)`. These are the brand colours (emerald mark, amber sun).
- **Particle constellation** on a full-bleed canvas: 40–110 points (scale with area, ~1 per 14,000px²), radius 0.6–2.2px, 80% mint / 20% amber, drifting at ≤0.35px per frame and wrapping at the edges. Draw a line between any two points closer than 130px, alpha fading with distance (max 0.35). Points within 120px of the pointer are pushed away with a gentle force and 1.5% velocity damping. Handle `devicePixelRatio` (cap 2), window resize, and pause the loop when the tab is hidden.
- **Orbs**: three large radial-gradient blobs (deep green `#065f46`, burnt amber `#92400e`, teal `#0f766e`), blur 90px, opacity 0.4–0.55, each on a slow 24–34s alternating drift.
- **Film grain**: an inline SVG `feTurbulence` noise tile as a background image, `mix-blend-mode: overlay`, opacity 0.5.
- **Split-text headline** `clamp(2.6rem, 7vw, 5.2rem)`, 700, letter-spacing −0.035em, line-height 1. Each word sits in an `overflow: hidden` box and rises from 110% below with a 70ms stagger. The phrase "in one tap." is italic serif (Iowan Old Style / Palatino / Georgia), weight 500, with a mint→amber gradient text fill.
- CTAs: pill buttons — primary filled mint with dark text and a mint glow; secondary glass (1px hairline, 4% white, backdrop blur) with a play icon.
- **Tilt card**: a glass kitchen-display ticket (18px radius, blur 16px, deep shadow) with two faded ghost tickets stacked behind it. On pointer move over its stage, rotate up to ±8° on X and Y with a 10px Z lift, and move a radial glare highlight to the pointer; reset on leave.

## Content (use exactly)
- Tag: amber dot · RESTAURANT · BAR · ROOM SERVICE (uppercase, letter-spaced)
- Headline: "From table to kitchen to drawer, *in one tap.*"
- Subhead: "Lush View POS runs the floor, the pass and the cash drawer as one system — so the Friday rush ends with a drawer that reconciles, not a pile of paper dockets."
- CTAs: "Start a free pilot" / "▶ Watch a ticket go through"
- Ticket: "Table 7 — Ticket #0412 · fired 19:44 · Ama", status chip "COOKING" (amber). Items: Jollof Rice & Grilled Chicken (extra shito) ×1 · Banku & Grilled Tilapia (medium pepper) ×1 · Kelewele (to share) ×2. A thin progress bar (mint→amber) creeping from 58% to 92%, caption "4 min on the pass / target 12 min", and a full-width mint button "Mark ready · bump".
- Facts: "Cash + MoMo in one drawer — Both tenders settle into the same shift and the same report." · "Works when the network doesn't — Orders queue offline and sync when the connection returns." · "Phone, tablet or desktop — One layout, from a 320px phone to the bar's touchscreen."

## Motion & accessibility
- Entrance fade-up with a short stagger; headline words first, card last.
- `prefers-reduced-motion: reduce`: draw the constellation once (no loop, no repulsion), no orb drift, no word rise, no tilt.
- Canvas, orbs and grain are `aria-hidden`; the ticket has `role="img"` with an `aria-label`.
- Keep 60fps on a mid-range phone: cap particle count, avoid shadows on the canvas, one `requestAnimationFrame` loop.

## Avoid
Purple-on-black "AI" clichés, 3D renders, more than one interactive element, text over busy parts of the canvas without contrast, emoji, external dependencies.
