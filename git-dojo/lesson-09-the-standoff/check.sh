#!/usr/bin/env bash
BASE="$(dirname "$0")/../playground/lesson-09"
cd "$BASE" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
ck "Ruth's rate-change commit reached the shared remote"  'git -C hub/rates.git log --format=%s main 2>/dev/null | grep -qi "195"' "press Time Passes in the dashboard (or: bash ../../../lesson-09-the-standoff/bot.sh)"
ck "You committed your own rate change on the laptop"     'git -C laptop log --format=%s 2>/dev/null | grep -qi "200"' "edit the Standard crate line to 200, git add + git commit with '200' in the message"
ck "History carries both sides of the standoff"           'git -C laptop log --format=%s 2>/dev/null | grep -qi "195" && git -C laptop log --format=%s 2>/dev/null | grep -qi "200"' "git pull (or fetch + merge), then resolve the conflict"
ck "No conflict markers left in rates.txt"                '[ -f laptop/rates.txt ] && ! grep -qE "^(<<<<<<<|=======|>>>>>>>)" laptop/rates.txt' "open rates.txt, keep one clean version of the line, delete the marker lines"
ck "The final rate on the remote is your 200"             'git -C hub/rates.git show main:rates.txt 2>/dev/null | grep -q "Standard crate: 200 per pallet"' "after resolving, git add rates.txt, git commit, git push"
ck "Laptop and remote are byte-identical at the tip"      '[ -n "$(git -C laptop rev-parse HEAD 2>/dev/null)" ] && [ "$(git -C laptop rev-parse HEAD)" = "$(git -C hub/rates.git rev-parse main 2>/dev/null)" ]' "push/pull until synced"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "Lesson 9 complete. A conflict is not damage — it is Git refusing to guess which human is right. You made the ruling, and the record shows both sides."
