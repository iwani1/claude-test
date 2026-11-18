#!/usr/bin/env bash
#
# Lush View POS — scheduled database backup (P1 in docs/FINDINGS.md).
#
# Run by systemd (deploy/systemd/pos-backup.timer), as root:
#   sudo /opt/pos/scripts/backup.sh
#
# Each run:
#   1. dumps the database with pg_dump -Fc (as the postgres user), to a temp file
#   2. verifies the dump (non-empty, readable by pg_restore) before keeping it
#   3. keeps it locally under $BACKUP_DIR/recent, plus one copy per month
#      under $BACKUP_DIR/monthly
#   4. if BACKUP_AGE_RECIPIENT is set, encrypts a copy with `age`, and if
#      BACKUP_REMOTE is set too, uploads that encrypted copy with `rclone`
#      (never the unencrypted dump)
#   5. prunes old local (and remote) copies
#   6. pings BACKUP_HEARTBEAT_URL on success, or BACKUP_HEARTBEAT_URL/fail on
#      failure, so a missed or failed backup raises an alert (healthchecks.io style)
#
# Settings come from the environment (systemd reads /etc/pos/backup.env;
# see deploy/backup.env.example). Every one has a safe default except the
# off-site ones, which are opt-in. A failure at any step exits non-zero, which
# systemd records and the heartbeat reports.
set -euo pipefail

POS_DB="${POS_DB:-pos}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pos}"
KEEP_DAYS="${KEEP_DAYS:-14}"           # local recent copies
KEEP_MONTHS="${KEEP_MONTHS:-12}"       # local monthly copies
REMOTE_KEEP_DAYS="${REMOTE_KEEP_DAYS:-30}"
BACKUP_AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"   # age public key (age1...)
BACKUP_REMOTE="${BACKUP_REMOTE:-}"                 # rclone path, e.g. contabo:pos-backups
BACKUP_HEARTBEAT_URL="${BACKUP_HEARTBEAT_URL:-}"
PG_USER="${PG_USER:-postgres}"         # OS user that runs pg_dump (peer auth)

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

heartbeat() {
  [[ -n "$BACKUP_HEARTBEAT_URL" ]] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "$BACKUP_HEARTBEAT_URL$1" || log "warning: heartbeat ping failed"
}

TMP=""
on_exit() {
  local status=$?
  [[ -n "$TMP" && -f "$TMP" ]] && rm -f "$TMP"
  if [[ $status -ne 0 ]]; then
    log "BACKUP FAILED (exit $status)"
    heartbeat /fail
  fi
}
trap on_exit EXIT

run_as_pg() {
  if [[ "$(id -un)" == "$PG_USER" ]]; then "$@"
  elif command -v runuser >/dev/null; then runuser -u "$PG_USER" -- "$@"
  else su -s /bin/sh "$PG_USER" -c "$(printf '%q ' "$@")"
  fi
}

mkdir -p "$BACKUP_DIR/recent" "$BACKUP_DIR/monthly"
chmod 700 "$BACKUP_DIR"

# One backup at a time: a slow dump must not overlap the next timer run.
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || { log "another backup is still running; skipping this run"; trap - EXIT; exit 0; }

STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
NAME="${POS_DB}-${STAMP}.dump"
FINAL="$BACKUP_DIR/recent/$NAME"
TMP="$BACKUP_DIR/recent/.$NAME.partial"

# ---------------------------------------------------------------- 1. dump ----
log "dumping database '$POS_DB'"
umask 077
run_as_pg pg_dump -Fc "$POS_DB" > "$TMP"

# -------------------------------------------------------------- 2. verify ----
[[ -s "$TMP" ]] || { log "dump is empty"; exit 1; }
pg_restore -l "$TMP" > /dev/null || { log "dump failed its integrity check (pg_restore -l)"; exit 1; }
mv "$TMP" "$FINAL"
TMP=""
chmod 600 "$FINAL"
log "kept $FINAL ($(du -h "$FINAL" | cut -f1))"

# ------------------------------------------------------------- 3. monthly ----
MONTH_FILE="$BACKUP_DIR/monthly/${POS_DB}-$(date -u +%Y-%m).dump"
if [[ ! -f "$MONTH_FILE" ]]; then
  cp -p "$FINAL" "$MONTH_FILE"
  log "kept monthly copy $MONTH_FILE"
fi

# ------------------------------------------------------------ 4. off-site ----
if [[ -n "$BACKUP_REMOTE" && -z "$BACKUP_AGE_RECIPIENT" ]]; then
  log "BACKUP_REMOTE is set but BACKUP_AGE_RECIPIENT is not: refusing to upload an unencrypted dump"
  exit 1
fi
if [[ -n "$BACKUP_AGE_RECIPIENT" ]]; then
  command -v age >/dev/null || { log "age is not installed (apt install age)"; exit 1; }
  ENC="$FINAL.age"
  age -r "$BACKUP_AGE_RECIPIENT" -o "$ENC" "$FINAL"
  [[ -s "$ENC" ]] || { log "encryption produced an empty file"; exit 1; }
  chmod 600 "$ENC"
  if [[ -n "$BACKUP_REMOTE" ]]; then
    command -v rclone >/dev/null || { log "rclone is not installed (apt install rclone)"; exit 1; }
    rclone copyto "$ENC" "$BACKUP_REMOTE/recent/$(basename "$ENC")"
    MONTH_ENC="$(basename "$MONTH_FILE").age"
    if ! rclone lsf "$BACKUP_REMOTE/monthly/" 2>/dev/null | grep -qx "$MONTH_ENC"; then
      rclone copyto "$ENC" "$BACKUP_REMOTE/monthly/$MONTH_ENC"
    fi
    log "uploaded encrypted copy to $BACKUP_REMOTE"
    rclone delete --min-age "${REMOTE_KEEP_DAYS}d" "$BACKUP_REMOTE/recent/" || log "warning: remote prune failed"
  fi
  rm -f "$ENC"   # the local copy stays unencrypted (root-only); only the upload needs it
fi

# --------------------------------------------------------------- 5. prune ----
find "$BACKUP_DIR/recent" -maxdepth 1 -type f -name "${POS_DB}-*.dump" -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/pruned /' || true
# Keep the newest KEEP_MONTHS monthly copies (names sort by date).
mapfile -t MONTHLY < <(find "$BACKUP_DIR/monthly" -maxdepth 1 -type f -name "${POS_DB}-*.dump" | sort -r)
for old in "${MONTHLY[@]:$KEEP_MONTHS}"; do rm -f "$old" && log "pruned $old"; done

log "backup complete"
heartbeat ""
