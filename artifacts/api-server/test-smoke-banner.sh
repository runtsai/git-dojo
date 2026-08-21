#!/usr/bin/env bash
# test-smoke-banner.sh
# Tests the handle_smoke_result function from start-and-smoke.sh in isolation,
# without starting a real server or running the actual smoke check.
#
# Three cases:
#   1. FAILED → PASSED : recovery banner must appear
#   2. UNKNOWN → PASSED : normal "✅ Smoke check passed" must appear
#   3. UNKNOWN → FAILED : failure message must appear and state file written

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Helpers ──────────────────────────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✅ $1"; (( PASS_COUNT++ )) || true; }
fail() { echo "  ❌ $1"; (( FAIL_COUNT++ )) || true; }

assert_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if echo "${haystack}" | grep -qF "${needle}"; then
    pass "${label}"
  else
    fail "${label} — expected to find: ${needle}"
    echo "     Output was:"
    echo "${haystack}" | sed 's/^/       /'
  fi
}

assert_not_contains() {
  local label="$1"
  local haystack="$2"
  local needle="$3"
  if ! echo "${haystack}" | grep -qF "${needle}"; then
    pass "${label}"
  else
    fail "${label} — expected NOT to find: ${needle}"
  fi
}

assert_file_contains() {
  local label="$1"
  local file="$2"
  local needle="$3"
  if [ -f "${file}" ] && grep -qF "${needle}" "${file}"; then
    pass "${label}"
  else
    fail "${label} — file '${file}' does not contain: ${needle}"
  fi
}

# ── Load the functions under test ────────────────────────────────────────────
# Source start-and-smoke.sh with guards so the server-startup code never runs.
# We define PORT (required by set -u) and stub out the server/curl sections by
# setting _SOURCING_FOR_TEST which the sourced file is not aware of — but we
# only need the functions that are defined before any top-level imperative code.
# Because handle_smoke_result and write_smoke_result are defined before the
# server launch section, we can source up to that point using a temporary copy.

TMP_SOURCE=$(mktemp /tmp/start-and-smoke-testable-XXXXXX.sh)
# Extract only the function definitions (everything up to the server launch marker).
sed -n '1,/^# ── 1\. Start server/p' "${SCRIPT_DIR}/start-and-smoke.sh" \
  | grep -v 'node --enable-source-maps' \
  > "${TMP_SOURCE}"
# Remove the set -u so PORT doesn't need to be real; keep pipefail.
sed -i 's/^set -uo pipefail/set -o pipefail/' "${TMP_SOURCE}"

# Provide dummy values for variables used by write_smoke_result.
PORT=9999
# SMOKE_RESULT_FILE and SMOKE_STATE_FILE are overridden per test below.
# shellcheck source=/dev/null
source "${TMP_SOURCE}"
rm -f "${TMP_SOURCE}"

# ── Test setup ───────────────────────────────────────────────────────────────

# Use a temp directory for all state files so tests are isolated.
TEST_TMP=$(mktemp -d /tmp/smoke-banner-test-XXXXXX)
trap 'rm -rf "${TEST_TMP}"' EXIT

# ── Case 1: FAILED → PASSED (recovery banner) ────────────────────────────────
echo ""
echo "Case 1: FAILED → PASSED — recovery banner should appear"

SMOKE_STATE_FILE="${TEST_TMP}/case1-state"
SMOKE_RESULT_FILE="${TEST_TMP}/case1-result.json"
export SMOKE_STATE_FILE SMOKE_RESULT_FILE

# Simulate a pre-existing FAILED state.
echo "FAILED" > "${SMOKE_STATE_FILE}"

OUTPUT=$(handle_smoke_result "FAILED" 0)

assert_contains \
  "recovery banner headline is present" \
  "${OUTPUT}" \
  "SMOKE CHECK RECOVERED"

assert_contains \
  "recovery banner shows previous run FAILED" \
  "${OUTPUT}" \
  "previous run had FAILED, now PASSED"

assert_contains \
  "recovery banner confirms rollback" \
  "${OUTPUT}" \
  "Rollback confirmed: API is healthy again"

assert_not_contains \
  "normal ✅ line is absent during recovery" \
  "${OUTPUT}" \
  "✅ Smoke check passed"

assert_not_contains \
  "failure warning is absent on a passing run" \
  "${OUTPUT}" \
  "⚠️  Smoke check FAILED"

assert_file_contains \
  "state file updated to PASSED" \
  "${SMOKE_STATE_FILE}" \
  "PASSED"

assert_file_contains \
  "result JSON records passed:true" \
  "${SMOKE_RESULT_FILE}" \
  '"passed":true'

# ── Case 2: UNKNOWN → PASSED (normal happy path) ─────────────────────────────
echo ""
echo "Case 2: UNKNOWN → PASSED — normal '✅ Smoke check passed' line"

SMOKE_STATE_FILE="${TEST_TMP}/case2-state"
SMOKE_RESULT_FILE="${TEST_TMP}/case2-result.json"
export SMOKE_STATE_FILE SMOKE_RESULT_FILE

# No prior state file exists (UNKNOWN path).
rm -f "${SMOKE_STATE_FILE}"

OUTPUT=$(handle_smoke_result "UNKNOWN" 0)

assert_contains \
  "normal ✅ line appears" \
  "${OUTPUT}" \
  "✅ Smoke check passed"

assert_not_contains \
  "recovery banner is absent on the UNKNOWN path" \
  "${OUTPUT}" \
  "SMOKE CHECK RECOVERED"

assert_not_contains \
  "failure warning is absent on a passing run" \
  "${OUTPUT}" \
  "⚠️  Smoke check FAILED"

assert_file_contains \
  "state file written as PASSED" \
  "${SMOKE_STATE_FILE}" \
  "PASSED"

assert_file_contains \
  "result JSON records passed:true" \
  "${SMOKE_RESULT_FILE}" \
  '"passed":true'

# ── Case 3: UNKNOWN → FAILED ─────────────────────────────────────────────────
echo ""
echo "Case 3: UNKNOWN → FAILED — failure warning and state file"

SMOKE_STATE_FILE="${TEST_TMP}/case3-state"
SMOKE_RESULT_FILE="${TEST_TMP}/case3-result.json"
export SMOKE_STATE_FILE SMOKE_RESULT_FILE

rm -f "${SMOKE_STATE_FILE}"

OUTPUT=$(handle_smoke_result "UNKNOWN" 1)

assert_contains \
  "failure warning appears" \
  "${OUTPUT}" \
  "⚠️  Smoke check FAILED"

assert_not_contains \
  "recovery banner is absent on failure" \
  "${OUTPUT}" \
  "SMOKE CHECK RECOVERED"

assert_not_contains \
  "normal ✅ line is absent on failure" \
  "${OUTPUT}" \
  "✅ Smoke check passed"

assert_file_contains \
  "state file written as FAILED" \
  "${SMOKE_STATE_FILE}" \
  "FAILED"

assert_file_contains \
  "result JSON records passed:false" \
  "${SMOKE_RESULT_FILE}" \
  '"passed":false'

# ── Case 4: PASSED → PASSED (already passing, stays normal) ──────────────────
echo ""
echo "Case 4: PASSED → PASSED — no recovery banner, normal ✅ line"

SMOKE_STATE_FILE="${TEST_TMP}/case4-state"
SMOKE_RESULT_FILE="${TEST_TMP}/case4-result.json"
export SMOKE_STATE_FILE SMOKE_RESULT_FILE

echo "PASSED" > "${SMOKE_STATE_FILE}"

OUTPUT=$(handle_smoke_result "PASSED" 0)

assert_contains \
  "normal ✅ line appears when already PASSED" \
  "${OUTPUT}" \
  "✅ Smoke check passed"

assert_not_contains \
  "recovery banner is absent when already PASSED" \
  "${OUTPUT}" \
  "SMOKE CHECK RECOVERED"

# ── Case 5: Mutation test — broken handle_smoke_result is detected ────────────
# Override handle_smoke_result with a deliberately broken implementation that
# emits the normal ✅ line instead of the recovery banner on a FAILED → PASSED
# transition.  Run the real Case-1 assert_contains / assert_not_contains helpers
# (inherited from this scope) against the output of the broken function inside a
# subshell.  The subshell must exit 1, proving the production assertions catch
# the regression.  If it exits 0 the assertions are not effective.
echo ""
echo "Case 5: Mutation test — broken handle_smoke_result is caught by the real assertions"

MUTATION_CAUGHT=0
(
  # Reset counters so the subshell tracks only its own assertions.
  FAIL_COUNT=0
  PASS_COUNT=0

  # Set up isolated state files.
  SMOKE_STATE_FILE="${TEST_TMP}/mut-state"
  SMOKE_RESULT_FILE="${TEST_TMP}/mut-result.json"
  export SMOKE_STATE_FILE SMOKE_RESULT_FILE
  echo "FAILED" > "${SMOKE_STATE_FILE}"

  # Override handle_smoke_result with a broken version:
  # always emits "✅ Smoke check passed", never the recovery banner.
  handle_smoke_result() {
    local prev_status="$1"
    local smoke_passed="$2"
    if [ "${smoke_passed}" -eq 0 ]; then
      echo "PASSED" > "${SMOKE_STATE_FILE}"
      write_smoke_result "true"
      echo ""
      echo "✅ Smoke check passed"   # BUG: missing recovery banner when prev=FAILED
    else
      echo "FAILED" > "${SMOKE_STATE_FILE}"
      write_smoke_result "false"
      echo ""
      echo "⚠️  Smoke check FAILED — check the output above"
    fi
  }

  # Call the broken function with the same arguments as Case 1.
  OUTPUT=$(handle_smoke_result "FAILED" 0)

  # Run the real production assertions — these are the same helpers used in
  # all other cases; they are inherited from the outer scope.
  assert_contains \
    "recovery banner headline is present" \
    "${OUTPUT}" \
    "SMOKE CHECK RECOVERED"

  assert_contains \
    "recovery banner shows previous run FAILED" \
    "${OUTPUT}" \
    "previous run had FAILED, now PASSED"

  assert_contains \
    "recovery banner confirms rollback" \
    "${OUTPUT}" \
    "Rollback confirmed: API is healthy again"

  assert_not_contains \
    "normal ✅ line is absent during recovery" \
    "${OUTPUT}" \
    "✅ Smoke check passed"

  # Broken function → at least some assertions must have failed.
  [ "${FAIL_COUNT}" -gt 0 ] && exit 1
  exit 0
) > /dev/null 2>&1 || MUTATION_CAUGHT=1
# (subshell output suppressed — it is expected ❌ noise from the broken function)

if [ "${MUTATION_CAUGHT}" -eq 1 ]; then
  pass "mutation test: broken handle_smoke_result was caught by the real assertions"
else
  fail "mutation test: broken handle_smoke_result was NOT caught — assertions are ineffective"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
echo "══════════════════════════════════════════"
echo ""

if [ "${FAIL_COUNT}" -gt 0 ]; then
  exit 1
fi
