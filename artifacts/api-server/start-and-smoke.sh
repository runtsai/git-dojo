#!/usr/bin/env bash
# start-and-smoke.sh
# Starts the compiled API server, waits for it to be healthy, runs the smoke
# check, then keeps the server alive for the rest of the workflow session.
#
# The workflow sees the port open (set by node) and marks the service ready.
# Smoke check output goes to the same workflow log so failures are visible
# immediately — without needing anyone to trigger the check manually.
#
# Recovery detection: the last smoke result is persisted to a /tmp state file
# so that a FAILED → PASSED transition (rollback confirmed working) is
# highlighted prominently in the log.  The happy path (always-passing) is
# unchanged.

set -uo pipefail

HEALTHZ="http://localhost:${PORT}/api/healthz"

# State file survives within a single Replit workflow session but is wiped on a
# full container restart — which is exactly the scope we care about.
# Both paths can be overridden via environment variables (used by tests).
SMOKE_STATE_FILE="${SMOKE_STATE_FILE:-/tmp/api-smoke-last-status}"

# JSON result file read by the /api/healthz endpoint.  Written atomically so
# the server never reads a partial file.
SMOKE_RESULT_FILE="${SMOKE_RESULT_FILE:-/tmp/api-smoke-result.json}"

write_smoke_result() {
  local passed="$1"   # "true" or "false"
  local checked_at
  checked_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local tmp
  tmp=$(mktemp "${SMOKE_RESULT_FILE}.XXXXXX")
  printf '{"passed":%s,"checkedAt":"%s"}\n' "${passed}" "${checked_at}" > "${tmp}"
  mv "${tmp}" "${SMOKE_RESULT_FILE}"
}

# ── Banner / state-file logic (also sourced by test-smoke-banner.sh) ────────
#
# handle_smoke_result PREV_STATUS SMOKE_PASSED
#   PREV_STATUS  — "FAILED", "PASSED", or "UNKNOWN"
#   SMOKE_PASSED — 0 (passed) or non-zero (failed)
#
# Writes the new status to SMOKE_STATE_FILE, calls write_smoke_result, and
# emits the appropriate banner line(s) to stdout.
handle_smoke_result() {
  local prev_status="$1"
  local smoke_passed="$2"   # 0 = passed, non-zero = failed

  if [ "${smoke_passed}" -eq 0 ]; then
    echo "PASSED" > "${SMOKE_STATE_FILE}"
    write_smoke_result "true"
    echo ""
    if [ "${prev_status}" = "FAILED" ]; then
      echo "🟢 ════════════════════════════════════════════════════════════"
      echo "🟢  SMOKE CHECK RECOVERED  —  previous run had FAILED, now PASSED"
      echo "🟢  Rollback confirmed: API is healthy again"
      echo "🟢 ════════════════════════════════════════════════════════════"
    else
      echo "✅ Smoke check passed"
    fi
  else
    echo "FAILED" > "${SMOKE_STATE_FILE}"
    write_smoke_result "false"
    echo ""
    echo "⚠️  Smoke check FAILED — check the output above"
  fi
}

# ── 1. Start server in background ──────────────────────────────────────────
node --enable-source-maps ./dist/index.mjs &
SERVER_PID=$!

# ── 2. Poll until healthy (max 30 s) ───────────────────────────────────────
echo ""
echo "⏳ Waiting for API server on port ${PORT}..."
READY=0
for i in $(seq 1 30); do
  if curl -s --max-time 2 "${HEALTHZ}" > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "${READY}" -eq 0 ]; then
  # Health poll timed out — treat as a failed deploy so a subsequent healthy
  # startup will be recognised as a recovery.
  echo "FAILED" > "${SMOKE_STATE_FILE}"
  write_smoke_result "false"
  echo "⚠️  Server did not become healthy within 30 s — skipping smoke check"
else
  # ── 3. Read previous smoke result ────────────────────────────────────────
  PREV_STATUS="UNKNOWN"
  if [ -f "${SMOKE_STATE_FILE}" ]; then
    PREV_STATUS=$(cat "${SMOKE_STATE_FILE}")
  fi

  # Clear the stale result file before running smoke so that /api/healthz
  # returns HTTP 200 (smokeStatus: "unknown") during the check itself.
  # Without this, a prior "passed:false" result causes /api/healthz to return
  # 503, which makes the smoke suite fail on its healthz assertion, which
  # rewrites "passed:false" again — a deadlock that prevents recovery.
  # PREV_STATUS is already captured above, so recovery detection is preserved.
  rm -f "${SMOKE_RESULT_FILE}"

  # ── 4. Run smoke check ───────────────────────────────────────────────────
  # SKIP_EXPORT_SMOKE=1: the promo-video export takes ~30 s and requires a
  # display server; skip it on startup.  Run the dedicated api-smoke workflow
  # when you need the full export check.
  echo ""
  echo "🔍 Running api-smoke check against ${HEALTHZ%/healthz}..."
  echo ""
  SMOKE_EXIT=0
  SKIP_EXPORT_SMOKE=1 API_URL="http://localhost:${PORT}" pnpm --filter @workspace/scripts run api-smoke || SMOKE_EXIT=$?
  handle_smoke_result "${PREV_STATUS}" "${SMOKE_EXIT}"
fi

echo ""

# ── 5. Keep the workflow alive by waiting for the server ───────────────────
wait "${SERVER_PID}"
