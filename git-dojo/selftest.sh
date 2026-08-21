#!/usr/bin/env bash
# selftest.sh — end-to-end smoke test for teammate-mission lessons 08 and 09.
# Plays every mission from scratch in a temp playground and fails loudly on any FAIL.
# Usage: bash git-dojo/selftest.sh
set -euo pipefail

# Serialize concurrent selftest runs so they do not stomp on each other's
# shared playground directories.  The lock is released automatically when
# this process exits (file descriptor 9 is closed by the OS).
exec 9>/tmp/git-dojo-selftest.lock
flock -x 9

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_TOTAL=0
FAIL_TOTAL=0

# ── Helpers ─────────────────────────────────────────────────────────────────

step() { printf "\n\033[1;34m» %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32mPASS\033[0m  %s\n" "$*"; PASS_TOTAL=$((PASS_TOTAL+1)); }
fail() { printf "  \033[1;31mFAIL\033[0m  %s\n" "$*"; FAIL_TOTAL=$((FAIL_TOTAL+1)); }

print_summary() {
  printf "\n\033[1m════════════════════════════════\033[0m\n"
  printf "\033[1mSelftest complete: %d PASS / %d FAIL\033[0m\n" "$PASS_TOTAL" "$FAIL_TOTAL"
  printf "\033[1m════════════════════════════════\033[0m\n\n"
}

# Run a lesson setup without letting `set -e` hide which lesson failed.  A
# failed setup leaves its playground in an unknown state, so stop cleanly
# rather than attempting its learner and grader steps.
run_setup() {
  local lesson_dir="$1" lesson_id="$2" status=0
  bash "$lesson_dir/setup.sh" > /dev/null 2>&1 || status=$?
  if [ "$status" -ne 0 ]; then
    fail "setup.sh exited $status for $lesson_id"
    printf "  (selftest cannot continue for this lesson — aborting)\n" >&2
    print_summary
    exit 1
  fi
}

# Before each lesson's setup.sh, remove any stale playground so selftest never
# relies on setup.sh to clean up.  Fail loudly if the removal itself fails.
assert_clean_playground() {
  local dir="$1"
  rm -rf "$dir"
  if [ -d "$dir" ]; then
    fail "stale playground still exists after rm -rf: $dir"
  fi
}

# After each lesson's setup.sh, assert the playground directory was actually
# created.  If it is missing, emit a clear FAIL that points at the lesson
# rather than letting the next `cd` produce a cryptic "no such directory".
assert_playground_created() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    fail "setup.sh did not create playground: $dir"
    printf "  (selftest cannot continue for this lesson — aborting)\n" >&2
    exit 1
  fi
}

# Run check.sh for a lesson; parse PASS/FAIL lines and update the global counters.
# Uses a temp file to avoid pipeline-subshell variable-scope issues.
# The "|| true" prevents pipefail from aborting selftest when check.sh exits
# non-zero (e.g. when the playground is missing and check.sh emits a FAIL line
# then exits 1 — we still want that FAIL line counted, not a hard abort).
run_check() {
  local lesson_dir="$1"
  local tmpout
  tmpout="$(mktemp)"
  bash "$lesson_dir/check.sh" 2>&1 | tee "$tmpout" || true
  while IFS= read -r line; do
    case "$line" in
      PASS:*) PASS_TOTAL=$((PASS_TOTAL+1)) ;;
      FAIL:*) FAIL_TOTAL=$((FAIL_TOTAL+1)) ;;
    esac
  done < "$tmpout"
  rm -f "$tmpout"
}

# Run check.sh for an intentionally incomplete lesson; require both a non-zero
# exit and a specific FAIL line, without counting the expected FAIL lines in the
# full selftest totals.
run_check_expect_fail() {
  local lesson_dir="$1" label="$2" fragment="$3"
  local tmpout rc=0
  tmpout="$(mktemp)"
  bash "$lesson_dir/check.sh" 2>&1 | tee "$tmpout" || rc=$?
  local fail_lines
  fail_lines="$(grep "^FAIL:" "$tmpout" 2>/dev/null || true)"
  if [ "$rc" -eq 0 ]; then
    fail "$label — expected check.sh to exit non-zero but it exited 0"
  elif ! printf '%s\n' "$fail_lines" | grep -qF "$fragment"; then
    fail "$label — expected FAIL line containing '$fragment' not found; got: $fail_lines"
  else
    ok "$label — check.sh correctly exited non-zero with FAIL: …$fragment…"
  fi
  rm -f "$tmpout"
}

# ─────────────────────────────────────────────────────────────────────────────
# Isolate git identity so the sandbox never touches the real ~/.gitconfig.
# ─────────────────────────────────────────────────────────────────────────────
SELFTEST_HOME="$(mktemp -d)"
export HOME="$SELFTEST_HOME"
export GIT_CONFIG_GLOBAL="$SELFTEST_HOME/.gitconfig"
unset XDG_CONFIG_HOME GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL 2>/dev/null || true

git config --global user.name  "Selftest Runner"
git config --global user.email "selftest@example.invalid"
git config --global init.defaultBranch main
git config --global merge.conflictstyle merge
# Trust all directories so git 2.35+ dubious-ownership checks never fire in CI.
git config --global --add safe.directory '*'

# ═════════════════════════════════════════════════════════════════════════════
# Manifest ↔ folder cross-check
# Verifies that CLI_LESSON_IDS in lessons.ts matches the lesson folders in
# git-dojo/ exactly — no orphan folders, no phantom manifest IDs.
# ═════════════════════════════════════════════════════════════════════════════
step "Manifest ↔ folder cross-check"
if bash "$LESSONS_DIR/test-manifest.sh" 2>&1; then
  ok "test-manifest.sh — all manifest ↔ folder checks passed"
  PASS_TOTAL=$((PASS_TOTAL+1))
else
  fail "test-manifest.sh — manifest and lesson folders are out of sync"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# Doctor script regression tests
# ═════════════════════════════════════════════════════════════════════════════
step "Doctor script checks"
if bash "$LESSONS_DIR/test-doctor.sh" 2>&1; then
  ok "test-doctor.sh — all checks passed"
  PASS_TOTAL=$((PASS_TOTAL+1))
else
  fail "test-doctor.sh — one or more checks failed"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# Sync auto-recovery regression tests
# ═════════════════════════════════════════════════════════════════════════════
step "Sync recovery checks (fast-forward merge completeness + divergence detection)"
if bash "$LESSONS_DIR/test-sync-recovery.sh" 2>&1; then
  ok "test-sync-recovery.sh — all checks passed"
else
  fail "test-sync-recovery.sh — one or more checks failed"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# Course sync recovery regression tests
# ═════════════════════════════════════════════════════════════════════════════
step "Course sync recovery checks (commit preservation + concurrent-push rejection)"
if bash "$LESSONS_DIR/test-course-sync-recovery.sh" 2>&1; then
  ok "test-course-sync-recovery.sh — all checks passed"
else
  fail "test-course-sync-recovery.sh — one or more checks failed"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# Reset script regression tests
# ═════════════════════════════════════════════════════════════════════════════
step "Reset script checks (populated / empty / missing playground)"
if bash "$LESSONS_DIR/test-reset.sh" 2>&1; then
  ok "test-reset.sh — all reset checks passed"
  PASS_TOTAL=$((PASS_TOTAL+1))
else
  fail "test-reset.sh — one or more reset checks failed"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# Setup script regression tests (lessons 01–09)
# ═════════════════════════════════════════════════════════════════════════════
step "Setup script checks (lessons 01–09)"
if bash "$LESSONS_DIR/test-setup.sh" 2>&1; then
  ok "test-setup.sh — all setup checks passed"
  PASS_TOTAL=$((PASS_TOTAL+1))
else
  fail "test-setup.sh — one or more setup checks failed"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# check.sh "no setup" regression tests (lessons 01–09)
# Verifies that each lesson's check.sh emits at least one FAIL: line (counted
# by run_check) when the playground folder has never been created.
# ═════════════════════════════════════════════════════════════════════════════
step "check.sh no-setup checks (lessons 01–09)"
if bash "$LESSONS_DIR/test-check-no-setup.sh" 2>&1; then
  ok "test-check-no-setup.sh — all lessons emit FAIL when playground missing"
  PASS_TOTAL=$((PASS_TOTAL+1))
else
  fail "test-check-no-setup.sh — one or more lessons did not emit a counted FAIL"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# check.sh "empty playground" regression tests (lessons 01–09)
# Verifies that each lesson's check.sh emits at least one FAIL: line when the
# playground folder exists but is completely empty (no git repo, no files).
# ═════════════════════════════════════════════════════════════════════════════
step "check.sh empty-playground checks (lessons 01–09)"
if bash "$LESSONS_DIR/test-check-empty-playground.sh" 2>&1; then
  ok "test-check-empty-playground.sh — all lessons emit FAIL when playground is empty"
  PASS_TOTAL=$((PASS_TOTAL+1))
else
  fail "test-check-empty-playground.sh — one or more lessons did not emit a counted FAIL"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# check.sh "files but no Git" regression tests (lessons 01–09)
# Verifies that each lesson's check.sh emits at least one FAIL: line when setup
# populated the playground but its Git metadata is missing.
# ═════════════════════════════════════════════════════════════════════════════
step "check.sh files-without-Git checks (lessons 01–09)"
if bash "$LESSONS_DIR/test-check-no-git.sh" 2>&1; then
  ok "test-check-no-git.sh — all lessons emit FAIL when Git metadata is missing"
  PASS_TOTAL=$((PASS_TOTAL+1))
else
  fail "test-check-no-git.sh — one or more lessons did not emit a counted FAIL"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

# ═════════════════════════════════════════════════════════════════════════════
# Grader regression tests (lessons 01–07)
# ═════════════════════════════════════════════════════════════════════════════
step "Grader checks (lessons 01–07)"
if bash "$LESSONS_DIR/test-check.sh" 2>&1; then
  ok "test-check.sh — all grader checks passed"
  PASS_TOTAL=$((PASS_TOTAL+1))
else
  fail "test-check.sh — one or more grader checks failed"
  FAIL_TOTAL=$((FAIL_TOTAL+1))
fi

LESSON_01="$LESSONS_DIR/lesson-01-first-snapshot"
PLAY_01="$LESSONS_DIR/playground/lesson-01"

step "Lesson 01 — First Snapshot: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_01"
run_setup "$LESSON_01" "lesson-01"
assert_playground_created "$PLAY_01"

step "Lesson 01 — learner: init, three commits (notes + edit + ideas)"
cd "$PLAY_01"
git init -q
git symbolic-ref HEAD refs/heads/main
# Commit 1: track notes.txt as-is
git add notes.txt
git commit -qm "Start tracking working notes"
# Commit 2: extend notes.txt
printf "\nAdded first real entry.\n" >> notes.txt
git add notes.txt
git commit -qm "Add first entry to working notes"
# Commit 3: create and commit ideas.txt
printf "Ideas for the project\n- Use Git for everything\n" > ideas.txt
git add ideas.txt
git commit -qm "Add ideas file for future reference"

step "Lesson 01 — grader check"
run_check "$LESSON_01"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 02 — The Ledger
# ═════════════════════════════════════════════════════════════════════════════
LESSON_02="$LESSONS_DIR/lesson-02-the-ledger"
PLAY_02="$LESSONS_DIR/playground/lesson-02"

step "Lesson 02 — The Ledger: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_02"
run_setup "$LESSON_02" "lesson-02"
assert_playground_created "$PLAY_02"

step "Lesson 02 — learner: find the fee-change commit and write audit.txt"
cd "$PLAY_02"
FEE_HASH_02=$(git log --format="%h %s" -- pricing.txt | grep -i "fee" | grep -iv "Add pricing" | awk '{print $1}' | head -1)
printf "Audit: the delivery fee was raised in commit %s\nThis commit modified pricing.txt to increase the fee.\n" "$FEE_HASH_02" > audit.txt
git add audit.txt
git commit -qm "Audit: record the fee-change commit for traceability"

step "Lesson 02 — grader check"
run_check "$LESSON_02"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 03 — Undo Without Erasing
# ═════════════════════════════════════════════════════════════════════════════
LESSON_03="$LESSONS_DIR/lesson-03-undo-without-erasing"
PLAY_03="$LESSONS_DIR/playground/lesson-03"

step "Lesson 03 — Undo Without Erasing: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_03"
run_setup "$LESSON_03" "lesson-03"
assert_playground_created "$PLAY_03"

step "Lesson 03 — learner: revert the streamline commit and the temp-note commit"
cd "$PLAY_03"
# Revert HEAD (the streamline commit that removed "Lock out power")
git revert --no-edit HEAD > /dev/null 2>&1
# Find and revert the temporary-note commit
TEMP_HASH=$(git log --format="%H %s" | grep -i "temporary" | awk '{print $1}' | head -1)
git revert --no-edit "$TEMP_HASH" > /dev/null 2>&1

step "Lesson 03 — grader check"
run_check "$LESSON_03"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 04 — Branches
# ═════════════════════════════════════════════════════════════════════════════
LESSON_04="$LESSONS_DIR/lesson-04-branches"
PLAY_04="$LESSONS_DIR/playground/lesson-04"

step "Lesson 04 — Branches: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_04"
run_setup "$LESSON_04" "lesson-04"
assert_playground_created "$PLAY_04"

step "Lesson 04 — learner: new-tagline branch, merge; bad-idea branch, abandon"
cd "$PLAY_04"
# Create new-tagline branch, update tagline, commit
git switch -qc new-tagline
sed -i 's/We haul it right\./Clean records. Moved right./' index.html
git add index.html
git commit -qm "Update tagline to Clean records. Moved right."
# Merge into main
git switch -q main
git merge -q new-tagline --no-edit
# Create bad-idea branch, make a bad change, then abandon it
git switch -qc bad-idea
sed -i 's/<h1>RTS Freight<\/h1>/<h1>RTS Mega Ultra Freight Corp<\/h1>/' index.html
git add index.html
git commit -qm "Rename company (bad idea)"
# Return to main and delete the branch
git switch -q main
git branch -D bad-idea

step "Lesson 04 — grader check"
run_check "$LESSON_04"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 05 — The Conflict
# ═════════════════════════════════════════════════════════════════════════════
LESSON_05="$LESSONS_DIR/lesson-05-the-conflict"
PLAY_05="$LESSONS_DIR/playground/lesson-05"

step "Lesson 05 — The Conflict: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_05"
run_setup "$LESSON_05" "lesson-05"
assert_playground_created "$PLAY_05"

step "Lesson 05 — learner: merge insurance-adjustment (fast-forward), then merge fuel-adjustment (conflict → \$95)"
cd "$PLAY_05"
# Merge insurance-adjustment first: fast-forward, pricing.txt becomes $95
git merge -q insurance-adjustment --no-edit
# Merge fuel-adjustment: conflict between $95 (main) and $80 (fuel-adjustment)
git merge fuel-adjustment --no-edit 2>/dev/null || true
# Resolve: keep $95, drop conflict markers
sed -i '/^<\{7\}/d; /^=\{7\}/d; /^>\{7\}/d' pricing.txt
sed -i 's/Delivery fee: \$80/Delivery fee: \$95/' pricing.txt
git add pricing.txt
git commit -q --no-edit

step "Lesson 05 — grader check"
run_check "$LESSON_05"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 06 — Fake GitHub
# ═════════════════════════════════════════════════════════════════════════════
LESSON_06="$LESSONS_DIR/lesson-06-fake-github"
PLAY_06="$LESSONS_DIR/playground/lesson-06"

step "Lesson 06 — Fake GitHub: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_06"
run_setup "$LESSON_06" "lesson-06"
assert_playground_created "$PLAY_06"

step "Lesson 06 — owner (laptop): add services page and push"
cd "$PLAY_06/laptop"
printf "RTS Freight services\nFull truckload, LTL, and hazmat.\n" > services.txt
git add services.txt
git commit -qm "Add services page"
git push -q

step "Lesson 06 — contractor: clone hub, add contact page and push"
cd "$PLAY_06"
git clone -q hub/website.git contractor 2>/dev/null
cd contractor
git config user.name "Contractor"
git config user.email "contractor@example.com"
printf "Contact us\nphone: 555-0100\nemail: info@rts.example\n" > contact.txt
git add contact.txt
git commit -qm "Add contact page"
git push -q

step "Lesson 06 — owner (laptop): pull contractor's contact page"
cd "$PLAY_06/laptop"
git pull -q

step "Lesson 06 — grader check"
run_check "$LESSON_06"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 07 — Capstone: Contractor Review
# ═════════════════════════════════════════════════════════════════════════════
LESSON_07="$LESSONS_DIR/lesson-07-capstone-contractor-review"
PLAY_07="$LESSONS_DIR/playground/lesson-07"

step "Lesson 07 — Capstone: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_07"
run_setup "$LESSON_07" "lesson-07"
assert_playground_created "$PLAY_07"

step "Lesson 07 — learner: write review.txt with findings and disposition, commit"
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

step "Lesson 07 — learner: cherry-pick about.txt from contractor-delivery, commit"
git restore --source=contractor-delivery -- about.txt
git add about.txt
git commit -qm "Adopt about page from contractor delivery"

step "Lesson 07 — grader check"
run_check "$LESSON_07"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 08 — The Collision
# ═════════════════════════════════════════════════════════════════════════════
LESSON_08="$LESSONS_DIR/lesson-08-the-collision"
PLAY_08="$LESSONS_DIR/playground/lesson-08"

step "Lesson 08 — The Collision: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_08"
run_setup "$LESSON_08" "lesson-08"
assert_playground_created "$PLAY_08"

LAPTOP_08="$LESSONS_DIR/playground/lesson-08/laptop"

step "Lesson 08 — learner: commit the safety section"
cd "$LAPTOP_08"
printf "\nSection 3: Safety\nNo driver dispatches without a rest log.\n" >> handbook.txt
git add handbook.txt
git commit -qm "Add safety section to the handbook"

step "Lesson 08 — bot: Ruth pushes her invoicing commit"
bash "$LESSON_08/bot.sh" > /dev/null 2>&1

step "Lesson 08 — learner: push is rejected, then fetch + merge + push"
cd "$LAPTOP_08"
# Push should be rejected — swallow the error and continue.
if git push 2>/dev/null; then
  fail "push should have been rejected but was accepted"
fi
git fetch -q
git merge -q origin/main --no-edit
git push -q

step "Lesson 08 — grader check"
run_check "$LESSON_08"

step "Lesson 08 — sad path: committed safety section but skipped recovery push"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_08"
run_setup "$LESSON_08" "lesson-08"
assert_playground_created "$PLAY_08"
cd "$PLAY_08/laptop"
printf "\nSection 3: Safety\nNo driver dispatches without a rest log.\n" >> handbook.txt
git add handbook.txt
git commit -qm "Add safety section to the handbook"
bash "$LESSON_08/bot.sh" > /dev/null 2>&1
run_check_expect_fail "$LESSON_08" \
  "Lesson 08 — skipped recovery push is rejected" \
  "Your safety commit made it to the shared remote"

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 09 — The Standoff
# ═════════════════════════════════════════════════════════════════════════════
LESSON_09="$LESSONS_DIR/lesson-09-the-standoff"
PLAY_09="$LESSONS_DIR/playground/lesson-09"

step "Lesson 09 — The Standoff: setup"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_09"
run_setup "$LESSON_09" "lesson-09"
assert_playground_created "$PLAY_09"

LAPTOP_09="$LESSONS_DIR/playground/lesson-09/laptop"

step "Lesson 09 — learner: commit the 200-rate change"
cd "$LAPTOP_09"
sed -i 's/^Standard crate: .*/Standard crate: 200 per pallet/' rates.txt
git add rates.txt
git commit -qm "Set standard crate rate to 200 per signed contract"

step "Lesson 09 — bot: Ruth pushes her competing 195-rate commit"
bash "$LESSON_09/bot.sh" > /dev/null 2>&1

step "Lesson 09 — learner: push rejected, fetch + merge (conflict), resolve, commit, push"
cd "$LAPTOP_09"
# Push rejected.
if git push 2>/dev/null; then
  fail "push should have been rejected but was accepted"
fi
git fetch -q
# Merge will conflict — that is expected; suppress the non-zero exit.
git merge origin/main --no-edit 2>/dev/null || true

# Verify conflict markers appeared in rates.txt.
if grep -qE "^(<{7}|={7}|>{7})" rates.txt; then
  ok "merge conflict markers appeared in rates.txt as expected"
else
  fail "expected merge conflict markers in rates.txt but found none"
fi

# Resolve: keep our "200" line, drop all conflict markers.
sed -i '/^<\{7\}/d; /^=\{7\}/d; /^>\{7\}/d' rates.txt
# Ensure our value (200) is present and Ruth's (195) is gone.
sed -i 's/^Standard crate: 195 per pallet/Standard crate: 200 per pallet/' rates.txt

git add rates.txt
git commit -q --no-edit
git push -q

step "Lesson 09 — grader check"
run_check "$LESSON_09"

step "Lesson 09 — sad path: left the rate conflict unresolved"
cd "$LESSONS_DIR"
assert_clean_playground "$PLAY_09"
run_setup "$LESSON_09" "lesson-09"
assert_playground_created "$PLAY_09"
cd "$PLAY_09/laptop"
sed -i 's/^Standard crate: .*/Standard crate: 200 per pallet/' rates.txt
git add rates.txt
git commit -qm "Set standard crate rate to 200 per signed contract"
bash "$LESSON_09/bot.sh" > /dev/null 2>&1
git fetch -q
git merge origin/main --no-edit 2>/dev/null || true
run_check_expect_fail "$LESSON_09" \
  "Lesson 09 — unresolved conflict is rejected" \
  "No conflict markers left in rates.txt"

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────────────────
rm -rf "$SELFTEST_HOME"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
print_summary

if [ "$FAIL_TOTAL" -gt 0 ]; then
  echo "One or more teammate-mission checks FAILED. See output above." >&2
  exit 1
fi
exit 0
