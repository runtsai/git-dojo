#!/usr/bin/env bash
# test-check-empty-playground.sh — verify that each lesson's check.sh emits at
# least one "FAIL:" line when the playground folder exists but is completely
# empty (e.g. setup.sh was interrupted before it could populate it).
#
# Called by selftest.sh; exits 0 only if every lesson behaves correctly.
set -euo pipefail

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
PLAYGROUND="$LESSONS_DIR/playground"

pass=0
fail=0

check_lesson_empty_playground() {
  local lesson_dir="$1"
  local label
  label="$(basename "$lesson_dir")"

  # Derive the playground slot for this lesson (e.g. lesson-01).
  local slot
  slot="$PLAYGROUND/$(echo "$label" | grep -oE 'lesson-[0-9]+')"

  # Remove any existing content, then re-create the folder empty so check.sh
  # sees a "setup ran but left nothing behind" state.
  rm -rf "$slot"
  mkdir -p "$slot"

  # Capture check.sh output without letting a non-zero exit abort this script.
  local out
  out="$(bash "$lesson_dir/check.sh" 2>&1 || true)"

  # Count FAIL: lines in the output.
  local fail_count
  fail_count="$(echo "$out" | grep -c '^FAIL:' || true)"

  if [ "$fail_count" -ge 1 ]; then
    echo "PASS: $label check.sh emits FAIL line when playground is empty"
    pass=$((pass + 1))
  else
    echo "FAIL: $label check.sh produced no FAIL: line when playground empty (got: $out)"
    fail=$((fail + 1))
  fi

  # Clean up the empty slot so subsequent test phases start fresh.
  rm -rf "$slot"
}

for lesson_dir in "$LESSONS_DIR"/lesson-*/; do
  check_lesson_empty_playground "${lesson_dir%/}"
done

echo
echo "Score: $pass PASS / $fail FAIL"
[ "$fail" -eq 0 ]
