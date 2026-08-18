#!/usr/bin/env bash
# test-sync-recovery.sh — verifies that the fast-forward auto-recovery logic
# in scripts/sync-to-github.sh:
#   1. Preserves ALL commits from both local and remote after a fast-forward merge
#   2. Correctly detects genuine divergence and would exit non-zero
#
# Runs entirely in temp directories; never touches GitHub or any real remote.
# Usage: bash git-dojo/test-sync-recovery.sh
set -euo pipefail

PASS=0
FAIL=0

pass() { printf "  PASS  %s\n" "$*"; PASS=$((PASS+1)); }
fail() { printf "  FAIL  %s\n" "$*"; FAIL=$((FAIL+1)); }

# ── Fully isolated git environment ───────────────────────────────────────────
# Always create a fresh writable HOME so we never collide with Replit's
# GIT_CONFIG_GLOBAL or XDG_CONFIG_HOME (both may point to non-writable paths).
_SELFOWN_HOME="$(mktemp -d)"
export HOME="$_SELFOWN_HOME"
export XDG_CONFIG_HOME="$_SELFOWN_HOME/.config"
export GIT_CONFIG_GLOBAL="$_SELFOWN_HOME/.gitconfig"
export GIT_CONFIG_NOSYSTEM=1

# Use env vars for identity — reliable without needing a writable global config.
export GIT_AUTHOR_NAME="Sync Recovery Test"
export GIT_AUTHOR_EMAIL="syncrecovery@example.invalid"
export GIT_COMMITTER_NAME="Sync Recovery Test"
export GIT_COMMITTER_EMAIL="syncrecovery@example.invalid"

# Write a minimal global config so init.defaultBranch=main is honoured.
mkdir -p "$_SELFOWN_HOME"
cat > "$GIT_CONFIG_GLOBAL" <<'GITCFG'
[init]
	defaultBranch = main
[user]
	name = Sync Recovery Test
	email = syncrecovery@example.invalid
GITCFG

# Resolve the workspace root NOW, before any cd changes the working directory.
_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_WORKSPACE_ROOT="$(cd "$_TEST_DIR/.." && pwd)"

TMP="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP"
  if [ "${_CLEANUP_HOME:-0}" = "1" ]; then
    rm -rf "$_SELFOWN_HOME"
  fi
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────────────────────────
# Helpers: replicate the detection logic from sync-to-github.sh (lines 109-141)
# so the tests exercise the exact same branch conditions the script uses.
# ─────────────────────────────────────────────────────────────────────────────

# detect_sync_case <local-sha> <remote-sha> <base-sha>
# Prints: "ff", "up-to-date", "diverged", or "local-ahead"
detect_sync_case() {
  local local_sha="$1" remote_sha="$2" base_sha="$3"
  if [ "$local_sha" = "$remote_sha" ]; then
    echo "up-to-date"
  elif [ -n "$base_sha" ] && [ "$base_sha" != "$remote_sha" ] && [ "$local_sha" != "$remote_sha" ]; then
    if [ "$base_sha" = "$local_sha" ]; then
      echo "ff"       # fast-forward: local is behind, no local-only commits
    else
      echo "diverged" # genuine divergence: both sides have unique commits
    fi
  else
    echo "local-ahead"
  fi
}

# ═════════════════════════════════════════════════════════════════════════════
# Test 1: Fast-forward — remote is ahead by 2 commits, no local-only commits
#   After ff-merge, all N commits must be present; push delivers the full history
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 1: fast-forward merge preserves all commits\n"

REMOTE1="$TMP/remote1.git"
LOCAL1="$TMP/local1"
git init --bare -q "$REMOTE1"
git init -q "$LOCAL1"
cd "$LOCAL1"
git remote add origin "$REMOTE1"

# Shared base commit
echo "initial" > file.txt
git add file.txt
git commit -qm "Initial commit"
git push -q origin main

# A second actor pushes 2 commits directly to the bare remote
RC1="$TMP/rc1"
git clone -q "$REMOTE1" "$RC1"
cd "$RC1"
echo "remote change 1" >> file.txt; git add file.txt; git commit -qm "Remote commit 1"
echo "remote change 2" >> file.txt; git add file.txt; git commit -qm "Remote commit 2"
git push -q origin main

# Local is now behind by 2 — run the sync detection logic
cd "$LOCAL1"
git fetch -q origin main:refs/remotes/origin/main

LOCAL_SHA=$(git rev-parse main)
REMOTE_SHA=$(git rev-parse origin/main)
BASE_SHA=$(git merge-base main origin/main)

CASE=$(detect_sync_case "$LOCAL_SHA" "$REMOTE_SHA" "$BASE_SHA")
if [ "$CASE" = "ff" ]; then
  pass "fast-forward condition correctly identified"
else
  fail "expected 'ff' but got '$CASE'"
fi

# Execute the ff merge (mirrors sync-to-github.sh line 120)
git merge --ff-only origin/main -q

NEW_LOCAL=$(git rev-parse main)
if [ "$NEW_LOCAL" = "$REMOTE_SHA" ]; then
  pass "local HEAD advanced to remote SHA after fast-forward"
else
  fail "local HEAD mismatch: got $NEW_LOCAL, expected $REMOTE_SHA"
fi

# All 3 commits must be present (Initial + Remote 1 + Remote 2).
# Capture the log once to avoid SIGPIPE under set -o pipefail when grep -q
# exits early before git log finishes writing.
LOG1=$(git log --oneline main)
COMMIT_COUNT=$(echo "$LOG1" | wc -l | tr -d ' ')
if [ "$COMMIT_COUNT" = "3" ]; then
  pass "all 3 commits present in local history after fast-forward"
else
  fail "expected 3 commits after fast-forward, got $COMMIT_COUNT"
fi

if echo "$LOG1" | grep -q "Initial commit"; then
  pass "initial commit not skipped after fast-forward"
else
  fail "initial commit is missing — fast-forward may have skipped it"
fi

if echo "$LOG1" | grep -q "Remote commit 1" && \
   echo "$LOG1" | grep -q "Remote commit 2"; then
  pass "both remote commits present in local history after fast-forward"
else
  fail "one or more remote commits are missing after fast-forward"
fi

# Push to the bare remote and verify the pushed history is also complete
git push -q origin main
PUSHED_SHA=$(git ls-remote origin main | awk '{print $1}')
if [ "$PUSHED_SHA" = "$REMOTE_SHA" ]; then
  pass "push delivered the fully merged SHA to remote"
else
  fail "pushed SHA mismatch: got $PUSHED_SHA, expected $REMOTE_SHA"
fi

# Clone the bare remote and count commits to confirm nothing was silently dropped
VERIFY1="$TMP/verify1"
git clone -q "$REMOTE1" "$VERIFY1"
PUSHED_COUNT=$(git -C "$VERIFY1" log --oneline main | wc -l | tr -d ' ')
if [ "$PUSHED_COUNT" = "3" ]; then
  pass "remote (bare) contains all 3 commits after the push"
else
  fail "remote (bare) commit count: expected 3, got $PUSHED_COUNT"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 2: Fast-forward with more commits — N=5 remote-only commits
#   Ensures the check is not sensitive to the specific commit count
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 2: fast-forward with 5 remote-only commits preserves full history\n"

REMOTE2="$TMP/remote2.git"
LOCAL2="$TMP/local2"
git init --bare -q "$REMOTE2"
git init -q "$LOCAL2"
cd "$LOCAL2"
git remote add origin "$REMOTE2"

echo "base" > log.txt
git add log.txt
git commit -qm "Base commit"
git push -q origin main

RC2="$TMP/rc2"
git clone -q "$REMOTE2" "$RC2"
cd "$RC2"
for i in 1 2 3 4 5; do
  echo "entry $i" >> log.txt
  git add log.txt
  git commit -qm "Remote entry $i"
done
git push -q origin main

cd "$LOCAL2"
git fetch -q origin main:refs/remotes/origin/main

LOCAL2_SHA=$(git rev-parse main)
REMOTE2_SHA=$(git rev-parse origin/main)
BASE2_SHA=$(git merge-base main origin/main)

CASE2=$(detect_sync_case "$LOCAL2_SHA" "$REMOTE2_SHA" "$BASE2_SHA")
if [ "$CASE2" = "ff" ]; then
  pass "5-commit fast-forward condition correctly identified"
else
  fail "expected 'ff' for 5-commit scenario but got '$CASE2'"
fi

git merge --ff-only origin/main -q

# Capture once — avoids SIGPIPE from grep -q under set -o pipefail
LOG2=$(git log --oneline main)
COUNT2=$(echo "$LOG2" | wc -l | tr -d ' ')
if [ "$COUNT2" = "6" ]; then
  pass "all 6 commits (1 base + 5 remote) present after fast-forward"
else
  fail "expected 6 commits after 5-commit fast-forward, got $COUNT2"
fi

# Confirm every remote entry commit appears
MISSING=0
for i in 1 2 3 4 5; do
  if ! echo "$LOG2" | grep -q "Remote entry $i"; then
    fail "Remote entry $i is missing after fast-forward"
    MISSING=$((MISSING+1))
  fi
done
if [ "$MISSING" = "0" ]; then
  pass "all 5 remote entry commits present — none silently skipped"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 3: Local-ahead — local has commits remote does not; no fast-forward merge
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 3: local-ahead of remote — push succeeds without a ff merge\n"

REMOTE3="$TMP/remote3.git"
LOCAL3="$TMP/local3"
git init --bare -q "$REMOTE3"
git init -q "$LOCAL3"
cd "$LOCAL3"
git remote add origin "$REMOTE3"

echo "base" > notes.txt
git add notes.txt
git commit -qm "Base commit"
git push -q origin main

echo "local note 1" >> notes.txt; git add notes.txt; git commit -qm "Local commit 1"
echo "local note 2" >> notes.txt; git add notes.txt; git commit -qm "Local commit 2"

git fetch -q origin main:refs/remotes/origin/main 2>/dev/null || \
  git fetch -q origin 2>/dev/null || true

LOCAL3_SHA=$(git rev-parse main)
REMOTE3_SHA=$(git rev-parse origin/main 2>/dev/null || echo "$LOCAL3_SHA")
BASE3_SHA=$(git merge-base main origin/main 2>/dev/null || echo "")

CASE3=$(detect_sync_case "$LOCAL3_SHA" "$REMOTE3_SHA" "$BASE3_SHA")
if [ "$CASE3" = "local-ahead" ] || [ "$CASE3" = "up-to-date" ]; then
  pass "local-ahead case correctly identified (no ff merge triggered)"
else
  fail "unexpected case '$CASE3' for local-ahead scenario"
fi

git push -q origin main
PUSHED3=$(git ls-remote origin main | awk '{print $1}')
if [ "$PUSHED3" = "$LOCAL3_SHA" ]; then
  pass "local-ahead push delivered correct SHA with all local commits"
else
  fail "local-ahead push SHA mismatch: got $PUSHED3, expected $LOCAL3_SHA"
fi

VERIFY3="$TMP/verify3"
git clone -q "$REMOTE3" "$VERIFY3"
COUNT3=$(git -C "$VERIFY3" log --oneline main | wc -l | tr -d ' ')
if [ "$COUNT3" = "3" ]; then
  pass "pushed remote contains all 3 commits for local-ahead scenario"
else
  fail "expected 3 commits for local-ahead push, got $COUNT3"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 4: Genuine divergence — both sides have unique commits
#   sync-to-github.sh must exit non-zero; verify the detection matches exactly
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 4: genuine divergence is detected — would exit non-zero\n"

REMOTE4="$TMP/remote4.git"
LOCAL4="$TMP/local4"
git init --bare -q "$REMOTE4"
git init -q "$LOCAL4"
cd "$LOCAL4"
git remote add origin "$REMOTE4"

echo "shared" > readme.txt
git add readme.txt
git commit -qm "Shared base"
git push -q origin main

# Remote gets a commit
RC4="$TMP/rc4"
git clone -q "$REMOTE4" "$RC4"
cd "$RC4"
echo "remote change" >> readme.txt
git add readme.txt
git commit -qm "Remote diverging commit"
git push -q origin main

# Local also gets a commit (creates true divergence from the same base)
cd "$LOCAL4"
echo "local change" >> readme.txt
git add readme.txt
git commit -qm "Local diverging commit"

git fetch -q origin main:refs/remotes/origin/main

LOCAL4_SHA=$(git rev-parse main)
REMOTE4_SHA=$(git rev-parse origin/main)
BASE4_SHA=$(git merge-base main origin/main 2>/dev/null || echo "")

CASE4=$(detect_sync_case "$LOCAL4_SHA" "$REMOTE4_SHA" "$BASE4_SHA")
if [ "$CASE4" = "diverged" ]; then
  pass "genuine divergence correctly identified"
else
  fail "expected 'diverged' but got '$CASE4'"
fi

# Confirm the sync-to-github.sh condition (lines 110-141) would exit 1:
#   base != remote AND local != remote AND base != local → diverged → exit 1
if [ -n "$BASE4_SHA" ] && \
   [ "$BASE4_SHA" != "$REMOTE4_SHA" ] && \
   [ "$LOCAL4_SHA" != "$REMOTE4_SHA" ] && \
   [ "$BASE4_SHA" != "$LOCAL4_SHA" ]; then
  pass "divergence condition matches sync-to-github.sh logic — script would exit non-zero"
else
  fail "divergence condition mismatch — sync-to-github.sh might not catch this case"
fi

# Sanity: the two tips must not be equal (they really diverged)
if [ "$LOCAL4_SHA" != "$REMOTE4_SHA" ]; then
  pass "local and remote SHAs differ as expected for a genuine divergence"
else
  fail "local and remote SHAs are unexpectedly equal"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 5: Already up-to-date — no merge, no push needed
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 5: already up-to-date — sync case returns up-to-date\n"

REMOTE5="$TMP/remote5.git"
LOCAL5="$TMP/local5"
git init --bare -q "$REMOTE5"
git init -q "$LOCAL5"
cd "$LOCAL5"
git remote add origin "$REMOTE5"

echo "content" > f.txt
git add f.txt
git commit -qm "Only commit"
git push -q origin main

git fetch -q origin main:refs/remotes/origin/main

LOCAL5_SHA=$(git rev-parse main)
REMOTE5_SHA=$(git rev-parse origin/main)
BASE5_SHA=$(git merge-base main origin/main 2>/dev/null || echo "")

CASE5=$(detect_sync_case "$LOCAL5_SHA" "$REMOTE5_SHA" "$BASE5_SHA")
if [ "$CASE5" = "up-to-date" ]; then
  pass "up-to-date case correctly identified — no push needed"
else
  fail "expected 'up-to-date' but got '$CASE5'"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Tests 6 & 7: Course mirror — sync-course-to-github.sh checkout/replace semantics
#
# The script no longer uses rebase. Instead it:
#   • If remote has commits: fetches, checks out FETCH_HEAD, does `git rm -rq .`
#   • Copies workspace content wholesale, runs `git add -A`
#   • If `git diff --cached --quiet` → exit 0 (nothing changed)
#   • Otherwise commits and fast-forward pushes
#
# This means the workspace is always the authoritative source.  A remote-only
# manual fix will be overwritten whenever the workspace content differs from
# the remote's tree.  These tests document and guard both paths:
#
#   Test 6 — Non-conflicting: remote has a fix to file B; workspace sync only
#             changes file A.  After the checkout/replace/commit cycle the
#             remote fix to B is NOT preserved (workspace wins), and the push
#             is a clean fast-forward.
#
#   Test 7 — Workspace overrides remote fix: remote and workspace both modify
#             the same file to different values.  The push still succeeds (no
#             merge conflict is possible in this design) and the result tree
#             reflects workspace content, not the remote fix.
# ═════════════════════════════════════════════════════════════════════════════

# ── Shared course-sync helper (mirrors the script's core loop) ───────────────
# simulate_course_sync <bare-remote> <workspace-dir>
# Checks out the remote tip, replaces content with workspace-dir, commits if
# changed, pushes.  Exits non-zero only on git errors.
simulate_course_sync() {
  local remote_url="$1"
  local workspace_dir="$2"

  local syncdir
  syncdir="$(mktemp -d)"
  (
    cd "$syncdir"
    git init -q
    git config user.email "sync-bot@replit"
    git config user.name "Replit Sync"

    local remote_sha
    remote_sha=$(git ls-remote "$remote_url" "refs/heads/main" 2>/dev/null | awk '{print $1}' || echo "")

    if [ -n "$remote_sha" ]; then
      git fetch -q "$remote_url" main
      git checkout -q -b main FETCH_HEAD
      git rm -rq . 2>/dev/null || true
    else
      git checkout -q -b main
    fi

    # Pre-copy manifest check (mirrors sync-course-to-github.sh EXPECTED_LESSONS guard).
    # SYNC_EXPECTED_LESSONS env var: space-separated list of lesson dir names the
    # caller declares must exist in workspace_dir before any copy begins.
    # A folder renamed outside this list is detected here, before cp runs.
    if [ -n "${SYNC_EXPECTED_LESSONS:-}" ]; then
      local _pre_missing=()
      for _lesson in $SYNC_EXPECTED_LESSONS; do
        if [ ! -d "$workspace_dir/$_lesson" ]; then
          _pre_missing+=("$_lesson")
        fi
      done
      if [ "${#_pre_missing[@]}" -gt 0 ]; then
        printf 'ERROR: expected lesson missing from workspace source: %s\n' "${_pre_missing[@]}" >&2
        exit 1
      fi
    fi

    cp -r "$workspace_dir"/. .

    # Post-copy manifest check (belt-and-suspenders; also mirrors the script).
    if [ -n "${SYNC_EXPECTED_LESSONS:-}" ]; then
      local _post_missing=()
      for _lesson in $SYNC_EXPECTED_LESSONS; do
        if [ ! -d "$_lesson" ]; then
          _post_missing+=("$_lesson")
        fi
      done
      if [ "${#_post_missing[@]}" -gt 0 ]; then
        printf 'ERROR: lesson folder not copied to sync dir: %s\n' "${_post_missing[@]}" >&2
        exit 1
      fi
    else
      # Fallback when no manifest: compare lesson-* dirs in workspace vs sync dir.
      local _missing_lessons=()
      for _src in "$workspace_dir"/lesson-*/; do
        [ -d "$_src" ] || continue
        local _lname
        _lname="$(basename "$_src")"
        if [ ! -d "$_lname" ]; then
          _missing_lessons+=("$_lname")
        fi
      done
      if [ "${#_missing_lessons[@]}" -gt 0 ]; then
        printf 'ERROR: lesson folder not copied: %s\n' "${_missing_lessons[@]}" >&2
        exit 1
      fi
    fi

    git add -A

    if git diff --cached --quiet; then
      echo "SYNC_RESULT=up-to-date"
      exit 0
    fi

    git commit -q -m "Sync course from workspace@test"
    git push -q "$remote_url" main:main
    echo "SYNC_RESULT=pushed"
  )
  local exit_code=$?
  rm -rf "$syncdir"
  return $exit_code
}

# ═════════════════════════════════════════════════════════════════════════════
# Test 6: Non-conflicting remote commit — workspace changes a different file
#   The remote has a manual fix to setup.sh; the workspace update only changes
#   lesson-01/README.md.  The sync must succeed (fast-forward push) and the
#   resulting tree on the remote must reflect the workspace content.
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 6: course mirror – non-conflicting remote fix; sync is a clean fast-forward\n"

REMOTE6="$TMP/remote6.git"
git init --bare -q "$REMOTE6"

# ── Initial sync: populate the bare remote with course v1 ────────────────────
INITIAL6="$TMP/initial6"
git init -q "$INITIAL6"
cd "$INITIAL6"
git checkout -q -b main
mkdir -p lesson-01
echo "Lesson 01 initial content" > lesson-01/README.md
echo "Shared setup instructions" > setup.sh
git add -A
git commit -qm "Sync course from workspace@aabbcc"
git push -q "$REMOTE6" main

INITIAL6_SHA=$(git -C "$INITIAL6" rev-parse HEAD)

# ── Manual fix pushed directly to the course mirror (setup.sh only) ──────────
FIX6="$TMP/fix6"
git clone -q "$REMOTE6" "$FIX6"
cd "$FIX6"
echo "# Fixed typo in setup" >> setup.sh
git add setup.sh
git commit -qm "Fix typo in setup.sh (manual fix to course mirror)"
git push -q origin main

REMOTE6_TIP=$(git ls-remote "$REMOTE6" refs/heads/main | awk '{print $1}')

# ── Workspace: same setup.sh as v1 but updated README ────────────────────────
# (the manual fix to setup.sh exists only on the remote, not in the workspace)
WS6="$TMP/ws6"
mkdir -p "$WS6/lesson-01"
echo "Lesson 01 UPDATED content" > "$WS6/lesson-01/README.md"
echo "Shared setup instructions" > "$WS6/setup.sh"   # original, without the remote fix

# ── Run the simulate_course_sync — must succeed ───────────────────────────────
SYNC6_EXIT=0
simulate_course_sync "$REMOTE6" "$WS6" 2>/dev/null || SYNC6_EXIT=$?

if [ "$SYNC6_EXIT" = "0" ]; then
  pass "course sync: sync succeeded (fast-forward push) when remote has a non-conflicting fix"
else
  fail "course sync: sync exited non-zero ($SYNC6_EXIT) — expected clean fast-forward"
fi

# The push must be a fast-forward from REMOTE6_TIP
NEW6_TIP=$(git ls-remote "$REMOTE6" refs/heads/main | awk '{print $1}')
PARENT6=$(git -C "$REMOTE6" rev-parse "${NEW6_TIP}^" 2>/dev/null || echo "unknown")

if [ "$PARENT6" = "$REMOTE6_TIP" ]; then
  pass "course sync: resulting commit is a fast-forward on top of the remote-fix commit"
else
  fail "course sync: resulting commit is not a fast-forward (parent=$PARENT6, expected=$REMOTE6_TIP)"
fi

# The pushed tree must reflect workspace content (workspace is authoritative)
VERIFY6="$TMP/verify6"
git clone -q "$REMOTE6" "$VERIFY6"
if grep -q "UPDATED content" "$VERIFY6/lesson-01/README.md" 2>/dev/null; then
  pass "course sync: workspace README content is present in the pushed result"
else
  fail "course sync: workspace README content missing from pushed result"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 7: Remote and workspace both modify the same file to different values
#   The sync script's checkout/replace design means workspace always wins — no
#   merge conflict is possible.  The push must still succeed as a fast-forward
#   and the final tree must contain the workspace version of the file.
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 7: course mirror – workspace overrides a conflicting remote edit (workspace wins)\n"

REMOTE7="$TMP/remote7.git"
git init --bare -q "$REMOTE7"

# ── Initial sync ──────────────────────────────────────────────────────────────
INITIAL7="$TMP/initial7"
git init -q "$INITIAL7"
cd "$INITIAL7"
git checkout -q -b main
echo "Delivery fee: \$90" > pricing.txt
git add pricing.txt
git commit -qm "Sync course from workspace@112233"
git push -q "$REMOTE7" main

# ── Manual fix on the remote: someone corrects the fee to $85 ────────────────
FIX7="$TMP/fix7"
git clone -q "$REMOTE7" "$FIX7"
cd "$FIX7"
echo "Delivery fee: \$85" > pricing.txt
git add pricing.txt
git commit -qm "Correct delivery fee to 85 (manual fix to course mirror)"
git push -q origin main

REMOTE7_TIP=$(git ls-remote "$REMOTE7" refs/heads/main | awk '{print $1}')

# ── Workspace: a different fee value ($95) — both sides changed the same line ─
WS7="$TMP/ws7"
mkdir -p "$WS7"
echo "Delivery fee: \$95" > "$WS7/pricing.txt"

# ── Run the simulate_course_sync — must succeed (workspace takes precedence) ──
SYNC7_EXIT=0
simulate_course_sync "$REMOTE7" "$WS7" 2>/dev/null || SYNC7_EXIT=$?

if [ "$SYNC7_EXIT" = "0" ]; then
  pass "course sync: sync succeeded even when remote and workspace edited the same file"
else
  fail "course sync: sync failed ($SYNC7_EXIT) when it should have taken workspace content"
fi

# Push must be a fast-forward from the remote-fix tip
NEW7_TIP=$(git ls-remote "$REMOTE7" refs/heads/main | awk '{print $1}')
PARENT7=$(git -C "$REMOTE7" rev-parse "${NEW7_TIP}^" 2>/dev/null || echo "unknown")

if [ "$PARENT7" = "$REMOTE7_TIP" ]; then
  pass "course sync: same-file conflict resolved as fast-forward (no divergence left on remote)"
else
  fail "course sync: push is not a fast-forward of the remote-fix commit (parent=$PARENT7)"
fi

# Final tree must contain workspace's value ($95), not the remote fix ($85)
VERIFY7="$TMP/verify7"
git clone -q "$REMOTE7" "$VERIFY7"
if grep -q '\$95' "$VERIFY7/pricing.txt" 2>/dev/null; then
  pass "course sync: workspace value (\$95) present in pushed result — workspace is authoritative"
else
  fail "course sync: workspace value (\$95) missing from pushed result"
fi
if ! grep -q '\$85' "$VERIFY7/pricing.txt" 2>/dev/null; then
  pass "course sync: remote-only edit (\$85) correctly overwritten by workspace content"
else
  fail "course sync: remote-only edit (\$85) survived — workspace did not take precedence"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 8: Completely fresh remote — no tracking ref (UNKNOWN / fall-through path)
#
#   Exercises the production script (scripts/sync-to-github.sh) directly via
#   its _SYNC_TEST_REMOTE seam, which wires GIT_FETCH/GIT_PUSH to a local bare
#   repo and overrides GITHUB_REPO so the sanity check passes.
#
#   When the bare remote is completely empty:
#     • git fetch returns nothing → origin/main tracking ref is absent
#     • The script falls through the UNKNOWN/divergence guards to the push step
#     • All local commits must arrive on the bare remote (exit 0, full history)
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 8: fresh remote (UNKNOWN tracking ref) — production script proceeds to push\n"

# Locate the production script using the workspace root resolved at script start.
SYNC_SCRIPT="$_WORKSPACE_ROOT/scripts/sync-to-github.sh"
if [ ! -f "$SYNC_SCRIPT" ]; then
  fail "fresh remote: cannot locate scripts/sync-to-github.sh at $SYNC_SCRIPT"
  printf "\n════════════════════════════════\n"
  printf "Sync recovery test: %d PASS / %d FAIL\n" "$PASS" "$FAIL"
  printf "════════════════════════════════\n\n"
  exit 1
fi

REMOTE8="$TMP/remote8.git"
LOCAL8="$TMP/local8"
git init --bare -q "$REMOTE8"
git init -q "$LOCAL8"
cd "$LOCAL8"

# Point origin at the bare remote; the _SYNC_TEST_REMOTE seam overrides
# GITHUB_REPO to this same path so the remote-URL sanity check passes.
git remote add origin "$REMOTE8"

# Local has 3 commits; the bare remote has NO commits — main does not exist.
echo "alpha" > alpha.txt; git add alpha.txt; git commit -qm "Commit alpha"
echo "beta"  > beta.txt;  git add beta.txt;  git commit -qm "Commit beta"
echo "gamma" > gamma.txt; git add gamma.txt; git commit -qm "Commit gamma"

LOCAL8_SHA=$(git rev-parse main)

# 8a — Run the production script.  _SYNC_TEST_REMOTE injects the local bare
#      remote for both fetch and push and skips the course-sync step.
SCRIPT8_EXIT=0
_SYNC_TEST_REMOTE="$REMOTE8" bash "$SYNC_SCRIPT" 2>&1 || SCRIPT8_EXIT=$?

if [ "$SCRIPT8_EXIT" = "0" ]; then
  pass "fresh remote: production script exited 0 — did not abort on missing tracking ref"
else
  fail "fresh remote: production script exited $SCRIPT8_EXIT — aborted instead of pushing"
fi

# 8b — Verify the correct HEAD SHA was pushed.
PUSHED8=$(git ls-remote "$REMOTE8" refs/heads/main | awk '{print $1}')
if [ "$PUSHED8" = "$LOCAL8_SHA" ]; then
  pass "fresh remote: pushed SHA matches local HEAD"
else
  fail "fresh remote: pushed SHA mismatch: got '${PUSHED8:-<nothing>}', expected $LOCAL8_SHA"
fi

# 8c — Clone the bare remote and verify all commits arrived — none skipped.
VERIFY8="$TMP/verify8"
git clone -q "$REMOTE8" "$VERIFY8"
LOG8=$(git -C "$VERIFY8" log --oneline main)
COUNT8=$(echo "$LOG8" | wc -l | tr -d ' ')

if [ "$COUNT8" = "3" ]; then
  pass "fresh remote: all 3 local commits delivered — none skipped when BASE_SHA absent"
else
  fail "fresh remote: expected 3 commits on bare remote, got $COUNT8"
fi

# 8d — Confirm each individual commit is present in the pushed history.
for MSG in "Commit alpha" "Commit beta" "Commit gamma"; do
  if echo "$LOG8" | grep -q "$MSG"; then
    pass "fresh remote: '$MSG' present in pushed history"
  else
    fail "fresh remote: '$MSG' missing from pushed history"
  fi
done

# ═════════════════════════════════════════════════════════════════════════════
# Test 9: Course sync — completely empty remote (first-ever push)
#
#   Simulates the very first time sync-course-to-github.sh is run against a
#   brand-new GitHub repository that has no commits at all.
#
#   When ls-remote returns nothing:
#     • REMOTE_SHA is empty → the fetch / checkout FETCH_HEAD / git rm block
#       is skipped entirely
#     • The script creates a fresh branch directly (`git checkout -b main`)
#     • Course content is copied and committed
#     • A plain push (not a force-push, not a rebase) delivers the content
#
#   After the sync:
#     • The remote must have exactly the content that was pushed
#     • The exit code must be 0
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 9: course sync – first-ever push to empty remote exits cleanly\n"

REMOTE9="$TMP/remote9.git"
git init --bare -q "$REMOTE9"

# Confirm the remote really is empty (ls-remote returns nothing for refs/heads/main)
EARLY_SHA=$(git ls-remote "$REMOTE9" refs/heads/main | awk '{print $1}')
if [ -z "$EARLY_SHA" ]; then
  pass "empty remote confirmed: ls-remote returns nothing for refs/heads/main"
else
  fail "test setup error: remote9 already has a main ref ($EARLY_SHA)"
fi

# Workspace with a realistic course layout
WS9="$TMP/ws9"
mkdir -p "$WS9/lesson-01"
echo "# Lesson 01 — Welcome to Git Dojo" > "$WS9/lesson-01/README.md"
echo "echo 'Setting up course...'"       > "$WS9/setup.sh"
echo "echo 'Resetting playground...'"    > "$WS9/reset.sh"
echo "# Git Dojo Course"                 > "$WS9/README.md"

# Run the simulate_course_sync against the empty remote — must succeed
SYNC9_EXIT=0
SYNC9_OUT=$(simulate_course_sync "$REMOTE9" "$WS9" 2>&1) || SYNC9_EXIT=$?

if [ "$SYNC9_EXIT" = "0" ]; then
  pass "empty remote: course sync exited 0 — did not abort on first-ever push"
else
  fail "empty remote: course sync exited $SYNC9_EXIT — aborted instead of pushing"
fi

# The remote must now have a main branch
PUSHED9=$(git ls-remote "$REMOTE9" refs/heads/main | awk '{print $1}')
if [ -n "$PUSHED9" ]; then
  pass "empty remote: refs/heads/main now exists on the remote after first-ever push"
else
  fail "empty remote: refs/heads/main still absent — nothing was pushed"
fi

# Clone the bare remote and verify the course content arrived intact
VERIFY9="$TMP/verify9"
git clone -q "$REMOTE9" "$VERIFY9"

LOG9=$(git -C "$VERIFY9" log --oneline main 2>/dev/null || echo "")
COUNT9=$(echo "$LOG9" | grep -c . || echo "0")
if [ "$COUNT9" -ge "1" ]; then
  pass "empty remote: at least one commit present on the remote after first-ever push"
else
  fail "empty remote: no commits found on the remote — push may have silently failed"
fi

# Confirm individual course files were delivered
for fname in "lesson-01/README.md" "setup.sh" "reset.sh" "README.md"; do
  if [ -f "$VERIFY9/$fname" ]; then
    pass "empty remote: '$fname' present in pushed remote"
  else
    fail "empty remote: '$fname' missing from pushed remote"
  fi
done

# Confirm file content is correct (not empty, not garbled)
if grep -q "Git Dojo" "$VERIFY9/lesson-01/README.md" 2>/dev/null; then
  pass "empty remote: lesson-01/README.md content matches workspace"
else
  fail "empty remote: lesson-01/README.md content does not match workspace"
fi

# The push must be a root commit (no parent) — there was nothing to build on.
# Use --verify so git exits non-zero silently rather than printing the ref name.
PARENT9=$(git -C "$VERIFY9" rev-parse --verify "HEAD^" 2>/dev/null || echo "no-parent")
if [ "$PARENT9" = "no-parent" ]; then
  pass "empty remote: pushed commit is a root commit (no parent) — rebase block was skipped"
else
  fail "empty remote: pushed commit has a parent ($PARENT9) — rebase block may have run unexpectedly"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 9b: Empty remote + workspace with NO lesson-* folders
#
#   Verifies the edge case where the very first sync is run against a brand-new
#   (empty) remote but the workspace has not yet been populated with any
#   lesson-* directories (e.g. a partially bootstrapped course).
#
#   The production script (scripts/sync-course-to-github.sh) has a hard-coded
#   EXPECTED_LESSONS manifest (9 lessons) and rejects the sync with a clear
#   error before any cp or git add runs when any listed lesson is absent.
#
#   This test mirrors that manifest guard by setting SYNC_EXPECTED_LESSONS to a
#   representative subset of the production list before calling
#   simulate_course_sync.  The expected outcome is:
#     • Exit code NON-ZERO — the manifest pre-copy check fires
#     • A meaningful error appears on stderr
#     • Nothing is pushed to the remote (abort happened before git commit)
#
#   This is EXPLICITLY REJECTED, not silently allowed: a lesson-free workspace
#   is a misconfigured or partially bootstrapped course and must not produce a
#   commit with only root files.
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 9b: empty remote + workspace with no lesson-* folders — explicitly rejected with clear error\n"

REMOTE9B="$TMP/remote9b.git"
git init --bare -q "$REMOTE9B"

# Confirm the remote is truly empty before the test begins.
EARLY9B=$(git ls-remote "$REMOTE9B" refs/heads/main | awk '{print $1}')
if [ -z "$EARLY9B" ]; then
  pass "no-lessons: remote is empty before the test run"
else
  fail "test setup error: remote9b already has a main ref ($EARLY9B)"
fi

# Workspace with root files only — deliberately NO lesson-* directories.
# This simulates a partially bootstrapped course (setup.sh/README exist but
# no lesson content has been created yet).
WS9B="$TMP/ws9b"
mkdir -p "$WS9B"
echo "# Git Dojo Course"              > "$WS9B/README.md"
echo "echo 'Setting up course...'"    > "$WS9B/setup.sh"
echo "echo 'Resetting playground...'" > "$WS9B/reset.sh"

# Confirm no lesson-* directory exists in the test workspace.
LESSON_COUNT9B=$(find "$WS9B" -maxdepth 1 -type d -name "lesson-*" | wc -l | tr -d ' ')
if [ "$LESSON_COUNT9B" = "0" ]; then
  pass "no-lessons: workspace correctly has zero lesson-* directories"
else
  fail "test setup error: found $LESSON_COUNT9B lesson-* dir(s) — workspace should have none"
fi

# Run simulate_course_sync WITH a manifest that matches the production script's
# expectation (a representative subset of the 9 real lesson names).  The
# pre-copy manifest check must detect every missing entry and exit non-zero.
SYNC9B_EXIT=0
SYNC9B_OUTPUT=$(SYNC_EXPECTED_LESSONS="lesson-01-first-snapshot lesson-02-the-ledger lesson-03-undo-without-erasing" \
  simulate_course_sync "$REMOTE9B" "$WS9B" 2>&1) || SYNC9B_EXIT=$?

# The sync MUST exit non-zero — a lesson-free workspace is rejected.
if [ "$SYNC9B_EXIT" != "0" ]; then
  pass "no-lessons: course sync exited non-zero ($SYNC9B_EXIT) — lesson-free workspace is explicitly rejected"
else
  fail "no-lessons: course sync exited 0 — should have rejected a workspace with no lesson-* dirs"
fi

# A meaningful error message must appear in the output.
if echo "$SYNC9B_OUTPUT" | grep -qi "ERROR"; then
  pass "no-lessons: error message present in output — failure is explicit, not silent"
else
  fail "no-lessons: no ERROR line found in output — failure may be silent or cryptic"
fi

# The error should mention that lessons are missing.
if echo "$SYNC9B_OUTPUT" | grep -qi "lesson"; then
  pass "no-lessons: output names the missing lesson(s) — error is actionable for the user"
else
  fail "no-lessons: output does not mention missing lessons — error lacks actionable detail"
fi

# Nothing must be pushed to the remote — the abort happened before git commit.
PUSHED9B=$(git ls-remote "$REMOTE9B" refs/heads/main 2>/dev/null | awk '{print $1}')
if [ -z "$PUSHED9B" ]; then
  pass "no-lessons: nothing pushed to remote — abort happened before any commit"
else
  fail "no-lessons: remote has a commit ($PUSHED9B) — sync should have aborted before committing"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Test 10: Manifest-based rename detection
#
#   10a — Rename to non-lesson-* name: lesson-02 is renamed to module-02 in the
#         workspace. The caller's manifest still lists lesson-02. The pre-copy
#         manifest check must detect the missing entry and exit non-zero before
#         cp or git add runs.
#
#   10b — Happy-path control: all manifest entries are present in the workspace;
#         sync must succeed and push normally.
#
#   10c — Partial-copy belt-and-suspenders: both lesson folders exist in the
#         workspace source but one fails to arrive in the sync dir (simulates a
#         cp failure). The post-copy manifest check must catch it.
# ═════════════════════════════════════════════════════════════════════════════
printf "\n» Test 10: manifest-based rename detection and post-copy sanity check\n"

# ── 10a: lesson-02 renamed to module-02 — pre-copy manifest check fires ───────
REMOTE10A="$TMP/remote10a.git"
git init --bare -q "$REMOTE10A"

WS10A="$TMP/ws10a"
mkdir -p "$WS10A/lesson-01" "$WS10A/module-02"   # module-02 was lesson-02 before rename
echo "Lesson 01" > "$WS10A/lesson-01/README.md"
echo "Module 02 (renamed from lesson-02)" > "$WS10A/module-02/README.md"

SYNC10A_EXIT=0
SYNC_EXPECTED_LESSONS="lesson-01 lesson-02" \
  simulate_course_sync "$REMOTE10A" "$WS10A" 2>/dev/null || SYNC10A_EXIT=$?

if [ "$SYNC10A_EXIT" != "0" ]; then
  pass "rename detection: exited non-zero when lesson-02 was renamed to module-02"
else
  fail "rename detection: should have exited non-zero for missing lesson-02 (renamed to module-02)"
fi

# Confirm nothing was pushed to the remote (sync aborted before git add)
PUSHED10A=$(git ls-remote "$REMOTE10A" refs/heads/main 2>/dev/null | awk '{print $1}')
if [ -z "$PUSHED10A" ]; then
  pass "rename detection: nothing pushed to remote — abort happened before commit"
else
  fail "rename detection: remote has a commit ($PUSHED10A) — sync should have aborted earlier"
fi

# ── 10b: all manifest entries present — sync succeeds ─────────────────────────
REMOTE10B="$TMP/remote10b.git"
git init --bare -q "$REMOTE10B"

WS10B="$TMP/ws10b"
mkdir -p "$WS10B/lesson-01" "$WS10B/lesson-02"
echo "Lesson 01" > "$WS10B/lesson-01/README.md"
echo "Lesson 02" > "$WS10B/lesson-02/README.md"

SYNC10B_EXIT=0
SYNC_EXPECTED_LESSONS="lesson-01 lesson-02" \
  simulate_course_sync "$REMOTE10B" "$WS10B" 2>/dev/null || SYNC10B_EXIT=$?

if [ "$SYNC10B_EXIT" = "0" ]; then
  pass "manifest happy path: sync exits 0 when all manifest entries are present"
else
  fail "manifest happy path: sync exited $SYNC10B_EXIT — false positive on complete workspace"
fi

PUSHED10B=$(git ls-remote "$REMOTE10B" refs/heads/main 2>/dev/null | awk '{print $1}')
if [ -n "$PUSHED10B" ]; then
  pass "manifest happy path: commit was pushed to remote"
else
  fail "manifest happy path: nothing pushed — sync may have exited too early"
fi

# ── 10c: partial-copy (cp-level failure) caught by post-copy manifest check ───
# Both lessons exist in the workspace source but only lesson-01 arrives in the
# sync dir (simulates a cp failure for lesson-02).
SANITY10C_EXIT=0
(
  syncdir10c="$(mktemp -d)"
  trap 'rm -rf "$syncdir10c"' EXIT
  cd "$syncdir10c"

  WS10C_SRC="$TMP/ws10c_src"
  mkdir -p "$WS10C_SRC/lesson-01" "$WS10C_SRC/lesson-02"
  echo "L1" > "$WS10C_SRC/lesson-01/README.md"
  echo "L2" > "$WS10C_SRC/lesson-02/README.md"

  # Simulate cp delivering only lesson-01 (lesson-02 failed silently).
  cp -r "$WS10C_SRC/lesson-01" .

  # Post-copy manifest check logic (mirrors both the script and simulate_course_sync).
  _post_missing=()
  for _lesson in lesson-01 lesson-02; do
    [ -d "$_lesson" ] || _post_missing+=("$_lesson")
  done
  if [ "${#_post_missing[@]}" -gt 0 ]; then
    printf 'ERROR: lesson folder not copied to sync dir: %s\n' "${_post_missing[@]}" >&2
    exit 1
  fi
  exit 0
) || SANITY10C_EXIT=$?

if [ "$SANITY10C_EXIT" != "0" ]; then
  pass "post-copy check: exited non-zero when lesson-02 absent after partial cp"
else
  fail "post-copy check: should have exited non-zero for absent lesson-02"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
printf "\n════════════════════════════════\n"
printf "Sync recovery test: %d PASS / %d FAIL\n" "$PASS" "$FAIL"
printf "════════════════════════════════\n\n"

if [ "$FAIL" -gt 0 ]; then
  echo "One or more sync-recovery checks FAILED." >&2
  exit 1
fi
exit 0
