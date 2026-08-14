#!/usr/bin/env bash
cd "$(dirname "$0")/../playground/lesson-04" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
ck "Standing on main"                        '[ "$(git branch --show-current)" = "main" ]'      "git switch main"
ck "New tagline merged into main"            'grep -q "Clean records. Moved right." index.html' "commit on new-tagline, then merge into main"
ck "new-tagline branch was used"             'git log --format=%s | grep -qi "tagline"'          "the tagline change should be its own commit"
ck "bad-idea branch is gone"                 '! git branch --list bad-idea | grep -q bad-idea'  "delete it: git branch -D bad-idea"
ck "Company name intact (bad idea rejected)" 'grep -q "<h1>RTS Freight</h1>" index.html'        "the ridiculous name must never reach main"
ck "Nothing unsealed"                        '[ -z "$(git status --porcelain)" ]'               "commit or discard stray edits"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "Lesson 4 complete. Draft, reject, approve — the candidate lifecycle is yours."
