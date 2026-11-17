#!/usr/bin/env bash
# Tests scripts/backup.sh and scripts/restore-check.sh without a database or a
# cloud account: pg_dump, pg_restore, psql, createdb, dropdb, rclone and curl are
# replaced by small stand-ins on PATH. `age` is real, so encryption round-trips
# for real. Run: npm run test:backup
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STUBS="$WORK/bin"; mkdir -p "$STUBS"
PASSES=0
pass() { PASSES=$((PASSES + 1)); echo "PASS $*"; }
fail() { echo "FAIL $*" >&2; exit 1; }

command -v age >/dev/null && command -v age-keygen >/dev/null || fail "age and age-keygen are required (apt install age)"

# --- stand-ins ---------------------------------------------------------------
cat > "$STUBS/pg_dump" <<'EOF'
#!/usr/bin/env bash
# Mimics a custom-format dump; DUMP_MODE=garbage or empty simulates failures.
case "${DUMP_MODE:-good}" in
  good) printf 'PGDMP fake dump of %s at %s\n' "${@: -1}" "$(date +%s%N)" ;;
  garbage) printf 'not a dump\n' ;;
  empty) : ;;
esac
EOF
cat > "$STUBS/pg_restore" <<'EOF'
#!/usr/bin/env bash
# -l FILE: list; succeeds only for our fake custom-format header.
if [[ "$1" == "-l" ]]; then head -c 5 "$2" | grep -q '^PGDMP'; exit; fi
# restore mode: read stdin, must be a dump
head -c 5 | grep -q '^PGDMP'
EOF
cat > "$STUBS/rclone" <<'EOF'
#!/usr/bin/env bash
# Remote "fake:" maps to $FAKE_REMOTE on disk.
map() { echo "${1/fake:/$FAKE_REMOTE/}"; }
case "$1" in
  copyto) mkdir -p "$(dirname "$(map "$3")")"; cp "$2" "$(map "$3")" ;;
  lsf) ls "$(map "$2")" 2>/dev/null || true ;;
  delete) : ;;
  *) exit 2 ;;
esac
EOF
cat > "$STUBS/curl" <<'EOF'
#!/usr/bin/env bash
echo "${@: -1}" >> "$HEARTBEAT_LOG"
EOF
cat > "$STUBS/createdb" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cp "$STUBS/createdb" "$STUBS/dropdb"
cat > "$STUBS/psql" <<'EOF'
#!/usr/bin/env bash
# MISSING_TABLE makes one table absent from the "restore".
[[ -n "${MISSING_TABLE:-}" && "$*" == *"\"$MISSING_TABLE\""* ]] && exit 1
echo 3
EOF
chmod +x "$STUBS"/*

export PATH="$STUBS:$PATH" PG_USER="$(id -un)" POS_DB=pos HEARTBEAT_LOG="$WORK/heartbeats" FAKE_REMOTE="$WORK/remote"
export BACKUP_HEARTBEAT_URL="https://hc.example/backup" RESTORE_HEARTBEAT_URL="https://hc.example/restore"
run_backup() { BACKUP_DIR="$WORK/b" "$ROOT/scripts/backup.sh" >> "$WORK/log" 2>&1; }
recent() { find "$WORK/b/recent" -maxdepth 1 -type f -name 'pos-*.dump' | sort; }

# 1. A normal run keeps a verified, root-only dump, a monthly copy, and pings success.
run_backup || fail "a normal backup run failed: $(tail -5 "$WORK/log")"
[[ "$(recent | wc -l)" -eq 1 ]] || fail "expected one recent dump"
[[ "$(stat -c %a "$(recent)")" == 600 ]] || fail "dump must be mode 600"
[[ "$(find "$WORK/b/monthly" -name 'pos-*.dump' | wc -l)" -eq 1 ]] || fail "expected a monthly copy"
[[ "$(tail -1 "$HEARTBEAT_LOG")" == "https://hc.example/backup" ]] || fail "success heartbeat not sent"
pass "a backup run keeps a verified mode-600 dump and a monthly copy, and pings success"

# 2. A dump that fails verification is not kept, leaves no partial file, and pings /fail.
if DUMP_MODE=garbage run_backup; then fail "a corrupt dump must fail the run"; fi
[[ "$(recent | wc -l)" -eq 1 ]] || fail "a corrupt dump must not be kept"
[[ -z "$(find "$WORK/b/recent" -name '*.partial')" ]] || fail "a partial file was left behind"
[[ "$(tail -1 "$HEARTBEAT_LOG")" == "https://hc.example/backup/fail" ]] || fail "failure heartbeat not sent"
if DUMP_MODE=empty run_backup; then fail "an empty dump must fail the run"; fi
pass "corrupt or empty dumps fail the run, are discarded, and ping /fail"

# 3. Off-site upload without encryption is refused.
if BACKUP_REMOTE=fake:pos run_backup; then fail "an unencrypted upload must be refused"; fi
[[ ! -d "$FAKE_REMOTE" ]] || fail "nothing may reach the remote unencrypted"
grep -q "refusing to upload an unencrypted dump" "$WORK/log" || fail "refusal not explained"
pass "the script refuses to upload when no encryption key is set"

# 4. With a key, only an encrypted copy leaves, and it decrypts to the exact dump.
age-keygen -o "$WORK/key.txt" 2>/dev/null
PUB="$(age-keygen -y "$WORK/key.txt")"
BACKUP_AGE_RECIPIENT="$PUB" BACKUP_REMOTE=fake:pos run_backup || fail "encrypted upload run failed: $(tail -5 "$WORK/log")"
UP="$(find "$FAKE_REMOTE/pos/recent" -type f)"
[[ "$(echo "$UP" | wc -l)" -eq 1 && "$UP" == *.dump.age ]] || fail "expected one .dump.age upload"
[[ -z "$(find "$FAKE_REMOTE" -type f -name '*.dump')" ]] || fail "an unencrypted file reached the remote"
age -d -i "$WORK/key.txt" "$UP" | cmp -s - "$(recent | tail -1)" || fail "the upload does not decrypt to the kept dump"
[[ -n "$(find "$FAKE_REMOTE/pos/monthly" -type f -name '*.dump.age')" ]] || fail "monthly encrypted copy not uploaded"
[[ -z "$(find "$WORK/b" -name '*.age')" ]] || fail "the local encrypted temp copy was not removed"
pass "only an age-encrypted copy is uploaded, and it decrypts to the exact dump"

# 5. Old copies are pruned: recent by age, monthly by count.
touch -d '20 days ago' "$WORK/b/recent/pos-2020-01-01T0000Z.dump"
for m in 01 02 03 04; do touch "$WORK/b/monthly/pos-2019-$m.dump"; done
KEEP_MONTHS=3 run_backup || fail "prune run failed"
[[ ! -f "$WORK/b/recent/pos-2020-01-01T0000Z.dump" ]] || fail "a 20-day-old dump was not pruned"
[[ "$(find "$WORK/b/monthly" -name 'pos-*.dump' | wc -l)" -eq 3 ]] || fail "monthly copies beyond KEEP_MONTHS were not pruned"
[[ -f "$WORK/b/monthly/pos-$(date -u +%Y-%m).dump" ]] || fail "the current month's copy was pruned"
pass "old recent dumps and surplus monthly copies are pruned; the newest are kept"

# 6. A run that starts while another holds the lock skips cleanly.
before="$(recent | wc -l)"
( exec 9>"$WORK/b/.lock"; flock 9; BACKUP_DIR="$WORK/b" "$ROOT/scripts/backup.sh" >> "$WORK/log" 2>&1 ) || fail "an overlapping run must exit 0"
[[ "$(recent | wc -l)" -eq "$before" ]] || fail "an overlapping run must not dump"
pass "an overlapping run skips instead of running twice"

# 7. Restore check: passes on a good dump, fails (and pings /fail) when a table is missing.
BACKUP_DIR="$WORK/b" "$ROOT/scripts/restore-check.sh" >> "$WORK/log" 2>&1 || fail "restore check failed on a good dump: $(tail -5 "$WORK/log")"
[[ "$(tail -1 "$HEARTBEAT_LOG")" == "https://hc.example/restore" ]] || fail "restore success heartbeat not sent"
if MISSING_TABLE=payments BACKUP_DIR="$WORK/b" "$ROOT/scripts/restore-check.sh" >> "$WORK/log" 2>&1; then fail "a restore missing a table must fail"; fi
[[ "$(tail -1 "$HEARTBEAT_LOG")" == "https://hc.example/restore/fail" ]] || fail "restore failure heartbeat not sent"
if SCRATCH_DB=pos BACKUP_DIR="$WORK/b" "$ROOT/scripts/restore-check.sh" >> "$WORK/log" 2>&1; then fail "restoring over the live database name must be refused"; fi
pass "the restore check passes a good dump, fails a missing table, and never targets the live database"

echo "$PASSES backup checks passed"
