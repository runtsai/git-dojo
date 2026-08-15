#!/usr/bin/env bash
# sync-to-github.sh — push the local main branch to the public GitHub mirror
#
# Safety guarantees:
#   - Never force-pushes; aborts loudly on divergence
#   - Token is supplied by Replit's GIT_ASKPASS helper at push time — never
#     written to git config, environment files, or log output
#
# When to run:
#   After significant work lands on main (e.g. after a task merge) run:
#
#     bash scripts/sync-to-github.sh
#
#   Or trigger it from the Replit validation panel as "sync-github".
#
# Requirements:
#   - GitHub must be connected in your Replit workspace
#     (Settings → Integrations → GitHub, or via the Git panel).
#   - Run from the workspace shell where REPLIT_ASKPASS_PID2_SESSION is set.

set -euo pipefail

REMOTE="origin"
BRANCH="main"
GITHUB_REPO="https://github.com/runtsai/git-dojo.git"

# ── 1. Sanity checks ─────────────────────────────────────────────────────────

# Must be inside a git repo
git rev-parse --git-dir > /dev/null 2>&1 || { echo "ERROR: not inside a git repository"; exit 1; }

# Confirm the origin remote points to the expected GitHub repo
ACTUAL_URL=$(git remote get-url "$REMOTE" 2>/dev/null || echo "")
if [ "$ACTUAL_URL" != "$GITHUB_REPO" ]; then
  echo "ERROR: remote '${REMOTE}' is '${ACTUAL_URL}', expected '${GITHUB_REPO}'"
  echo "       Refusing to push to an unexpected destination."
  exit 1
fi

# Confirm Replit's GitHub credential helper is available
if ! command -v replit-git-askpass &>/dev/null; then
  echo "ERROR: replit-git-askpass not found."
  echo "       This script relies on Replit's built-in GitHub credential helper."
  echo "       Run it from the Replit workspace shell with GitHub connected."
  exit 1
fi

# Confirm we are on main (or HEAD matches main)
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "ERROR: expected to be on branch '${BRANCH}', but HEAD is '${CURRENT_BRANCH}'."
  echo "       Please switch to ${BRANCH} before syncing."
  exit 1
fi

# ── 2. Fetch to see what GitHub has ──────────────────────────────────────────

echo "Fetching ${REMOTE}/${BRANCH} ..."
# Use GIT_ASKPASS so the token is obtained ephemerally — never stored
GIT_ASKPASS=replit-git-askpass git fetch "$REMOTE" "$BRANCH" 2>&1

LOCAL_SHA=$(git rev-parse "$BRANCH")
REMOTE_SHA=$(git rev-parse "${REMOTE}/${BRANCH}" 2>/dev/null || echo "UNKNOWN")

if [ "$REMOTE_SHA" = "UNKNOWN" ]; then
  echo "WARNING: could not resolve ${REMOTE}/${BRANCH}. Proceeding anyway."
else
  # Check whether remote has commits that local does not
  BASE_SHA=$(git merge-base "$BRANCH" "${REMOTE}/${BRANCH}" 2>/dev/null || echo "")
  if [ -n "$BASE_SHA" ] && [ "$BASE_SHA" != "$REMOTE_SHA" ] && [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
    echo ""
    echo "ERROR: Divergence detected."
    echo "  Local  ${BRANCH}: ${LOCAL_SHA}"
    echo "  Remote ${BRANCH}: ${REMOTE_SHA}"
    echo "  Common ancestor:  ${BASE_SHA}"
    echo ""
    echo "GitHub has commits that are NOT in local main."
    echo "Refusing to push — a force-push would destroy that history."
    echo ""
    echo "To resolve: fetch, inspect the diverging commits, then merge or rebase"
    echo "before running this script again."
    exit 1
  fi

  if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
    echo "Already up-to-date (local and GitHub are at ${LOCAL_SHA})."
    exit 0
  fi
fi

# ── 3. Push ───────────────────────────────────────────────────────────────────

echo "Pushing ${LOCAL_SHA} → ${REMOTE}/${BRANCH} ..."
GIT_ASKPASS=replit-git-askpass git push "$REMOTE" "${BRANCH}:${BRANCH}" 2>&1

echo ""
echo "✓ GitHub mirror synced: https://github.com/runtsai/git-dojo"
echo "  Pushed: ${LOCAL_SHA}"
