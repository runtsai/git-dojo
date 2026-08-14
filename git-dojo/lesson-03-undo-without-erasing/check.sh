#!/usr/bin/env bash
cd "$(dirname "$0")/../playground/lesson-03" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
ck "Lockout line restored in manual.txt"        'grep -q "Lock out power" manual.txt'          "revert HEAD (the streamline commit)"
ck "Temporary note removed from notes.txt"      '! grep -q "TODO delete this" notes.txt'       "revert the temporary-note commit by hash"
ck "History preserved — no commits deleted"     '[ "$(git rev-list --count HEAD)" -ge 6 ]'     "you should have 4 original + 2 revert commits; never delete history"
ck "Corrections are revert commits"             '[ "$(git log --format=%s | grep -c "^Revert")" -ge 2 ]' "use git revert, not manual edits"
ck "Nothing left unsealed"                      '[ -z "$(git status --porcelain)" ]'           "commit any leftover changes"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "Lesson 3 complete. Additive correction is now muscle memory."
