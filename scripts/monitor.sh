#!/usr/bin/env bash
#
# Lush View POS — server health check for alerts (P8 in docs/FINDINGS.md).
#
# Run by systemd every 10 minutes (deploy/systemd/pos-monitor.timer), as root:
#   sudo /opt/pos/scripts/monitor.sh
#
# Checks what an outside uptime check cannot see:
#   - the app answers /api/health on the server itself
#   - the pos service is running
#   - disk space on / and on the backup disk
#   - the HTTPS certificate is not about to expire
#   - the newest backup is recent
#   - the app is not logging a burst of errors
#
# All good: pings MONITOR_HEARTBEAT_URL. Any problem: pings MONITOR_HEARTBEAT_URL/fail
# with the list of problems as the body, so the alert says what is wrong. The
# alert service (healthchecks.io or similar) only notifies on a change of state,
# so a lasting problem alerts once, and again when it clears; a server that stops
# reporting at all alerts too. Exit status: 0 all good, 1 problems found.
set -uo pipefail

POS_URL="${POS_URL:-http://127.0.0.1:3000}"
POS_SERVICE="${POS_SERVICE:-pos}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pos}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-85}"
CERT_HOST="${CERT_HOST:-}"                      # e.g. pos.example.com; empty skips the check
CERT_WARN_DAYS="${CERT_WARN_DAYS:-14}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
ERROR_WINDOW="${ERROR_WINDOW:-10 min ago}"
ERROR_LIMIT="${ERROR_LIMIT:-20}"
MONITOR_HEARTBEAT_URL="${MONITOR_HEARTBEAT_URL:-}"

PROBLEMS=()
problem() { PROBLEMS+=("$*"); }
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

# 1. The app answers its health check.
health="$(curl -sS --max-time 10 "$POS_URL/api/health" 2>&1)" || true
if [[ "$health" != *'"ok":true'* ]]; then
  problem "App health check failed at $POS_URL/api/health: ${health:0:200}"
fi

# 2. The service is running (systemd restarts it on a crash; this catches a stop).
if command -v systemctl >/dev/null; then
  state="$(systemctl is-active "$POS_SERVICE" 2>/dev/null)" || true
  [[ "$state" == "active" ]] || problem "Service $POS_SERVICE is '${state:-unknown}', not active"
fi

# 3. Disk space, for the system disk and the backup disk (often the same).
for path in / "$BACKUP_DIR"; do
  [[ -e "$path" ]] || continue
  used="$(df -P "$path" | awk 'NR==2 {gsub("%","",$5); print $5}')"
  if [[ "$used" =~ ^[0-9]+$ ]] && (( used >= DISK_WARN_PERCENT )); then
    problem "Disk for $path is ${used}% full (alert at ${DISK_WARN_PERCENT}%)"
  fi
done

# 4. The HTTPS certificate is valid for a while yet (certbot renews at 30 days).
if [[ -n "$CERT_HOST" ]]; then
  end="$(echo | openssl s_client -servername "$CERT_HOST" -connect "$CERT_HOST:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [[ -z "$end" ]]; then
    problem "Could not read the HTTPS certificate for $CERT_HOST"
  else
    days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
    (( days >= CERT_WARN_DAYS )) || problem "HTTPS certificate for $CERT_HOST expires in $days days ($end); check: certbot renew --dry-run"
  fi
fi

# 5. The newest backup is recent (the backup job has its own heartbeat too; this
#    also catches backups that run but land somewhere else).
if [[ -d "$BACKUP_DIR/recent" ]]; then
  newest="$(find "$BACKUP_DIR/recent" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f1)"
  if [[ -z "$newest" ]]; then
    problem "No backups in $BACKUP_DIR/recent"
  else
    age_h=$(( ( $(date +%s) - ${newest%.*} ) / 3600 ))
    (( age_h < BACKUP_MAX_AGE_HOURS )) || problem "Newest backup is ${age_h} hours old (alert at ${BACKUP_MAX_AGE_HOURS})"
  fi
fi

# 6. A burst of errors. The app logs one JSON line per failed request
#    ("level":"error" for server faults, see src/lib/api.ts).
if command -v journalctl >/dev/null; then
  errors="$(journalctl -u "$POS_SERVICE" --since "$ERROR_WINDOW" --no-pager -o cat 2>/dev/null | grep -c '"level":"error"')" || true
  if [[ "${errors:-0}" =~ ^[0-9]+$ ]] && (( errors >= ERROR_LIMIT )); then
    problem "$errors server errors logged since $ERROR_WINDOW (alert at $ERROR_LIMIT); see: journalctl -u $POS_SERVICE --since '$ERROR_WINDOW'"
  fi
fi

# ------------------------------------------------------------------ report ----
if (( ${#PROBLEMS[@]} == 0 )); then
  log "all checks passed"
  [[ -z "$MONITOR_HEARTBEAT_URL" ]] || curl -fsS -m 10 --retry 3 -o /dev/null "$MONITOR_HEARTBEAT_URL" || log "warning: heartbeat ping failed"
  exit 0
fi
report="$(printf '%s\n' "${PROBLEMS[@]}")"
log "PROBLEMS:"; printf '  %s\n' "${PROBLEMS[@]}"
[[ -z "$MONITOR_HEARTBEAT_URL" ]] || curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$report" "$MONITOR_HEARTBEAT_URL/fail" || log "warning: heartbeat ping failed"
exit 1
