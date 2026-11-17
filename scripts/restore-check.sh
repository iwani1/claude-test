#!/usr/bin/env bash
#
# Lush View POS — prove the latest backup actually restores (P1).
#
# Run weekly by systemd (deploy/systemd/pos-restore-check.timer), as root:
#   sudo /opt/pos/scripts/restore-check.sh [dump-file]
#
# Restores the newest dump in $BACKUP_DIR/recent (or the file given) into a
# scratch database, checks that the core tables came back and prints their row
# counts, then drops the scratch database. A backup that has never been
# restored is a hope, not a backup. Pings RESTORE_HEARTBEAT_URL like backup.sh.
set -euo pipefail

POS_DB="${POS_DB:-pos}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pos}"
SCRATCH_DB="${SCRATCH_DB:-pos_restore_check}"
RESTORE_HEARTBEAT_URL="${RESTORE_HEARTBEAT_URL:-}"
PG_USER="${PG_USER:-postgres}"
# Tables that must exist in any restore of this application.
REQUIRED_TABLES=(restaurants branches users menu_items orders order_items payments refunds shifts audit_logs)

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
heartbeat() {
  [[ -n "$RESTORE_HEARTBEAT_URL" ]] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "$RESTORE_HEARTBEAT_URL$1" || log "warning: heartbeat ping failed"
}
run_as_pg() {
  if [[ "$(id -un)" == "$PG_USER" ]]; then "$@"
  elif command -v runuser >/dev/null; then runuser -u "$PG_USER" -- "$@"
  else su -s /bin/sh "$PG_USER" -c "$(printf '%q ' "$@")"
  fi
}
cleanup() {
  local status=$?
  run_as_pg dropdb --if-exists "$SCRATCH_DB" >/dev/null 2>&1 || true
  if [[ $status -ne 0 ]]; then log "RESTORE CHECK FAILED (exit $status)"; heartbeat /fail; fi
}
trap cleanup EXIT

[[ "$SCRATCH_DB" != "$POS_DB" ]] || { log "SCRATCH_DB must not be the live database"; exit 1; }

DUMP="${1:-$(find "$BACKUP_DIR/recent" -maxdepth 1 -type f -name "${POS_DB}-*.dump" | sort | tail -n 1)}"
[[ -n "$DUMP" && -s "$DUMP" ]] || { log "no backup found in $BACKUP_DIR/recent"; exit 1; }
log "restoring $DUMP into scratch database '$SCRATCH_DB'"

START=$SECONDS
run_as_pg dropdb --if-exists "$SCRATCH_DB"
run_as_pg createdb "$SCRATCH_DB"
# The dump is root-only (0600); feed it on stdin so the postgres user needs no file access.
run_as_pg pg_restore --exit-on-error --no-owner --no-privileges -d "$SCRATCH_DB" < "$DUMP"

for table in "${REQUIRED_TABLES[@]}"; do
  count="$(run_as_pg psql -XAtq -d "$SCRATCH_DB" -c "SELECT count(*) FROM public.\"$table\"")" \
    || { log "table '$table' is missing from the restore"; exit 1; }
  log "  $table: $count rows"
done

log "restore check passed in $((SECONDS - START))s ($(du -h "$DUMP" | cut -f1) dump)"
heartbeat ""
