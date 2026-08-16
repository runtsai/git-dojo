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
