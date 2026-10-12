# Restaurant POS — hardened source

Next.js / React / TypeScript with PostgreSQL and Drizzle ORM.
The original `11claude.zip` is retained unchanged; use the unpacked source here.

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
`python3 scripts/package-release.py --check` verifies it matches the source.
The original ZIP is retained in Git but excluded from the new source archive.
