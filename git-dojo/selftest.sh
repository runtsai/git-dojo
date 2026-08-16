#!/usr/bin/env bash
# selftest.sh — end-to-end smoke test for teammate-mission lessons 08 and 09.
# Plays every mission from scratch in a temp playground and fails loudly on any FAIL.
# Usage: bash git-dojo/selftest.sh
set -euo pipefail

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS_TOTAL=0
FAIL_TOTAL=0

# ── Helpers ─────────────────────────────────────────────────────────────────

step() { printf "\n\033[1;34m» %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32mPASS\033[0m  %s\n" "$*"; PASS_TOTAL=$((PASS_TOTAL+1)); }
fail() { printf "  \033[1;31mFAIL\033[0m  %s\n" "$*"; FAIL_TOTAL=$((FAIL_TOTAL+1)); }

# Run check.sh for a lesson; parse PASS/FAIL lines and update the global counters.
# Uses a temp file to avoid pipeline-subshell variable-scope issues.
run_check() {
  local lesson_dir="$1"
  local tmpout
  tmpout="$(mktemp)"
  bash "$lesson_dir/check.sh" 2>&1 | tee "$tmpout"
  while IFS= read -r line; do
    case "$line" in
      PASS:*) PASS_TOTAL=$((PASS_TOTAL+1)) ;;
      FAIL:*) FAIL_TOTAL=$((FAIL_TOTAL+1)) ;;
    esac
  done < "$tmpout"
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
# Lesson 08 — The Collision
# ═════════════════════════════════════════════════════════════════════════════
LESSON_08="$LESSONS_DIR/lesson-08-the-collision"

step "Lesson 08 — The Collision: setup"
bash "$LESSON_08/setup.sh" > /dev/null 2>&1

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

# ═════════════════════════════════════════════════════════════════════════════
# Lesson 09 — The Standoff
# ═════════════════════════════════════════════════════════════════════════════
LESSON_09="$LESSONS_DIR/lesson-09-the-standoff"

step "Lesson 09 — The Standoff: setup"
bash "$LESSON_09/setup.sh" > /dev/null 2>&1

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
if grep -qE "^(<<<<<<<|=======|>>>>>>>)" rates.txt; then
  ok "merge conflict markers appeared in rates.txt as expected"
else
  fail "expected merge conflict markers in rates.txt but found none"
fi

# Resolve: keep our "200" line, drop all conflict markers.
sed -i '/^<<<<<<</d; /^=======/d; /^>>>>>>>/d' rates.txt
# Ensure our value (200) is present and Ruth's (195) is gone.
sed -i 's/^Standard crate: 195 per pallet/Standard crate: 200 per pallet/' rates.txt

git add rates.txt
git commit -q --no-edit
git push -q

step "Lesson 09 — grader check"
run_check "$LESSON_09"

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────────────────
rm -rf "$SELFTEST_HOME"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
printf "\n\033[1m════════════════════════════════\033[0m\n"
printf "\033[1mSelftest complete: %d PASS / %d FAIL\033[0m\n" "$PASS_TOTAL" "$FAIL_TOTAL"
printf "\033[1m════════════════════════════════\033[0m\n\n"

if [ "$FAIL_TOTAL" -gt 0 ]; then
  echo "One or more teammate-mission checks FAILED. See output above." >&2
  exit 1
fi
exit 0
