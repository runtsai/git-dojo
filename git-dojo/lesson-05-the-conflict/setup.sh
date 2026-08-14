#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
rm -rf playground/lesson-05
mkdir -p playground/lesson-05
cd playground/lesson-05
git init -q
git config user.name "Previous Operator"
git config user.email "ops@example.com"
printf "RTS Freight pricing\nStandard load: \$500\nDelivery fee: \$50\n" > pricing.txt
git add . && git commit -qm "Add pricing sheet"
git switch -qc fuel-adjustment
sed -i.bak 's/Delivery fee: \$50/Delivery fee: \$80/' pricing.txt && rm -f pricing.txt.bak
git add . && git commit -qm "Raise delivery fee to \$80 for fuel costs"
git switch -q main
git switch -qc insurance-adjustment
sed -i.bak 's/Delivery fee: \$50/Delivery fee: \$95/' pricing.txt && rm -f pricing.txt.bak
git add . && git commit -qm "Raise delivery fee to \$95 for insurance costs"
git switch -q main
echo "Sandbox ready: playground/lesson-05 — two branches disagree about one line."
echo "Now:  cd ../playground/lesson-05   and follow the README."
