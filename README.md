# Restaurant POS — hardened source

Next.js / React / TypeScript with PostgreSQL and Drizzle ORM.
The original `11claude.zip` is retained unchanged; use the unpacked source here.

- [Deployment and database setup](GREENGEEKS_DEPLOYMENT_GUIDE.md)
- [Security model, tests, and remaining release work](SECURITY.md)

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
