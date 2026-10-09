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

No MySQL support. No default owner password/PIN. Existing populated databases
need a reviewed ownership conversion before cutover. Cash/MoMo are manual tender
records, not payment gateway integrations.

Release archive: `python3 scripts/package-release.py` builds `11claude-fixed.zip`;
`python3 scripts/package-release.py --check` verifies it matches the source.
The original ZIP is retained in Git but excluded from the new source archive.
