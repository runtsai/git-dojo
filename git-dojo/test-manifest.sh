#!/usr/bin/env bash
# test-manifest.sh — cross-checks lesson folders against the dashboard manifest.
#
# Rules enforced:
#   1. Every lesson-NN folder in git-dojo/ must have its ID in CLI_LESSON_IDS.
#   2. Every ID in CLI_LESSON_IDS must have a corresponding lesson-NN-* folder.
#
# Exit 0 iff all checks pass; exit 1 on any mismatch.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LESSONS_FILE="$SCRIPT_DIR/../artifacts/git-dojo-dashboard/src/content/lessons.ts"

pass() { printf "  \033[1;32mPASS\033[0m  %s\n" "$*"; }
fail() { printf "  \033[1;31mFAIL\033[0m  %s\n" "$*"; }

if [ ! -f "$LESSONS_FILE" ]; then
  fail "lessons.ts not found at $LESSONS_FILE"
  exit 1
fi

# ── Collect folder IDs ────────────────────────────────────────────────────────
# Lesson folders are named lesson-NN-<slug>. The manifest ID is the lesson-NN prefix.
FOLDER_IDS=()
while IFS= read -r folder; do
  id="${folder%%-*-*}"  # strip everything after the second dash
  # fallback: use awk to get the first two dash-separated tokens
  id=$(basename "$folder" | awk -F'-' '{print $1"-"$2}')
  FOLDER_IDS+=("$id")
done < <(find "$SCRIPT_DIR" -maxdepth 1 -type d -name "lesson-*" | sort)

# ── Collect manifest IDs ──────────────────────────────────────────────────────
# Extract lesson IDs from inside the CLI_LESSON_IDS array only — not from
# comments, type aliases, or other parts of the file.
MANIFEST_IDS=()
in_array=0
while IFS= read -r line; do
  # Detect the opening of the CLI_LESSON_IDS array.
  [[ "$line" =~ CLI_LESSON_IDS ]] && in_array=1
  # Detect the closing bracket that ends the array.
  [[ "$in_array" -eq 1 && "$line" =~ \]\ as\ const ]] && in_array=0
  if [[ "$in_array" -eq 1 && "$line" =~ \"(lesson-[^\"]+)\" ]]; then
    MANIFEST_IDS+=("${BASH_REMATCH[1]}")
  fi
done < "$LESSONS_FILE"

FAILURES=0

# ── Check 1: every folder ID must appear in the manifest ─────────────────────
for fid in "${FOLDER_IDS[@]}"; do
  found=0
  for mid in "${MANIFEST_IDS[@]}"; do
    [ "$fid" = "$mid" ] && found=1 && break
  done
  if [ "$found" -eq 1 ]; then
    pass "folder '$fid' is present in CLI_LESSON_IDS"
  else
    fail "folder '$fid' is MISSING from CLI_LESSON_IDS in lessons.ts"
    FAILURES=$((FAILURES + 1))
  fi
done

# ── Check 2: every manifest ID must have a folder ────────────────────────────
for mid in "${MANIFEST_IDS[@]}"; do
  found=0
  for fid in "${FOLDER_IDS[@]}"; do
    [ "$mid" = "$fid" ] && found=1 && break
  done
  if [ "$found" -eq 1 ]; then
    pass "manifest ID '$mid' has a matching lesson folder"
  else
    fail "manifest ID '$mid' has NO matching lesson folder in git-dojo/"
    FAILURES=$((FAILURES + 1))
  fi
done

if [ "$FAILURES" -eq 0 ]; then
  echo ""
  echo "All manifest ↔ folder checks passed."
  exit 0
else
  echo ""
  echo "$FAILURES mismatch(es) detected. Update CLI_LESSON_IDS in lessons.ts or add/remove lesson folders." >&2
  exit 1
fi
