#!/usr/bin/env bash
cd "$(dirname "$0")/../playground/lesson-07" 2>/dev/null || { echo "FAIL: playground missing. Run setup.sh first."; exit 1; }
pass=0; fail=0
ck(){ if eval "$2"; then echo "PASS: $1"; pass=$((pass+1)); else echo "FAIL: $1 — $3"; fail=$((fail+1)); fi; }
ck "On main"                                   '[ "$(git branch --show-current)" = "main" ]'         "git switch main"
ck "review.txt committed with two findings"    '[ "$(grep -c "FINDING" review.txt 2>/dev/null)" -ge 2 ] && git ls-files --error-unmatch review.txt >/dev/null 2>&1' "write FINDING 1 and FINDING 2, commit"
ck "Found the planted secret"                  'grep -qiE "key|secret|credential|token" review.txt'  "one finding should name the credential in config"
ck "Found the unauthorized behavior change"    'grep -qiE "cloud|upload|behavior|unauthorized|silent" review.txt' "one finding should name the cloud-upload flip"
ck "About page adopted onto main"              'git ls-files --error-unmatch about.txt >/dev/null 2>&1 && grep -q "ABOUT RTS" about.txt' "git restore --source=contractor-delivery -- about.txt, then commit"
ck "Contaminated config NEVER reached main"    '! grep -q "api_key" config.txt && grep -q "upload_to_cloud=false" config.txt' "main config must stay clean; do not merge or restore config.txt"
ck "Rejected branch preserved, not deleted"    'git branch --list contractor-delivery | grep -q contractor-delivery' "keep the branch on record"
ck "Disposition recorded"                      'grep -qi "DISPOSITION" review.txt'                   "add the DISPOSITION line and commit"
echo; echo "Score: $pass PASS / $fail FAIL"
[ $fail -eq 0 ] && echo "CAPSTONE COMPLETE. You can review, catch, partially adopt, and rule — the owner's seat is yours."
