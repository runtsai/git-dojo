#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
rm -rf playground/lesson-03
mkdir -p playground/lesson-03
cd playground/lesson-03
git init -q
git config user.name "Previous Operator"
git config user.email "ops@example.com"
printf "SHOP SAFETY MANUAL\n1. Wear eye protection\n2. Clear the work area\n3. Lock out power before service\n4. Log every incident\n" > manual.txt
git add . && git commit -qm "Add shop safety manual"
printf "General notes\n" > notes.txt
git add . && git commit -qm "Add notes file"
printf "TODO delete this\n" >> notes.txt
git add . && git commit -qm "Add a temporary note (mistake)"
sed -i.bak '/Lock out power/d' manual.txt && rm -f manual.txt.bak
git add . && git commit -qm "Streamline manual by removing a step"
echo "Sandbox ready: playground/lesson-03 — the newest commit is a known defect."
echo "Now:  cd ../playground/lesson-03   and follow the README."
