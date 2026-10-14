# Hero · 04 Brutalist (paper & ink, Promter-style)

Build a brutalist hero section for **Lush View POS**, a restaurant, bar and room-service point-of-sale used in Accra, Ghana. Output a **single self-contained HTML file** (inline CSS and vanilla JS; no frameworks, fonts or CDNs). The tone is loud, honest and physical: thick ink borders, hard shadows, a ticker, a receipt. Nothing glows.

## Layout
- Top to bottom: a black **ticker band** → a boxed **nav** → the **main grid** (max 1200px; from 1000px up `7fr 5fr`, stacked below) → a row of three **step cards** (three columns from 760px).
- Nav is a row of bordered cells: brand cell (round green mark with an amber dot + "LUSH VIEW POS" in a heavy display face), link cells (hidden under 900px) that invert to black/yellow on hover, a flexible spacer, and a yellow CTA cell "Open the till →".
- Main grid, left: kicker → headline → subhead → two buttons → a row of proof tags. Right: a receipt mock-up with a round sticker overlapping its top-right corner.

## Visual system
- Paper `#f4efe6` with a faint 18px dot grid (`radial-gradient` dots at 12% ink). Ink `#111`. Yellow `#ffd400`, red `#ff3d2e`, blue `#2b4cff`, green `#17b26a`.
- Every box: `3px solid #111` border, square corners, `8px 8px 0 #111` hard shadow. Hover lifts by 2–3px and grows the shadow; `:active` pushes the box 6px into the shadow (shadow shrinks to 2px) so buttons feel pressed.
- Display face: `"Arial Black", "Helvetica Neue", Impact, sans-serif`, uppercase, weight 900. Headline `clamp(2.6rem, 7.4vw, 6rem)`, line-height 0.92, letter-spacing −0.03em, one word per visual line. The word "Friday" sits in a yellow block with its own hard shadow, rotated −1.2°.
- Body: system sans, weight 500. Receipt and tags: monospace.
- Ticker: black band, paper-coloured uppercase text, letter-spacing 0.14em, yellow ★ separators, 28s linear loop, content duplicated for a seamless wrap.
- Receipt: white, 360px, rotated −2° (straightens on hover), zig-zag torn bottom edge made with two 45° linear-gradient tiles, dashed `hr` separators, a green outlined "PAID" stamp rotated −6°, and a CSS barcode (`repeating-linear-gradient` stripes).
- Sticker: 118px red circle, white uppercase text, 3px ink border, rotated 10° with a slow 5s wobble.
- Step cards: white, number in display face with a 2px ink text-stroke and a coloured fill (yellow, red, green).
- Entrance: blocks snap in from the left using `steps(6)` timing (no smooth easing — it should feel mechanical).

## Content (use exactly)
- Ticker: Lush View POS ★ Cash & MoMo ★ Kitchen tickets ★ Stock that deducts itself ★ GRA VAT on every receipt ★ Works offline ★ Phone · Tablet · Desktop ★ No cloud fees
- Kicker: RESTAURANT · BAR · ROOM SERVICE · ACCRA
- Headline: "THE TILL THAT / KEEPS UP WITH / A **FRIDAY** NIGHT."
- Subhead: "Orders in, tickets to the pass, Cash or MoMo out — and a drawer that **reconciles to the cedi** when the last table leaves." (the bold phrase is white text on an ink block)
- Buttons: "START A SHIFT →" (ink background, yellow text, blue on hover) / "SEE THE KITCHEN SCREEN" (white)
- Proof tags: Cash & MoMo · GRA VAT · Works offline · Phone → desktop
- Receipt: "LUSH VIEW HOTEL / Restaurant & Bar · Accra / Receipt #10422 · 14/10/2026 21:08"; lines 1× Jollof & Grilled Chicken 65.00 · 1× Banku & Tilapia 80.00 · 2× Kelewele 40.00 · 3× Sobolo 36.00; Subtotal 221.00 · VAT & levies 46.41 · TOTAL GH₵ 267.41 · MoMo (MTN) · ****4471 267.41; stamp PAID; barcode; "Thank you for visiting Lush View Hotel".
- Sticker: "NO CLOUD FEES. EVER."
- Steps: 01 TAKE THE ORDER — "Tap the table, tap the dish, add the note. On a phone, a tablet or the bar's touchscreen." · 02 FIRE TO THE KITCHEN — "The ticket lands on the kitchen screen the second you send it. Stock deducts from the recipe." · 03 SETTLE & RECONCILE — "Cash or MoMo, VAT on the receipt, and a shift report that matches the drawer."

## Accessibility
- Ticker and sticker are `aria-hidden`; the receipt has `role="img"` with an `aria-label`.
- `prefers-reduced-motion: reduce` stops the ticker and wobble and shows everything immediately.
- Contrast is trivially high; keep tap targets ≥ 44px; at 390px the headline is 2.6rem and the receipt is full width.

## Avoid
Rounded corners, drop-shadow blur, gradients (except the barcode/torn-edge tricks), thin type, pastel colours, glassmorphism, emoji, external dependencies.
