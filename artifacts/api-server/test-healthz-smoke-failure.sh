#!/usr/bin/env bash
# test-healthz-smoke-failure.sh
# Runs the compiled API server against a timeout-style smoke result and proves
# that /api/healthz reports the failure without becoming unavailable.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_TMP=$(mktemp -d /tmp/healthz-smoke-failure-test-XXXXXX)
SERVER_PID=""

cleanup() {
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  rm -rf "${TEST_TMP}"
}
trap cleanup EXIT

pass() { echo "  ✅ $1"; }
fail() {
  echo "  ❌ $1"
  exit 1
}

find_available_port() {
  node -e '
    const server = require("node:net").createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => console.log(port));
    });
  '
}

echo ""
echo "Building the compiled API server"
pnpm --dir "${SCRIPT_DIR}" run build

RESULT_FILE="${TEST_TMP}/timeout-result.json"
RESPONSE_FILE="${TEST_TMP}/healthz-response.json"
PORT="$(find_available_port)"

# This is the exact persisted result produced by the READY=0 timeout path in
# start-and-smoke.sh, expressed with a fixed timestamp for deterministic output.
printf '%s\n' '{"passed":false,"checkedAt":"2026-08-21T00:00:00Z"}' > "${RESULT_FILE}"

echo ""
echo "Starting compiled API server with a timeout-style failed smoke result"
PORT="${PORT}" \
SMOKE_RESULT_FILE="${RESULT_FILE}" \
node --enable-source-maps "${SCRIPT_DIR}/dist/index.mjs" \
  > "${TEST_TMP}/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl --silent --output /dev/null \
    "http://127.0.0.1:${PORT}/api/healthz"; then
    break
  fi
  sleep 1
done

if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
  cat "${TEST_TMP}/server.log" >&2
  fail "compiled API server exited before /api/healthz became available"
fi

HTTP_STATUS=$(curl --silent --show-error --output "${RESPONSE_FILE}" \
  --write-out "%{http_code}" \
  "http://127.0.0.1:${PORT}/api/healthz") ||
  fail "could not request /api/healthz from the compiled server"

if [ "${HTTP_STATUS}" = "200" ]; then
  pass "/api/healthz stays available with a failed smoke result"
else
  cat "${RESPONSE_FILE}" >&2
  fail "/api/healthz returned HTTP ${HTTP_STATUS}; expected HTTP 200"
fi

if grep -qF '"passed":false' "${RESPONSE_FILE}"; then
  pass "/api/healthz exposes passed:false from the timeout result file"
else
  cat "${RESPONSE_FILE}" >&2
  fail "/api/healthz response did not contain \"passed\":false"
fi

if grep -qF '"status":"degraded"' "${RESPONSE_FILE}"; then
  pass "/api/healthz marks the failed smoke result as degraded"
else
  cat "${RESPONSE_FILE}" >&2
  fail "/api/healthz response did not report a degraded status"
fi