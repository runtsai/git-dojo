#!/usr/bin/env bash
cd "$(dirname "$0")/../playground/lesson-01" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
ck "Folder is a Git repository"                '[ -d .git ]'                                        "run: git init"
ck "At least 3 commits sealed"                 '[ "$(git rev-list --count HEAD 2>/dev/null || echo 0)" -ge 3 ]' "you need 3 commits (steps 3, 5, 6)"
ck "ideas.txt exists and is committed"         'git ls-files --error-unmatch ideas.txt >/dev/null 2>&1' "create ideas.txt, then add + commit it"
ck "No unsealed changes left behind"           '[ -z "$(git status --porcelain)" ]'                 "run git status; add and commit what remains"
ck "Commit messages are real (none say test)"  '! git log --format=%s | grep -qiE "^(test|asdf|wip)$"' "reword: messages should say what and why"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "Lesson 1 complete. The seal-the-record loop is yours." 
