# VPS deployment — Contabo Cloud VPS (Ubuntu 24.04)

Step-by-step from a fresh root login to a running HTTPS POS. Budget roughly one
hour. Replace `pos.example.com` with your domain and never reuse example
passwords. Commands are run over SSH (Contabo emails the initial root password —
change it immediately).

> Production deployment is a business decision. Run the pilot checklist in
> `docs/PILOT_RUNBOOK.md` before trading real money.

---

## Phase 0 — What you need

- Root SSH access to the VPS (use the console in the Contabo panel if locked out)
- A domain name you control (for HTTPS; e.g. `pos.yourrestaurant.com`)
- A strong password manager entry ready for new DB credentials
- Roughly 2 vCPU / 4 GB RAM is enough; your Cloud VPS 4 is comfortably larger

---

## Phase 1 — First login and OS hardening

```sh
# 1. Change the emailed root password immediately
passwd

# 2. Update everything
apt update && apt upgrade -y

# 3. Server time and timezone (Ghana is UTC+0; this keeps logs/receipts readable)
timedatectl set-timezone Africa/Accra

# 4. Create a daily-updates safety net
apt install -y unattended-upgrades fail2ban
dpkg-reconfigure -plow unattended-upgrades   # answer Yes

# 5. Firewall: only SSH, HTTP, HTTPS
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80,443/tcp
ufw enable
```

### Recommended: stop logging in as root

```sh
adduser admin
usermod -aG sudo admin
mkdir -p /home/admin/.ssh && chmod 700 /home/admin/.ssh
# From your own computer, upload your public key (id_ed25519.pub):
#   ssh-copy-id admin@YOUR_SERVER_IP
# Then verify a NEW ssh session as admin works, and only then:
# sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
# sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
# systemctl reload ssh
```

Test the `admin` login in a second terminal **before** disabling root/password
login. Contabo also offers an external firewall in the customer panel — optional
belt-and-braces.

---

## Phase 2 — Install Node.js 22, PostgreSQL 16, nginx

```sh
apt install -y curl ca-certificates git unzip postgresql nginx

# Node.js 22 LTS from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

node --version    # expect v22.x
psql --version    # expect 16.x
```

PostgreSQL is installed with default config: it listens on localhost only.
Confirm it is NOT publicly reachable (must show `127.0.0.1:5432` only):

```sh
ss -lntp | grep 5432
```

---

## Phase 3 — Create the database and roles

The app needs **two** database logins: a maintenance owner (migrations/bootstrap)
and a restricted runtime login (the web app). The API refuses superuser or
`BYPASSRLS` runtime connections — this is intentional.

```sh
sudo -u postgres psql <<'SQL'
CREATE ROLE pos_owner LOGIN PASSWORD 'OWNER_PASSWORD_HERE';
CREATE DATABASE pos OWNER pos_owner;
CREATE ROLE pos_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'RUNTIME_PASSWORD_HERE';
GRANT CONNECT ON DATABASE pos TO pos_runtime;
SQL
```

Use long random passwords (`openssl rand -base64 24`) and URL-encode special
characters when putting them in connection strings.

---

## Phase 4 — Get the code and install dependencies

The code is on branch `arena/181e4004-claude-test` of
`https://github.com/iwani1/claude-test` (or merged to `main` once PR #1 is
merged). Either method works:

```sh
install -d -o admin -g admin /opt/pos && cd /opt/pos

# Option A — clone from GitHub (repo must be accessible from the server)
git clone -b arena/181e4004-claude-test https://github.com/iwani1/claude-test.git .

# Option B — upload the reviewed archive instead
#   Download 11claude-fixed.zip from the repository page, then:
#   unzip 11claude-fixed.zip -d /opt/pos
```

```sh
cd /opt/pos
npm ci          # installs dev dependencies too — they are required for the build
```

Never deploy the original `11claude.zip`; it contains the insecure legacy code.

Later updates are one command — `sudo ./scripts/deploy-vps.sh` — see
[Updating the app later](#updating-the-app-later).

---

## Phase 5 — Configure the environment

```sh
cd /opt/pos
cp .env.production.example .env
openssl rand -hex 48        # generate AUTH_SECRET — copy the output
nano .env                   # or vim
chmod 600 .env
```

Fill `.env` like this (placeholders only):

```env
DATABASE_URL=postgresql://pos_runtime:RUNTIME_PASSWORD_HERE@127.0.0.1:5432/pos
AUTH_SECRET=PASTE_THE_48_HEX_RANDOM_VALUE
NODE_ENV=production
PORT=3000
APP_ORIGIN=https://pos.example.com
PIN_LOGIN_BRANCH_ID=
```

- `DATABASE_URL` uses the **restricted runtime** login.
- `APP_ORIGIN` must be the exact public HTTPS URL.
- Leave `PIN_LOGIN_BRANCH_ID` blank unless you intentionally run a single-branch
  anonymous-PIN terminal.

---

## Phase 6 — Migrate and bootstrap the owner

```sh
cd /opt/pos

# Migrations use the maintenance URL only — never the web app's DATABASE_URL.
export MIGRATION_DATABASE_URL='postgresql://pos_owner:OWNER_PASSWORD_HERE@127.0.0.1:5432/pos'
npm run db:migrate
# Expected: Applied 0000_initial.sql ... 0003_refund_accounting.sql
# Safe to re-run; it refuses silently-changed migrations.
```

Now grant the runtime login access (run once, as database administrator, **after**
migrations so all current tables exist):

```sh
sudo -u postgres psql -d pos <<'SQL'
GRANT USAGE ON SCHEMA public TO pos_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pos_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pos_runtime;
REVOKE ALL ON schema_migrations FROM pos_runtime;
REVOKE INSERT, UPDATE, DELETE ON security_meta FROM pos_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
```

Bootstrap the first owner (new empty database only; it refuses existing data):

```sh
export MIGRATION_DATABASE_URL='postgresql://pos_owner:OWNER_PASSWORD_HERE@127.0.0.1:5432/pos'
export BOOTSTRAP_EMAIL='owner@yourrestaurant.com'
export BOOTSTRAP_PASSWORD='A-strong-password-12-plus-chars'
export BOOTSTRAP_PIN='4567'                 # optional, 4–8 digits
export BOOTSTRAP_RESTAURANT='Your Restaurant Name'
npm run db:bootstrap

# Clear secrets from the shell immediately
unset MIGRATION_DATABASE_URL BOOTSTRAP_PASSWORD BOOTSTRAP_PIN
```

Revoke `pos_owner`'s LOGIN when maintenance is done if you want maximum
hardening (keep the role for future migrations; you can re-enable LOGIN briefly).

Importing data from an older POS system (menu, staff, full sales history) is
covered separately in `docs/LEGACY_IMPORT.md` — it runs with the same
`MIGRATION_DATABASE_URL` maintenance connection and is safe to re-run at cutover.

---

## Phase 7 — Build and run under systemd

```sh
cd /opt/pos
npm run typecheck   # optional sanity check
npm run build

# Dedicated unprivileged service user
useradd --system --home /opt/pos --shell /usr/sbin/nologin pos
chown -R pos:pos /opt/pos
```

Create `/etc/systemd/system/pos.service`:

```ini
[Unit]
Description=Restaurant POS
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=pos
WorkingDirectory=/opt/pos
EnvironmentFile=/opt/pos/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/pos/.next

[Install]
WantedBy=multi-user.target
```

```sh
systemctl daemon-reload
systemctl enable --now pos
systemctl status pos
curl -sS http://127.0.0.1:3000/api/health
# Expect a minimal JSON health response.
```

Logs: `journalctl -u pos -f`

---

## Phase 8 — nginx reverse proxy + HTTPS

Create `/etc/nginx/sites-available/pos`:

```nginx
server {
    listen 80;
    server_name pos.example.com;

    client_max_body_size 1m;
    limit_req zone=req_limit burst=20 nodelay;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }
}
```

Add the rate-limit zone at the top of `/etc/nginx/nginx.conf` inside `http {}`:

```nginx
limit_req_zone $binary_remote_addr zone=req_limit:10m rate=10r/s;
```

Point DNS `pos.example.com → YOUR_SERVER_IP` (A record), then:

```sh
ln -s /etc/nginx/sites-available/pos /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

apt install -y certbot python3-certbot-nginx
certbot --nginx -d pos.example.com
# certbot renews automatically; verify: certbot renew --dry-run
```

Open `https://pos.example.com` — the login page should load, and
`https://pos.example.com/api/health` should respond. Secure cookies only work
over HTTPS; don't test logins over plain HTTP.

---

## Phase 9 — First-run business setup (with your accountant)

1. Sign in with the bootstrap owner email/password.
2. Configure **tax rates** with your accountant (initial rate is deliberately 0%).
3. Create branches/staff, menu categories/items, recipes and opening stock.
4. Set each user's branch and role; enroll manager PINs for refund approvals.
5. Work through `docs/PILOT_RUNBOOK.md` before trading real money.

---

## Phase 10 — Backups (do this on day one)

```sh
# Daily logical backup as the postgres user
sudo -u postgres pg_dump -Fc pos > /root/backups/pos-$(date +%F).dump
```

Automate with a cron/systemd timer, copy backups **off the server** (Contabo
Object Storage or another host) with restricted access, and rehearse a restore
into a new database (never over production):

```sh
sudo -u postgres createdb pos_restore_test
sudo -u postgres pg_restore --exit-on-error --no-owner -d pos_restore_test /root/backups/pos-YYYY-MM-DD.dump
```

Full restore acceptance criteria are in `docs/PILOT_RUNBOOK.md`. Also consider
Contabo's VPS Auto Backup in the panel as a second layer.

---

## Updating the app later

### The short way — one command

```sh
cd /opt/pos
sudo ./scripts/deploy-vps.sh
```

It takes the backup, pulls the branch, installs dependencies only if
`package-lock.json` moved, builds, restarts the service, waits for
`/api/health`, and prints the rollback for the commit it replaced. It is safe to
re-run: if anything fails, the next run finishes the job instead of reporting
"nothing to deploy".

| It refuses to run when | Why |
|---|---|
| You are not root (`sudo`) | It has to read the database, chown the build and restart the service |
| Tracked files in `/opt/pos` have local edits | A fast-forward would bury them; `ALLOW_DIRTY=1` discards them on purpose |
| `pg_dump` fails or the dump is empty/corrupt | No verified backup, no deploy |
| The branch and the server have diverged | Nothing is thrown away silently; you resolve it |
| The release adds migrations and `MIGRATION_DATABASE_URL` is missing | It stops **before** touching the working tree, so the same command can simply be re-run with the URL |

```sh
# a release that adds migrations (the migration URL is used once, then forgotten)
sudo MIGRATION_DATABASE_URL='postgresql://pos_owner:PASSWORD@127.0.0.1:5432/pos' ./scripts/deploy-vps.sh

# see the plan without changing anything
sudo DRY_RUN=1 ./scripts/deploy-vps.sh

# rebuild and restart even when the commit has not changed
sudo FORCE=1 ./scripts/deploy-vps.sh
```

Everything it needs can be overridden for a non-standard install:
`POS_DIR` (default `/opt/pos`), `POS_USER` (`pos`), `POS_SERVICE` (`pos`),
`POS_BRANCH` (the deployed branch), `POS_URL` (`http://127.0.0.1:3000`),
`POS_DB` (`pos`), `BACKUP_DIR` (`/var/backups/pos`).

If a deploy fails after the checkout moved, the script leaves
`/var/backups/pos/deploy-incomplete` and prints the exact commands to roll the
code back to the previous commit. The database backup taken at the start of
that same run is named `pos-before-<commit>-<timestamp>.dump`.

Ownership note: the script runs `git` as root and the app as `pos`, and it
chowns `/opt/pos` to `pos` whenever it installs dependencies. If you later run
`git` in `/opt/pos` as your admin user, allow the directory once with
`git config --global --add safe.directory /opt/pos`.

### The long way — every step by hand

Run these as an admin user with `sudo`. Each line is written so the account
that actually needs the permission is the one that gets it.

```sh
# 0. What is deployed?
sudo -u pos git -C /opt/pos status -sb | head -2
sudo -u pos git -C /opt/pos log --oneline -1

# 1. Backup. The redirection must be root: `sudo -u postgres pg_dump > /root/...`
#    still redirects as *you*, which is what "Permission denied" on the dump is.
sudo mkdir -p /root/backups
sudo -u postgres pg_dump -Fc pos | sudo tee /root/backups/pos-before-$(date +%F-%H%M).dump > /dev/null
sudo ls -lh /root/backups | tail -2          # a non-zero file, or stop here

# 2. Code. /opt/pos belongs to the service account, so pull as that account —
#    a plain `git pull` answers "cannot open '.git/FETCH_HEAD': Permission denied".
sudo -u pos git -C /opt/pos pull             # or upload the new 11claude-fixed.zip

# 3. Dependencies, only when package-lock.json moved
sudo -u pos npm --prefix /opt/pos ci

# 4. Migrations, as the schema owner with its real password (never the runtime
#    login, and "PASSWORD" in this document is a placeholder, not a value).
sudo -E -u pos env MIGRATION_DATABASE_URL='postgresql://pos_owner:REAL_PASSWORD@127.0.0.1:5432/pos' \
  npm --prefix /opt/pos run db:migrate       # safe to re-run; new files apply in order

# 5. Build and restart. The restart needs its own sudo: without it systemd
#    raises a polkit prompt ("Authentication is required to restart 'pos.service'")
#    that normally denies the unit.
sudo -u pos npm --prefix /opt/pos run build
sudo systemctl restart pos

# 6. Verify
curl -sS http://127.0.0.1:3000/api/health; echo
systemctl status pos --no-pager | head -5
```

Notes

- **Lost the `pos_owner` password?** Reset it from the database superuser and use
  the new value in step 4:
  `sudo -u postgres psql -c "ALTER ROLE pos_owner WITH PASSWORD 'new-long-password';"`
  Pick one without `@ : / ?` so the URL needs no escaping, and keep it out of chat
  and out of shell history (`set -o history -o histexpand` / prefix with a space
  if `HISTCONTROL=ignorespace`).
- **Skipped a step by accident?** The app now says so itself: `/api/health`
  reports `{"ok":false,"reason":"schema-behind","missing":[…]}` and every screen
  answers *"The database is missing an update this version needs (…)"* instead of
  failing obscurely. Re-run step 4 and restart.
- **Prefer one command?** `sudo MIGRATION_DATABASE_URL='postgresql://pos_owner:…' ./scripts/deploy-vps.sh`
  does steps 1, 2, 4, 5 and 6 for you (backup, fetch, migration gate, build,
  restart, health) and prints the rollback line. Add
  `git config --system --add safe.directory /opt/pos` once if root's git ever
  reports "detected dubious ownership".
- If a new migration created tables, re-apply the `pos_runtime` grants (Phase 6).

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `AUTH_SECRET must contain at least 32 random characters` | Missing/short value in `.env` |
| App refuses DB connection mentioning privileged/superuser/BYPASSRLS | `DATABASE_URL` is using `pos_owner` or a superuser — use `pos_runtime` |
| `Changed migration: 000X_...` | Never edit an applied migration; add a new file instead |
| Permission denied writing the `pg_dump` file | The shell redirected as your login user. Use `sudo -u postgres pg_dump -Fc pos \| sudo tee /root/backups/… > /dev/null`, or let `scripts/deploy-vps.sh` do it |
| `cannot open '.git/FETCH_HEAD': Permission denied` | The checkout belongs to the service account: `sudo -u pos git -C /opt/pos pull` |
| `Authentication is required to restart 'pos.service'` / polkit denied | The restart needs its own `sudo`: `sudo systemctl restart pos` |
| `password authentication failed for user "pos_owner"` | The real owner password, not the placeholder. Reset it with `sudo -u postgres psql -c "ALTER ROLE pos_owner WITH PASSWORD '…'"` and use that in `MIGRATION_DATABASE_URL` |
| `EADDRINUSE` | Another process on port 3000: `ss -lntp \| grep 3000` |
| nginx `502 Bad Gateway` | `systemctl status pos`, `journalctl -u pos -n 50` |
| Login works on server but not from browsers | `APP_ORIGIN` mismatch or not HTTPS |
| `429 Too many attempts` | Login/refund throttles are working; wait 15 minutes |
| A deploy stopped half-way | Re-run `sudo ./scripts/deploy-vps.sh`; it sees `/var/backups/pos/deploy-incomplete` and finishes the job |
| The app answers 503 *"The database is missing an update this version needs (…)"* | The code is newer than the database. Run `sudo -E -u pos env MIGRATION_DATABASE_URL='postgresql://pos_owner:…@127.0.0.1:5432/pos' npm run db:migrate` in `/opt/pos`, then `systemctl restart pos`. `/api/health` reports the same thing as `{"ok":false,"reason":"schema-behind"}` |
| `scripts/deploy-vps.sh` stops with *"The app is up but the database is behind this release — do not roll the code back"* | The fetched release needs its migrations and they were not applied (for example the checkout already held the new migration file, so the run saw no *new* file to gate on). Run the `db:migrate` command it prints, then `sudo systemctl restart pos` |
| `/api/health` says `{"ok":false,"reason":"schema-behind"}` | Same fix as above. The check exists because an unapplied migration used to surface as a bare "Request failed" in the middle of a deletion or a payment |
| Staff PINs suddenly rejected ("Invalid manager approval", "Invalid PIN") | `AUTH_SECRET` was changed. PIN digests are keyed on it, so every stored PIN must be set again: each staff member signs in with their password and sets a new PIN (Staff → Set PIN). Sessions are invalidated too, so everyone signs in again |
| Tests wanted on the server | `npm run test:security` needs ports 15432 + 3100 free and ignores `.env` — prefer running tests before deploying |

Monitor `journalctl -u pos`, nginx error logs, disk space, and PostgreSQL
connections. Rotate the owner password and `AUTH_SECRET` per the security notes
in `SECURITY.md` (rotating `AUTH_SECRET` invalidates sessions and PIN digests).
