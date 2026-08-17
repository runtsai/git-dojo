#!/usr/bin/env bash
# test-check.sh — verify that each lesson's check.sh grades the canonical
# passing scenario as fully correct.  For each of lessons 01–07 this script:
#   1. Runs setup.sh (creates a fresh playground)
#   2. Replays the passing learner actions
#   3. Runs check.sh and asserts no FAIL: lines appear
#
# Usage: bash git-dojo/test-check.sh
# Exit code: 0 = all pass, 1 = one or more failures.
set -euo pipefail

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

# ── Helpers ──────────────────────────────────────────────────────────────────

ok()   { printf "  \033[1;32mPASS\033[0m  %s\n" "$*"; PASS=$((PASS+1)); }
fail() { printf "  \033[1;31mFAIL\033[0m  %s\n" "$*"; FAIL=$((FAIL+1)); }
step() { printf "\n\033[1;34m» %s\033[0m\n" "$*"; }

# run_grader <lesson_dir> <label>
# Runs check.sh; fails if any FAIL: line appears or the exit code is non-zero.
run_grader() {
  local lesson_dir="$1" label="$2"
  local tmpout rc=0
  tmpout="$(mktemp)"
  bash "$lesson_dir/check.sh" 2>&1 | tee "$tmpout" || rc=$?
  if grep -q "^FAIL:" "$tmpout" 2>/dev/null; then
    fail "$label — check.sh reported one or more FAIL lines"
  elif [ "$rc" -ne 0 ]; then
    fail "$label — check.sh exited with code $rc"
  else
    ok "$label — all grader checks PASS"
  fi
  rm -f "$tmpout"
}

# run_grader_expect_fail <lesson_dir> <label> <expected_fail_fragment>
# Runs check.sh in an intentionally incomplete scenario.
# Asserts: (a) check.sh exits non-zero or emits at least one FAIL: line,
#          (b) at least one FAIL: line contains expected_fail_fragment.
run_grader_expect_fail() {
  local lesson_dir="$1" label="$2" fragment="$3"
  local tmpout rc=0
  tmpout="$(mktemp)"
  bash "$lesson_dir/check.sh" 2>&1 | tee "$tmpout" || rc=$?
  local fail_lines
  fail_lines="$(grep "^FAIL:" "$tmpout" 2>/dev/null || true)"
  if [ -z "$fail_lines" ] && [ "$rc" -eq 0 ]; then
    fail "$label — expected a FAIL line or non-zero exit but got neither"
  elif ! printf '%s\n' "$fail_lines" | grep -qF "$fragment"; then
    fail "$label — expected FAIL line containing '$fragment' not found; got: $fail_lines"
  else
    ok "$label — check.sh correctly emitted FAIL: …$fragment…"
  fi
  rm -f "$tmpout"
}

# ── Isolated git identity ─────────────────────────────────────────────────────
CHECK_HOME="$(mktemp -d)"
export HOME="$CHECK_HOME"
export GIT_CONFIG_GLOBAL="$CHECK_HOME/.gitconfig"
unset XDG_CONFIG_HOME GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL \
      GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL 2>/dev/null || true

git config --global user.name  "Check Runner"
git config --global user.email "check-runner@example.invalid"
git config --global init.defaultBranch main
git config --global merge.conflictstyle merge

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 01 — First Snapshot
# ═════════════════════════════════════════════════════════════════════════════
step "Lesson 01 — First Snapshot"
LESSON_01="$LESSONS_DIR/lesson-01-first-snapshot"
bash "$LESSON_01/setup.sh" > /dev/null 2>&1

PLAY_01="$LESSONS_DIR/playground/lesson-01"
cd "$PLAY_01"
git init -q
git symbolic-ref HEAD refs/heads/main
git add notes.txt
git commit -qm "Start tracking working notes"
printf "\nAdded first real entry.\n" >> notes.txt
git add notes.txt
git commit -qm "Add first entry to working notes"
printf "Ideas for the project\n- Use Git for everything\n" > ideas.txt
git add ideas.txt
git commit -qm "Add ideas file for future reference"

run_grader "$LESSON_01" "Lesson 01"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 02 — The Ledger
# ═════════════════════════════════════════════════════════════════════════════
step "Lesson 02 — The Ledger"
LESSON_02="$LESSONS_DIR/lesson-02-the-ledger"
bash "$LESSON_02/setup.sh" > /dev/null 2>&1

PLAY_02="$LESSONS_DIR/playground/lesson-02"
cd "$PLAY_02"
FEE_HASH=$(git log --format="%h %s" -- pricing.txt | grep -i "fee" | grep -iv "Add pricing" | awk '{print $1}' | head -1)
printf "Audit: the delivery fee was raised in commit %s\nThis commit modified pricing.txt to increase the fee.\n" "$FEE_HASH" > audit.txt
git add audit.txt
git commit -qm "Audit: record the fee-change commit for traceability"

run_grader "$LESSON_02" "Lesson 02"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 03 — Undo Without Erasing
# ═════════════════════════════════════════════════════════════════════════════
step "Lesson 03 — Undo Without Erasing"
LESSON_03="$LESSONS_DIR/lesson-03-undo-without-erasing"
bash "$LESSON_03/setup.sh" > /dev/null 2>&1

PLAY_03="$LESSONS_DIR/playground/lesson-03"
cd "$PLAY_03"
git revert --no-edit HEAD > /dev/null 2>&1
TEMP_HASH=$(git log --format="%H %s" | grep -i "temporary" | awk '{print $1}' | head -1)
git revert --no-edit "$TEMP_HASH" > /dev/null 2>&1

run_grader "$LESSON_03" "Lesson 03"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 04 — Branches
# ═════════════════════════════════════════════════════════════════════════════
step "Lesson 04 — Branches"
LESSON_04="$LESSONS_DIR/lesson-04-branches"
bash "$LESSON_04/setup.sh" > /dev/null 2>&1

PLAY_04="$LESSONS_DIR/playground/lesson-04"
cd "$PLAY_04"
git switch -qc new-tagline
sed -i 's/We haul it right\./Clean records. Moved right./' index.html
git add index.html
git commit -qm "Update tagline to Clean records. Moved right."
git switch -q main
git merge -q new-tagline --no-edit
git switch -qc bad-idea
sed -i 's/<h1>RTS Freight<\/h1>/<h1>RTS Mega Ultra Freight Corp<\/h1>/' index.html
git add index.html
git commit -qm "Rename company (bad idea)"
git switch -q main
git branch -D bad-idea

run_grader "$LESSON_04" "Lesson 04"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 05 — The Conflict
# ═════════════════════════════════════════════════════════════════════════════
step "Lesson 05 — The Conflict"
LESSON_05="$LESSONS_DIR/lesson-05-the-conflict"
bash "$LESSON_05/setup.sh" > /dev/null 2>&1

PLAY_05="$LESSONS_DIR/playground/lesson-05"
cd "$PLAY_05"
git merge -q insurance-adjustment --no-edit
git merge fuel-adjustment --no-edit 2>/dev/null || true
sed -i '/^<\{7\}/d; /^=\{7\}/d; /^>\{7\}/d' pricing.txt
sed -i 's/Delivery fee: \$80/Delivery fee: \$95/' pricing.txt
git add pricing.txt
git commit -q --no-edit

run_grader "$LESSON_05" "Lesson 05"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 06 — Fake GitHub
# ═════════════════════════════════════════════════════════════════════════════
step "Lesson 06 — Fake GitHub"
LESSON_06="$LESSONS_DIR/lesson-06-fake-github"
bash "$LESSON_06/setup.sh" > /dev/null 2>&1

PLAY_06="$LESSONS_DIR/playground/lesson-06"
cd "$PLAY_06/laptop"
printf "RTS Freight services\nFull truckload, LTL, and hazmat.\n" > services.txt
git add services.txt
git commit -qm "Add services page"
git push -q

cd "$PLAY_06"
git clone -q hub/website.git contractor 2>/dev/null
cd contractor
git config user.name "Contractor"
git config user.email "contractor@example.com"
printf "Contact us\nphone: 555-0100\nemail: info@rts.example\n" > contact.txt
git add contact.txt
git commit -qm "Add contact page"
git push -q

cd "$PLAY_06/laptop"
git pull -q

run_grader "$LESSON_06" "Lesson 06"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 07 — Capstone: Contractor Review
# ═════════════════════════════════════════════════════════════════════════════
step "Lesson 07 — Capstone: Contractor Review"
LESSON_07="$LESSONS_DIR/lesson-07-capstone-contractor-review"
bash "$LESSON_07/setup.sh" > /dev/null 2>&1

PLAY_07="$LESSONS_DIR/playground/lesson-07"
cd "$PLAY_07"
cat > review.txt <<'REVIEW'
Contractor Delivery Review

FINDING 1: api_key credential planted in config.txt
The contractor added a live api_key (api_key=sk-live-...) to config.txt.
This is a secret/credential that must never be committed to a repository.

FINDING 2: unauthorized cloud upload behavior change
The contractor silently changed upload_to_cloud from false to true in config.txt.
This silent behavior change was not authorized and poses a data-exposure risk.

DISPOSITION: about.txt adopted (clean); config.txt change rejected — credential must be removed
REVIEW
git add review.txt
git commit -qm "Add contractor delivery review with findings and disposition"

git restore --source=contractor-delivery -- about.txt
git add about.txt
git commit -qm "Adopt about page from contractor delivery"

run_grader "$LESSON_07" "Lesson 07"

# ═════════════════════════════════════════════════════════════════════════════
# Sad-path: Lesson 01 with only 2 commits (ideas.txt step skipped)
# Verifies the grader catches an incomplete scenario and names the right check.
# ═════════════════════════════════════════════════════════════════════════════
step "Lesson 01 sad-path — only 2 commits, ideas.txt never committed"
bash "$LESSON_01/setup.sh" > /dev/null 2>&1

cd "$PLAY_01"
git init -q
git symbolic-ref HEAD refs/heads/main
git add notes.txt
git commit -qm "Start tracking working notes"
printf "\nAdded first real entry.\n" >> notes.txt
git add notes.txt
git commit -qm "Add first entry to working notes"
# Deliberately omit the third commit (ideas.txt) to trigger the grader's
# "At least 3 commits sealed" and "ideas.txt exists and is committed" checks.

run_grader_expect_fail "$LESSON_01" \
  "Lesson 01 sad-path (2 commits, no ideas.txt)" \
  "At least 3 commits sealed"

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────────────────
rm -rf "$CHECK_HOME"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
printf "\n\033[1m════════════════════════════════\033[0m\n"
printf "\033[1mtest-check.sh: %d PASS / %d FAIL\033[0m\n" "$PASS" "$FAIL"
printf "\033[1m════════════════════════════════\033[0m\n\n"

if [ "$FAIL" -gt 0 ]; then
  echo "One or more grader checks FAILED. See output above." >&2
  exit 1
fi
exit 0
