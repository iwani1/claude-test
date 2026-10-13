#!/usr/bin/env bash
#
# Lush View POS — update the app on the VPS (Contabo / Ubuntu 24.04).
#
#   sudo ./scripts/deploy-vps.sh
#
# It is deliberately boring and safe:
#   1. refuses to run if the checkout has local changes or a divergent history
#   2. takes a database backup FIRST and validates it (no backup -> no deploy)
#   3. fetches the tracking branch and fast-forwards
#   4. installs dependencies only when package-lock.json actually changed
#   5. stops before building if there are migrations without a migration URL
#   6. builds, restarts the service, and waits for /api/health to answer
#   7. prints the exact rollback for the commit it replaced
#
# Every step says what it is doing. Nothing here touches the database schema
# unless a new migration file arrived AND you provided MIGRATION_DATABASE_URL.
#
# Overridable for testing / non-standard installs:
#   POS_DIR=/opt/pos  POS_USER=pos  POS_SERVICE=pos  POS_BRANCH=<branch>
#   POS_URL=http://127.0.0.1:3000  POS_DB=pos  BACKUP_DIR=/var/backups/pos
#   DRY_RUN=1 (print the plan, change nothing)   FORCE=1 (rebuild even if sha unchanged)
#   ALLOW_DIRTY=1 (allow `git reset --hard`, discarding local changes)
#
set -euo pipefail

POS_DIR="${POS_DIR:-/opt/pos}"
POS_USER="${POS_USER:-pos}"
POS_SERVICE="${POS_SERVICE:-pos}"
POS_URL="${POS_URL:-http://127.0.0.1:3000}"
POS_DB="${POS_DB:-pos}"
POS_BRANCH="${POS_BRANCH:-main}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pos}"
DRY_RUN="${DRY_RUN:-0}"
FORCE="${FORCE:-0}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"

step()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
info()  { printf '    %s\n' "$*"; }
warn()  { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
die()   { printf '\n\033[1;31mSTOP:\033[0m %s\n' "$*" >&2; exit 1; }

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '    [dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

# This script is always run as root (via sudo). Running a command as the service
# user then needs runuser, with su as the fallback on a minimal image.
as_user() {
  local user="$1"; shift
  if command -v runuser >/dev/null; then
    runuser -u "$user" -- "$@"
  else
    su -s /bin/sh "$user" -c "$(printf '%q ' "$@")"
  fi
}

# This script updates the checkout it lives in, and bash reads a script file
# lazily — a file that is replaced underneath it mid-run can make bash execute
# garbage. So it always runs from a copy of itself, wherever it was invoked.
if [[ "${POS_DEPLOY_REEXEC:-0}" != "1" ]]; then
  SELF="$(readlink -f "$0" 2>/dev/null || echo "$0")"
  case "$SELF" in
    "$POS_DIR"/*)
      COPY="$(mktemp /tmp/pos-deploy-XXXXXX.sh)"
      cp "$SELF" "$COPY"
      chmod 755 "$COPY"
      printf '\n\033[1;36m==>\033[0m %s\n' "Running from a copy of itself ($COPY)"
      POS_DEPLOY_REEXEC=1 exec "$COPY" "$@" ;;
  esac
fi

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  sed -n '3,30p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

# ---------------------------------------------------------------- preflight --
step "Preflight"

[[ "$(id -u)" -eq 0 ]] || die "Run this with sudo: sudo $0"
[[ -d "$POS_DIR/.git" ]] || die "$POS_DIR is not a git checkout — is the app installed there?"
[[ -f "$POS_DIR/.env" ]] || die "$POS_DIR/.env is missing; the app cannot start without it"
command -v git >/dev/null || die "git is not installed"
command -v pg_dump >/dev/null || die "pg_dump is not installed (postgresql-client)"
command -v npm >/dev/null || die "npm is not on this shell's PATH (see Phase 2 of docs/VPS_DEPLOYMENT.md)"
command -v runuser >/dev/null || command -v su >/dev/null || die "neither runuser nor su is available to drop privileges"

TRACKED_CHANGES="$(git -C "$POS_DIR" status --porcelain --untracked-files=no -- . ':!node_modules' ':!.next')"
if [[ -n "$TRACKED_CHANGES" ]]; then
  printf '%s\n' "$TRACKED_CHANGES" | sed 's/^/    /'
  if [[ "$ALLOW_DIRTY" == "1" ]]; then
    warn "The changes above will be discarded (ALLOW_DIRTY=1)"
  else
    die "Tracked files in $POS_DIR have local changes. Commit or stash them, or re-run with ALLOW_DIRTY=1 to discard them."
  fi
fi
UNTRACKED="$(git -C "$POS_DIR" ls-files --others --exclude-standard | head -5)"
if [[ -n "$UNTRACKED" ]]; then
  warn "Untracked files are present and will be left alone:"
  printf '%s\n' "$UNTRACKED" | sed 's/^/      /'
fi

git -C "$POS_DIR" rev-parse --verify -q "origin/$POS_BRANCH" >/dev/null \
  || git -C "$POS_DIR" fetch origin "$POS_BRANCH" >/dev/null
OLD_SHA="$(git -C "$POS_DIR" rev-parse HEAD)"
info "Install:      $POS_DIR"
info "Branch:       $POS_BRANCH"
info "Currently at: $OLD_SHA"
info "Service:      $POS_SERVICE   Health: $POS_URL/api/health"
[[ "$DRY_RUN" == "1" ]] && warn "DRY RUN — no changes will be made"

# ------------------------------------------------------------- 1. backup ----
step "1/6  Database backup (before anything else)"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F-%H%M%S)"
DUMP="$BACKUP_DIR/${POS_DB}-before-${OLD_SHA:0:7}-${STAMP}.dump"
MARKER="$BACKUP_DIR/deploy-incomplete"
if [[ "$DRY_RUN" != "1" ]]; then
  as_user postgres pg_dump -Fc "$POS_DB" > "$DUMP" || die "pg_dump failed — nothing has been changed"
  [[ -s "$DUMP" ]] || die "Backup file is empty ($DUMP) — nothing has been changed"
  if command -v pg_restore >/dev/null; then
    pg_restore -l "$DUMP" >/dev/null || die "Backup failed its integrity check — nothing has been changed"
  fi
  chmod 600 "$DUMP"
  info "Backup: $DUMP ($(du -h "$DUMP" | cut -f1))"
else
  info "[dry-run] would write $DUMP"
fi

# -------------------------------------------------------------- 2. fetch ----
step "2/6  Fetch $POS_BRANCH"
# Fetched even in DRY_RUN: it only updates remote-tracking refs, and the plan
# would be wrong without it.
git -C "$POS_DIR" fetch --prune origin "$POS_BRANCH"
NEW_SHA="$(git -C "$POS_DIR" rev-parse --verify -q FETCH_HEAD || true)"
[[ -n "$NEW_SHA" ]] || NEW_SHA="$(git -C "$POS_DIR" rev-parse --verify "origin/$POS_BRANCH")"

if [[ "$NEW_SHA" == "$OLD_SHA" && "$FORCE" != "1" && ! -f "$MARKER" ]]; then
  info "Already at $NEW_SHA — nothing to deploy."
  info "Re-run with FORCE=1 to rebuild and restart anyway."
  exit 0
fi
if [[ "$NEW_SHA" == "$OLD_SHA" && -f "$MARKER" ]]; then
  warn "An earlier deploy did not finish ($(cat "$MARKER" 2>/dev/null || echo unknown)) — completing it."
elif [[ "$NEW_SHA" == "$OLD_SHA" ]]; then
  info "Rebuilding $NEW_SHA because FORCE=1."
fi

git -C "$POS_DIR" log --oneline -1 "$NEW_SHA" | sed 's/^/    /'
CHANGED="$(git -C "$POS_DIR" diff --name-only "$OLD_SHA" "$NEW_SHA")" || true

# ---------------------------------------------------------- 3. migrations ---
# Checked BEFORE the working tree moves: a missing migration URL must leave the
# checkout untouched so the same command can simply be re-run.
step "3/6  Migrations"
NEW_MIGRATIONS="$(printf '%s\n' "$CHANGED" | grep -E '^migrations/.*\.sql$' || true)"
if [[ -n "$NEW_MIGRATIONS" && -z "${MIGRATION_DATABASE_URL:-}" ]]; then
  printf '%s\n' "$NEW_MIGRATIONS" | sed 's/^/    + /'
  die "This release adds migrations. Re-run with the owner connection string, e.g.:
      sudo MIGRATION_DATABASE_URL='postgresql://pos_owner:PASSWORD@127.0.0.1:5432/$POS_DB' $0
    Nothing on disk has changed, and the backup above is already taken."
fi

info "Checking out $NEW_SHA"
if [[ "$NEW_SHA" != "$OLD_SHA" ]]; then
  if [[ "$ALLOW_DIRTY" == "1" ]]; then
    run git -C "$POS_DIR" reset --hard "$NEW_SHA"
  else
    # Fast-forward only: if the server's history diverged from the branch, stop
    # rather than silently discarding somebody's work.
    run git -C "$POS_DIR" merge --ff-only "$NEW_SHA" \
      || die "History has diverged from origin/$POS_BRANCH. Resolve it by hand (git -C $POS_DIR status)."
  fi
fi

# From here the deploy is mutating; a marker makes a re-run finish the job
# instead of reporting "nothing to deploy" after a failure.
if [[ "$DRY_RUN" != "1" ]]; then
  printf 'started %s at %s -> %s\n' "$(date -Is)" "${OLD_SHA:0:7}" "${NEW_SHA:0:7}" > "$MARKER"
fi

if [[ -z "$NEW_MIGRATIONS" ]]; then
  info "No new migration files — schema untouched."
else
  printf '%s\n' "$NEW_MIGRATIONS" | sed 's/^/    + /'
  info "Applying migrations as the schema owner…"
  as_user "$POS_USER" env MIGRATION_DATABASE_URL="$MIGRATION_DATABASE_URL" \
    npm --prefix "$POS_DIR" run db:migrate
  warn "A migration was applied: re-apply the pos_runtime table grants from Phase 6 of docs/VPS_DEPLOYMENT.md if it created tables."
fi

# -------------------------------------------------------- 4. dependencies ---
step "4/6  Dependencies"
if [[ ! -d "$POS_DIR/node_modules" ]] || [[ -n "$(printf '%s\n' "$CHANGED" | grep -E '^package(-lock)?\.json$' || true)" ]]; then
  info "package.json / package-lock.json changed (or node_modules missing) — running npm ci"
  run chown -R "$POS_USER":"$POS_USER" "$POS_DIR"
  ( cd "$POS_DIR" && run as_user "$POS_USER" npm ci --no-audit --no-fund )
else
  info "No dependency changes — skipping npm ci."
fi

# ------------------------------------------------------------- 5. build -----
step "5/6  Build"
# The service runs as $POS_USER with ProtectSystem=full and WritePaths=.next,
# so .next must belong to that user before the build writes into it.
if [[ -d "$POS_DIR/.next" && "$(stat -c '%U' "$POS_DIR/.next")" != "$POS_USER" ]]; then
  run chown -R "$POS_USER":"$POS_USER" "$POS_DIR/.next"
fi
( cd "$POS_DIR" && run as_user "$POS_USER" npm run build ) \
  || die "Build failed — the running service is untouched (the old build is still what is being served).
    Fix the error, then run this script again: it will see the unfinished deploy marker and continue.
    To go back to the previous release instead:
      cd $POS_DIR && git reset --hard $OLD_SHA && sudo -u $POS_USER npm run build && systemctl restart $POS_SERVICE"
info "Build finished."

# --------------------------------------------------- 6. restart + verify ----
step "6/6  Restart and verify"
run systemctl restart "$POS_SERVICE"

if [[ "$DRY_RUN" == "1" ]]; then
  info "[dry-run] would wait for $POS_URL/api/health"
else
  printf '    Waiting for %s/api/health ' "$POS_URL"
  HEALTHY=0; BEHIND=0
  for _ in $(seq 1 30); do
    # No -f: a 503 still carries a body, and that body says whether the
    # database is simply behind this release (migrations not applied yet).
    if curl -sS --max-time 5 "$POS_URL/api/health" -o /tmp/pos-health.json 2>/dev/null; then
      if grep -q '"ok":true' /tmp/pos-health.json; then HEALTHY=1; printf ' ok\n'; break; fi
      if grep -q 'schema-behind' /tmp/pos-health.json; then BEHIND=1; printf ' schema-behind\n'; break; fi
    fi
    printf '.'; sleep 2
  done
  if [[ "$BEHIND" == "1" ]]; then
    info "Health: $(cat /tmp/pos-health.json)"
    die "The app is up but the database is behind this release — do not roll the code back.
    Apply the migrations, then restart:
      cd $POS_DIR && sudo -E -u $POS_USER env MIGRATION_DATABASE_URL='postgresql://pos_owner:PASSWORD@127.0.0.1:5432/$POS_DB' npm run db:migrate
      sudo systemctl restart $POS_SERVICE
    the service log names the missing piece. Backup from this run: $DUMP"
  fi
  [[ "$HEALTHY" == "1" ]] || {
    printf '\n'
    systemctl --no-pager --lines=30 status "$POS_SERVICE" || true
    die "The service did not answer on /api/health. Roll back with:
      cd $POS_DIR && git reset --hard $OLD_SHA && sudo -u $POS_USER npm run build && systemctl restart $POS_SERVICE
    Database backup taken before this deploy: $DUMP"
  }
  info "Health: $(cat /tmp/pos-health.json)"
  if curl -fsS --max-time 5 -o /dev/null "$POS_URL/sw.js"; then
    info "Offline app shell (/sw.js) is being served."
  else
    warn "/sw.js did not answer — offline shell will not install on devices."
  fi
fi

# -------------------------------------------------------------- summary -----
# The deploy is only "done" once the app answers; the marker stays until then.
[[ "$DRY_RUN" == "1" ]] || rm -f "$MARKER"

if [[ "$DRY_RUN" == "1" ]]; then
  step "Plan complete — dry run, nothing was changed"
else
  step "Deployed"
fi
info "$([[ "$DRY_RUN" == "1" ]] && echo 'Would be at:' || echo 'Now at:  ') $NEW_SHA  ($(git -C "$POS_DIR" log --oneline -1 "$NEW_SHA" | cut -c1-60))"
info "Backup:  $DUMP"
info "Rollback:
      cd $POS_DIR && git reset --hard $OLD_SHA && sudo -u $POS_USER npm run build && systemctl restart $POS_SERVICE"
info "Logs:    journalctl -u $POS_SERVICE -f"
