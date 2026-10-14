# Restaurant POS — hardened source

Next.js / React / TypeScript with PostgreSQL and Drizzle ORM.
The original `11claude.zip` is kept on the owner's machine only and is not in Git; use the source here.

- [Deployment and database setup](GREENGEEKS_DEPLOYMENT_GUIDE.md)
- [Security model, tests, and remaining release work](SECURITY.md)
- [One-branch pilot and sign-off checklist](docs/PILOT_RUNBOOK.md)
- [Development dependency advisory review](docs/DEPENDENCY_REVIEW.md)

```sh
npm ci
# Configure .env from .env.production.example; see deployment guide first.
npm run db:migrate     # uses separate MIGRATION_DATABASE_URL
npm run db:bootstrap   # new empty installations only, explicit credentials
npm run typecheck
npm run test:security  # disposable PostgreSQL, no production data
npm run build
npm start
```

Branding (name, logo, titles, export filenames) lives in `src/lib/brand.ts`
and `public/logo.svg`; receipt business details are managed in Restaurant Settings.

### Order deletion (owner only)

The super-admin account gets a trash button on each row of **Order History**,
confirmed by a two-button dialog. Deletion **erases** the order: its lines,
payments, refunds (+ their drawer movements), kitchen tickets and any audit
entries pointing at it. Stock the order had deducted returns to inventory, and
the shift's running sales/cash/MoMo totals are rolled back so the drawer still
reconciles to the sales that remain. There is no undo, and no other role —
including managers — can reach it.

The order's operational records are erased completely (no copy in Order
History, reports or the audit log). One minimal record *is* kept, in the
`order_deletion_tombstones` table: order number, total/paid/refunded amounts,
who deleted it and when, written in the same transaction as the deletion.
It is not shown in any screen and the app can never delete it — it exists so
an operator or accountant with database access can still prove a deleted
order existed. Keep your own till or accounting records as well if you need
line-item evidence: the tombstone holds totals only, not items or payments.

### Roles: who can reach what

The till roles handle money; the finance role reads it. **Accountant / Finance**
gets **Order History** (receipts, items, payments, refunds) and the **Cash
Drawer** ledger — read-only: no refund, no re-price, no deletion, no opening or
closing a shift, no till. Reports, the activity log and the CSV reconciliation
export work as before, and the dashboard says *"Not available to your role"* on
the floor, kitchen and stock panels rather than printing zeros as fact.

`canViewOrderHistory` and `canViewDrawerHistory` in `src/lib/permissions.ts` are
the one question asked by the menu, the screen and the API gate. They used to
disagree — the menu offered both tabs to anyone who could see reports, while the
APIs behind them demanded till access — which opened Order History onto a `403`
for finance, with dashboard panels showing `GH₵0` where their requests had been
refused. `npm run audit:workflows` fails (rule 7) if a menu tab and the API gate
behind it ever disagree again.

### Devices — phone, tablet, laptop, desktop

One layout serves every screen; nothing is feature-limited on a smaller device.

- **Phones (under 768px)** — the navigation rail becomes a slide-in drawer behind
  the **Menu** button, the till shows the open order as a **slide-up sheet** with a
  running `Cart · n items · GH₵…` bar along the bottom, and every data table
  (Order History, Ingredient Stock, Menu Items, Shifts, Reports, Audit Logs)
  becomes a **card list** with full-size buttons instead of 26px icons.
- **Tablets (768px and up)** — the icon rail is permanently visible and the till
  is side-by-side again (menu + order panel), which is the layout the bar and
  wait stations use.
- **Laptops and desktops** — unchanged: full rail, full tables, keyboard focus
  rings, and the POS quick-jump bar.
- **The five screens a shift lives in** — Till, Tables, Kitchen, Orders and
  Drawer — also sit in a **bottom tab bar** on phones, within thumb reach, with
  the open-table count and the drawer's Open/Closed state as badges. The drawer
  keeps the full menu, so nothing becomes unreachable.
- **Rotation and resizing** are handled live: a phone rotated into a width that
  can hold the rail closes the drawer instead of leaving a dimmed overlay.
- **Notches and home indicators** are respected (`viewport-fit=cover` plus
  safe-area padding on the drawer, cart bar and bottom sheets), and the shell
  uses `dvh` so mobile browser toolbars never clip the till.
- **Zoom is allowed** on phones and tablets (double-tap zoom stays suppressed so
  taps remain immediate), and the per-device **display size** control in the top
  bar still scales the whole UI — pick *Standard* on a phone for the most
  content per screen.

`npm run audit:workflows` re-checks the rules about telling the truth to the
person at the till: no swallowed failures in client code, money routes stay
idempotent, routes keep their permission check, and screens keep a phone view.
`npm run audit:responsive` re-checks the structural rules this depends on
(tables scroll or become cards, dialogs scroll on short screens, no `h-screen` /
`w-screen` in an app that lives inside mobile browser chrome). It exits non-zero
if a new screen breaks one of them.

### Working with no signal (offline)

The floor loses signal; a shift cannot. The app is built so that losing the
network slows the writing down, never the truth.

- **The app itself opens offline.** A small service worker (`public/sw.js`)
  stores the app shell and the build's scripts after the first visit, so a
  reload with no signal still loads the till. It is registered in production
  builds only — in development it would fight hot reload.
- **What carries over**: the menu, the floor plan, the room charge and VAT last
  confirmed by the server, and the drawer open/closed state. What never does:
  stock levels, live orders, other people's data, and anything to do with money.
  `/api/` responses are never cached — a stale price or a stale payment is worse
  than no answer.
- **Orders queue on the device** (localStorage, scoped per branch) when the
  connection drops mid-service, and **sync automatically** the moment the server
  is reachable again — the top bar has a manual **Sync** button as well. Whether
  the order actually landed on the device is verified before the till clears the
  ticket, so "saved" is never claimed on a device that could not store it.
- **An order is queued UNPAID, always.** Only the server may mark money as
  collected, and the offline sync endpoint rejects anything already flagged as
  paid. If you take cash while offline, record the payment from **Order History**
  after the sync, or the drawer will not reconcile.
- **Payments never happen offline.** Tapping *Pay* with no connection queues the
  order instead and says so, including the amount you are holding.
- **One ticket, one order identity.** Retrying a send that died halfway cannot
  ring the same food twice: the server de-duplicates on the ticket's id key.
- **Retries and notices** appear as in-app notices (they never block the screen —
  a phone mid-service cannot wait for an "OK" tap).
- **Session restore**: a device that signed in within the last 12 hours reopens
  the till offline; after that, or after signing out, it asks for the network,
  because a local copy of who you are is not proof of who you are.

### Audits

`docs/SYSTEM_AUDIT.md` is the full pass over the system (access control, money,
stock, feedback, devices, deployment): what was verified and how, what was fixed,
what is still open, and what cannot be checked without hardware or the server.
Re-run it with:

```sh
npm run test:security      # 239 security + 80 pilot + 30 accounting checks
npm run audit:responsive   # phone/tablet/laptop layout rules
npm run audit:workflows    # failure-feedback, money-guard and schema-guard rules
```

Continuous integration (`.github/workflows/security.yml`) runs the same gates on
every push and pull request — the release-archive check, lint, typecheck, both
static audits, the legacy-import test, the full security suite and a
production-dependency audit — so a regression is caught on the branch rather than
on the till. The archive check is built for the way CI runs: a branch merged with
`main`, which is where the owner's uploaded database backup has lived. Data files
(`.db`, `.sqlite`, `.dump`) are never packaged and never required, but any other
new file still makes a stale archive fail.

The app reports a database that has not run this version's migrations instead of
failing obscurely: `/api/health` answers `{"ok":false,"reason":"schema-behind"}`
and any operation that needs a missing column answers `503` naming it and the
command that fixes it (`npm run db:migrate`). Everything else keeps working, so a
half-applied deploy degrades the till rather than stopping the venue.
`scripts/audit-workflows.py` fails when a migration adds a column that
`src/lib/schema-guard.ts` does not list, and when a menu offers a tab to a role
the API behind it refuses (rule 7).

A database the app cannot *reach* at all is named too, so it never reads as a
wrong password: `/api/health` answers `{"ok":false,"reason":"database-unreachable"}`
and sign-in explains that the server's own connection is down (verified against
a wrong password and a stopped service).

### Editing a saved order (owner only)

The same account gets a pencil button on each row of **Order History**. The
editor changes lines and quantities, the order type (dine-in / room service /
takeaway / delivery), the table or room, guest details, discount, tip and notes.
Every price is recalculated on the server from the menu and the billing
configuration — the browser's numbers are never trusted — and stock is re-synced
to exactly what the saved lines require, using the movement ledger's **net** so
a second edit can never hand back stock that was already returned. Open kitchen
dockets are refreshed to the corrected lines; completed ones are left alone.

Money is never adjusted silently:

- **Editing up** leaves the order open showing **"Collect GH₵X more"**; it only
  reads *paid* again once the money matches.
- **Editing below what was collected is refused** with an explanation. An order
  can never hold more money than its bill, so it is not half-saved; either raise
  the total or refund the order and ring up the correct bill.
- **Once anything has been refunded** against an order, its items, discount and
  tip are locked (guest details and notes still save). Re-pricing would rewrite
  what the drawer already recorded.

Edits are the owner's decision and are not written to the activity log: the
order shows the new amounts, but the system keeps no before/after record of the
change.


- **Display size** — the control in the top bar cycles **Standard (16px)** →
  **Large (18px, default)** → **Extra large (20px)**. The whole UI is rem-based,
  so one value scales text, buttons, gaps and padding together; the choice is
  saved per device and applied before first paint. In the two enlarged modes no
  button or input may be shorter than 45–50px.
- **Destructive taps ask first** — New Ticket, Clear and Remove-line open a
  two-button confirmation instead of silently discarding work.
- **The open ticket is a draft** — tapping Tables/Orders/Drawer, or an app
  restart, no longer loses a half-taken order; it is restored for the same
  staff member for up to 12 hours. "New Order" clears it (after confirming).

No MySQL support. No default owner password/PIN. Existing populated databases
need a reviewed ownership conversion before cutover. Cash/MoMo are manual tender
records, not payment gateway integrations.

Release archive: `python3 scripts/package-release.py` builds `11claude-fixed.zip`;
`python3 scripts/package-release.py --check` verifies it matches the source. CI builds
it on every run and keeps it as the `pos-release-archive` artifact (90 days). The
archive is git-ignored, never committed. The original ZIP is kept on the owner's
machine, not in Git, and is excluded from the release archive.
