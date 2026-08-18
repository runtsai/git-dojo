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

# Canonical lesson manifest — list every expected lesson directory explicitly.
# This list is the authoritative source of truth, independent of the copy glob.
# If a lesson is renamed, added, or removed, update this list intentionally;
# the sync will refuse to proceed until the manifest and the directory state agree.
EXPECTED_LESSONS=(
  lesson-01-first-snapshot
  lesson-02-the-ledger
  lesson-03-undo-without-erasing
  lesson-04-branches
  lesson-05-the-conflict
  lesson-06-fake-github
  lesson-07-capstone-contractor-review
  lesson-08-the-collision
  lesson-09-the-standoff
)

if [ ! -d "$COURSE_DIR" ]; then
  echo "ERROR: course directory not found at $COURSE_DIR"
  exit 1
fi

# Pre-copy manifest check: every expected lesson must exist in the source tree.
# A lesson renamed to a non-lesson-* name will be caught here before cp runs.
MISSING_FROM_SOURCE=()
for _lesson in "${EXPECTED_LESSONS[@]}"; do
  if [ ! -d "$COURSE_DIR/$_lesson" ]; then
    MISSING_FROM_SOURCE+=("$_lesson")
  fi
done
if [ "${#MISSING_FROM_SOURCE[@]}" -gt 0 ]; then
  echo "ERROR: the following expected lesson folders are missing from $COURSE_DIR:"
  printf '  - %s\n' "${MISSING_FROM_SOURCE[@]}"
  echo "  A lesson may have been renamed or deleted."
  echo "  Update EXPECTED_LESSONS in this script to match the new layout and re-run."
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

# ── 3. Build the sync commit ON TOP of the remote history ────────────────────
#
# The workspace is the single source of truth for course content. We check out
# the mirror's current history, replace the content wholesale with the
# workspace copy, and commit the difference. The push is then always a
# fast-forward — no rebase, no possible merge conflicts. (A previous version
# rebased a fresh root commit onto the remote, which produced add/add
# conflicts whenever any course file changed.)

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"; CONNECTOR_TOKEN=""' EXIT

cd "$TMPDIR"
git init -q
git config user.email "sync-bot@replit"
git config user.name "Replit Sync"

echo "Checking remote state..."
REMOTE_SHA=$(git ls-remote "$AUTH_REMOTE" "refs/heads/${BRANCH}" 2>/dev/null | awk '{print $1}' || echo "")

if [ -n "$REMOTE_SHA" ]; then
  git fetch -q "$AUTH_REMOTE" "${BRANCH}"
  git checkout -q -b "$BRANCH" FETCH_HEAD
  # Remove all tracked content so deletions in the workspace propagate too.
  git rm -rq . 2>/dev/null || true
else
  git checkout -q -b "$BRANCH"
fi

# Copy course content (everything except playground/)
cp -r "$COURSE_DIR"/lesson-* .
cp "$COURSE_DIR/setup.sh" .
cp "$COURSE_DIR/setup.ps1" .
cp "$COURSE_DIR/reset.sh" .
cp "$COURSE_DIR/README.md" .

# ── Post-copy manifest check: every expected lesson must have arrived ─────────
# Belt-and-suspenders: the pre-copy check already guards against renames, but
# this second pass catches any cp failure that would leave a folder absent.
MISSING_AFTER_COPY=()
for _lesson in "${EXPECTED_LESSONS[@]}"; do
  if [ ! -d "$_lesson" ]; then
    MISSING_AFTER_COPY+=("$_lesson")
  fi
done
if [ "${#MISSING_AFTER_COPY[@]}" -gt 0 ]; then
  echo "ERROR: the following lesson folders were not copied to the sync directory:"
  printf '  - %s\n' "${MISSING_AFTER_COPY[@]}"
  echo "  Verify $COURSE_DIR and re-run."
  exit 1
fi

# Post-copy root-file check: every required root file must have arrived.
# These are copied individually above; a missing source file may cause cp to
# exit 0 on some systems, so we check explicitly after the copy block.
REQUIRED_ROOT_FILES=(setup.sh setup.ps1 reset.sh README.md)
MISSING_ROOT_FILES=()
for _f in "${REQUIRED_ROOT_FILES[@]}"; do
  if [ ! -f "$_f" ]; then
    MISSING_ROOT_FILES+=("$_f")
  fi
done
if [ "${#MISSING_ROOT_FILES[@]}" -gt 0 ]; then
  echo "ERROR: the following required root files were not copied to the sync directory:"
  printf '  - %s\n' "${MISSING_ROOT_FILES[@]}"
  echo "  Verify $COURSE_DIR and re-run."
  exit 1
fi

git add -A

if git diff --cached --quiet; then
  echo "Already up-to-date (course content unchanged since last sync)."
  exit 0
fi

# Compute a short hash of the workspace HEAD for the commit message
WORKSPACE_SHA=$(git -C "$WORKSPACE_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")

git commit -q -m "Sync course from workspace@${WORKSPACE_SHA}"

# ── 5. Push ───────────────────────────────────────────────────────────────────

echo "Pushing course content to ${COURSE_REPO} ..."
git push "$AUTH_REMOTE" "${BRANCH}:${BRANCH}"

LOCAL_SHA=$(git rev-parse HEAD)
echo ""
echo "✓ Course mirror synced: https://github.com/runtsai/git-dojo-course"
echo "  Pushed: ${LOCAL_SHA}"
