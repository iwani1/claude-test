# Security model and verification

## Request boundary

Every operational Next route export uses `secureRoute` (`src/lib/api.ts`).
Login is public; health performs only `SELECT 1`. All remaining API exports
require a live session and the appropriate permission. The browser is not a
security boundary. JSON mutation requests reject mismatched Origin headers.

A request acquires a transaction and an AsyncLocalStorage context. Authentication
performs a limited-purpose users/branches lookup, verifies token signature,
expiry and session version, reloads current staff role/active status, verifies
branch membership, and disables authentication lookup mode before invoking any
business handler. An error response rolls back the outer transaction, including
legacy handlers that catch exceptions themselves. Nested stock/payment
transactions use savepoints on the same connection.

`db` refuses unscoped access. FORCE RLS limits every operational table, and
composite foreign keys enforce ownership on references as well as direct rows.
A request-local PostgreSQL setting supplies branch defaults; there is no default
branch 1. Runtime credentials must be NOSUPERUSER NOBYPASSRLS, must not own the
schema, and must not be able to assume maintenance roles. Migration metadata and
policies are part of the application, not optional infrastructure.

## Authentication

Passwords and PINs use salted scrypt. A secret-keyed PIN digest enables lookup;
PIN hashes/digests are never sent to browsers. Existing PBKDF2 password hashes
are accepted only for migration compatibility and upgraded after password login.
There are no generated demo/default passwords. Tokens contain only user ID,
version and bounded timestamps; role/ownership never comes from client claims.
Signatures use constant-time comparison. Cookies are HttpOnly, SameSite=Lax and
Secure in production, and tokens are not duplicated in JSON responses.

Managers cannot create owners/managers, modify those privileged accounts, or see
PINs. PIN change/account toggle increments session version; logout revokes all
sessions for the current user. Anonymous PIN login is disabled by default.
Database-backed throttles survive failed-login transaction rollback and multiple
Node workers. Protect login endpoints with edge controls as well.

## Financial and offline integrity

Orders use menu prices, bounded integer quantities and branch-local data.
Idempotency keys serialize with PostgreSQL advisory locks and are backed by a
unique `(branch_id, idempotency_key)` index and request fingerprint. Offline
replay reuses exactly the same creation service; it never trusts paid flags or
client totals. Batch errors roll back orders, tickets, stock, and audit entries.

Payments lock the order and commit their ledger, balance and shift updates
atomically. Refunds lock the order, validate exact minor-unit amounts, check
cumulative refunds against collected funds, and require a same-branch active
manager's PIN. Partial refunds retain their own payment state. Stock restoration
uses original stock movements, not a mutable recipe; insufficient stock during
order creation causes rollback rather than a clamped/inaccurate ledger.

## Tests

`npm run test:security` starts a disposable PostgreSQL cluster, applies actual
migrations, creates a restricted runtime login, seeds multiple branches across
two restaurants, runs the Next HTTP API, and removes the cluster afterward.
It ignores an existing DATABASE_URL. Ports 15432 and 3100 must be free.
Fixtures and credentials are test-only. The original `tests/e2e.mjs` is a legacy
manual suite with obsolete demo-login assumptions, not the security gate.

Checks cover every protected method anonymously, role denial, privilege
escalation, credential redaction, tenant/branch read and write isolation,
concurrent order/payment/refund/offline operations, inventory restoration,
failed-batch rollback, session expiry/revocation, role changes, password/PIN
rotation with session revocation, and throttling.

## Known residual gaps (explicit)

- Background list loaders (inventory, purchasing, recipes lists) still refresh
  quietly when a read request fails; every **user-initiated action** now reports
  success/failure visibly, but a silent stale list during an API outage remains
  possible on read-only screens.
- `tests/e2e.mjs` is a legacy manual suite, not part of the CI gate.
- Development-tool dependency advisories remain documented in
  `docs/DEPENDENCY_REVIEW.md` pending owner acceptance.

## Remaining release work

- Rehearse a site-specific migration for any populated legacy installation;
  fresh-schema migrations do not guess ownership for old global tables.
- Cash refunds are automatically recorded as uniquely linked drawer outflows;
  finance must still reconcile actual cash handed back and MoMo reversals
  against the provider statement and drawer count. The application does not
  execute financial-network transactions.
- Complete browser/device acceptance tests (thermal printing, receipt layout,
  offline queue recovery). Automated API tests do not certify hardware behavior.
- UI lint findings have been fixed without disabling the rules. Lint with zero
  warnings is now enforced in CI. See docs/PILOT_RUNBOOK.md for on-site gates.
- `npm audit --omit=dev` is clean after updating Next/PostCSS. Development tooling
  still has transitive advisories; do not expose development/tooling servers
  publicly. Review those upgrades separately rather than force-downgrading Next.
- New SQL migrations must preserve RLS, role grants and ownership constraints.
  Never use schema push against production in place of reviewed SQL migrations.

## Verified in this change

- Production Next build: passed (Next 16.4.0).
- TypeScript check: passed, including generated Next route types.
- Production HTTP regression suite: **129 checks passed** against disposable
  PostgreSQL, plus offline-storage isolation/retention assertions, **13 synthetic
  shift reconciliation checks**, and **30 accounting checks** (refund tender
  allocation, retry idempotency, linked drawer movements, refund of old sales
  against the current shift, closed-shift immutability, refund/close races, legacy
  unallocated refunds, and event-date collection reporting).
- Injected late audit failure verified rollback of refund ledger, order state,
  and restored stock together.
- Production dependency audit: **0 vulnerabilities** at verification time.
- Full ESLint run: **0 errors and 0 warnings** after the release-check cleanup.

Offline caches/queues are now branch-keyed. Old unscoped browser queues are not
silently imported; reconcile/export any pending legacy entries before cutover.
The client submits batches of at most 50 and retains entries added while a sync
request is in flight. These storage tests use a mocked browser storage API;
real-device/offline acceptance remains necessary.

Release preparation: see [pilot runbook](docs/PILOT_RUNBOOK.md) and
[dependency advisory review](docs/DEPENDENCY_REVIEW.md). The synthetic shift
suite is part of the security test command, not a replacement for on-site acceptance.
