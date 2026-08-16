#!/usr/bin/env bash
# test-reset.sh — verify that reset.sh exits cleanly whether or not any
# lesson playgrounds have been run yet.
#
# Usage: bash git-dojo/test-reset.sh
# Exit code: 0 = all pass, 1 = one or more failures.
set -euo pipefail

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

ok()   { printf "  \033[1;32mPASS\033[0m  %s\n" "$*"; PASS=$((PASS+1)); }
fail() { printf "  \033[1;31mFAIL\033[0m  %s\n" "$*"; FAIL=$((FAIL+1)); }

# Run reset.sh inside a temp directory that mirrors the git-dojo layout.
# Copies only reset.sh into the temp root and manages the playground itself.
run_reset_in() {
  local tmp_root="$1"
  # reset.sh does: cd "$(dirname "$0")" then rm -rf playground
  # So we copy it into the temp root and run it from there.
  cp "$LESSONS_DIR/reset.sh" "$tmp_root/reset.sh"
  bash "$tmp_root/reset.sh" > /dev/null 2>&1
}

# ─────────────────────────────────────────────────────────────────────────────
# Case 1: playground exists with several lesson subdirectories
# ─────────────────────────────────────────────────────────────────────────────
printf "\n\033[1;34m» reset.sh — playground already populated\033[0m\n"

TMP1="$(mktemp -d)"
mkdir -p "$TMP1/playground/lesson-01"
mkdir -p "$TMP1/playground/lesson-02"
mkdir -p "$TMP1/playground/lesson-03"
printf "some content\n" > "$TMP1/playground/lesson-01/notes.txt"

if run_reset_in "$TMP1"; then
  ok "reset exits 0 when playground exists with lesson dirs"
else
  fail "reset exited non-zero when playground exists with lesson dirs"
fi

if [ ! -d "$TMP1/playground" ]; then
  ok "playground directory removed after reset"
else
  fail "playground directory still present after reset"
fi

rm -rf "$TMP1"

# ─────────────────────────────────────────────────────────────────────────────
# Case 2: playground does not exist (fresh checkout / no lessons run yet)
# ─────────────────────────────────────────────────────────────────────────────
printf "\n\033[1;34m» reset.sh — no playground (fresh checkout)\033[0m\n"

TMP2="$(mktemp -d)"
# Do NOT create a playground directory — simulate a fresh checkout.

if run_reset_in "$TMP2"; then
  ok "reset exits 0 when playground does not exist"
else
  fail "reset exited non-zero when playground does not exist"
fi

rm -rf "$TMP2"

# ─────────────────────────────────────────────────────────────────────────────
# Case 3: playground is empty (exists but no lessons inside)
# ─────────────────────────────────────────────────────────────────────────────
printf "\n\033[1;34m» reset.sh — empty playground directory\033[0m\n"

TMP3="$(mktemp -d)"
mkdir -p "$TMP3/playground"

if run_reset_in "$TMP3"; then
  ok "reset exits 0 when playground is empty"
else
  fail "reset exited non-zero when playground is empty"
fi

if [ ! -d "$TMP3/playground" ]; then
  ok "empty playground directory removed after reset"
else
  fail "empty playground directory still present after reset"
fi

rm -rf "$TMP3"

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
printf "\n\033[1m════════════════════════════════\033[0m\n"
printf "\033[1mtest-reset.sh: %d PASS / %d FAIL\033[0m\n" "$PASS" "$FAIL"
printf "\033[1m════════════════════════════════\033[0m\n\n"

if [ "$FAIL" -gt 0 ]; then
  echo "One or more reset checks FAILED. See output above." >&2
  exit 1
fi
exit 0
