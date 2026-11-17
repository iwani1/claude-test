# Release folders for zero-rebuild switch-over and rollback (P3 in docs/FINDINGS.md).
# Sourced by scripts/deploy-vps.sh and tests/deploy-releases.sh; needs POS_DIR.
#
# Layout inside $POS_DIR (all at the same depth as .next, on purpose: a build
# contains relative links, e.g. node_modules/pg-<hash> -> ../../node_modules/pg,
# that only resolve one level below the project root):
#   .next-build/                    staging: `next build` writes here (NEXT_DIST_DIR)
#   .next-release-<name>/           one finished build per deploy, <name> = <sha7>-<UTC time>
#   .next-previous-release          name of the release that was live before the current one
#   .next -> .next-release-<name>   what `next start` serves
#
# The live app only ever reads .next, so building never touches it, and switching
# is a single atomic rename of the link. Rollback points the link back.

RELEASE_KEEP="${RELEASE_KEEP:-3}"
RELEASE_PREFIX=".next-release-"

release_path() { printf '%s/%s%s' "$POS_DIR" "$RELEASE_PREFIX" "$1"; }

# Release names, newest first.
list_releases() {
  local dir
  for dir in $(ls -1td "$POS_DIR/$RELEASE_PREFIX"* 2>/dev/null); do
    [[ -d "$dir" && ! -L "$dir" ]] && printf '%s\n' "${dir##*/$RELEASE_PREFIX}"
  done
  return 0
}

# Name of the release .next points to, or nothing (no link yet).
active_release() {
  [[ -L "$POS_DIR/.next" ]] || return 0
  local target; target="$(readlink "$POS_DIR/.next")"
  printf '%s' "${target##*$RELEASE_PREFIX}"
}

previous_release() {
  [[ -f "$POS_DIR/.next-previous-release" ]] && cat "$POS_DIR/.next-previous-release"
  return 0
}

# A plain .next directory (an install from before release folders) becomes a
# release of its own, so the first new deploy can still roll back to it.
adopt_plain_build() {
  local name="$1"
  [[ -d "$POS_DIR/.next" && ! -L "$POS_DIR/.next" ]] || return 0
  mv "$POS_DIR/.next" "$(release_path "$name")"
  ln -s "$RELEASE_PREFIX$name" "$POS_DIR/.next"
}

# Move a finished staging build into its release folder. Refuses an incomplete one.
store_build() {
  local name="$1"
  [[ -n "$name" && "$name" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "invalid release name '$name'" >&2; return 1; }
  [[ -f "$POS_DIR/.next-build/BUILD_ID" ]] || { echo "the build in .next-build is incomplete (no BUILD_ID)" >&2; return 1; }
  [[ ! -e "$(release_path "$name")" ]] || { echo "release $name already exists" >&2; return 1; }
  mv "$POS_DIR/.next-build" "$(release_path "$name")"
}

# Point .next at a release in one atomic step, remembering what was live before.
activate_release() {
  local name="$1" current
  [[ -n "$name" && -f "$(release_path "$name")/BUILD_ID" ]] || { echo "release '$name' is missing or incomplete" >&2; return 1; }
  current="$(active_release)"
  ln -sfn "$RELEASE_PREFIX$name" "$POS_DIR/.next.switch"
  mv -Tf "$POS_DIR/.next.switch" "$POS_DIR/.next"
  if [[ -n "$current" && "$current" != "$name" ]]; then
    printf '%s\n' "$current" > "$POS_DIR/.next-previous-release"
  fi
}

# Keep $RELEASE_KEEP releases in all: the active one, the previous one, and the
# newest others. Never removes the active or previous release.
prune_releases() {
  local active previous name others=0
  active="$(active_release)"; previous="$(previous_release)"
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    if [[ "$name" == "$active" || "$name" == "$previous" ]]; then continue; fi
    others=$((others + 1))
    if (( others + 2 > RELEASE_KEEP )); then
      rm -rf -- "$(release_path "$name")"
      echo "pruned release $name"
    fi
  done < <(list_releases)
}

# The commit a release was built from (its name starts with the short sha).
release_commit() { printf '%s' "${1%%-*}"; }
