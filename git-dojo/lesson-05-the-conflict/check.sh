#!/usr/bin/env bash
cd "$(dirname "$0")/../playground/lesson-05" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
ck "On main"                                  '[ "$(git branch --show-current)" = "main" ]'   "git switch main"
ck "Merge fully completed (no conflict open)" '[ ! -f .git/MERGE_HEAD ] && [ -z "$(git status --porcelain)" ]' "finish: edit file, git add, git commit"
ck "Fee resolved to \$95"                     'grep -q "Delivery fee: \$95" pricing.txt'      "the ruling was \$95"
ck "No conflict markers left in file"         '! grep -qE "^(<{7}|={7}|>{7})" pricing.txt'    "delete the <<<<<<< ======= >>>>>>> lines"
ck "Both branch histories present"            'git log --oneline | grep -qi fuel && git log --oneline | grep -qi insurance' "merge both branches, do not delete either"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "Lesson 5 complete. Fail-closed conflicts are now a 90-second chore, not a crisis."
