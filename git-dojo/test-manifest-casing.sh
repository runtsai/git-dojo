#!/usr/bin/env bash
# test-manifest-casing.sh — integration tests for the naming-convention check
# in test-manifest.sh.
#
# Safety design: all fixtures live inside a disposable temp root created by
# mktemp. The real git-dojo/ directory is NEVER written to; only a copy of
# test-manifest.sh and a synthetic lessons.ts are used. The temp root is
# removed in full by an EXIT trap.
#
# Layout inside TMPROOT:
#   TMPROOT/
#     git-dojo/
#       test-manifest.sh   ← copy of the real script
#       lesson-*/           ← individual fixture dirs, created/removed per case
#     artifacts/
#       git-dojo-dashboard/src/content/
#         lessons.ts        ← minimal synthetic manifest
#
# Exit 0 iff all assertions pass; exit 1 on any failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST_CHECK="$SCRIPT_DIR/test-manifest.sh"

pass() { printf "  \033[1;32mPASS\033[0m  %s\n" "$*"; }
fail() { printf "  \033[1;31mFAIL\033[0m  %s\n" "$*"; }

FAILURES=0

# ── Build isolated temp environment ──────────────────────────────────────────
TMPROOT=$(mktemp -d)
FIXTURE_ROOT="$TMPROOT/git-dojo"
LESSONS_DIR="$TMPROOT/artifacts/git-dojo-dashboard/src/content"

cleanup() { rm -rf "$TMPROOT"; }
trap cleanup EXIT

mkdir "$FIXTURE_ROOT"
mkdir -p "$LESSONS_DIR"

# Copy the real manifest check script so it runs with SCRIPT_DIR = FIXTURE_ROOT.
cp "$MANIFEST_CHECK" "$FIXTURE_ROOT/test-manifest.sh"

# Synthetic lessons.ts: contains only lesson-01 and lesson-02 so that any
# fixture folder (lesson-99-*, lesson-10a-*, etc.) triggers the expected FAILs
# without any dependency on real workspace content.
cat > "$LESSONS_DIR/lessons.ts" <<'EOF'
export const CLI_LESSON_IDS = [
  "lesson-01",
  "lesson-02",
] as const;
EOF

# ── Helpers ───────────────────────────────────────────────────────────────────

# Create a fixture directory inside FIXTURE_ROOT.
# Fails loudly (does not use -p) so a path that somehow pre-exists is caught.
make_fixture() {
  local name="$1"
  local path="$FIXTURE_ROOT/$name"
  if [ -e "$path" ]; then
    echo "ERROR: fixture path already exists before test created it: $path" >&2
    exit 1
  fi
  mkdir "$path"
}

# Remove a fixture directory.
remove_fixture() {
  local name="$1"
  rm -rf "$FIXTURE_ROOT/$name"
}

# Run the copied manifest check against the isolated FIXTURE_ROOT.
run_check() {
  bash "$FIXTURE_ROOT/test-manifest.sh" 2>&1 || true
}

# Assert the output contains a FAIL line with the given substring.
assert_fails_with() {
  local label="$1" pattern="$2" output="$3"
  if echo "$output" | grep -qF "$pattern"; then
    pass "$label"
  else
    fail "$label"
    printf "      Expected FAIL containing: %s\n" "$pattern" >&2
    echo "$output" | sed 's/^/        /' >&2
    FAILURES=$((FAILURES + 1))
  fi
}

# Assert the output does NOT contain a FAIL line with the given substring.
assert_no_naming_fail_for() {
  local label="$1" pattern="$2" output="$3"
  if echo "$output" | grep -qF "$pattern"; then
    fail "$label"
    printf "      Unexpected FAIL found: %s\n" "$pattern" >&2
    FAILURES=$((FAILURES + 1))
  else
    pass "$label"
  fi
}

# ── Test cases ────────────────────────────────────────────────────────────────

echo ""
echo "=== Case 1: extra dashes in slug (lesson-99-extra-dash-slug) ==="
# Correctly named; only Check 1 (not in manifest) should fire, not Check 0.
make_fixture "lesson-99-extra-dash-slug"
output=$(run_check)
assert_no_naming_fail_for \
  "naming convention: 'lesson-99-extra-dash-slug' is accepted (extra slug dashes are fine)" \
  "folder 'lesson-99-extra-dash-slug' violates naming convention" \
  "$output"
assert_fails_with \
  "manifest check: 'lesson-99' is flagged as missing from CLI_LESSON_IDS" \
  "folder 'lesson-99' is MISSING from CLI_LESSON_IDS" \
  "$output"
remove_fixture "lesson-99-extra-dash-slug"

echo ""
echo "=== Case 2: alpha-suffixed lesson number (lesson-10a-variant) ==="
make_fixture "lesson-10a-variant"
output=$(run_check)
assert_fails_with \
  "naming convention: 'lesson-10a-variant' is flagged (alpha suffix on number)" \
  "folder 'lesson-10a-variant' violates naming convention" \
  "$output"
remove_fixture "lesson-10a-variant"

echo ""
echo "=== Case 3: uppercase L (Lesson-01-intro) ==="
make_fixture "Lesson-01-intro"
output=$(run_check)
assert_fails_with \
  "naming convention: 'Lesson-01-intro' is flagged (uppercase L)" \
  "folder 'Lesson-01-intro' violates naming convention" \
  "$output"
remove_fixture "Lesson-01-intro"

echo ""
echo "=== Case 4: all-caps (LESSON-02-branch) ==="
make_fixture "LESSON-02-branch"
output=$(run_check)
assert_fails_with \
  "naming convention: 'LESSON-02-branch' is flagged (all caps)" \
  "folder 'LESSON-02-branch' violates naming convention" \
  "$output"
remove_fixture "LESSON-02-branch"

echo ""
echo "=== Case 5: underscore separator (lesson_01-intro) ==="
make_fixture "lesson_01-intro"
output=$(run_check)
assert_fails_with \
  "naming convention: 'lesson_01-intro' is flagged (underscore separator)" \
  "folder 'lesson_01-intro' violates naming convention" \
  "$output"
remove_fixture "lesson_01-intro"

echo ""
echo "=== Case 6: canonical folder (lesson-01-first-snapshot) ==="
make_fixture "lesson-01-first-snapshot"
output=$(run_check)
assert_no_naming_fail_for \
  "naming convention: 'lesson-01-first-snapshot' is accepted (canonical name)" \
  "folder 'lesson-01-first-snapshot' violates naming convention" \
  "$output"
remove_fixture "lesson-01-first-snapshot"

echo ""
echo "=== Case 7: combined uppercase + underscore (LESSON_01-intro) ==="
make_fixture "LESSON_01-intro"
output=$(run_check)
assert_fails_with \
  "naming convention: 'LESSON_01-intro' is flagged (uppercase + underscore)" \
  "folder 'LESSON_01-intro' violates naming convention" \
  "$output"
remove_fixture "LESSON_01-intro"

echo ""
echo "=== Case 8: underscore/uppercase chars in slug (lesson-01-intro_EXTRA) ==="
make_fixture "lesson-01-intro_EXTRA"
output=$(run_check)
assert_fails_with \
  "naming convention: 'lesson-01-intro_EXTRA' is flagged (invalid chars in slug)" \
  "folder 'lesson-01-intro_EXTRA' violates naming convention" \
  "$output"
remove_fixture "lesson-01-intro_EXTRA"

# ─────────────────────────────────────────────────────────────────────────────
echo ""

if [ "$FAILURES" -eq 0 ]; then
  echo "All casing/separator integration tests passed."
  exit 0
else
  echo "$FAILURES integration test(s) failed." >&2
  exit 1
fi
