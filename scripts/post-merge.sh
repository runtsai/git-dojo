#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Sync to GitHub mirror (best-effort — failure is logged but never blocks the merge)
echo ""
echo "── Syncing to GitHub mirror ──────────────────────────────────────────────"
if bash "$(dirname "$0")/sync-to-github.sh"; then
  echo "✓ GitHub sync succeeded."
else
  echo "⚠ GitHub sync failed (exit $?). The merge is complete; sync manually when ready:"
  echo "    bash scripts/sync-to-github.sh"
fi
