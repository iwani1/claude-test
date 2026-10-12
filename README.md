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

### Touch terminals (finger-driven use)

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
