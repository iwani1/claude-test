# Findings register

**This is the single source of truth for audit status.** Dated audit reports in
`docs/AUDIT_*.md` and `docs/PRODUCTION_READINESS_*.md` are point-in-time snapshots; they
are never edited to say something was fixed. This file is.

- **Last full verification:** 2026-11-17 (second pass) against `main` @ `4eca07d` (after PR #36): every Open row re-checked, no new findings. See [`AUDIT_2026-11-17-2.md`](AUDIT_2026-11-17-2.md).
- **How a status changes:** see [Rules](#rules). A row says *Fixed* only when the fix is
  merged to `main` and the row names the PR and how it was verified.

## Status key

| Status | Meaning |
|---|---|
| **Open** | Confirmed problem, not fixed on `main` |
| **In progress** | A PR exists (linked) but is not merged |
| **Fixed** | Merged to `main`; PR and verification recorded |
| **Accepted** | Owner decided to keep the behaviour; decision and date recorded |
| **Owner action** | Cannot be fixed in code (repository settings, credentials, server) |

A fix that exists only in someone's local copy, an AI builder's sandbox, or directly on
the VPS is **not** fixed: it is lost on the next deploy and invisible to audits.

## Summary (2026-11-17, re-verified @ `4eca07d`)

| Severity | Open | Owner action | Fixed | Accepted |
|---|---|---|---|---|
| Critical | 0 | 1 | 1 | 0 |
| High | 0 | 1 | 4 | 0 |
| Medium | 1 | 1 | 7 | 0 |
| Low / Info | 12 | 0 | 3 | 0 |

## Go-live blockers

N2 (owner action; owner has deferred making the repo private, see its row) and P1 (owner action: install the backup job on the server, Phase 10). N3, N4, N5 and P2 are fixed in PR #37. See the go-live checklist in
[`PRODUCTION_READINESS_2026-11-17.md`](PRODUCTION_READINESS_2026-11-17.md).

## Application findings — [`AUDIT_2026-11-17.md`](AUDIT_2026-11-17.md)

| ID | Sev | Title | Status | Fixed by / decision | Verified | Where to look |
|---|---|---|---|---|---|---|
| N1 | Critical | Next.js 16.4.2 vulnerable (GHSA-mfr8-8qww-v76h); build and CI blocked | **Fixed** | PR #34 (`84e2b77`): `next` and `eslint-config-next` ^16.4.6 | 2026-11-17: `next` 16.4.6 installed, `npm audit --omit=dev` 0 vulnerabilities, `npm run build` passes | `package.json` |
| N2 | Critical | Repo public; `2026-10-12_restpos.db`, `2026-10-15_restpos.db`, `11claude.zip` retrievable from history | **Owner action** | **Owner decision 2026-11-17: keep the repository public for now; making it private is deferred, not declined.** This is not *Accepted*: the finding stays open and remains a go-live blocker. Interim: rotate legacy credentials reused in the new system (staff passwords/PINs, `pos_owner`); push nothing sensitive. When going private, also purge the blobs from history. | 2026-11-17: repo still `public`; blobs present in history | GitHub settings; history at `ad6e134^`, `be3524e^`, `4cbbc90^` |
| N3 | High | Till staff can remove or swap items on an open bill; no approval, no audit | **Fixed** | PR #37 (`3410660`): removing or reducing lines on a kitchen order needs a manager PIN from till staff; every removal logged as `order_items_removed` with actor, approver and items | `tests/security.ts` N3 checks (refused without PIN and unchanged; non-manager PIN refused and counted; manager PIN approves; logged; additions need no PIN; drafts need no PIN but are logged) | `src/app/api/orders/[id]/edit/route.ts`, `src/lib/manager-approval.ts`, `src/components/ManagerApprovalModal.tsx` |
| N4 | High | Any till user can cancel an unpaid order; audit row has no actor; stock returned | **Fixed** | PR #37 (`3410660`): cancelling a kitchen order needs a manager PIN (owner/order-editors exempt); `order_cancelled` row records actor, approver, items and stock return; all order status rows name the actor | `tests/security.ts` N4 checks (refused without PIN and order stays open; manager PIN approves; logged with cashier and manager; draft cancel needs no PIN; owner cancel logged) | `src/app/api/orders/[id]/route.ts` `handlePATCH` |
| N5 | High | PIN-collision message lets a manager enumerate PINs, then quick-switch to the owner | **Fixed** | PR #37 (`888630f`): quick PIN switch refuses the owner account; PIN collisions limited to 3 per 15 min per person setting PINs, counted outside the transaction and logged (`pin_collision`) | `tests/security.ts` N5 checks (collisions counted despite rollback; 4th attempt 429; limit is per person; owner's correct PIN does not switch) | `src/app/api/auth/switch-pin/route.ts`, `src/app/api/staff/route.ts` |
| N6 | Medium | Refund approver and discount checks use role, not effective permissions | **Fixed** | PR #37: three owner-selectable permissions, default on for manager and owner only: `canApplyDiscounts` (discounts/complimentary at order creation), `canApproveRefunds` (whose PIN authorises a refund; separate from requesting, so finance cannot self-approve), `canApproveVoids` (whose PIN works in the till's removal/cancel prompt). Refund, create-order and manager-approval checks read effective permissions | `tests/security.ts` N6 checks: default manager approves; barred manager refused for refunds and removals; allowed cashier approves both; finance cannot approve by default; allowed cashier can discount; barred manager cannot | `src/lib/permissions.ts`, `src/app/api/orders/[id]/refund/route.ts`, `src/lib/create-order.ts`, `src/lib/manager-approval.ts` |
| N7 | Medium | Ten audit-log inserts record no `userId` or `userName` | **Fixed** | PR #37: order status rows (with N3/N4), then the nine menu, ingredient, recipe, stock-count, purchase-order, goods-receipt and supplier rows now spread `auditActor()` (`src/lib/audit.ts`). `audit:workflows` rule 9 refuses any audit insert that names no actor. Money in those rows now reads GH₵, not $ | `tests/security.ts` N7 checks (supplier and ingredient created by the inventory officer are logged with their id and name); rule 9 shown to fail on a removed actor | `src/lib/audit.ts`, `scripts/audit-workflows.py` rule 9 |
| N8 | Medium | Photo data URLs overflow the `localStorage` menu cache; offline till keeps stale menu | Open | — | 2026-11-17 @ `06126e9` | `src/lib/offline-storage.ts`, `src/components/MenuManager.tsx` |
| N9 | Low | Order GET uses `SELECT … FOR UPDATE` | Open | — | 2026-11-17 | `src/app/api/orders/[id]/route.ts` `handleGET` |
| N10 | Low | Order status can move backwards; malformed id becomes a 500 | Open | — | 2026-11-17 | `src/app/api/orders/[id]/route.ts` `handlePATCH` |
| N11 | Low | `Origin: null` causes a 500; body cap trusts `Content-Length` | Open | — | 2026-11-17 | `src/lib/api.ts` `checkRequest` |
| N12 | Low | Re-price without discount or tip fields zeroes them (latent) | Open | — | 2026-11-17 | `src/app/api/orders/[id]/edit/route.ts` |
| N13 | Low | PIN throttles are branch-wide (one person can block everyone) | Open | — | 2026-11-17 | `src/app/api/auth/switch-pin/route.ts`, refund route |
| N14 | Info | Dev-only dependency advisories: full-tree `npm audit` reports 21 (12 moderate, 9 high), including **high-severity `picomatch`**, plus `esbuild` and `minimatch`. The production tree is clean (`npm audit --omit=dev`: 0) | Open (tracked) | Standing policy: no `--force`; review the dev-tool upgrades separately | 2026-11-17 @ `06126e9`: full `npm audit` 21 (12 moderate, 9 high); `--omit=dev` 0 | `npm audit` |
| N15 | Low | Closing or editing another person's shift is gated by job title (`manager`/`super_admin`), not a permission the owner can set | Open | Found while fixing N6 (2026-11-17). Same pattern as N6: add an owner-selectable permission (e.g. `canManageOthersShifts`) and use it in the route and the drawer screen | 2026-11-17 | `src/app/api/shifts/route.ts` (two checks), `src/components/ShiftCashDrawer.tsx` |

## Production findings — [`PRODUCTION_READINESS_2026-11-17.md`](PRODUCTION_READINESS_2026-11-17.md)

| ID | Sev | Title | Status | Fixed by / decision | Verified | Where to look |
|---|---|---|---|---|---|---|
| P1 | High | No automated off-site backups (only at deploy time) | **Owner action** | Code shipped in PR #37: `scripts/backup.sh` (hourly 07–23 + 03:00, `pg_restore -l` verified, 14 days + 12 monthly kept, `age`-encrypted off-site upload via `rclone`, refuses unencrypted upload, heartbeat on success and failure), `scripts/restore-check.sh` (weekly restore into a scratch DB), systemd units in `deploy/systemd/`. **Not in effect until installed on the server** per `docs/VPS_DEPLOYMENT.md` Phase 10 (encryption key, bucket, heartbeat URLs). Mark Fixed once the first off-site copy and restore check succeed on the VPS | `npm run test:backup` (7 checks, run in CI) | `scripts/backup.sh`, `scripts/restore-check.sh`, `deploy/`, `docs/VPS_DEPLOYMENT.md` Phase 10 |
| P2 | High | Global login-failure counter lets anyone lock out all sign-ins | **Fixed** | PR #37 (`16da35e`): no site-wide lock; limits per address (30), per account per address (10), per account (50); site-wide count only logs `login_failure_surge`; nginx `auth_limit` zone and `limit_req_status 429` in the deployment guide | `tests/security.ts` P2 checks (flood never refuses a correct login; locks stay with the guessing address; per-address spray refused; account backstop) | `src/app/api/auth/login/route.ts`, `src/lib/api.ts` `clientAddress`, `docs/VPS_DEPLOYMENT.md` Phase 8 |
| P3 | Medium | Deploy builds in place over the live `.next`; slow rollback | **Fixed** | PR #37: `deploy-vps.sh` builds into `.next-build` (`NEXT_DIST_DIR`) while the app keeps serving, keeps it as `.next-release-<sha>-<time>`, switches `.next` (a link) in one atomic rename, restarts, and switches back automatically if health fails; `--rollback` switches to the previous release in seconds; last 3 kept; warns when shifts are open (`scripts/lib/releases.sh`). Releases sit beside `.next` because builds contain relative module links (found while testing: nesting them broke every API route); `.next-build` is pre-listed in tsconfig so builds do not rewrite it | `npm run test:deploy` (7 checks incl. module links), in CI; end-to-end with real builds: 37 probes during two builds all served the live build, switch and rollback served the expected build ID, API answered in every release | `scripts/deploy-vps.sh`, `scripts/lib/releases.sh`, `next.config.ts`, `tsconfig.json` |
| P4 | Medium | 8-hour sessions, never renewed | **Fixed** | PR #37: a request from a session over 1 hour old gets a fresh 8-hour cookie (`renewedSessionCookie`, applied in `secureRoute`), so a device in use stays signed in; idle devices still sign out after 7–8 hours; tokens carry the original sign-in time (`auth`) and nothing is renewed or accepted past 16 hours from it. Older tokens without `auth` use their issue time | `tests/security.ts` P4 checks: fresh session not renewed; 2-hour-old session renewed with original sign-in time and secure flags; renewed cookie works; legacy token; renewal capped at 16 h; past-cap token refused | `src/lib/auth.ts`, `src/lib/api.ts` |
| P5 | Medium | No DB statement, lock or idle-in-transaction timeouts; pool has no connect timeout | **Fixed** | PR #37: every app connection carries `statement_timeout` 15 s, `lock_timeout` 5 s, `idle_in_transaction_session_timeout` 30 s, plus a 5 s pool connect timeout (`src/db/timeouts.ts`, env-tunable, 0 refused). Timeouts answer 503 with a plain 'try again' message and `Retry-After` (`databaseBusyMessage`). Maintenance scripts are unaffected | `tests/security.ts` P5 checks: a row locked by another session makes an edit fail in under 5 s with the clear message, and the same edit succeeds after release; defaults and the refusal of 0 | `src/db/timeouts.ts`, `src/db/index.ts`, `src/lib/api.ts`, `src/lib/schema-guard.ts` |
| P6 | Medium | `scryptSync` blocks the event loop on every login, PIN or refund | **Fixed** | PR #37: request handlers (login, PIN switch, refund and manager approvals, staff PIN/password changes) use `hashPasswordAsync` / `verifyPasswordAsync` (same scrypt parameters, on libuv worker threads); the login dummy hash is made lazily off-thread; blocking forms stay for scripts and tests. `audit:workflows` rule 8 refuses blocking hashes under `src/app` and `src/lib` | `tests/security.ts` P6 checks: async and blocking hashes interchangeable; wrong/oversized/malformed refused; legacy PBKDF2 verifies; a 10 ms timer keeps ticking during four concurrent checks. Rule 8 shown to fail on a reintroduced blocking call | `src/lib/auth.ts`, `scripts/audit-workflows.py` rule 8 |
| P7 | Medium | Reports load the whole branch history every request | **Fixed** | PR #37: `/api/reports` aggregates cost of goods, sales by category, top sellers and wastage in SQL over the period's non-cancelled orders only, selects only the order columns it uses, and no longer loads menu items (photos), all order lines or all stock movements. Wastage is now the period's own (it was all-time whatever the period; the figure is not shown on screen today) | `tests/accounting.ts` P7 checks: for all-time, today and a custom past day, order count, sales, cost of goods, categories, top sellers and wastage equal a reference that recomputes them the old row-by-row way; older wastage excluded from today; low-stock list exact | `src/app/api/reports/route.ts` |
| P8 | Medium | No uptime, backup, disk or certificate alerting | **Owner action** | Code and steps shipped in PR #37: `scripts/monitor.sh` (every 10 min via `deploy/systemd/pos-monitor.timer`) checks local health, the service, disk space, certificate expiry, backup age and error bursts, and pings a heartbeat (`/fail` with the problem list on failure); backup and restore heartbeats came with P1; `docs/VPS_DEPLOYMENT.md` Phase 11 covers the outside uptime check, the monitor install, a journald size cap, and an alert drill. **Not in effect until set up on the server and the alert services.** Mark Fixed once the drill (stop the app, both alerts arrive, both recover) succeeds | `npm run test:monitor` (12 checks, in CI): each check alerts on its own problem with a clear message, healthy reports success, problems combine; mutation-checked; run once against real system tools | `scripts/monitor.sh`, `deploy/`, `docs/VPS_DEPLOYMENT.md` Phase 11 |
| P9 | Low | nginx limit is per IP; tills share one NAT IP; 503 on throttle | Open | — | 2026-11-17 | `docs/VPS_DEPLOYMENT.md` Phase 8 |
| P10 | Low | systemd and secret-file hardening gaps | Open | — | 2026-11-17 | `docs/VPS_DEPLOYMENT.md` Phases 5 and 7 |
| P11 | Low | Manual grants step after migrations | Open | — | 2026-11-17 | `scripts/deploy-vps.sh` step 3 |
| P12 | Low | DB test suites cannot run as root | Open | — | 2026-11-17 | `tests/run-security.ts` |

## Earlier audits (carried forward)

Findings from `AUDIT_2026-10-13.md`, `AUDIT_2026-10-19.md` and `SYSTEM_AUDIT.md` not
listed here were recorded as closed in later audits. Status of the 2026-10-23 set:

| ID | Title | Status | Notes |
|---|---|---|---|
| F1 | Repo public with legacy DB in history | Superseded by **N2** | |
| F2 | PIN-switch audit row named the outgoing user | **Fixed** | Verified 2026-11-17 in `src/app/api/auth/switch-pin/route.ts` |
| F3 | Hold-to-confirm has no single-activation alternative | **Fixed** | PR #33 (`f76ed65`): `ConfirmDialog` offers a typed `DELETE` alternative to press-and-hold. Verified 2026-11-17 in `src/components/ConfirmDialog.tsx` (`confirmWord`, typed mode) |
| F4 | Archived menu readable by any session | **Fixed** | Verified 2026-11-17: `includeArchived` requires `canManageMenu` |
| F5 | Dev-only dependency advisories | Superseded by **N14** | |
| F6 | Photo data URLs grow the menu payload | Superseded by **N8** | |
| F7 | Live deploy state unconfirmed | Open (ops) | `/api/health` does **not** yet report the running commit: `APP_BUILD_COMMIT` appears only in server error logs, and a healthy response is just `{"ok":true}`. Until that changes, confirm the VPS commit by hand (`git -C /opt/pos rev-parse --short HEAD`) after each deploy |

## Rules

1. **Fix → PR → register, in the same PR.** A PR that fixes a finding names it in the
   title or body (`Fixes N3`) and updates the row here: status **Fixed**, the PR number,
   and one line saying how it was verified (test name, command, or manual check).
2. **Never mark Fixed from a claim.** "The builder said it's done" is not verification.
   Check the code on `main`, and run the relevant test or command.
3. **Partial fixes stay Open**, with a note on what remains.
4. **Accepted** needs the owner's decision and the date. It is not a way to close a hard fix.
5. **New findings** get the next ID in their series (N15, P13, …). Never reuse or renumber IDs.
6. **Every audit** re-verifies each Open and In progress row and updates the
   *Last full verification* line at the top.
