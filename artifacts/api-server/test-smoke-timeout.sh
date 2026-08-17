#!/usr/bin/env bash
# test-smoke-timeout.sh
# Integration test for the READY=0 (health-poll timeout) path in
# start-and-smoke.sh.
#
# Runs the real start-and-smoke.sh with stubbed external commands so the 30-
# second poll loop finishes instantly and no real server or network is needed.
#
# Two scenarios are exercised end-to-end:
#   A. Server never becomes healthy → FAILED state + failed result JSON written
#   B. Next healthy start after a timeout-seeded FAILED state → recovery banner

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ✅ $1"; (( PASS_COUNT++ )) || true; }
fail() { echo "  ❌ $1"; (( FAIL_COUNT++ )) || true; }

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "${haystack}" | grep -qF "${needle}"; then
    pass "${label}"
  else
    fail "${label} — expected to find: ${needle}"
    echo "     Output was:"
    echo "${haystack}" | sed 's/^/       /'
  fi
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if ! echo "${haystack}" | grep -qF "${needle}"; then
    pass "${label}"
  else
    fail "${label} — expected NOT to find: ${needle}"
    echo "     Output was:"
    echo "${haystack}" | sed 's/^/       /'
  fi
}

assert_file_contains() {
  local label="$1" file="$2" needle="$3"
  if [ -f "${file}" ] && grep -qF "${needle}" "${file}"; then
    pass "${label}"
  else
    fail "${label} — file '${file}' does not contain: ${needle}"
    [ -f "${file}" ] && echo "     File contents: $(cat "${file}")"
  fi
}

# ── Shared stubs ──────────────────────────────────────────────────────────────

TEST_TMP=$(mktemp -d /tmp/smoke-timeout-test-XXXXXX)
trap 'rm -rf "${TEST_TMP}"' EXIT

STUBS="${TEST_TMP}/stubs"
mkdir -p "${STUBS}"

# node: exits immediately — `wait $SERVER_PID` returns at once.
cat > "${STUBS}/node" << 'STUB'
#!/bin/bash
exit 0
STUB

# sleep: no-op — the 30-iteration health poll finishes in milliseconds.
cat > "${STUBS}/sleep" << 'STUB'
#!/bin/bash
exit 0
STUB

# pnpm: stub for the smoke-check invocation; controlled via STUB_PNPM_EXIT.
cat > "${STUBS}/pnpm" << 'STUB'
#!/bin/bash
exit "${STUB_PNPM_EXIT:-0}"
STUB

chmod +x "${STUBS}/node" "${STUBS}/sleep" "${STUBS}/pnpm"

# Helper: run start-and-smoke.sh with the stub directory first on PATH.
run_script() {
  local state_file="$1" result_file="$2"
  PATH="${STUBS}:${PATH}" \
  PORT=9999 \
  SMOKE_STATE_FILE="${state_file}" \
  SMOKE_RESULT_FILE="${result_file}" \
  bash "${SCRIPT_DIR}/start-and-smoke.sh" 2>&1
}

# ── Scenario A: server never becomes healthy (curl always fails) ──────────────
echo ""
echo "Scenario A: server never becomes healthy — timeout path writes FAILED"

STATE_A="${TEST_TMP}/state-a"
RESULT_A="${TEST_TMP}/result-a.json"

# curl stub: always exits 1 → READY stays 0 after 30 iterations.
cat > "${STUBS}/curl" << 'STUB'
#!/bin/bash
exit 1
STUB
chmod +x "${STUBS}/curl"

OUTPUT_A=$(run_script "${STATE_A}" "${RESULT_A}")

assert_contains \
  "timeout warning message is emitted" \
  "${OUTPUT_A}" \
  "Server did not become healthy within 30 s"

assert_file_contains \
  "timeout path writes FAILED to state file" \
  "${STATE_A}" \
  "FAILED"

assert_file_contains \
  "timeout path writes passed:false to result JSON" \
  "${RESULT_A}" \
  '"passed":false'

assert_file_contains \
  "result JSON contains a checkedAt timestamp" \
  "${RESULT_A}" \
  '"checkedAt"'

assert_not_contains \
  "smoke check is skipped (no SMOKE CHECK RECOVERED banner)" \
  "${OUTPUT_A}" \
  "SMOKE CHECK RECOVERED"

assert_not_contains \
  "normal ✅ line is absent when timed out" \
  "${OUTPUT_A}" \
  "✅ Smoke check passed"

# ── Scenario B: next healthy start after a timeout-seeded failure ─────────────
echo ""
echo "Scenario B: next healthy start after timeout FAILED → recovery banner"

STATE_B="${TEST_TMP}/state-b"
RESULT_B="${TEST_TMP}/result-b.json"

# Pre-seed the FAILED state exactly as Scenario A would leave it.
cp "${STATE_A}" "${STATE_B}"

# curl stub: succeeds on first call → READY=1.
cat > "${STUBS}/curl" << 'STUB'
#!/bin/bash
exit 0
STUB
chmod +x "${STUBS}/curl"

OUTPUT_B=$(run_script "${STATE_B}" "${RESULT_B}")

assert_contains \
  "recovery banner headline appears" \
  "${OUTPUT_B}" \
  "SMOKE CHECK RECOVERED"

assert_contains \
  "recovery banner references previous FAILED run" \
  "${OUTPUT_B}" \
  "previous run had FAILED, now PASSED"

assert_contains \
  "recovery banner confirms rollback" \
  "${OUTPUT_B}" \
  "Rollback confirmed: API is healthy again"

assert_not_contains \
  "normal ✅ line is absent during recovery" \
  "${OUTPUT_B}" \
  "✅ Smoke check passed"

assert_file_contains \
  "state file updated to PASSED after recovery" \
  "${STATE_B}" \
  "PASSED"

assert_file_contains \
  "result JSON updated to passed:true after recovery" \
  "${RESULT_B}" \
  '"passed":true'

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
echo "══════════════════════════════════════════"
echo ""

if [ "${FAIL_COUNT}" -gt 0 ]; then
  exit 1
fi
