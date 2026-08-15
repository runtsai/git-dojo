#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Sync to GitHub mirror — failure blocks the merge so divergence is caught immediately
echo ""
echo "── Syncing to GitHub mirror ──────────────────────────────────────────────"
bash "$(dirname "$0")/sync-to-github.sh"
echo "✓ GitHub sync succeeded."
