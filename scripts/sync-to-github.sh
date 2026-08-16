#!/usr/bin/env bash
# sync-to-github.sh — push the local main branch to the public GitHub mirror,
# then automatically sync the learner-facing course repo as well.
#
# This is the single entry point for all post-merge syncs.  Running it once
# keeps BOTH mirrors up-to-date:
#   1. runtsai/git-dojo        — full codebase mirror
#   2. runtsai/git-dojo-course — course content only (git-dojo/ subfolder)
#
# Auth strategy (tried in order):
#   1. Replit GitHub connector token — works from agent shell and automated
#      contexts where REPLIT_CONNECTORS_HOSTNAME + REPL_IDENTITY are available.
#   2. replit-git-askpass — works from the interactive Replit workspace shell
#      where the ASKPASS session is live (human-in-the-loop sessions only).
#
# Safety guarantees:
#   - Never force-pushes the main mirror; aborts loudly on divergence
#   - Token is used ephemerally in-memory — never written to git config,
#     environment files, or log output
#   - The two syncs are INDEPENDENT: a course-sync failure is reported loudly
#     but does not roll back the already-completed main-mirror push; the script
#     exits non-zero so CI / the caller knows something went wrong.
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

set -euo pipefail

REMOTE="origin"
BRANCH="main"
GITHUB_REPO="https://github.com/runtsai/git-dojo.git"
GITHUB_HOST="github.com"
GITHUB_PATH="runtsai/git-dojo.git"

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

# Confirm we are on main (or HEAD matches main)
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "ERROR: expected to be on branch '${BRANCH}', but HEAD is '${CURRENT_BRANCH}'."
  echo "       Please switch to ${BRANCH} before syncing."
  exit 1
fi

# ── 2. Resolve auth — connector token or askpass ──────────────────────────────

# Try the Replit connector API first (works from agent shell + automated runs).
# The token is fetched ephemerally and used only in git URLs; it is never logged.
CONNECTOR_TOKEN=""
if [ -n "${REPLIT_CONNECTORS_HOSTNAME:-}" ] && [ -n "${REPL_IDENTITY:-}" ] && command -v jq &>/dev/null; then
  CONNECTOR_RESPONSE=$(curl -sf \
    "https://${REPLIT_CONNECTORS_HOSTNAME}/api/v2/connection?include_secrets=true&connector_names=github" \
    -H "X-Replit-Token: repl ${REPL_IDENTITY}" 2>/dev/null || echo "")
  if [ -n "$CONNECTOR_RESPONSE" ]; then
    CONNECTOR_TOKEN=$(echo "$CONNECTOR_RESPONSE" | jq -r '.items[0].settings.access_token // empty' 2>/dev/null || echo "")
  fi
fi

if [ -n "$CONNECTOR_TOKEN" ]; then
  echo "Auth: using Replit GitHub connector token."
  # Build an authenticated remote URL — token never appears in git config or logs
  AUTH_REMOTE="https://x-access-token:${CONNECTOR_TOKEN}@${GITHUB_HOST}/${GITHUB_PATH}"
  GIT_FETCH() { git fetch "$AUTH_REMOTE" "$BRANCH":refs/remotes/"$REMOTE"/"$BRANCH" 2>&1; }
  GIT_PUSH()  { git push  "$AUTH_REMOTE" "${BRANCH}:${BRANCH}" 2>&1; }
elif command -v replit-git-askpass &>/dev/null; then
  echo "Auth: using replit-git-askpass (interactive shell)."
  GIT_FETCH() { GIT_ASKPASS=replit-git-askpass git fetch "$REMOTE" "$BRANCH" 2>&1; }
  GIT_PUSH()  { GIT_ASKPASS=replit-git-askpass git push "$REMOTE" "${BRANCH}:${BRANCH}" 2>&1; }
else
  echo "ERROR: no GitHub auth method available."
  echo "  • For automated/agent runs: ensure the GitHub connector is connected"
  echo "    (REPLIT_CONNECTORS_HOSTNAME and REPL_IDENTITY must be set)."
  echo "  • For interactive runs: open the Replit workspace shell where"
  echo "    replit-git-askpass is available."
  exit 1
fi

# ── 3. Fetch to see what GitHub has ──────────────────────────────────────────

echo "Fetching ${REMOTE}/${BRANCH} ..."
GIT_FETCH

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

# ── 4. Push ───────────────────────────────────────────────────────────────────

echo "Pushing ${LOCAL_SHA} → ${REMOTE}/${BRANCH} ..."
GIT_PUSH

echo ""
echo "✓ GitHub mirror synced: https://github.com/runtsai/git-dojo"
echo "  Pushed: ${LOCAL_SHA}"

# Clear the token from memory (belt-and-suspenders)
CONNECTOR_TOKEN=""

# ── 5. Sync the course mirror (independent — failure is loud but non-blocking) ──

COURSE_SCRIPT="$(cd "$(dirname "$0")" && pwd)/sync-course-to-github.sh"

if [ ! -f "$COURSE_SCRIPT" ]; then
  echo ""
  echo "WARNING: sync-course-to-github.sh not found at ${COURSE_SCRIPT}"
  echo "         Course mirror was NOT synced."
  exit 1
fi

echo ""
echo "── Syncing course mirror ────────────────────────────────────────────────────"
# Run the course sync; capture its exit code without letting set -e abort us here.
set +e
bash "$COURSE_SCRIPT"
COURSE_EXIT=$?
set -e

if [ "$COURSE_EXIT" -ne 0 ]; then
  echo ""
  echo "ERROR: Course mirror sync FAILED (exit ${COURSE_EXIT})."
  echo "       The main mirror push above succeeded and is permanent."
  echo "       Re-run  bash scripts/sync-course-to-github.sh  to retry the course sync."
  exit "$COURSE_EXIT"
fi
