# UI redesign (Nov 2026)

The owner chose a new look for the whole app: a top navigation bar and a
three-panel till, modelled on the layout and flow of the Dreams POS restaurant
template, but **built from scratch**. No code, images, icons or text from that
paid template are in this repository; only the layout ideas are.

Reference demos (owner-approved): canvas artboards 8 (POS screen) and 9 (Orders
page), in light and dark.

## How it reaches staff

- **Off by default.** Each stage is merged and deployed without changing what
  staff see. A terminal opts in with **New design** on the classic controls
  strip; the new top bar's account menu has **Back to the classic design**.
- **Per terminal**, like the display size: stored in `localStorage`
  (`pos.uiDesign`, `pos.uiTheme`) and applied to `<html data-ui data-ui-theme>`
  before first paint (`src/lib/ui-preferences-script.ts`, `layout.tsx`).
- **Light or dark**, chosen per terminal in the account menu.
- When every screen is done, the default flips to the new design and the
  classic shell is removed in its own pull request.
- Phones keep the current layout until a later stage. The new POS screen needs
  a 64rem-wide screen (laptop or landscape till); narrower screens keep the
  classic till and its slide-up order sheet.

## Rules for new-design code

- Colours come from the `ui-*` tokens in `src/app/globals.css` (`bg-ui-surface`,
  `text-ui-muted`, `bg-ui-primary` ...), never raw hex or the classic
  `neutral-*`/`amber-*` classes, so both themes work. Text pairs are chosen to
  meet 4.5:1 contrast in both themes.
- Navigation comes from `src/components/nav-config.ts`, the one list of screens
  and permission gates shared with the classic sidebar (`audit:workflows`
  checks it against the APIs).
- Screens reuse the existing logic: a redesigned screen changes markup and
  styling, not how orders, payments, approvals or stock work. Money paths keep
  their idempotency keys, row locks and manager-PIN checks.
- Classic components shown inside a new screen sit in `.ui-bridge`
  (`globals.css`): in the light theme it re-points the classic colour variables
  to the new tokens and darker text shades. It is a migration aid, removed with
  the classic shell.
- The till's new layout (`src/components/pos/PosNewLayout.tsx`) and its
  pop-ups (`src/components/pos/NewPosDialogs.tsx`) are presentation only:
  every value and handler comes from `PosTerminal`. The payment confirm uses
  the classic rule unchanged (`paymentBlocked`). Docket, receipt, approvals and
  confirm are shared with the classic till (`commonModals`).
- Screen-width checks go through `useMediaQuery` (`src/lib/use-media-query.ts`):
  `MD_UP` where the top bar shows, `LAPTOP_UP` for the POS layout.
- `audit:responsive` and the table check in `audit:workflows` scan component
  subfolders (`src/components/pos/`).
- Touch targets stay at least 44px; the bar's labels drop by container width in
  `rem` (they scale with the terminal's text size), not by screen breakpoints.

## Stages

| Stage | Scope | Status |
|---|---|---|
| 1 | Tokens (light/dark), per-terminal switch, top-bar shell, shared nav list | PR #39 |
| 2 | POS screen in the demo 8 layout (recent orders, category cards, dish cards, order panel); the shared pop-ups re-coloured for light through the theme bridge | PR #40 |
| 2b | Till pop-ups drawn in the new design: dish options (option groups, add-ons, note chips), payment (keypad, cash/MoMo/split), discount, comp, shift gate. Docket, receipt, approvals and confirm stay classic through the bridge | PR #41 |
| 3 | Orders page (demo 9): count cards, tabs with counts, cards or a board by kitchen state, date presets, search, pages. Same actions under the same permissions; kitchen status stays on the Kitchen screen; no cancel action is added (the app has none). Its pop-ups stay classic through the bridge | PR #42 |
| 4a | Kitchen board: columns by step (New shown only when pending tickets exist, Preparing, Ready), ticket age (amber 8 min, overdue 15), items, options, notes, one next-step button, reprint. The classic screen's sound toggle, which did nothing, is not carried over | This PR |
| 4b | Tables | Next |
| 4c | Cash Drawer | Planned |
| 5 | Menu, stock, purchasing, reports, staff, settings | Planned |
| 6 | Phones; make the new design the default; remove the classic shell | Planned |
