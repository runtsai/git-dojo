#!/usr/bin/env bash
BASE="$(dirname "$0")/../playground/lesson-08"
cd "$BASE" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
ck "Ruth's invoicing commit reached the shared remote"   'git -C hub/handbook.git log --format=%s main 2>/dev/null | grep -qi "invoicing"' "press Time Passes in the dashboard (or: bash ../../../lesson-08-the-collision/bot.sh)"
ck "You committed the safety section on your laptop"     'git -C laptop log --format=%s 2>/dev/null | grep -qi "safety"' "edit handbook.txt, then git add + git commit with 'safety' in the message"
ck "Your laptop history contains Ruth's commit too"      'git -C laptop log --format=%s 2>/dev/null | grep -qi "invoicing"' "git fetch, then git merge origin/main (or git pull)"
ck "Your safety commit made it to the shared remote"     'git -C hub/handbook.git log main --format=%s 2>/dev/null | grep -qi "safety"' "after merging, git push"
ck "Laptop and remote are byte-identical at the tip"     '[ -n "$(git -C laptop rev-parse HEAD 2>/dev/null)" ] && [ "$(git -C laptop rev-parse HEAD)" = "$(git -C hub/handbook.git rev-parse main 2>/dev/null)" ]' "push/pull until synced"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "Lesson 8 complete. A rejected push is not an error — it is Git protecting the shared record until you have read what your teammate wrote."
