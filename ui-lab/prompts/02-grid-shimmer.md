# Hero · 02 Grid & Shimmer (light, bento, Magic UI-style)

Build a light-theme hero section for **Lush View POS**, a restaurant, bar and room-service point-of-sale used in Accra, Ghana. Output a **single self-contained HTML file** (inline CSS and vanilla JS; no frameworks, fonts or CDNs). It should feel like a Magic UI landing page: calm, precise, with small delightful motion rather than big effects.

## Layout
- Full-viewport section, centred single column (max 880px) for the copy, then a two-row feature marquee, then a three-tile bento preview (max 1120px). Nav on top: logo + "Lush View POS", four quiet links (hidden under 860px), "Sign in" outline button.
- Order of the centred copy: announcement pill → headline → subhead → two CTAs → one line of micro-copy.
- Bento: from 820px up, columns `1.2fr 1fr 1fr`; stacked below.

## Visual system
- Background `#fafafa`, text `#09090b`, muted `#71717a`, hairline `#e4e4e7`, accent emerald `#059669` (brand green), warm accent `#f59e0b`.
- **Animated grid pattern** behind the top half: an SVG 40px line grid; a small set of cells (~28) light up emerald at 18% opacity and fade out at random (JS toggles a class every ~180ms, CSS transitions opacity over 1.4s). Fade the whole pattern with a radial mask centred near the top. Add a soft emerald radial glow behind the headline.
- **Announcement pill** with *animated shiny text*: a linear-gradient highlight that sweeps across the text via `background-clip: text` (3.2s loop). Sparkle icon left, chevron right.
- **Headline** `clamp(2.5rem, 6.4vw, 4.6rem)`, 700, letter-spacing −0.04em, line-height 1.04. Each word *blurs in* (opacity 0 → 1, blur 10px → 0, 8px rise) with a 90ms stagger. The last two words are emerald.
- **Shimmer button** (primary): near-black `#0a0a0a` button; a conic-gradient highlight (mint → white) rotates around its 1.5px border using a registered `@property --angle`, 2.8s linear loop. Secondary: white outline button.
- **Marquee**: two rows of white pill chips with coloured dots, scrolling in opposite directions (32s / 38s), content duplicated for a seamless loop, edges faded with a mask, paused on hover.
- **Bento tiles**: white, 20px radius, 1px hairline, soft shadow. The featured tile has a **border beam** — a short amber→emerald arc travelling around its border (conic gradient + mask-composite, 5s loop).

## Content (use exactly)
- Pill: "Introducing offline shifts — the till keeps selling when the network drops"
- Headline: "Every order, every cedi, *accounted for.*"
- Subhead: "One point of sale for the restaurant, the bar and room service. Orders go to the kitchen screen, stock deducts itself from the recipe, and the shift reconciles to the cedi."
- CTAs: "Start a free pilot →" (shimmer) / "Book a 20-minute demo" (outline)
- Micro-copy: "No card needed · Runs on the tablets you already own · Cash & MoMo"
- Marquee chips: Cash & MoMo tender · Kitchen display screen · Recipe-linked stock · GRA VAT on every receipt · Works offline · Table floor plan · Shift & cash drawer · Room-service billing · Refunds with an audit trail · Phone, tablet & desktop · Role-based access · CSV exports for the accountant
- Tile 1 (featured) "Live sales — Today across the till, the bar and room service." A **number ticker** counts GH₵ 0 → 4,230 over 1.8s with ease-out, "+12% vs last Tue" in emerald, and an SVG sparkline whose stroke draws in (stroke-dasharray) with a faded area fill.
- Tile 2 "Kitchen display — Tickets fire the moment the order is sent." Three ticket rows: "T7 · Jollof & Chicken — New", "T3 · Banku & Tilapia ×2 — Cooking · 6m", "Room 12 · Kelewele — Ready" with amber / blue / green status chips.
- Tile 3 "Stock that deducts itself — Each sale takes the recipe out of ingredient stock." Three progress bars that grow in: Tilapia (whole) 7 left (red, 18%), Rice (kg) 26 kg (amber, 52%), Sobolo (bottles) 43 (green, 86%).

## Motion & accessibility
- Entrance stagger of ~0.1s per block; bento tiles follow last.
- Under `prefers-reduced-motion: reduce`: no marquee, shimmer, beam, blur-in, ticker or grid flicker — show final states immediately.
- Pattern, glow and marquee are `aria-hidden`. Keep contrast ≥ 4.5:1 for body text on white.
- At 390px: pill text may wrap to two lines, buttons stack, bento becomes one column.

## Avoid
Dark mode, gradients on large surfaces, stock photos, fake customer logos (use the feature chips instead), emoji, external dependencies.
