#!/usr/bin/env bash
# Tests scripts/monitor.sh with stand-ins for curl, systemctl, df, openssl and
# journalctl: each check passes when healthy, fails on its own problem, and the
# problem text reaches the alert. Run: npm run test:monitor
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STUBS="$WORK/bin"; mkdir -p "$STUBS"
PASSES=0
pass() { PASSES=$((PASSES + 1)); echo "PASS $*"; }
fail() { echo "FAIL $*" >&2; exit 1; }

cat > "$STUBS/curl" <<'EOF'
#!/usr/bin/env bash
url="${@: -1}"; body=""
for ((i=1; i<=$#; i++)); do [[ "${!i}" == "--data-raw" ]] && { j=$((i+1)); body="${!j}"; }; done
if [[ "$url" == */api/health ]]; then printf '%s' "$HEALTH_BODY"; exit 0; fi
printf '%s\n%s\n---\n' "$url" "$body" >> "$HEARTBEAT_LOG"
EOF
cat > "$STUBS/systemctl" <<'EOF'
#!/usr/bin/env bash
echo "$SERVICE_STATE"; [[ "$SERVICE_STATE" == active ]]
EOF
cat > "$STUBS/df" <<'EOF'
#!/usr/bin/env bash
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
echo "/dev/vda 100 $DISK_USED 0 ${DISK_USED}% /"
EOF
cat > "$STUBS/openssl" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  s_client) cat > /dev/null ;;
  x509) [[ -n "$CERT_END" ]] && echo "notAfter=$CERT_END" ;;
esac
EOF
cat > "$STUBS/journalctl" <<'EOF'
#!/usr/bin/env bash
for ((i=0; i<ERRORS; i++)); do echo '{"level":"error","event":"api_request_failed"}'; done
echo '{"level":"warn","event":"api_request_failed"}'
EOF
chmod +x "$STUBS"/*

export PATH="$STUBS:$PATH" HEARTBEAT_LOG="$WORK/hb" BACKUP_DIR="$WORK/backups" CERT_HOST="pos.example.test"
export MONITOR_HEARTBEAT_URL="https://hc.example/monitor"
mkdir -p "$BACKUP_DIR/recent"
healthy() {
  export HEALTH_BODY='{"ok":true}' SERVICE_STATE=active DISK_USED=40 ERRORS=0
  export CERT_END="$(date -u -d '+60 days' '+%b %e %H:%M:%S %Y GMT')"
  rm -f "$BACKUP_DIR/recent/"*; touch -d '-2 hours' "$BACKUP_DIR/recent/pos-now.dump"
  : > "$HEARTBEAT_LOG"
}
run() { "$ROOT/scripts/monitor.sh" > "$WORK/out" 2>&1; }
last_url() { grep -E '^https://' "$HEARTBEAT_LOG" | tail -1; }
expect_problem() {  # $1 = text that must reach the alert, $2 = description
  if run; then fail "$2: monitor reported all good"; fi
  [[ "$(last_url)" == "https://hc.example/monitor/fail" ]] || fail "$2: no /fail ping"
  grep -q "$1" "$HEARTBEAT_LOG" || fail "$2: alert body lacks '$1': $(cat "$HEARTBEAT_LOG")"
  pass "$2"
}

healthy
run || fail "a healthy server was reported as failing: $(cat "$WORK/out")"
[[ "$(last_url)" == "https://hc.example/monitor" ]] || fail "success ping not sent"
pass "a healthy server pings success and exits 0"

healthy; HEALTH_BODY='{"ok":false,"reason":"database-unreachable"}'; expect_problem "database-unreachable" "a failing health check alerts with the app's own reason"
healthy; SERVICE_STATE=inactive; expect_problem "not active" "a stopped service alerts"
healthy; DISK_USED=91; expect_problem "91% full" "a nearly full disk alerts"
healthy; CERT_END="$(date -u -d '+5 days' '+%b %e %H:%M:%S %Y GMT')"; expect_problem "certificate for pos.example.test expires in" "a certificate expiring within 14 days alerts"
healthy; CERT_END=""; expect_problem "Could not read the HTTPS certificate" "an unreadable certificate alerts"
healthy; touch -d '-30 hours' "$BACKUP_DIR/recent/pos-now.dump"; expect_problem "Newest backup is 30 hours old" "a stale backup alerts"
healthy; rm -f "$BACKUP_DIR/recent/"*; expect_problem "No backups" "missing backups alert"
healthy; ERRORS=25; expect_problem "25 server errors" "a burst of server errors alerts (warnings are not counted)"
healthy; ERRORS=5; run || fail "five errors are under the limit"; pass "a few errors stay under the alert limit"

healthy; DISK_USED=95; SERVICE_STATE=failed
if run; then fail "two problems reported as healthy"; fi
grep -q "95% full" "$HEARTBEAT_LOG" && grep -q "'failed'" "$HEARTBEAT_LOG" || fail "both problems must be in one alert"
pass "several problems arrive together in one alert"

healthy; CERT_HOST=""; run || fail "no CERT_HOST must skip the certificate check"; pass "the certificate check is skipped when no host is set"

echo "$PASSES monitor checks passed"
