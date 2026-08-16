#!/usr/bin/env bash
# test-doctor.sh — regression tests for doctor.sh.
# Creates isolated temp environments, triggers each failure condition, and
# asserts that the matching [FAIL] line appears (or doesn't appear for the
# happy path).
#
# Usage:  bash git-dojo/test-doctor.sh
# Also invoked by selftest.sh.

set -uo pipefail

DOCTOR_SRC="$(cd "$(dirname "$0")" && pwd)/doctor.sh"

PASS_TOTAL=0
FAIL_TOTAL=0

# ── helpers ───────────────────────────────────────────────────────────────────

step() { printf "\n\033[1;34m» %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32mPASS\033[0m  %s\n" "$*"; PASS_TOTAL=$((PASS_TOTAL+1)); }
fail() { printf "  \033[1;31mFAIL\033[0m  %s\n" "$*"; FAIL_TOTAL=$((FAIL_TOTAL+1)); }

# assert_fail <label> <output>
# Passes when [FAIL] appears anywhere in output.
assert_fail() {
  local label="$1" output="$2"
  if echo "$output" | grep -q "\[FAIL\]"; then
    ok "$label — [FAIL] detected as expected"
  else
    fail "$label — expected [FAIL] but none appeared"
    echo "    output was:"
    echo "$output" | sed 's/^/    /'
  fi
}

# assert_not_contains <label> <needle> <output>
# Passes when <needle> does NOT appear anywhere in output.
assert_not_contains() {
  local label="$1" needle="$2" output="$3"
  if echo "$output" | grep -qF "$needle"; then
    fail "$label — unexpected text found: $needle"
    echo "    output was:"
    echo "$output" | sed 's/^/    /'
  else
    ok "$label — correctly absent: $needle"
  fi
}

# assert_contains <label> <needle> <output>
# Passes when <needle> appears anywhere in output.
assert_contains() {
  local label="$1" needle="$2" output="$3"
  if echo "$output" | grep -qF "$needle"; then
    ok "$label — fix command found: $needle"
  else
    fail "$label — expected fix command not found: $needle"
    echo "    output was:"
    echo "$output" | sed 's/^/    /'
  fi
}

# assert_pass <label> <output>
# Passes when no [FAIL] appears in output.
assert_pass() {
  local label="$1" output="$2"
  if echo "$output" | grep -q "\[FAIL\]"; then
    fail "$label — unexpected [FAIL] in output"
    echo "    output was:"
    echo "$output" | sed 's/^/    /'
  else
    ok "$label — no [FAIL] (all checks passed)"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# make_base_dojo <dojo_dir> <fake_home>
# Populates <dojo_dir> with the minimal structure that satisfies every check
# except the one under test; sets up a valid git identity in <fake_home>.
# ─────────────────────────────────────────────────────────────────────────────
make_base_dojo() {
  local dojo="$1" home="$2"

  # Copy doctor.sh into the dojo dir so HERE resolves to dojo.
  cp "$DOCTOR_SRC" "$dojo/doctor.sh"

  # Check 3 — no nested folder
  # (nothing needed; just don't create git-dojo/git-dojo etc.)

  # Check 4 — lesson structure
  mkdir -p "$dojo/lesson-01-first-snapshot"
  touch    "$dojo/lesson-01-first-snapshot/setup.sh"

  # Check 5 — playground
  mkdir -p "$dojo/playground"

  # Check 6 + 7 — git identity
  export GIT_CONFIG_GLOBAL="$home/.gitconfig"
  git config --global user.name  "Test Runner"
  git config --global user.email "test@example.invalid"
  git config --global init.defaultBranch main
}

# run_doctor <dojo_dir> <fake_home>
# Runs doctor.sh with HOME pointed at <fake_home> so all home-relative paths
# stay isolated from the real workspace.
run_doctor() {
  local dojo="$1" home="$2"
  HOME="$home" GIT_CONFIG_GLOBAL="$home/.gitconfig" bash "$dojo/doctor.sh" 2>&1
}

# ═════════════════════════════════════════════════════════════════════════════
# TEST 1 — accidental .git in home folder
# ═════════════════════════════════════════════════════════════════════════════
step "Check 1 — accidental .git in home folder"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
mkdir "$H/.git"                   # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "home .git present" "$OUT"
assert_contains "home .git fix command" "rm -rf ~/.git" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 2 — accidental .git inside the dojo folder
# ═════════════════════════════════════════════════════════════════════════════
step "Check 2 — accidental .git inside dojo folder"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
mkdir "$T/.git"                   # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "dojo .git present" "$OUT"
assert_contains "dojo .git fix command" "rm -rf $T/.git" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 3 — nested layout (zip-extracted extra folder)
# ═════════════════════════════════════════════════════════════════════════════
step "Check 3 — nested layout"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
# Create a nested git-dojo folder that has its own setup.sh
mkdir -p "$T/git-dojo"
touch    "$T/git-dojo/setup.sh"   # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "nested folder detected" "$OUT"
assert_contains "nested folder fix command" "bash $T/git-dojo/setup.sh" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 4 — lesson structure missing
# ═════════════════════════════════════════════════════════════════════════════
step "Check 4 — lesson structure missing"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
rm -rf "$T/lesson-01-first-snapshot"   # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "lesson-01 missing" "$OUT"
assert_contains "lesson-01 missing fix command" "bash $T/git-dojo/doctor.sh" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 5 — playground missing
# ═════════════════════════════════════════════════════════════════════════════
step "Check 5 — playground missing"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
rm -rf "$T/playground"            # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "playground missing" "$OUT"
assert_contains "playground missing fix command" "mkdir $T/playground" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 6a — git identity: user.name missing
# ═════════════════════════════════════════════════════════════════════════════
step "Check 6a — git user.name missing"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
git config --global --unset user.name 2>/dev/null || true   # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "user.name unset" "$OUT"
assert_contains "user.name unset fix command" 'git config --global user.name' "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 6b — git identity: user.email missing
# ═════════════════════════════════════════════════════════════════════════════
step "Check 6b — git user.email missing"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
git config --global --unset user.email 2>/dev/null || true  # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "user.email unset" "$OUT"
assert_contains "user.email unset fix command" 'git config --global user.email' "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 7a — init.defaultBranch unset
# ═════════════════════════════════════════════════════════════════════════════
step "Check 7a — init.defaultBranch unset"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
git config --global --unset init.defaultBranch 2>/dev/null || true  # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "defaultBranch unset" "$OUT"
assert_contains "defaultBranch unset fix command" "git config --global init.defaultBranch main" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST 7b — init.defaultBranch set to 'master'
# ═════════════════════════════════════════════════════════════════════════════
step "Check 7b — init.defaultBranch set to 'master'"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
git config --global init.defaultBranch master   # inject the failure
OUT="$(run_doctor "$T" "$H")"
assert_fail     "defaultBranch=master" "$OUT"
assert_contains "defaultBranch=master fix command" "git config --global init.defaultBranch main" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST — git not on PATH (not installed)
# ═════════════════════════════════════════════════════════════════════════════
step "Check 6 — git not on PATH"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
# Build a PATH that contains all existing entries EXCEPT the directory that
# holds the git binary, so 'command -v git' inside doctor.sh returns nothing.
NO_GIT_PATH=""
for dir in $(echo "$PATH" | tr ':' '\n'); do
  [ -x "$dir/git" ] && continue
  NO_GIT_PATH="${NO_GIT_PATH:+$NO_GIT_PATH:}$dir"
done
OUT="$(HOME="$H" GIT_CONFIG_GLOBAL="$H/.gitconfig" PATH="$NO_GIT_PATH" bash "$T/doctor.sh" 2>&1 || true)"
assert_fail         "git not on PATH" "$OUT"
assert_contains     "git not on PATH install guidance" "Git is not installed" "$OUT"
assert_contains     "git not on PATH Windows hint"     "git-scm.com/download/win" "$OUT"
assert_not_contains "git not on PATH no identity fix"  "git config --global" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# HAPPY PATH — all checks should pass, zero [FAIL] lines
# ═════════════════════════════════════════════════════════════════════════════
step "Happy path — all checks pass"
T=$(mktemp -d); H=$(mktemp -d)
make_base_dojo "$T" "$H"
OUT="$(run_doctor "$T" "$H")"
assert_pass "happy path" "$OUT"
rm -rf "$T" "$H"

# ═════════════════════════════════════════════════════════════════════════════
# TEST — renamed dojo folder: fix commands must reference the actual path
# Verifies that none of the fix commands contain the old hardcoded ~/git-dojo
# and that they contain the real directory path instead.
# ═════════════════════════════════════════════════════════════════════════════
step "Renamed folder — fix commands use actual path, not hardcoded ~/git-dojo"

# Use a distinctly non-default name so any leak of ~/git-dojo is obvious.
RENAMED_DIR=$(mktemp -d)
RENAMED_HOME=$(mktemp -d)
RENAMED_DOJO="$RENAMED_DIR/git-dojo-course"
mkdir -p "$RENAMED_DOJO"
make_base_dojo "$RENAMED_DOJO" "$RENAMED_HOME"

# Trigger check 2 (dojo .git) — fix command must show the real path.
mkdir "$RENAMED_DOJO/.git"
OUT="$(HOME="$RENAMED_HOME" GIT_CONFIG_GLOBAL="$RENAMED_HOME/.gitconfig" bash "$RENAMED_DOJO/doctor.sh" 2>&1)"
assert_fail     "renamed: dojo .git detected" "$OUT"
assert_contains "renamed: fix uses actual path" "rm -rf $RENAMED_DOJO/.git" "$OUT"
# The old hardcoded string must not appear anywhere in the output.
if echo "$OUT" | grep -qF '~/git-dojo'; then
  fail "renamed: output still contains hardcoded ~/git-dojo"
else
  ok "renamed: no hardcoded ~/git-dojo found in output"
fi
rm -rf "$RENAMED_DOJO/.git"

# Trigger check 5 (playground missing) — fix command must show the real path.
rm -rf "$RENAMED_DOJO/playground"
OUT="$(HOME="$RENAMED_HOME" GIT_CONFIG_GLOBAL="$RENAMED_HOME/.gitconfig" bash "$RENAMED_DOJO/doctor.sh" 2>&1)"
assert_fail     "renamed: playground missing detected" "$OUT"
assert_contains "renamed: playground fix uses actual path" "mkdir $RENAMED_DOJO/playground" "$OUT"
if echo "$OUT" | grep -qF '~/git-dojo'; then
  fail "renamed: playground fix still contains hardcoded ~/git-dojo"
else
  ok "renamed: no hardcoded ~/git-dojo in playground fix"
fi
mkdir "$RENAMED_DOJO/playground"

rm -rf "$RENAMED_DIR" "$RENAMED_HOME"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
printf "\n\033[1m════════════════════════════════\033[0m\n"
printf "\033[1mtest-doctor complete: %d PASS / %d FAIL\033[0m\n" "$PASS_TOTAL" "$FAIL_TOTAL"
printf "\033[1m════════════════════════════════\033[0m\n\n"

if [ "$FAIL_TOTAL" -gt 0 ]; then
  echo "One or more doctor checks FAILED. See output above." >&2
  exit 1
fi
exit 0
