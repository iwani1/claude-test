# Hero · 01 Aurora (dark, glass, Aceternity-style)

Build a hero section for **Lush View POS**, a restaurant, bar and room-service point-of-sale used in Accra, Ghana. It is the first thing a visitor sees. Output a **single self-contained HTML file** (inline CSS and vanilla JS, no frameworks, no external fonts, no CDN). If I ask for React later, keep the same structure as one component with Tailwind + Framer Motion.

## Layout
- Full-viewport section (`min-height: 100dvh`), content vertically centred, max width 1180px.
- Top nav: logo + wordmark "Lush View POS" on the left, three or four quiet links in the middle (hidden under 860px), one pill button "Open the till" on the right.
- Two columns from 1000px up (1.05fr / 0.95fr), stacked on smaller screens.
- **Left column, in this order:** eyebrow pill → headline → one-sentence subhead → primary + secondary CTA → trust line with three check-marked items.
- **Right column:** a glass product mock-up of an open order on the till, tilted slightly in 3D (`rotateY(-10deg) rotateX(5deg)`), straightening on hover, with two small floating badge cards overlapping its corners.

## Visual system
- Background `#05010f`. Text `#fafafa`, muted text `#a1a1aa`, hairlines `rgba(255,255,255,.08)`.
- Four layered background effects, all `pointer-events: none`, all behind the content:
  1. **Aurora** — four large radial-gradient blobs (violet `#7c3aed`, cyan `#22d3ee`, fuchsia `#e879f9`, a small emerald `#34d399`) blurred ~70px with `mix-blend-mode: screen`, each drifting slowly on its own 24–35s alternating keyframe.
  2. **Grid** — 64px line grid at 6% white, faded out with a radial mask so it only shows around the centre.
  3. **Spotlight** — a 640px radial highlight that follows the pointer (JS writes `--x`/`--y` custom properties, throttled with `requestAnimationFrame`).
  4. **Beams** — four 1px vertical lines, each with a short bright segment that falls from top to bottom on a 7–12s loop, staggered.
  Plus a vignette so the edges stay dark.
- Type: system sans (Inter if installed). Headline `clamp(2.6rem, 6.4vw, 4.9rem)`, weight 700, letter-spacing −0.035em, line-height 1.02. The key phrase "one screen" gets an animated gradient text fill (violet → cyan → fuchsia, slowly sliding).
- Primary CTA: white button with dark text and a coloured glow shadow; secondary: ghost button with a 1px border, backdrop blur, and an arrow that nudges right on hover.
- Glass card: 22px radius, `rgba(255,255,255,.1 → .03)` gradient, 1px white/14% border, `backdrop-filter: blur(18px)`, deep shadow, gentle 7s float.

## Content (use exactly)
- Eyebrow: pulsing green dot · **New** · Offline mode covers the whole shift
- Headline: "Run the whole floor from **one screen**."
- Subhead: "Lush View POS takes the order at the table, fires it to the kitchen, and settles it in Cash or MoMo — with the stock and the VAT already worked out."
- CTAs: "Start a free pilot" / "See how a shift runs →"
- Trust line: Cash & MoMo tender · GRA VAT ready · Phone, tablet or desktop
- Mock-up: header "Table 7 · Dine-in / Opened 19:42 · Ama (cashier)" with a green chip "Sent to kitchen"; three lines with 44px thumbnails — Jollof Rice & Grilled Chicken GH₵ 65.00, Banku & Grilled Tilapia GH₵ 80.00, Sobolo GH₵ 12.00; totals Subtotal GH₵ 157.00, VAT & levies GH₵ 33.00, Total GH₵ 190.00; a full-width gradient button "Charge GH₵ 190.00 · MoMo".
- Badges: "Kitchen · 3 tickets open / Oldest 4 min" (amber clock icon) and "MoMo received / GH₵ 190.00 · Table 7" (green check icon).

## Motion & accessibility
- Entrance: each block fades up 14px with a 0.1s stagger.
- Everything respects `prefers-reduced-motion: reduce` (no drift, beams, float, spotlight or gradient slide; content simply visible).
- Decorative layers are `aria-hidden`; the mock-up has `role="img"` and an `aria-label`.
- Must read well at 390px wide: single column, headline ≥ 2.6rem, buttons wrap.

## Avoid
Stock photography, 3D blobs as the hero image, more than two CTAs, vague headlines ("Empower your workflow"), emoji, lorem ipsum, any external script or font.
