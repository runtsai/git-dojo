#!/usr/bin/env bash
# test-course-sync-recovery.sh — verifies that the checkout/replace approach
# used by scripts/sync-course-to-github.sh:
#   1. Preserves ALL prior remote commits when the course repo is ahead of the
#      workspace (history is built on top of FETCH_HEAD — no commits are dropped)
#   2. Correctly exits non-zero when a concurrent push creates a non-fast-forward
#      situation between the fetch step and the push step (genuine divergence)
#
# Runs entirely in temp directories; never touches GitHub or any real remote.
# Usage: bash git-dojo/test-course-sync-recovery.sh
set -euo pipefail

PASS=0
FAIL=0

pass() { printf "  PASS  %s\n" "$*"; PASS=$((PASS+1)); }
fail() { printf "  FAIL  %s\n" "$*"; FAIL=$((FAIL+1)); }

# ── Fully isolated git environment ───────────────────────────────────────────
_SELFOWN_HOME="$(mktemp -d)"
export HOME="$_SELFOWN_HOME"
export XDG_CONFIG_HOME="$_SELFOWN_HOME/.config"
export GIT_CONFIG_GLOBAL="$_SELFOWN_HOME/.gitconfig"
export GIT_CONFIG_NOSYSTEM=1

export GIT_AUTHOR_NAME="Course Sync Test"
export GIT_AUTHOR_EMAIL="coursesync@example.invalid"
export GIT_COMMITTER_NAME="Course Sync Test"
export GIT_COMMITTER_EMAIL="coursesync@example.invalid"

mkdir -p "$_SELFOWN_HOME"
cat > "$GIT_CONFIG_GLOBAL" <<'GITCFG'
[init]
	defaultBranch = main
[user]
	name = Course Sync Test
	email = coursesync@example.invalid
GITCFG

TMP="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP" "$_SELFOWN_HOME"
}
trap cleanup EXIT

# ── simulate_course_sync ─────────────────────────────────────────────────────
# Mirrors the core loop of scripts/sync-course-to-github.sh:
#   • Fetch the remote tip → checkout FETCH_HEAD → git rm -rq .
#   • Copy workspace content wholesale → git add -A
#   • If unchanged: exit 0 silently; otherwise commit and push.
# Returns the exit code of the push (or 0 when up-to-date).
simulate_course_sync() {
  local remote_url="$1"
  local workspace_dir="$2"

  local syncdir exit_code
  syncdir="$(mktemp -d)"
  exit_code=0

  (
    cd "$syncdir"
    git init -q
    git config user.email "sync-bot@replit"
    git config user.name "Replit Sync"

    local remote_sha
    remote_sha=$(git ls-remote "$remote_url" "refs/heads/main" 2>/dev/null \
                 | awk '{print $1}' || echo "")

    if [ -n "$remote_sha" ]; then
      git fetch -q "$remote_url" main
      git checkout -q -b main FETCH_HEAD
      git rm -rq . 2>/dev/null || true
    else
      git checkout -q -b main
    fi

    cp -r "$workspace_dir"/. .
    git add -A

    if git diff --cached --quiet; then
      echo "SYNC_RESULT=up-to-date"
      exit 0
    fi

    git commit -q -m "Sync course from workspace@test"
    git push -q "$remote_url" main:main
    echo "SYNC_RESULT=pushed"
  ) || exit_code=$?

  rm -rf "$syncdir"
  return $exit_code
}

# ═════════════════════════════════════════════════════════════════════════════
# Test 1: Remote is 3 commits ahead — all prior commits preserved after sync
#
# The course remote accumulates hotfix commits (pushed directly to the mirror).
# When the workspace content changes and a new sync runs, the script must build
# the commit on top of FETCH_HEAD so every hotfix commit survives in history.
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 1: course sync preserves all prior remote commits when remote is 3 commits ahead\n"

REMOTE1="$TMP/remote1.git"
git init --bare -q "$REMOTE1"

# ── Seed: initial sync commit ─────────────────────────────────────────────────
SEED1="$TMP/seed1"
git init -q "$SEED1"
cd "$SEED1"
git checkout -q -b main
mkdir -p lesson-01
echo "Lesson 01 v1" > lesson-01/README.md
echo "#!/bin/bash" > setup.sh
git add -A
git commit -qm "Sync course from workspace@aaa111"
git push -q "$REMOTE1" main

# ── Remote accumulates 3 hotfix commits pushed directly to the mirror ─────────
HOTFIX1="$TMP/hotfix1"
git clone -q "$REMOTE1" "$HOTFIX1"
cd "$HOTFIX1"
echo "# hotfix 1" >> setup.sh
git add setup.sh
git commit -qm "Hotfix 1: typo in setup.sh"

echo "# hotfix 2" >> setup.sh
git add setup.sh
git commit -qm "Hotfix 2: another typo"

echo "Note for learners" >> lesson-01/README.md
git add lesson-01/README.md
git commit -qm "Add learner note to lesson-01"
git push -q origin main

REMOTE1_TIP=$(git ls-remote "$REMOTE1" refs/heads/main | awk '{print $1}')

# ── Workspace: new content (different from both seed and hotfixes) ────────────
WS1="$TMP/ws1"
mkdir -p "$WS1/lesson-01"
echo "Lesson 01 v2 — new content" > "$WS1/lesson-01/README.md"
echo "#!/bin/bash" > "$WS1/setup.sh"   # original, without the hotfixes

# ── Run course sync ────────────────────────────────────────────────────────────
SYNC1_EXIT=0
simulate_course_sync "$REMOTE1" "$WS1" 2>/dev/null || SYNC1_EXIT=$?

if [ "$SYNC1_EXIT" = "0" ]; then
  pass "course sync succeeded when remote is 3 commits ahead"
else
  fail "course sync exited non-zero ($SYNC1_EXIT) — expected success"
fi

# The new tip must be a direct child of the old remote tip (fast-forward chain)
NEW1_TIP=$(git ls-remote "$REMOTE1" refs/heads/main | awk '{print $1}')
PARENT1=$(git -C "$REMOTE1" rev-parse "${NEW1_TIP}^" 2>/dev/null || echo "unknown")

if [ "$PARENT1" = "$REMOTE1_TIP" ]; then
  pass "pushed commit is a direct child of remote tip (fast-forward chain intact)"
else
  fail "pushed commit parent ($PARENT1) != remote tip ($REMOTE1_TIP)"
fi

# Clone and verify all 5 commits are present: 1 seed + 3 hotfixes + 1 new sync
VERIFY1="$TMP/verify1"
git clone -q "$REMOTE1" "$VERIFY1"
LOG1=$(git -C "$VERIFY1" log --oneline main)
COUNT1=$(echo "$LOG1" | wc -l | tr -d ' ')

if [ "$COUNT1" = "5" ]; then
  pass "all 5 commits present (1 seed + 3 hotfixes + 1 new sync)"
else
  fail "expected 5 commits, got $COUNT1 — some commits may have been dropped"
fi

for MSG in "Hotfix 1" "Hotfix 2" "Add learner note"; do
  if echo "$LOG1" | grep -q "$MSG"; then
    pass "commit '$MSG' preserved in history after sync"
  else
    fail "commit '$MSG' is missing — dropped during course sync"
  fi
done

# ═════════════════════════════════════════════════════════════════════════════
# Test 2: Remote ahead by 5 commits — all preserved (count-independent check)
#
# Ensures the history-preservation guarantee holds regardless of how many
# commits the remote has accumulated since the last workspace sync.
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 2: course sync preserves all commits when remote is 5 commits ahead\n"

REMOTE2="$TMP/remote2.git"
git init --bare -q "$REMOTE2"

SEED2="$TMP/seed2"
git init -q "$SEED2"
cd "$SEED2"
git checkout -q -b main
echo "Base content" > base.txt
git add base.txt
git commit -qm "Initial course sync"
git push -q "$REMOTE2" main

HOTFIX2="$TMP/hotfix2"
git clone -q "$REMOTE2" "$HOTFIX2"
cd "$HOTFIX2"
for i in 1 2 3 4 5; do
  echo "fix $i" >> base.txt
  git add base.txt
  git commit -qm "Remote fix $i"
done
git push -q origin main

WS2="$TMP/ws2"
mkdir -p "$WS2"
echo "Updated base content from workspace" > "$WS2/base.txt"

SYNC2_EXIT=0
simulate_course_sync "$REMOTE2" "$WS2" 2>/dev/null || SYNC2_EXIT=$?

if [ "$SYNC2_EXIT" = "0" ]; then
  pass "course sync succeeded with 5-commit-ahead remote"
else
  fail "course sync failed ($SYNC2_EXIT) with 5-commit-ahead remote"
fi

VERIFY2="$TMP/verify2"
git clone -q "$REMOTE2" "$VERIFY2"
LOG2=$(git -C "$VERIFY2" log --oneline main)
COUNT2=$(echo "$LOG2" | wc -l | tr -d ' ')

if [ "$COUNT2" = "7" ]; then
  pass "all 7 commits present (1 seed + 5 remote fixes + 1 new sync)"
else
  fail "expected 7 commits, got $COUNT2"
fi

MISSING2=0
for i in 1 2 3 4 5; do
  if ! echo "$LOG2" | grep -q "Remote fix $i"; then
    fail "Remote fix $i is missing from history — silently dropped"
    MISSING2=$((MISSING2+1))
  fi
done
if [ "$MISSING2" = "0" ]; then
  pass "all 5 remote fix commits preserved — none silently dropped"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 3: Genuine divergence — concurrent push between fetch and our push
#
# sync-course-to-github.sh does NOT use --force-push.  If another actor pushes
# to the mirror after our fetch (but before our push), git push must be
# rejected with a non-zero exit so the operator knows to re-run the sync.
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 3: concurrent push between fetch and our push causes exit non-zero\n"

REMOTE3="$TMP/remote3.git"
git init --bare -q "$REMOTE3"

SEED3="$TMP/seed3"
git init -q "$SEED3"
cd "$SEED3"
git checkout -q -b main
echo "v1" > content.txt
git add content.txt
git commit -qm "Initial course sync v1"
git push -q "$REMOTE3" main

# ── Reproduce the script's steps manually so we can inject a concurrent push ──
SYNCDIR3="$TMP/syncdir3"
mkdir -p "$SYNCDIR3"
cd "$SYNCDIR3"
git init -q
git config user.email "sync-bot@replit"
git config user.name "Replit Sync"

# Step 1: fetch — mirrors script lines 85-94
git fetch -q "$REMOTE3" main
git checkout -q -b main FETCH_HEAD
git rm -rq . 2>/dev/null || true

# Step 2: another actor pushes to the bare remote BEFORE we push (race condition)
CONCURRENT3="$TMP/concurrent3"
git clone -q "$REMOTE3" "$CONCURRENT3"
cd "$CONCURRENT3"
echo "concurrent change" >> content.txt
git add content.txt
git commit -qm "Concurrent push (simulated race condition)"
git push -q origin main

# Step 3: finish our sync commit in the syncdir
cd "$SYNCDIR3"
WS3="$TMP/ws3"
mkdir -p "$WS3"
echo "v2 workspace content" > "$WS3/content.txt"
cp -r "$WS3"/. .
git add -A
git commit -q -m "Sync course from workspace@test-diverge"

# Step 4: push — must fail because remote now has a commit we do not have
PUSH3_EXIT=0
git push "$REMOTE3" main:main 2>/dev/null || PUSH3_EXIT=$?

if [ "$PUSH3_EXIT" != "0" ]; then
  pass "push correctly rejected (exit $PUSH3_EXIT) when remote advanced between fetch and push"
else
  fail "push should have been rejected after a concurrent push, but it succeeded"
fi

# Confirm the remote tip is the concurrent actor's commit, not ours
REMOTE3_TIP=$(git ls-remote "$REMOTE3" refs/heads/main | awk '{print $1}')
CONCURRENT3_SHA=$(git -C "$CONCURRENT3" rev-parse HEAD)
if [ "$REMOTE3_TIP" = "$CONCURRENT3_SHA" ]; then
  pass "remote still points to the concurrent actor's commit — no force-overwrite occurred"
else
  fail "remote tip changed unexpectedly (got $REMOTE3_TIP, expected $CONCURRENT3_SHA)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
printf "\n════════════════════════════════\n"
printf "Course sync recovery test: %d PASS / %d FAIL\n" "$PASS" "$FAIL"
printf "════════════════════════════════\n\n"

if [ "$FAIL" -gt 0 ]; then
  echo "One or more course-sync-recovery checks FAILED." >&2
  exit 1
fi
exit 0
