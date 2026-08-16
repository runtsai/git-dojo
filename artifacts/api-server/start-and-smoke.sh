#!/usr/bin/env bash
# start-and-smoke.sh
# Starts the compiled API server, waits for it to be healthy, runs the smoke
# check, then keeps the server alive for the rest of the workflow session.
#
# The workflow sees the port open (set by node) and marks the service ready.
# Smoke check output goes to the same workflow log so failures are visible
# immediately — without needing anyone to trigger the check manually.

set -uo pipefail

HEALTHZ="http://localhost:${PORT}/api/healthz"

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
  echo "⚠️  Server did not become healthy within 30 s — skipping smoke check"
else
  # ── 3. Run smoke check ───────────────────────────────────────────────────
  # SKIP_EXPORT_SMOKE=1: the promo-video export takes ~30 s and requires a
  # display server; skip it on startup.  Run the dedicated api-smoke workflow
  # when you need the full export check.
  echo ""
  echo "🔍 Running api-smoke check against ${HEALTHZ%/healthz}..."
  echo ""
  if SKIP_EXPORT_SMOKE=1 API_URL="http://localhost:${PORT}" pnpm --filter @workspace/scripts run api-smoke; then
    echo ""
    echo "✅ Smoke check passed"
  else
    echo ""
    echo "⚠️  Smoke check FAILED — check the output above"
  fi
fi

echo ""

# ── 4. Keep the workflow alive by waiting for the server ───────────────────
wait "${SERVER_PID}"
