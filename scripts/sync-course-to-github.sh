#!/usr/bin/env bash
# sync-course-to-github.sh — push the git-dojo/ subfolder to the learner-facing
# course repo (runtsai/git-dojo-course), which contains ONLY the course content
# (lessons, setup scripts, README) — not the app code.
#
# Run this alongside scripts/sync-to-github.sh after significant work lands on
# main so both mirrors stay in sync.
#
# Auth strategy (same as sync-to-github.sh — tried in order):
#   1. Replit GitHub connector token
#   2. replit-git-askpass (interactive shell)
#
# Safety guarantees:
#   - Token is used ephemerally in-memory — never written to git config,
#     environment files, or log output
#   - Builds a throwaway git repo; never modifies the workspace git history

set -euo pipefail

COURSE_REPO="https://github.com/runtsai/git-dojo-course.git"
GITHUB_HOST="github.com"
GITHUB_PATH="runtsai/git-dojo-course.git"
BRANCH="main"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COURSE_DIR="$WORKSPACE_ROOT/git-dojo"

# ── 1. Sanity checks ──────────────────────────────────────────────────────────

if [ ! -d "$COURSE_DIR/lesson-01-first-snapshot" ]; then
  echo "ERROR: course directory not found at $COURSE_DIR"
  echo "       Expected to find lesson-01-first-snapshot/ inside it."
  exit 1
fi

# ── 2. Resolve auth — connector token or askpass ──────────────────────────────

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
  AUTH_REMOTE="https://x-access-token:${CONNECTOR_TOKEN}@${GITHUB_HOST}/${GITHUB_PATH}"
elif command -v replit-git-askpass &>/dev/null; then
  echo "Auth: using replit-git-askpass (interactive shell)."
  # For askpass we push from the temp repo; we need to embed credentials in the URL
  # via the helper. Askpass doesn't work with arbitrary remotes in a temp repo,
  # so we fall back to cloning+pushing with the helper.
  echo "ERROR: replit-git-askpass is only supported for the main mirror sync."
  echo "       Run this script from an automated context where the Replit connector is available."
  exit 1
else
  echo "ERROR: no GitHub auth method available."
  echo "  • For automated/agent runs: ensure the GitHub connector is connected"
  echo "    (REPLIT_CONNECTORS_HOSTNAME and REPL_IDENTITY must be set)."
  exit 1
fi

# ── 3. Build a throwaway repo with just the course content ───────────────────

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"; CONNECTOR_TOKEN=""' EXIT

cd "$TMPDIR"
git init -q
git checkout -q -b "$BRANCH"
git config user.email "sync-bot@replit"
git config user.name "Replit Sync"

# Copy course content (everything except playground/)
cp -r "$COURSE_DIR"/lesson-* .
cp "$COURSE_DIR/setup.sh" .
cp "$COURSE_DIR/setup.ps1" .
cp "$COURSE_DIR/reset.sh" .
cp "$COURSE_DIR/README.md" .

git add -A

# Compute a short hash of the workspace HEAD for the commit message
WORKSPACE_SHA=$(git -C "$WORKSPACE_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")

git commit -q -m "Sync course from workspace@${WORKSPACE_SHA}"

# ── 4. Fetch remote HEAD and check for divergence ────────────────────────────

echo "Checking remote state..."
REMOTE_SHA=$(git ls-remote "$AUTH_REMOTE" "refs/heads/${BRANCH}" 2>/dev/null | awk '{print $1}' || echo "")

if [ -n "$REMOTE_SHA" ]; then
  # Fetch the remote into our temp repo to compare
  git fetch -q "$AUTH_REMOTE" "${BRANCH}:refs/remotes/origin/${BRANCH}" 2>/dev/null || true
  LOCAL_TREE=$(git rev-parse HEAD^{tree})
  REMOTE_TREE=$(git rev-parse "refs/remotes/origin/${BRANCH}^{tree}" 2>/dev/null || echo "")
  if [ "$LOCAL_TREE" = "$REMOTE_TREE" ]; then
    echo "Already up-to-date (course content unchanged since last sync)."
    exit 0
  fi
  # Fast-forward case: remote has commits that our throwaway repo doesn't (this
  # is always the case for a freshly-built repo).  Rebase our new sync commit on
  # top of the remote so we preserve remote history, then push.
  echo ""
  echo "Fast-forward detected: remote has commits not present in local."
  echo "  Remote ${BRANCH}: ${REMOTE_SHA}"
  echo "Rebasing course commit on top of remote ..."
  GIT_AUTHOR_NAME="Replit Sync" GIT_AUTHOR_EMAIL="sync-bot@replit" \
    git rebase "refs/remotes/origin/${BRANCH}" || {
    echo ""
    echo "ERROR: Rebase failed — genuine divergence between the local course"
    echo "       content and the remote course mirror."
    echo "       Inspect the conflict and resolve manually before re-running."
    git rebase --abort 2>/dev/null || true
    exit 1
  }
  echo "✓ Rebase complete. Ready to push."
  echo ""
fi

# ── 5. Push ───────────────────────────────────────────────────────────────────

echo "Pushing course content to ${COURSE_REPO} ..."
git push "$AUTH_REMOTE" "${BRANCH}:${BRANCH}"

LOCAL_SHA=$(git rev-parse HEAD)
echo ""
echo "✓ Course mirror synced: https://github.com/runtsai/git-dojo-course"
echo "  Pushed: ${LOCAL_SHA}"
