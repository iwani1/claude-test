# PostgreSQL deployment guide

## Supported architecture

This application requires **Node.js 22 LTS and PostgreSQL 16+**. It does **not**
support MySQL/MariaDB. A cPanel MySQL database or importing the old MySQL SQL file
will not work. Check that your GreenGeeks plan supports a persistent Node service,
reverse proxy, and connections to a PostgreSQL server. Otherwise choose suitable
Node/PostgreSQL hosting. Provider-specific Passenger setup must be verified with
the host; this project uses `next start`, not a nonexistent `server.js`.

The repository root is the hardened source. `11claude.zip` is the **unchanged,
insecure original archive**, retained only for reference. Do not deploy it.

## 1. Install and configure

```sh
npm ci
cp .env.production.example .env
openssl rand -hex 48  # generate AUTH_SECRET locally; put it in your secret manager/.env
chmod 600 .env
```

Install development dependencies for the build: TypeScript, PostCSS and Tailwind
are build tools. Do not run `npm install --omit=dev` before building. Set
`DATABASE_URL` to your runtime PostgreSQL connection string. Configure TLS with
certificate verification for remote PostgreSQL; do not disable verification.

Set `APP_ORIGIN` to the exact public HTTPS origin. Configure the reverse proxy to
preserve the public `Host` header, enforce HTTPS, limit request bodies to 1 MB,
and apply edge rate limits. Never expose the Node port or the database publicly.
Secure cookies are enabled automatically in production.

## 2. Create a new database and apply migrations

Use a maintenance login for migrations and bootstrap; keep that credential out
of the running application's environment. The runtime login MUST NOT own the
schema/tables, be a superuser, or have `BYPASSRLS`. The API refuses privileged
runtime connections. Do not grant it membership in the maintenance role.

```sh
# Supply through your secret manager/shell environment, not committed files:
export MIGRATION_DATABASE_URL='postgresql://MAINTENANCE_LOGIN:URL_ENCODED_PASSWORD@DB_HOST:5432/pos'
npm run db:migrate
```

The migration runner applies SQL files in order, transactionally, with an
advisory lock and checksums. It is safe to rerun. `0000` creates the schema;
`0001` installs mandatory FORCE row-level security, branch foreign keys and
unique indexes; `0002` adds order fingerprints. **Do not use `drizzle-kit push`**
as a substitute: it does not install the handwritten security policies.

As database administrator, provision a unique password and grant the runtime
role access (replace the role name if needed):

```sql
CREATE ROLE pos_runtime LOGIN NOSUPERUSER NOBYPASSRLS;
-- Set its password using your database administrator's secure tooling.
GRANT CONNECT ON DATABASE pos TO pos_runtime;
GRANT USAGE ON SCHEMA public TO pos_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pos_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pos_runtime;
REVOKE ALL ON schema_migrations FROM pos_runtime;
REVOKE INSERT, UPDATE, DELETE ON security_meta FROM pos_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

Reapply appropriate grants when a future migration introduces tables. Database
functions do not use SECURITY DEFINER. Without an authenticated request scope,
the runtime role cannot read operational rows. Branch IDs are global IDs;
composite foreign keys prevent records from referencing another branch's data.

## 3. Bootstrap an owner — no demo credentials

For a **new empty database**, supply `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD`
(12–256 characters), optionally `BOOTSTRAP_PIN` (4–8 digits), and optionally
`BOOTSTRAP_RESTAURANT` through your secret manager/environment, then run:

```sh
npm run db:bootstrap
unset MIGRATION_DATABASE_URL BOOTSTRAP_PASSWORD BOOTSTRAP_PIN
```

Bootstrap requires a maintenance role with `BYPASSRLS` or superuser access; it
refuses an existing installation and never truncates data. It creates only an
owner, restaurant, and branch. Sign in using email/password, configure tax rates
with your accountant, and create/import your menu and stock before trading.
The initial tax rate is zero to force an explicit business configuration decision.

## Existing installations: stop and plan the data migration

The provided migration chain targets a **fresh PostgreSQL database**, not an
in-place upgrade of the original archive's populated schema. It deliberately
fails instead of silently assigning existing global stock, settings, recipes,
or suppliers to an arbitrary branch.

For a live installation, take a tested backup, stop writes, and migrate into a
new database. Map each legacy row and every dependent record to its verified
branch; explicitly duplicate genuinely shared catalog records where required.
Resolve duplicate PINs and idempotency keys; hash PINs using the new scrypt/hash
lookup helpers (or reset them). Preserve monetary and stock ledgers, compare
row counts and balances, and rehearse the cutover with a restored backup first.
A site-specific data conversion is required; do not run the old destructive seed
or automatically mark baseline migrations as applied. All old sessions are invalid.

## 4. Validate, build, start

```sh
npm run typecheck
npm run test:security  # isolated PostgreSQL; never points at the live database
npm run build
npm start             # binds 0.0.0.0, defaults to port 3000
```

Use your hosting process manager/systemd/container supervisor for restarts.
Only expose HTTPS through the reverse proxy. `/api/health` is the sole public
read endpoint and returns minimal availability information. Login is the sole
public write endpoint. No offline-sync cron is needed: authenticated terminals
submit their local queue after reconnecting.

## Operating constraints

- A user, including an owner, operates within **one assigned active branch**.
  No cross-branch owner bypass is provided. Provision accounts deliberately.
- Password login is the default. Anonymous PIN login is disabled unless
  `PIN_LOGIN_BRANCH_ID` explicitly pins the deployment to one branch. PIN switch
  requires an existing session and stays within that branch. Low-entropy PINs
  should be used only on controlled terminals.
- Sessions expire after eight hours. Logout revokes all sessions for that user.
  Active status and roles are checked on each request. PIN changes revoke sessions.
- `AUTH_SECRET` must be at least 32 random characters. Rotating it invalidates
  sessions **and PIN lookup digests**; reset/re-enroll PINs as part of rotation.
- Login, PIN switch and refund approvals use database-backed throttles. These
  prioritize brute-force resistance and can temporarily lock a shared branch;
  deploy edge abuse controls and monitor 429s. Remove expired `auth_attempts`
  records periodically using a maintenance job, not a public application endpoint.
- Offline sync accepts at most 50 unpaid orders with stable idempotency keys.
  The entire batch commits or rolls back, prices are recalculated at sync time,
  and successful retries are recognized. Record money afterward via payment API.
- Cash and MoMo are **manual recording**, not gateway charges or automatic
  refunds. Refunds retain gross collected amounts and a separate refund ledger;
  reconcile actual cash/MoMo disbursements and drawer payouts operationally.
- Partial refunds cannot restore whole-order stock. Final refunds can restore
  the quantities actually deducted, even if recipes have changed.
- Discounts and complimentary orders now require manager/owner authority.
- Back up PostgreSQL and rehearse restore, monitor application errors and stock
  reconciliation, and rotate initial credentials before go-live.
