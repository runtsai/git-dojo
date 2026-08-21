#!/usr/bin/env bash
# test-check-no-git.sh — verify that each lesson's check.sh emits at least one
# "FAIL:" line when setup populated the playground but no Git repository was
# initialized (or its Git metadata was lost).
#
# Called by selftest.sh; exits 0 only if every lesson behaves correctly.
set -euo pipefail

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
PLAYGROUND="$LESSONS_DIR/playground"

pass=0
fail=0

strip_git_metadata() {
  local slot="$1"

  # Keep the files setup.sh created, but remove both ordinary working-copy
  # metadata and bare repositories used by the multi-repo lessons.
  find "$slot" -type d \( -name .git -o -name '*.git' \) -prune -exec rm -rf {} +
  find "$slot" -type f -name .git -delete
}

check_lesson_no_git() {
  local lesson_dir="$1"
  local label
  label="$(basename "$lesson_dir")"

  # Derive the playground slot for this lesson (e.g. lesson-01).
  local slot
  slot="$PLAYGROUND/$(echo "$label" | grep -oE 'lesson-[0-9]+')"

  # Let setup.sh create the lesson's seed files and repository layout first.
  # The test then models Git metadata disappearing before the learner starts.
  rm -rf "$slot"
  local setup_out setup_rc
  if setup_out="$(bash "$lesson_dir/setup.sh" 2>&1)"; then
    setup_rc=0
  else
    setup_rc=$?
  fi

  if [ "$setup_rc" -ne 0 ] || [ ! -d "$slot" ]; then
    echo "FAIL: $label setup.sh did not create the seed playground (got: $setup_out)"
    fail=$((fail + 1))
    rm -rf "$slot"
    return
  fi

  strip_git_metadata "$slot"

  # Make sure the scenario really has seed files but no Git metadata before
  # invoking check.sh.
  local seed_file remaining_git
  seed_file="$(find "$slot" -type f -print -quit)"
  if [ -z "$seed_file" ]; then
    echo "FAIL: $label test removed the seed files along with Git metadata"
    fail=$((fail + 1))
    rm -rf "$slot"
    return
  fi

  remaining_git="$(find "$slot" \( -name .git -o -name '*.git' \) -print -quit)"
  if [ -n "$remaining_git" ]; then
    echo "FAIL: $label test could not remove Git metadata: $remaining_git"
    fail=$((fail + 1))
    rm -rf "$slot"
    return
  fi

  # Capture check.sh output without letting its expected non-zero exit abort
  # this script.
  local out
  out="$(bash "$lesson_dir/check.sh" 2>&1 || true)"

  # Count FAIL: lines in the grader output.
  local fail_count
  fail_count="$(echo "$out" | grep -c '^FAIL:' || true)"

  if [ "$fail_count" -ge 1 ]; then
    echo "PASS: $label check.sh emits FAIL line when playground has files but no Git repo"
    pass=$((pass + 1))
  else
    echo "FAIL: $label check.sh produced no FAIL: line when Git metadata was missing (got: $out)"
    fail=$((fail + 1))
  fi

  # Clean up the populated slot so subsequent test phases start fresh.
  rm -rf "$slot"
}

for lesson_dir in "$LESSONS_DIR"/lesson-*/; do
  check_lesson_no_git "${lesson_dir%/}"
done

echo
echo "Score: $pass PASS / $fail FAIL"
[ "$fail" -eq 0 ]