#!/usr/bin/env bash
# Tests scripts/lib/releases.sh with fake builds: adoption of a plain .next,
# refusing incomplete builds, atomic switch, rollback target and pruning.
# Run: npm run test:deploy
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASSES=0
pass() { PASSES=$((PASSES + 1)); echo "PASS $*"; }
fail() { echo "FAIL $*" >&2; exit 1; }

export POS_DIR="$WORK/pos"
mkdir -p "$POS_DIR"
# shellcheck source=../scripts/lib/releases.sh
source "$ROOT/scripts/lib/releases.sh"
fake_build() { mkdir -p "$POS_DIR/.next-build"; echo "$1" > "$POS_DIR/.next-build/BUILD_ID"; }
served() { cat "$POS_DIR/.next/BUILD_ID"; }

# 1. An install from before release folders: .next is a plain directory.
mkdir -p "$POS_DIR/.next"; echo old-build > "$POS_DIR/.next/BUILD_ID"
adopt_plain_build "aaaaaaa-legacy"
[[ -L "$POS_DIR/.next" && "$(active_release)" == "aaaaaaa-legacy" && "$(served)" == old-build ]] || fail "plain .next not adopted"
adopt_plain_build "should-not-happen"
[[ ! -e "$(release_path should-not-happen)" ]] || fail "adoption ran twice"
pass "a plain .next from an older install becomes a release, once, and is still served"

# 2. An incomplete build is refused and the live release is untouched.
mkdir -p "$POS_DIR/.next-build"
if store_build "bbbbbbb-1" 2>/dev/null; then fail "an incomplete build was stored"; fi
[[ "$(served)" == old-build ]] || fail "live release changed after a refused build"
rm -rf "$POS_DIR/.next-build"
pass "a build without BUILD_ID is refused and the live app is untouched"

# 3. A finished build is stored and switched to; the old one becomes 'previous'.
fake_build build-b; store_build "bbbbbbb-1"
[[ ! -e "$POS_DIR/.next-build" ]] || fail "staging folder not moved"
[[ "$(served)" == old-build ]] || fail "storing a build must not switch the live app"
activate_release "bbbbbbb-1"
[[ "$(served)" == build-b && "$(previous_release)" == "aaaaaaa-legacy" ]] || fail "switch or previous record wrong"
[[ ! -e "$POS_DIR/.next.switch" ]] || fail "temporary link left behind"
pass "storing does not change what is served; activating switches it and records the previous release"

# 4. Rollback is activating the previous release; rolling 'forward' again works.
activate_release "$(previous_release)"
[[ "$(served)" == old-build && "$(previous_release)" == "bbbbbbb-1" ]] || fail "rollback wrong"
activate_release "$(previous_release)"
[[ "$(served)" == build-b ]] || fail "roll forward wrong"
if activate_release "does-not-exist" 2>/dev/null; then fail "activating a missing release must fail"; fi
[[ "$(served)" == build-b ]] || fail "a failed activation changed the live app"
pass "rollback switches straight back, and a missing release is refused without touching the live app"

# 5. Pruning keeps the newest three and never the active or previous release.
for n in 2 3 4 5; do fake_build "build-$n"; store_build "ccccccc-$n"; sleep 1; done
activate_release "ccccccc-5"; activate_release "aaaaaaa-legacy"   # previous = ccccccc-5, active = oldest
RELEASE_KEEP=3 prune_releases > /dev/null
left="$(list_releases | sort | tr '\n' ' ')"
[[ -d "$(release_path aaaaaaa-legacy)" && -d "$(release_path ccccccc-5)" ]] || fail "active or previous pruned: $left"
[[ "$(list_releases | wc -l)" -eq 3 ]] || fail "expected 3 releases kept, have: $left"
[[ -d "$(release_path ccccccc-4)" ]] || fail "the newest other release should be kept: $left"
pass "pruning keeps three releases and never removes the active or previous one"

# 6. The build's relative links (Next.js links node_modules/<pkg>-<hash> to
#    ../../node_modules/<pkg>) must still resolve once the build is a release.
#    Nesting releases one level deeper broke every API route (the database driver
#    could not load), so this guards the layout.
mkdir -p "$POS_DIR/node_modules/pg"; echo "module.exports = 1" > "$POS_DIR/node_modules/pg/index.js"
fake_build build-links; mkdir -p "$POS_DIR/.next-build/node_modules"
ln -s ../../node_modules/pg "$POS_DIR/.next-build/node_modules/pg-0123456789abcdef"
[[ -f "$POS_DIR/.next-build/node_modules/pg-0123456789abcdef/index.js" ]] || fail "fixture link does not resolve in staging"
store_build "ddddddd-links"; activate_release "ddddddd-links"
[[ -f "$POS_DIR/.next/node_modules/pg-0123456789abcdef/index.js" && -f "$(release_path ddddddd-links)/node_modules/pg-0123456789abcdef/index.js" ]] \
  || fail "the build's relative module links broke when it became a release"
pass "the build's relative module links still resolve once it is a release"

[[ "$(release_commit "1a2b3c4-20261117T230000Z")" == 1a2b3c4 ]] || fail "release_commit"
pass "a release name gives back the commit it was built from"

echo "$PASSES deploy release checks passed"
