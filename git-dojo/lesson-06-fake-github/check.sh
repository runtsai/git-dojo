#!/usr/bin/env bash
BASE="$(dirname "$0")/../playground/lesson-06"
cd "$BASE" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
ck "Owner pushed a services commit to the hub"      'git -C hub/website.git log --format=%s main 2>/dev/null | grep -qi "services"' "commit in laptop/, then git push"
ck "Contractor clone exists"                        '[ -d contractor/.git ]'                       "git clone hub/website.git contractor"
ck "Contractor pushed a contact commit"             'git -C hub/website.git log --format=%s main | grep -qi "contact"' "commit in contractor/, then git push"
ck "Laptop pulled the contractor's work"            'git -C laptop log --format=%s | grep -qi "contact"' "in laptop/: git pull"
ck "Laptop and hub are byte-identical at the tip"   '[ "$(git -C laptop rev-parse HEAD)" = "$(git -C hub/website.git rev-parse main)" ]' "push/pull until synced"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "Lesson 6 complete. GitHub is now just a URL — you already speak its language."
