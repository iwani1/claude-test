# Production Readiness Review — 2026-11-17

Companion to [`AUDIT_2026-11-17.md`](AUDIT_2026-11-17.md), which covers application
security and money integrity (findings **N1–N14**). This review covers what it takes to
**run** the system in production at `main` `f71f93e`: deployment, configuration, the
database, backups, availability, performance, monitoring and operations.

Sources reviewed: `scripts/deploy-vps.sh`, `docs/VPS_DEPLOYMENT.md` (systemd, nginx,
TLS, firewall, backups), `.env.production.example`, `next.config.ts`, `src/db/index.ts`,
`src/lib/api.ts`, `src/lib/auth.ts`, `/api/health`, `/api/reports`, the client polling
loops, the service worker and the CI workflow.

## Verdict

**Not ready for production.** Two items block go-live today:

- **N1:** no new build can be produced; `next build` refuses to run on Next.js 16.4.2.
- **N2:** the legacy databases are downloadable from the public repository.

After those, the system has a strong security core. It still needs the operational
items below before it can be trusted unattended: automated off-site backups, monitoring
and alerting, database timeouts, safe deploys, and a login lockout that outsiders cannot trigger.

## Go-live blockers

| # | Item | Why it blocks | Fix |
|---|---|---|---|
| B1 | **N1**: Next.js 16.4.2 | `next build` exits with `SecurityFatalError`, and CI fails on `npm audit --omit=dev`. The deploy script dies at step 5. | Upgrade `next` and `eslint-config-next` to `^16.4.6`; run the full battery. |
| B2 | **N2**: repo public, DBs in history | Legacy business data and credentials are downloadable. | Make the repo private, rotate credentials, purge history, move the VPS to a deploy key. |
| B3 | **N3/N4/N5**: insider fraud and escalation paths | A live till handling cash should not allow untracked item removal or voids, or a path from manager to owner. | See the application audit; the minimum is to audit with the actor and require a manager PIN for removals and voids. |
| B4 | **P1**: no automated off-site backups (below) | One disk or VPS failure loses all sales history. | Ship the timer and off-site copy, and rehearse a restore. |

## Findings

### P1 — HIGH: backups exist only at deploy time

`deploy-vps.sh` takes and verifies a `pg_dump` before every deploy, which is good. Daily
backups, though, are left to the reader. Phase 10 of `VPS_DEPLOYMENT.md` says
"Automate with a cron/systemd timer, copy backups off the server", but the repository
ships no timer, no off-site copy, no retention policy and no restore check. On a single
VPS, the database and its only backups sit on the same disk.

**Recommendations:**
- Ship `scripts/backup.sh` plus a `pos-backup.timer` systemd unit:
  - nightly, plus hourly during trading hours;
  - `pg_dump -Fc`, verified with `pg_restore -l`;
  - kept for 14 days, plus 12 monthly copies.
- Copy every dump off the server: Contabo Object Storage or another provider, using write-only credentials, encrypted with `age` or `gpg`.
- Restore the latest dump into a scratch database weekly and check row counts. Alert if any step fails.
- For under-an-hour recovery, add WAL archiving (pgBackRest or wal-g) later.
- Keep Contabo's snapshot backups as a second layer, not the only one.

### P2 — HIGH: anyone on the internet can lock every user out of sign-in

`/api/auth/login` keeps a global failure counter (`login:global`, limit 300 per
15 min). Once 300 wrong passwords arrive from anywhere, **every** login is refused with
429 for 15 minutes, including correct ones. nginx allows 10 requests per second per IP,
so one IP reaches 300 in about 30 seconds, and repeating it keeps the venue locked out
indefinitely. Sessions already open survive, but every shift start, device restart and
session expiry (see P4) is then blocked.

**Recommendations:**
- Do not let the global counter refuse requests. Use it to alert, or to add a delay or CAPTCHA. Keep the per-account and per-IP limits as the hard stops.
- Add a per-IP key (`X-Real-IP` from nginx) to the login throttle.
- Add a tighter nginx `limit_req` zone just for `/api/auth/` (for example 1 r/s, burst 5).
- If the restaurant has a fixed IP, consider limiting `/api/auth/login` to the venue's IP range (`allow`/`deny` in nginx).

### P3 — MEDIUM: deploys build in place and a failed build can take the live app down

`deploy-vps.sh` runs `npm run build` inside the live `/opt/pos`, writing to the `.next`
directory that the running `next start` is serving. `next build` replaces `.next`, so:

- During the build, browsers that request a page or code chunk can get errors. The till is in use while you deploy.
- The script says "the running service is untouched" when the build fails. That is not reliable: `.next` may already be partly overwritten, and the next restart or crash serves the broken output.
- Rollback means a full rebuild (minutes of downtime) while the venue waits.

**Recommendations:**
- Build into a release directory and switch over in one step:
  - each release gets `/opt/pos/releases/<sha>`, with `output: "standalone"` in `next.config.ts`;
  - point `/opt/pos/current` at the new release, then restart;
  - roll back by pointing the symlink back and restarting (seconds, no rebuild);
  - keep the last three releases.
- Alternatively, build in CI and ship the built archive. The CI pipeline already packages a release.
- Deploy outside trading hours, and have the script check for an open shift first, warning or refusing.

### P4 — MEDIUM: sessions end after 8 hours and are never renewed

`SESSION_SECONDS = 8h`. Tokens are created only at login and PIN switch, never renewed.
A 12-hour restaurant day logs every till out mid-service, often during the evening rush,
and if P2 is happening at the same time nobody can sign back in.

**Recommendation:** renew the cookie when a token is more than half-way through its life.
`secureRoute` can re-issue it on any successful response. Keep an absolute ceiling
(for example 16 h, or "until the shift closes"), and keep the idle limit short on
shared devices.

### P5 — MEDIUM: the database has no timeouts

The connection pool (`max: 15`, plus 2 for the throttle) sets no
`connectionTimeoutMillis`, and the runtime role has no `statement_timeout` or
`idle_in_transaction_session_timeout`. Every request holds an open transaction for its
whole duration, often with `SELECT … FOR UPDATE` row locks on orders and shifts. One
hung request, such as a slow report or a stuck client, can:

- hold locks that block payments on that order or shift;
- with 15 of them, use up the pool, so every till hangs instead of failing.

**Recommendations:**
```sql
ALTER ROLE pos_runtime SET statement_timeout = '15s';
ALTER ROLE pos_runtime SET lock_timeout = '5s';
ALTER ROLE pos_runtime SET idle_in_transaction_session_timeout = '30s';
```
Also set `connectionTimeoutMillis: 5000` and `idleTimeoutMillis: 30000` on both pools.
Put these in a migration or the setup guide so every install gets them.

### P6 — MEDIUM: password and PIN checks freeze the whole server briefly

`hashPassword` and `verifyPassword` use `crypto.scryptSync` (N=32768, about 32 MB, and
typically 50–150 ms of CPU). Node serves every till from one thread, so each login,
PIN switch, refund approval, PIN change and staff creation **freezes all other
requests** for that time. A few PIN switches at shift change, or the login attack in
P2, which runs the hash even for unknown emails, makes every till stall.

**Recommendation:** switch to the asynchronous `crypto.scrypt` (promisified), which runs
on the libuv thread pool. The parameters stay the same, so existing hashes still verify.

### P7 — MEDIUM: Reports loads the whole history on every request

`/api/reports` filters only orders by date. It then loads **all** `order_items`,
`stock_movements`, `ingredients` and `menu_items` for the branch, including the
photo data URLs from N8, and aggregates them in JavaScript inside one transaction.
That is fine in the first weeks. After months of trading, each report takes longer,
uses more memory and holds a pooled connection longer, which makes P5 worse.

**Recommendation:** push the date window and the aggregation into SQL (join `order_items` to the filtered orders, `GROUP BY`), and select only the columns used. `orders_branch_created_idx` and `order_items_branch_order_idx` already support this. Add a cap on the date range.

### P8 — MEDIUM: no monitoring or alerting

The app has a good health endpoint and writes structured JSON error logs with a request
ID. Nothing watches either of them. Today, an outage, an expired certificate, a full
disk or a failed backup is found by staff at the till.

**Recommendations (cheap and enough for one site):**
- An external uptime check on `https://<host>/api/health` every minute, alerting the owner by SMS or WhatsApp (UptimeRobot, Better Stack or Healthchecks.io).
- A heartbeat ping at the end of the backup job, so a missed backup alerts.
- Alerts for disk usage over 80% and for certificate expiry (`certbot renew` failures).
- A daily job that searches the journal for `"level":"error"` and emails a count. Later, ship logs to Better Stack or Grafana Loki.
- Set `journald` `SystemMaxUse=` so logs cannot fill the disk.

### P9 — LOW: nginx rate limit is per IP, and all tills share one IP

`limit_req … rate=10r/s burst=20` is keyed on `$binary_remote_addr`. Every till in the
restaurant reaches the server through the same NAT address, so the whole venue shares
10 r/s. Kitchen screens (5 s polling), Order History (30 s polling), offline-queue sync
and several devices loading at once can hit the burst limit, and nginx then answers
**503**, which looks like an outage. Signing in on a new device fires several API calls
at once.

**Recommendation:**
- Use a generous limit for authenticated API traffic (about 50 r/s, burst 100), plus the strict auth zone from P2.
- Return 429 instead of 503 (`limit_req_status 429;`) so the app can tell throttling from an outage.
- Watch the nginx error log for `limiting requests` during the pilot.

### P10 — LOW: hardening gaps in the server setup guide

- **systemd:** add `ProtectHome=true`, `PrivateDevices=true`, `ProtectKernelTunables=true`, `RestrictSUIDSGID=true`, `MemoryMax=` and `LimitNOFILE=`. Run `ExecStart=/usr/bin/node …` directly rather than through `npm start`, so signals and restarts are cleaner.
- **`.env`** sits inside the checkout at `/opt/pos/.env`, owned by the service user. Move secrets to `/etc/pos/env` (root-owned, mode 0640, group `pos`) so a compromised app process or a stray `git` command cannot change or expose them.
- **PostgreSQL:** state that it listens on `127.0.0.1` only, and that `pg_hba.conf` uses `scram-sha-256`.
- **TLS:** the nginx sample shows only `listen 80`; certbot adds 443. Also add `http2`, and redirect HTTP to HTTPS explicitly.
- **Unattended upgrades** may restart PostgreSQL during trading hours. Schedule them outside opening hours (`Unattended-Upgrade::Automatic-Reboot-Time`).

### P11 — LOW: migrations need a manual grants step

After any migration that creates a table, the deploy script prints "re-apply the
pos_runtime table grants from Phase 6". Forgetting this gives `permission denied`
errors in production on the new feature. Grant inside each migration, or set
`ALTER DEFAULT PRIVILEGES … GRANT … TO pos_runtime` once, so new tables are reachable
automatically. Also document a down-path or a forward-fix policy for each migration;
today rollback means restoring the pre-deploy dump and losing any sales taken since.

### P12 — LOW: the database test suites cannot run as root

`test:security` and `test:legacy-import` fail as root, because embedded PostgreSQL
refuses to initialise. CI passes because GitHub runners are not root, but operators and
container builds hit this. Make the test runner create the data directory with
permissions the `postgres` user can use, or document "run as a non-root user".

## What is already production-grade

- **Deploy safety rails:** a verified backup before every deploy, fast-forward-only
  updates, a gate that stops when migrations arrive without the migration login, a
  resume marker, a health-checked restart and printed rollback commands.
- **Separated database roles:** the runtime login cannot bypass RLS or own the schema;
  migrations use a separate owner login supplied only at maintenance time.
- **Health endpoint:** reports `schema-behind` and `database-unreachable` separately,
  leaks no internals, and the build commit is baked in for "what is live?" questions.
- **Edge basics:** firewall (`ufw`) allows SSH, 80 and 443 only; fail2ban; key-only SSH
  is recommended; certbot TLS with HSTS in production; strict CSP and frame denial.
- **CI:** lint, typecheck, a build with no database, static audits, a security suite
  against disposable PostgreSQL, a production dependency audit, and a release archive
  built from the exact commit.
- **Offline:** a branch-scoped queue, idempotent replay, and the server re-prices every
  synced order without trusting client "paid" flags.

## Go-live checklist

**Before the first live shift**
- [ ] B1: Next.js upgraded; CI green; `npm run build` passes on the VPS
- [ ] B2: repository private; legacy credentials rotated; VPS on a deploy key
- [ ] B3: item removal and cancel require a manager PIN and are audited with the actor; owner excluded from quick PIN switch
- [ ] B4/P1: nightly and hourly backups running, copied off-site, one restore rehearsed and timed
- [ ] P2: global login lockout removed; per-IP and auth-specific rate limits in place
- [ ] P5: `statement_timeout`, `lock_timeout` and `idle_in_transaction_session_timeout` set on `pos_runtime`
- [ ] P8: external uptime alert on `/api/health`; backup heartbeat; disk alert
- [ ] VAT rate saved in Settings (orders are refused until it is)
- [ ] The `docs/PILOT_RUNBOOK.md` on-site gates signed off (printers, receipts, offline recovery on the real devices)

**Within the first month**
- [ ] P3: release directories with symlink switch-over and instant rollback
- [ ] P4: session renewal
- [ ] P6: async scrypt
- [ ] P9: nginx limits retuned from pilot logs
- [ ] N6/N7: permission-based approvals; actor on every audit row
- [ ] N8: menu photos served as files

**Before adding a second branch or heavy history**
- [ ] P7: reports aggregated in SQL
- [ ] P10/P11: systemd and secrets hardening; default privileges for new tables
- [ ] WAL archiving if under-an-hour data loss is required
