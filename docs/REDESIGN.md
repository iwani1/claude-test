# UI redesign (Nov 2026)

The owner chose a new look for the whole app: a top navigation bar and a
three-panel till, modelled on the layout and flow of the Dreams POS restaurant
template, but **built from scratch**. No code, images, icons or text from that
paid template are in this repository; only the layout ideas are.

Reference demos (owner-approved): canvas artboards 8 (POS screen) and 9 (Orders
page), in light and dark.

## How it reaches staff

- **On by default since stage 6b.** A device with no saved choice shows the new
  design (light). A device where someone chose **Back to the classic design**
  keeps the classic design until it is switched back. Switching, either way:
  - tills and laptops: **Back to the classic design** in the top bar's account
    menu (the initials, top right), and **New design** on the classic controls
    strip;
  - phones: the same account menu in the new phone bar (stage 6b), and **Use
    the new design on this device** in the classic bar's account menu.
- **Per terminal**, like the display size: stored in `localStorage`
  (`pos.uiDesign`, `pos.uiTheme`) and applied to `<html data-ui data-ui-theme>`
  before first paint (`src/lib/ui-preferences-script.ts`, `layout.tsx`).
- **Light or dark**, chosen per terminal in the account menu.
- The classic shell is removed in its own pull request (stage 6c), once the
  new design has run through real shifts.
- Phones and portrait tablets get the new design too (stage 6a): the classic
  phone bar, tabs and drawer take the theme through the bridge, and the new
  boards show at every width. Since stage 7 the new till shows at every width
  too: below 64rem its order panel is a slide-up sheet opened from a bar with
  the running total.

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
- New-design dialogs use the kit in `src/components/ui/NewDialog.tsx`. Amount
  fields use `step="0.01"`: with a `min`, the browser measures `step` from it,
  so `step="1.00" min="0.01"` would refuse GH₵5.
- Charts use the `ui-chart-*` tokens (validated with the dataviz palette
  checks in each theme) and write every figure out as text.
- Type is Manrope (self-hosted, `@fontsource-variable/manrope`, no download at
  build or run time), set on `html[data-ui="new"]` with tabular figures.
  `font-mono` in the new design is the same face with fixed-width digits;
  money is never set in a code font. Large amounts use `ui/Money.tsx` (smaller
  currency sign).
- Depth is two levels: `shadow-ui-1` (resting cards) and `shadow-ui-2` (pop-ups,
  sheets). Motion is the `ui-in`, `ui-fade`, `ui-pop`, `ui-sheet` and `ui-slide`
  classes in `globals.css`, 160–260ms, switched off under reduced motion.
- Loading shows skeletons (`ui/Skeleton.tsx`) with a screen-reader line, not a
  bare "Loading…".
- Bar charts give the accent to the largest bar only (`ui-chart-bar`); the rest
  are `ui-chart-bar-muted`.
- Touch targets stay at least 44px; the bar's labels drop by container width in
  `rem` (they scale with the terminal's text size), not by screen breakpoints.

## Stages

| Stage | Scope | Status |
|---|---|---|
| 1 | Tokens (light/dark), per-terminal switch, top-bar shell, shared nav list | PR #39 |
| 2 | POS screen in the demo 8 layout (recent orders, category cards, dish cards, order panel); the shared pop-ups re-coloured for light through the theme bridge | PR #40 |
| 2b | Till pop-ups drawn in the new design: dish options (option groups, add-ons, note chips), payment (keypad, cash/MoMo/split), discount, comp, shift gate. Docket, receipt, approvals and confirm stay classic through the bridge | PR #41 |
| 3 | Orders page (demo 9): count cards, tabs with counts, cards or a board by kitchen state, date presets, search, pages. Same actions under the same permissions; kitchen status stays on the Kitchen screen; no cancel action is added (the app has none). Its pop-ups stay classic through the bridge | PR #42 |
| 4a | Kitchen board: columns by step (New shown only when pending tickets exist, Preparing, Ready), ticket age (amber 8 min, overdue 15), items, options, notes, one next-step button, reprint. The classic screen's sound toggle, which did nothing, is not carried over | PR #43 |
| 4b | Tables: area tabs, status counts that filter, tiles by state with the open bill (docket, total, time open), one fitting action per state; fixes the classic "Reserve" button that set a table being cleaned to available | PR #44 |
| 4c | Cash Drawer: the cash that should be in the drawer first, with the sum spelled out (float + cash sales − cash out), MoMo shown apart, colleagues on shift (managers close them), history as responsive rows. Its open, payout and close dialogs stay classic through the bridge | PR #46 |
| 4d | The daily screens' dialogs in the new design: open shift, payout, count & close (sum, live over/short, colleague note); order details and the manager-PIN refund (tender caps, retry lock unchanged); move bill (free tables as tiles) and add table. Shared kit `src/components/ui/NewDialog.tsx`. Receipt, docket and the owner's order editor and delete stay classic through the bridge | PR #48 |
| 5a | Back office (dashboard, reports, menu, recipes, stock, purchasing, staff, audit, hardware, settings, deploy) in the new shell: the work area takes the terminal's theme through the colour bridge, which now also maps the shades those screens use. Checked screen by screen, with their dialogs, in light and dark | PR #49 |
| 5b | Owner dashboard (money first, cash/MoMo split, floor and kitchen now, low stock, top sellers, categories, period switch; refused panels say so) and Reports (money received, sales and margin, top sellers, categories, free breakfasts, custom dates, exports). Shared chart marks in `dashboard/charts.tsx`, colours validated per theme (`ui-chart-*`) | PR #50 |
| 5c | Other back-office screens redrawn where it pays off | Planned |
| 6a | Phones and portrait tablets: the whole shell (phone bar, bottom tabs, drawer, notices) sits in the colour bridge, and the new boards (orders, kitchen, tables, drawer, dashboard, reports) show at every width. The till keeps its slide-up order sheet below 64rem, themed. Checked on a 390×844 phone and a 768×1024 tablet in light and dark | PR #51 |
| 7 | Premium pass from the UI/UX audit (Nov 2026): Manrope with tabular figures and no code font for money; till with a chip row of categories so dishes fill the first screen, initials tiles for dishes without a photo, add and total animations; the new till on phones with a slide-up order sheet (only the amount and actions pinned); dialogs with a blurred scrim, depth and an open animation; kitchen lanes that share the width by load, an age ring per ticket, 44px reprint; recent orders show the kitchen step, not an age bar; skeleton loading on dashboard, reports and orders; margin says "Not yet" when no recipe costs exist; accent on the largest chart bar only; the hotel's logo in the top bar; contrast and target fixes (strip counts, phone "View", menu table Edit/Delete/availability, phone Drawer badge as a dot). axe-core (WCAG 2.1 AA): 0 issues and no target under 44px on 23 screens (10 screens × light/dark at 1440×900, 3 on a phone) | PR #53 |
| 6b | The new design is the default (no saved choice → new, light); a saved "classic" choice is kept. Phones get a new top bar in the theme tokens (`PhoneTopBar.tsx`: menu, hotel mark, your shift state, offline/sync chip only when needed, quick Switch staff, account menu). The account menu is one shared component (`AccountMenu.tsx`) used by the md+ top bar and the phone bar. Built before a trial shift on a real till, at the owner's request; classic stays one tap away | PR (this) |
| 6c | Remove the classic shell and the bridge | Planned |
