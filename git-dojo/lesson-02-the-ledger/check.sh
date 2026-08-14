#!/usr/bin/env bash
cd "$(dirname "$0")/../playground/lesson-02" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
FEE_HASH=$(git log --format="%h %s" -- pricing.txt | grep -i "fee" | grep -iv "Add pricing" | awk '{print $1}' | head -1)
ck "audit.txt exists and is committed"   'git ls-files --error-unmatch audit.txt >/dev/null 2>&1'  "create audit.txt, add, commit"
ck "audit.txt names the correct commit"  'grep -q "$FEE_HASH" audit.txt 2>/dev/null'               "the hash in audit.txt is not the fee-change commit; use git log -p pricing.txt"
ck "Audit commit message used"           'git log --format=%s -1 -- audit.txt | grep -qi "audit"'  "commit audit.txt with the Audit: message"
ck "History untouched (6 commits total)" '[ "$(git rev-list --count HEAD)" -eq 6 ]'                "you should have added exactly one commit on top of the five"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "Lesson 2 complete. You can read any repo's custody trail cold."
