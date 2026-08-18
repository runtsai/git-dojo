#!/usr/bin/env bash
# test-setup.sh — verify that every lesson's setup.sh produces the expected
# files, git repos, branches, and history.  Runs each setup in a fresh temp
# directory so lessons never interfere with each other or with the real
# playground.
#
# Usage: bash git-dojo/test-setup.sh
# Exit code: 0 = all pass, 1 = one or more failures.
set -euo pipefail

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

# ── Helpers ──────────────────────────────────────────────────────────────────

ok()   { printf "  \033[1;32mPASS\033[0m  %s\n" "$*"; PASS=$((PASS+1)); }
fail() { printf "  \033[1;31mFAIL\033[0m  %s\n" "$*"; FAIL=$((FAIL+1)); }

# assert_file <path> <description>
assert_file() {
  if [ -f "$1" ]; then ok "$2"; else fail "$2 — file missing: $1"; fi
}

# assert_dir <path> <description>
assert_dir() {
  if [ -d "$1" ]; then ok "$2"; else fail "$2 — dir missing: $1"; fi
}

# assert_contains <file> <pattern> <description>
assert_contains() {
  if grep -qF "$2" "$1" 2>/dev/null; then
    ok "$3"
  else
    fail "$3 — pattern not found in $1: $2"
  fi
}

# assert_not_contains <file> <pattern> <description>
assert_not_contains() {
  if ! grep -qF "$2" "$1" 2>/dev/null; then
    ok "$3"
  else
    fail "$3 — unexpected pattern found in $1: $2"
  fi
}

# assert_git_repo <dir> <description>
assert_git_repo() {
  if git -C "$1" rev-parse --git-dir > /dev/null 2>&1; then
    ok "$3"
  else
    fail "$3 — not a git repo: $1"
  fi
}

# assert_commit_count <dir> <n> <description>
assert_commit_count() {
  local count
  count=$(git -C "$1" rev-list --count HEAD 2>/dev/null || echo 0)
  if [ "$count" -eq "$2" ]; then
    ok "$3 (${count} commits)"
  else
    fail "$3 — expected $2 commits, got $count"
  fi
}

# assert_branch_exists <dir> <branch> <description>
assert_branch_exists() {
  if git -C "$1" show-ref --verify --quiet "refs/heads/$2" 2>/dev/null; then
    ok "$3"
  else
    fail "$3 — branch '$2' not found in $1"
  fi
}

# assert_current_branch <dir> <branch> <description>
assert_current_branch() {
  local b
  b=$(git -C "$1" symbolic-ref --short HEAD 2>/dev/null || echo "")
  if [ "$b" = "$2" ]; then
    ok "$3"
  else
    fail "$3 — expected branch '$2', got '$b'"
  fi
}

# assert_remote <dir> <remote> <description>
assert_remote() {
  if git -C "$1" remote | grep -q "^$2$" 2>/dev/null; then
    ok "$3"
  else
    fail "$3 — remote '$2' not found in $1"
  fi
}

# assert_bare_repo <dir> <description>
assert_bare_repo() {
  if git -C "$1" rev-parse --is-bare-repository 2>/dev/null | grep -q "^true$"; then
    ok "$2"
  else
    fail "$2 — not a bare repo: $1"
  fi
}

# assert_contains_on_branch <dir> <branch> <file> <pattern> <description>
assert_contains_on_branch() {
  local content
  content=$(git -C "$1" show "$2:$3" 2>/dev/null || echo "")
  if echo "$content" | grep -qF "$4"; then
    ok "$5"
  else
    fail "$5 — pattern not found on branch $2 in $3: $4"
  fi
}

# ── Isolated setup runner ─────────────────────────────────────────────────────
# Copies a single lesson dir into a fresh temp root, runs setup.sh there, and
# returns the temp root path via stdout.  The temp root simulates the git-dojo
# directory so that "cd $(dirname $0)/.." inside setup.sh lands in an isolated
# sandbox.

run_setup() {
  local lesson_dir_name="$1"  # e.g. lesson-01-first-snapshot
  local root
  root="$(mktemp -d)"
  cp -r "$LESSONS_DIR/$lesson_dir_name" "$root/"
  bash "$root/$lesson_dir_name/setup.sh" > /dev/null 2>&1
  echo "$root"
}

# ── Git identity for any repo created by the tests themselves ─────────────────
SELFTEST_HOME="$(mktemp -d)"
export HOME="$SELFTEST_HOME"
export GIT_CONFIG_GLOBAL="$SELFTEST_HOME/.gitconfig"
unset XDG_CONFIG_HOME GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL \
      GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL 2>/dev/null || true
git config --global user.name  "Setup Tester"
git config --global user.email "setup-test@example.invalid"
git config --global init.defaultBranch main

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 01 — First Snapshot
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 01 — First Snapshot\033[0m\n"
ROOT=$(run_setup "lesson-01-first-snapshot")
PG="$ROOT/playground/lesson-01"

assert_dir  "$PG"                                  "01: playground/lesson-01 created"
assert_file "$PG/notes.txt"                        "01: notes.txt exists"
assert_contains "$PG/notes.txt" "RTS.AI"          "01: notes.txt contains 'RTS.AI'"

# Lesson 01 deliberately has NO git repo — learner initialises it themselves.
if git -C "$PG" rev-parse --git-dir > /dev/null 2>&1; then
  fail "01: playground should not be a git repo yet"
else
  ok "01: playground is not pre-initialised as a git repo"
fi
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 02 — The Ledger
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 02 — The Ledger\033[0m\n"
ROOT=$(run_setup "lesson-02-the-ledger")
PG="$ROOT/playground/lesson-02"

assert_git_repo     "$PG" "" "02: playground is a git repo"
assert_commit_count "$PG" 5 "02: 5 commits in history"
assert_file "$PG/overview.txt"             "02: overview.txt exists"
assert_file "$PG/pricing.txt"              "02: pricing.txt exists"
assert_file "$PG/dispatch.txt"             "02: dispatch.txt exists"
assert_contains     "$PG/pricing.txt" "\$75" "02: delivery fee raised to \$75"
assert_not_contains "$PG/pricing.txt" "Delivery fee: \$50" "02: old \$50 delivery fee replaced"
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 03 — Undo Without Erasing
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 03 — Undo Without Erasing\033[0m\n"
ROOT=$(run_setup "lesson-03-undo-without-erasing")
PG="$ROOT/playground/lesson-03"

assert_git_repo     "$PG" "" "03: playground is a git repo"
assert_commit_count "$PG" 4 "03: 4 commits in history"
assert_file "$PG/manual.txt"                           "03: manual.txt exists"
assert_file "$PG/notes.txt"                            "03: notes.txt exists"
assert_not_contains "$PG/manual.txt" "Lock out power" "03: defective step removed from manual"
assert_contains     "$PG/notes.txt"  "TODO delete"    "03: temporary note present (the deliberate mistake)"
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 04 — Branches
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 04 — Branches\033[0m\n"
ROOT=$(run_setup "lesson-04-branches")
PG="$ROOT/playground/lesson-04"

assert_git_repo      "$PG" ""     "04: playground is a git repo"
assert_current_branch "$PG" "main" "04: on main branch"
assert_commit_count  "$PG" 1      "04: 1 commit in history"
assert_file "$PG/index.html"                     "04: index.html exists"
assert_contains "$PG/index.html" "RTS Freight"  "04: index.html contains 'RTS Freight'"
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 05 — The Conflict
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 05 — The Conflict\033[0m\n"
ROOT=$(run_setup "lesson-05-the-conflict")
PG="$ROOT/playground/lesson-05"

assert_git_repo       "$PG" ""                   "05: playground is a git repo"
assert_current_branch "$PG" "main"               "05: HEAD is on main"
assert_branch_exists  "$PG" "fuel-adjustment"    "05: fuel-adjustment branch exists"
assert_branch_exists  "$PG" "insurance-adjustment" "05: insurance-adjustment branch exists"
assert_file "$PG/pricing.txt"                    "05: pricing.txt exists on main"
assert_contains_on_branch "$PG" "fuel-adjustment"    "pricing.txt" "\$80" "05: fuel branch has \$80"
assert_contains_on_branch "$PG" "insurance-adjustment" "pricing.txt" "\$95" "05: insurance branch has \$95"
assert_contains_on_branch "$PG" "main"              "pricing.txt" "\$50"  "05: main still has original \$50"
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 06 — Fake GitHub
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 06 — Fake GitHub\033[0m\n"
ROOT=$(run_setup "lesson-06-fake-github")
HUB="$ROOT/playground/lesson-06/hub/website.git"
LAPTOP="$ROOT/playground/lesson-06/laptop"

assert_dir            "$HUB"                     "06: bare hub repo directory exists"
assert_bare_repo      "$HUB"                     "06: hub/website.git is a bare repo"
assert_git_repo       "$LAPTOP" ""               "06: laptop is a git repo"
assert_current_branch "$LAPTOP" "main"           "06: laptop is on main"
assert_remote         "$LAPTOP" "origin"         "06: laptop has remote 'origin'"
assert_file "$LAPTOP/site.txt"                   "06: site.txt exists in laptop"
assert_contains "$LAPTOP/site.txt" "RTS Freight" "06: site.txt contains 'RTS Freight'"
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 07 — Capstone: Contractor Review
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 07 — Contractor Review\033[0m\n"
ROOT=$(run_setup "lesson-07-capstone-contractor-review")
PG="$ROOT/playground/lesson-07"

assert_git_repo       "$PG" ""                   "07: playground is a git repo"
assert_current_branch "$PG" "main"               "07: HEAD is on main"
assert_branch_exists  "$PG" "contractor-delivery" "07: contractor-delivery branch exists"
assert_file "$PG/product.txt"                    "07: product.txt exists on main"
assert_file "$PG/config.txt"                     "07: config.txt exists on main"
assert_contains_on_branch "$PG" "contractor-delivery" "about.txt" "ABOUT RTS" \
  "07: contractor branch has about.txt with ABOUT RTS"
assert_contains_on_branch "$PG" "contractor-delivery" "config.txt" "api_key" \
  "07: contractor branch has api_key in config (the risk to spot)"
assert_not_contains "$PG/config.txt" "api_key"   "07: main config.txt has no api_key"
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 08 — The Collision
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 08 — The Collision\033[0m\n"
ROOT=$(run_setup "lesson-08-the-collision")
HUB="$ROOT/playground/lesson-08/hub/handbook.git"
LAPTOP="$ROOT/playground/lesson-08/laptop"

assert_dir            "$HUB"                      "08: bare hub repo directory exists"
assert_bare_repo      "$HUB"                      "08: hub/handbook.git is a bare repo"
assert_git_repo       "$LAPTOP" ""                "08: laptop is a git repo"
assert_current_branch "$LAPTOP" "main"            "08: laptop is on main"
assert_remote         "$LAPTOP" "origin"          "08: laptop has remote 'origin'"
assert_file "$LAPTOP/handbook.txt"                "08: handbook.txt exists"
assert_contains "$LAPTOP/handbook.txt" "OPERATIONS HANDBOOK" \
  "08: handbook.txt contains expected heading"
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 09 — The Standoff
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Lesson 09 — The Standoff\033[0m\n"
ROOT=$(run_setup "lesson-09-the-standoff")
HUB="$ROOT/playground/lesson-09/hub/rates.git"
LAPTOP="$ROOT/playground/lesson-09/laptop"

assert_dir            "$HUB"                     "09: bare hub repo directory exists"
assert_bare_repo      "$HUB"                     "09: hub/rates.git is a bare repo"
assert_git_repo       "$LAPTOP" ""               "09: laptop is a git repo"
assert_current_branch "$LAPTOP" "main"           "09: laptop is on main"
assert_remote         "$LAPTOP" "origin"         "09: laptop has remote 'origin'"
assert_file "$LAPTOP/rates.txt"                  "09: rates.txt exists"
assert_contains "$LAPTOP/rates.txt" "RATE CARD"  "09: rates.txt contains expected heading"
assert_contains "$LAPTOP/rates.txt" "180 per pallet" \
  "09: initial standard-crate rate is 180"
rm -rf "$ROOT"

# ═════════════════════════════════════════════════════════════════════════════
# Git identity warning — partial identity edge cases
# Verifies that lesson-01's HEADS UP block fires when only ONE of user.name /
# user.email is absent (the condition uses OR, so either missing should trigger).
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» Git identity warning — partial identity\033[0m\n"

# Case 1: user.name set, user.email missing → warning must appear.
IDTEST_HOME1="$(mktemp -d)"
ID_ROOT1="$(mktemp -d)"
cp -r "$LESSONS_DIR/lesson-01-first-snapshot" "$ID_ROOT1/"
printf '[user]\n    name = Test User\n' > "$IDTEST_HOME1/.gitconfig"
ID_OUT1="$(HOME="$IDTEST_HOME1" GIT_CONFIG_GLOBAL="$IDTEST_HOME1/.gitconfig" \
  bash "$ID_ROOT1/lesson-01-first-snapshot/setup.sh" 2>&1 || true)"
if echo "$ID_OUT1" | grep -q "HEADS UP"; then
  ok "identity warning (email missing): HEADS UP block printed"
else
  fail "identity warning (email missing): HEADS UP block NOT printed"
fi
if echo "$ID_OUT1" | grep -q "doctor.sh"; then
  ok "identity warning (email missing): doctor.sh hint printed"
else
  fail "identity warning (email missing): doctor.sh hint NOT printed"
fi
rm -rf "$IDTEST_HOME1" "$ID_ROOT1"

# Case 2: user.email set, user.name missing → warning must appear.
IDTEST_HOME2="$(mktemp -d)"
ID_ROOT2="$(mktemp -d)"
cp -r "$LESSONS_DIR/lesson-01-first-snapshot" "$ID_ROOT2/"
printf '[user]\n    email = test@example.invalid\n' > "$IDTEST_HOME2/.gitconfig"
ID_OUT2="$(HOME="$IDTEST_HOME2" GIT_CONFIG_GLOBAL="$IDTEST_HOME2/.gitconfig" \
  bash "$ID_ROOT2/lesson-01-first-snapshot/setup.sh" 2>&1 || true)"
if echo "$ID_OUT2" | grep -q "HEADS UP"; then
  ok "identity warning (name missing): HEADS UP block printed"
else
  fail "identity warning (name missing): HEADS UP block NOT printed"
fi
if echo "$ID_OUT2" | grep -q "doctor.sh"; then
  ok "identity warning (name missing): doctor.sh hint printed"
else
  fail "identity warning (name missing): doctor.sh hint NOT printed"
fi
rm -rf "$IDTEST_HOME2" "$ID_ROOT2"

# ═════════════════════════════════════════════════════════════════════════════
# ERR trap — doctor.sh hint appears when a setup script fails midway
# ─────────────────────────────────────────────────────────────────────────────
# Strategy: shadow git with a fake binary that exits 1 immediately. Lesson-02
# calls `git init` unconditionally early in setup.sh, so this reliably
# triggers the ERR trap after the playground directory is created but before
# setup completes (i.e. "midway").
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» ERR trap — doctor.sh hint on setup failure\033[0m\n"

TRAP_ROOT="$(mktemp -d)"
cp -r "$LESSONS_DIR/lesson-02-the-ledger" "$TRAP_ROOT/"

# Fake git: always fails.
FAKE_BIN="$TRAP_ROOT/bin"
mkdir -p "$FAKE_BIN"
printf '#!/usr/bin/env bash\nexit 1\n' > "$FAKE_BIN/git"
chmod +x "$FAKE_BIN/git"

# Capture combined stdout+stderr; allow non-zero exit so the test script
# itself does not abort (set -e is active).
TRAP_OUT="$(PATH="$FAKE_BIN:$PATH" bash "$TRAP_ROOT/lesson-02-the-ledger/setup.sh" 2>&1 || true)"

if echo "$TRAP_OUT" | grep -q "doctor.sh"; then
  ok "ERR trap: doctor.sh hint printed when setup fails midway"
else
  fail "ERR trap: doctor.sh hint NOT found — output was: $TRAP_OUT"
fi

# Confirm the exit code is non-zero so callers know setup did not succeed.
TRAP_STATUS=0
PATH="$FAKE_BIN:$PATH" bash "$TRAP_ROOT/lesson-02-the-ledger/setup.sh" >/dev/null 2>&1 \
  || TRAP_STATUS=$?
if [ "$TRAP_STATUS" -ne 0 ]; then
  ok "ERR trap: setup.sh exits non-zero when a command fails mid-run"
else
  fail "ERR trap: setup.sh exited 0 despite git failing — trap may be suppressing the exit"
fi

rm -rf "$TRAP_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
# ERR trap — bare-hub layout (lesson-06) also fires doctor.sh hint
# Strategy: shadow git with a failing binary. Lesson-06 calls `git init --bare`
# immediately, reliably triggering the ERR trap in the bare-hub layout.
# ─────────────────────────────────────────────────────────────────────────────
printf "\n\033[1;34m» ERR trap — doctor.sh hint on setup failure (bare-hub layout, lesson-06)\033[0m\n"

TRAP_ROOT06="$(mktemp -d)"
cp -r "$LESSONS_DIR/lesson-06-fake-github" "$TRAP_ROOT06/"

FAKE_BIN06="$TRAP_ROOT06/bin"
mkdir -p "$FAKE_BIN06"
printf '#!/usr/bin/env bash\nexit 1\n' > "$FAKE_BIN06/git"
chmod +x "$FAKE_BIN06/git"

TRAP_OUT06="$(PATH="$FAKE_BIN06:$PATH" bash "$TRAP_ROOT06/lesson-06-fake-github/setup.sh" 2>&1 || true)"

if echo "$TRAP_OUT06" | grep -q "doctor.sh"; then
  ok "ERR trap (bare-hub): doctor.sh hint printed when lesson-06 setup fails midway"
else
  fail "ERR trap (bare-hub): doctor.sh hint NOT found — output was: $TRAP_OUT06"
fi

TRAP_STATUS06=0
PATH="$FAKE_BIN06:$PATH" bash "$TRAP_ROOT06/lesson-06-fake-github/setup.sh" >/dev/null 2>&1 \
  || TRAP_STATUS06=$?
if [ "$TRAP_STATUS06" -ne 0 ]; then
  ok "ERR trap (bare-hub): lesson-06 setup.sh exits non-zero when git fails"
else
  fail "ERR trap (bare-hub): lesson-06 setup.sh exited 0 despite git failing — trap may be suppressing the exit"
fi

rm -rf "$TRAP_ROOT06"

# ═════════════════════════════════════════════════════════════════════════════
# ERR trap text consistency — all lesson setup scripts must share identical
# doctor-hint text so learners always see the same guidance.
# ─────────────────────────────────────────────────────────────────────────────
# Strategy: extract the trap line from each setup.sh (grep for "trap.*ERR"),
# compare every lesson against lesson-01 (the reference), and fail on any
# difference.
# ═════════════════════════════════════════════════════════════════════════════
printf "\n\033[1;34m» ERR trap text — consistent across all lesson setup scripts\033[0m\n"

REFERENCE_TRAP=""
TRAP_MISMATCH=0

for SETUP in "$LESSONS_DIR"/lesson-*/setup.sh; do
  LESSON_NAME="$(basename "$(dirname "$SETUP")")"
  TRAP_LINE="$(grep 'trap .*ERR' "$SETUP" || true)"

  if [ -z "$TRAP_LINE" ]; then
    fail "trap text: no 'trap … ERR' line found in $LESSON_NAME/setup.sh"
    TRAP_MISMATCH=1
    continue
  fi

  if [ -z "$REFERENCE_TRAP" ]; then
    # First lesson sets the reference.
    REFERENCE_TRAP="$TRAP_LINE"
    ok "trap text: $LESSON_NAME — trap line present (reference)"
  elif [ "$TRAP_LINE" = "$REFERENCE_TRAP" ]; then
    ok "trap text: $LESSON_NAME — identical to reference"
  else
    fail "trap text: $LESSON_NAME — differs from lesson-01 reference"
    printf "    expected: %s\n" "$REFERENCE_TRAP"
    printf "    got:      %s\n" "$TRAP_LINE"
    TRAP_MISMATCH=1
  fi
done

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -rf "$SELFTEST_HOME"

# ── Summary ───────────────────────────────────────────────────────────────────
printf "\n\033[1m════════════════════════════════\033[0m\n"
printf "\033[1mtest-setup.sh: %d PASS / %d FAIL\033[0m\n" "$PASS" "$FAIL"
printf "\033[1m════════════════════════════════\033[0m\n\n"

if [ "$FAIL" -gt 0 ]; then
  echo "One or more setup checks FAILED. See output above." >&2
  exit 1
fi
exit 0
