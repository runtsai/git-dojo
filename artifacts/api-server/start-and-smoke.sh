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
SMOKE_STATE_FILE="/tmp/api-smoke-last-status"

# ── 1. Start server in background ──────────────────────────────────────────
node --enable-source-maps ./dist/index.mjs &
SERVER_PID=$!

# ── 2. Poll until healthy (max 30 s) ───────────────────────────────────────
echo ""
echo "⏳ Waiting for API server on port ${PORT}..."
READY=0
for i in $(seq 1 30); do
  if curl -sf "${HEALTHZ}" > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "${READY}" -eq 0 ]; then
  # Health poll timed out — treat as a failed deploy so a subsequent healthy
  # startup will be recognised as a recovery.
  echo "FAILED" > "${SMOKE_STATE_FILE}"
  echo "⚠️  Server did not become healthy within 30 s — skipping smoke check"
else
  # ── 3. Read previous smoke result ────────────────────────────────────────
  PREV_STATUS="UNKNOWN"
  if [ -f "${SMOKE_STATE_FILE}" ]; then
    PREV_STATUS=$(cat "${SMOKE_STATE_FILE}")
  fi

  # ── 4. Run smoke check ───────────────────────────────────────────────────
  # SKIP_EXPORT_SMOKE=1: the promo-video export takes ~30 s and requires a
  # display server; skip it on startup.  Run the dedicated api-smoke workflow
  # when you need the full export check.
  echo ""
  echo "🔍 Running api-smoke check against ${HEALTHZ%/healthz}..."
  echo ""
  if SKIP_EXPORT_SMOKE=1 API_URL="http://localhost:${PORT}" pnpm --filter @workspace/scripts run api-smoke; then
    echo "PASSED" > "${SMOKE_STATE_FILE}"
    echo ""
    if [ "${PREV_STATUS}" = "FAILED" ]; then
      echo "🟢 ════════════════════════════════════════════════════════════"
      echo "🟢  SMOKE CHECK RECOVERED  —  previous run had FAILED, now PASSED"
      echo "🟢  Rollback confirmed: API is healthy again"
      echo "🟢 ════════════════════════════════════════════════════════════"
    else
      echo "✅ Smoke check passed"
    fi
  else
    echo "FAILED" > "${SMOKE_STATE_FILE}"
    echo ""
    echo "⚠️  Smoke check FAILED — check the output above"
  fi
fi

echo ""

# ── 5. Keep the workflow alive by waiting for the server ───────────────────
wait "${SERVER_PID}"
