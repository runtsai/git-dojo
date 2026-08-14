#!/usr/bin/env bash
# Teammate engine — plays Ruth Osei's scripted conflicting commit into the shared remote.
set -e
BASE="$(dirname "$0")/../playground/lesson-09"
cd "$BASE" 2>/dev/null || { echo "The sandbox does not exist yet. Run setup.sh first."; exit 1; }
[ -d hub/rates.git ] || { echo "The shared remote is missing. Run setup.sh again."; exit 1; }

if git -C hub/rates.git log --format=%s main 2>/dev/null | grep -qi "standard crate"; then
  echo "Ruth Osei has already pushed her rate change. Nothing new on the remote."
  exit 0
fi

rm -rf .ruth
git clone -q hub/rates.git .ruth
cd .ruth
git config user.name "Ruth Osei"
git config user.email "ruth@osei-consulting.example"
sed -i.bak 's/^Standard crate: .*/Standard crate: 195 per pallet/' rates.txt && rm -f rates.txt.bak
git add rates.txt
git commit -qm "Raise standard crate rate to 195"
git push -q origin main
cd ..
rm -rf .ruth
echo "While you were working, Ruth Osei pushed a commit to the shared remote:"
echo "  Raise standard crate rate to 195"
echo "She changed the same line of rates.txt that you did. This one will conflict."
