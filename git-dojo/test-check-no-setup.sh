#!/usr/bin/env bash
# test-check-no-setup.sh — verify that each lesson's check.sh emits at least one
# "FAIL:" line (suitable for selftest.sh's counter) when the playground folder
# has never been created by setup.sh.
#
# Called by selftest.sh; exits 0 only if every lesson behaves correctly.
set -euo pipefail

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
PLAYGROUND="$LESSONS_DIR/playground"

pass=0
fail=0

check_lesson_no_setup() {
  local lesson_dir="$1"
  local label
  label="$(basename "$lesson_dir")"

  # Remove the lesson's playground folder if it exists, so check.sh sees a
  # clean "never set up" state.  We restore nothing — the caller (selftest.sh)
  # runs this section before any setup, or cleans up itself.
  local slot
  slot="$PLAYGROUND/${label#lesson-}"
  # lesson dirs are like "lesson-01-first-snapshot"; playground slots are
  # "lesson-01", so strip the suffix after the two-digit number.
  slot="$PLAYGROUND/$(echo "$label" | grep -oE 'lesson-[0-9]+')"
  rm -rf "$slot"

  # Capture check.sh output without letting a non-zero exit abort this script.
  local out
  out="$(bash "$lesson_dir/check.sh" 2>&1 || true)"

  # Count FAIL: lines in the output.
  local fail_count
  fail_count="$(echo "$out" | grep -c '^FAIL:' || true)"

  if [ "$fail_count" -ge 1 ]; then
    echo "PASS: $label check.sh emits FAIL line when playground missing"
    pass=$((pass + 1))
  else
    echo "FAIL: $label check.sh produced no FAIL: line when playground missing (got: $out)"
    fail=$((fail + 1))
  fi
}

for lesson_dir in "$LESSONS_DIR"/lesson-*/; do
  check_lesson_no_setup "${lesson_dir%/}"
done

echo
echo "Score: $pass PASS / $fail FAIL"
[ "$fail" -eq 0 ]
