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
| Medium | 9 | 0 | 0 | 0 |
| Low / Info | 11 | 0 | 3 | 0 |

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
| N6 | Medium | Refund approver and discount checks use role, not effective permissions | Open | — | 2026-11-17 @ `06126e9` | `src/app/api/orders/[id]/refund/route.ts`, `src/lib/create-order.ts` |
| N7 | Medium | Ten audit-log inserts record no `userId` or `userName` | Open | Partly addressed in PR #37: `order_updated`/`order_cancelled` now record the actor. 9 sites remain (menu, inventory, recipes, stock counts, purchasing, suppliers) | 2026-11-17 @ `06126e9` | `grep -rn "insert(auditLogs)" src` |
| N8 | Medium | Photo data URLs overflow the `localStorage` menu cache; offline till keeps stale menu | Open | — | 2026-11-17 @ `06126e9` | `src/lib/offline-storage.ts`, `src/components/MenuManager.tsx` |
| N9 | Low | Order GET uses `SELECT … FOR UPDATE` | Open | — | 2026-11-17 | `src/app/api/orders/[id]/route.ts` `handleGET` |
| N10 | Low | Order status can move backwards; malformed id becomes a 500 | Open | — | 2026-11-17 | `src/app/api/orders/[id]/route.ts` `handlePATCH` |
| N11 | Low | `Origin: null` causes a 500; body cap trusts `Content-Length` | Open | — | 2026-11-17 | `src/lib/api.ts` `checkRequest` |
| N12 | Low | Re-price without discount or tip fields zeroes them (latent) | Open | — | 2026-11-17 | `src/app/api/orders/[id]/edit/route.ts` |
| N13 | Low | PIN throttles are branch-wide (one person can block everyone) | Open | — | 2026-11-17 | `src/app/api/auth/switch-pin/route.ts`, refund route |
| N14 | Info | Dev-only dependency advisories: full-tree `npm audit` reports 21 (12 moderate, 9 high), including **high-severity `picomatch`**, plus `esbuild` and `minimatch`. The production tree is clean (`npm audit --omit=dev`: 0) | Open (tracked) | Standing policy: no `--force`; review the dev-tool upgrades separately | 2026-11-17 @ `06126e9`: full `npm audit` 21 (12 moderate, 9 high); `--omit=dev` 0 | `npm audit` |

## Production findings — [`PRODUCTION_READINESS_2026-11-17.md`](PRODUCTION_READINESS_2026-11-17.md)

| ID | Sev | Title | Status | Fixed by / decision | Verified | Where to look |
|---|---|---|---|---|---|---|
| P1 | High | No automated off-site backups (only at deploy time) | **Owner action** | Code shipped in PR #37: `scripts/backup.sh` (hourly 07–23 + 03:00, `pg_restore -l` verified, 14 days + 12 monthly kept, `age`-encrypted off-site upload via `rclone`, refuses unencrypted upload, heartbeat on success and failure), `scripts/restore-check.sh` (weekly restore into a scratch DB), systemd units in `deploy/systemd/`. **Not in effect until installed on the server** per `docs/VPS_DEPLOYMENT.md` Phase 10 (encryption key, bucket, heartbeat URLs). Mark Fixed once the first off-site copy and restore check succeed on the VPS | `npm run test:backup` (7 checks, run in CI) | `scripts/backup.sh`, `scripts/restore-check.sh`, `deploy/`, `docs/VPS_DEPLOYMENT.md` Phase 10 |
| P2 | High | Global login-failure counter lets anyone lock out all sign-ins | **Fixed** | PR #37 (`16da35e`): no site-wide lock; limits per address (30), per account per address (10), per account (50); site-wide count only logs `login_failure_surge`; nginx `auth_limit` zone and `limit_req_status 429` in the deployment guide | `tests/security.ts` P2 checks (flood never refuses a correct login; locks stay with the guessing address; per-address spray refused; account backstop) | `src/app/api/auth/login/route.ts`, `src/lib/api.ts` `clientAddress`, `docs/VPS_DEPLOYMENT.md` Phase 8 |
| P3 | Medium | Deploy builds in place over the live `.next`; slow rollback | Open | — | 2026-11-17 | `scripts/deploy-vps.sh` step 5 |
| P4 | Medium | 8-hour sessions, never renewed | Open | — | 2026-11-17 | `src/lib/auth.ts` `SESSION_SECONDS` |
| P5 | Medium | No DB statement, lock or idle-in-transaction timeouts; pool has no connect timeout | Open | — | 2026-11-17 | `src/db/index.ts`, `src/lib/api.ts` |
| P6 | Medium | `scryptSync` blocks the event loop on every login, PIN or refund | Open | — | 2026-11-17 | `src/lib/auth.ts` |
| P7 | Medium | Reports load the whole branch history every request | Open | — | 2026-11-17 | `src/app/api/reports/route.ts` |
| P8 | Medium | No uptime, backup, disk or certificate alerting | Open | — | 2026-11-17 | ops |
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
