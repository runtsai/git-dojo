#!/usr/bin/env bash
# Regression test for selftest.sh: multiple successful-but-empty setup scripts
# must be counted as failures without preventing later lessons from running.
set -euo pipefail

LESSONS_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_DIR="$(dirname "$LESSONS_DIR")"
SANDBOX="$(mktemp -d)"
OUTPUT="$SANDBOX/selftest.out"
trap 'rm -rf "$SANDBOX"' EXIT

cp -a "$WORKSPACE_DIR/scripts" "$SANDBOX/scripts"
mkdir -p "$SANDBOX/artifacts"
cp -a "$WORKSPACE_DIR/artifacts/git-dojo-dashboard" "$SANDBOX/artifacts/"
cp -a "$LESSONS_DIR" "$SANDBOX/git-dojo"

break_setup_without_playground() {
  local lesson_dir="$1" lesson_id="$2" setup_script="$1/setup.sh"
  mv "$setup_script" "$setup_script.real"
  cat > "$setup_script" <<'WRAPPER'
#!/usr/bin/env bash
if [ "${SELFTEST_SETUP_ID:-}" = "__LESSON_ID__" ]; then
  exit 0
fi
exec "$(dirname "$0")/setup.sh.real" "$@"
WRAPPER
  grep 'trap .*ERR' "$setup_script.real" >> "$setup_script"
  sed -i "s/__LESSON_ID__/$lesson_id/" "$setup_script"
  chmod +x "$setup_script"
}

break_setup_without_playground \
  "$SANDBOX/git-dojo/lesson-02-the-ledger" "lesson-02"
break_setup_without_playground \
  "$SANDBOX/git-dojo/lesson-04-branches" "lesson-04"

set +e
SELFTEST_SKIP_CONTINUATION_REGRESSION=1 \
SELFTEST_LOCK_FILE="$SANDBOX/selftest.lock" \
  bash "$SANDBOX/git-dojo/selftest.sh" > "$OUTPUT" 2>&1
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "FAIL: selftest exited 0 after broken setup scripts" >&2
  exit 1
fi

for lesson_id in lesson-02 lesson-04; do
  if ! grep -F "setup.sh did not create playground:" "$OUTPUT" | grep -qF "/$lesson_id"; then
    echo "FAIL: missing setup failure for $lesson_id" >&2
    exit 1
  fi
done

if grep -q "Lesson 02 — learner:" "$OUTPUT" ||
   grep -q "Lesson 04 — learner:" "$OUTPUT"; then
  echo "FAIL: learner steps ran for a lesson without its playground" >&2
  exit 1
fi

grep -qF "Lesson 03 — learner: revert the streamline commit and the temp-note commit" "$OUTPUT"
grep -qF "Lesson 05 — learner: merge insurance-adjustment" "$OUTPUT"
grep -Eq "Selftest complete: [0-9]+ PASS / 2 FAIL" "$OUTPUT"

echo "PASS: selftest continues after broken setup scripts and counts both failures"