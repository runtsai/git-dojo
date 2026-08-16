#!/usr/bin/env bash
set -e
trap 'echo; echo "Something went wrong — run this for a full diagnosis:"; echo "  bash ~/git-dojo/doctor.sh"; echo "(Windows Git Bash: Shift+Insert to paste)"' ERR
cd "$(dirname "$0")/.."
rm -rf playground/lesson-02
mkdir -p playground/lesson-02
cd playground/lesson-02
git init -q
git config user.name  "Previous Operator"
git config user.email "ops@example.com"
printf "RTS Freight — company overview\nWe move regulated freight with clean records.\n" > overview.txt
git add . && git commit -qm "Open company records: overview"
printf "Standard load: \$500\nDelivery fee: \$50\n" > pricing.txt
git add . && git commit -qm "Add pricing sheet with standard load and delivery fee"
printf "Dispatch checklist\n1. Verify DOT number\n2. Confirm insurance\n" > dispatch.txt
git add . && git commit -qm "Add dispatch checklist"
sed -i.bak 's/Delivery fee: \$50/Delivery fee: \$75/' pricing.txt && rm -f pricing.txt.bak
git add . && git commit -qm "Raise delivery fee to cover fuel costs"
printf "3. Log departure time\n" >> dispatch.txt
git add . && git commit -qm "Extend dispatch checklist with departure logging"
echo "Sandbox ready: playground/lesson-02 (a repo with 5 commits of history)."
echo "Now:  cd ../playground/lesson-02   and follow the README."
