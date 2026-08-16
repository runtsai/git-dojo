#!/usr/bin/env bash
set -e
trap 'echo; echo "Something went wrong — run this for a full diagnosis:"; echo "  bash ~/git-dojo/doctor.sh"; echo "(Windows Git Bash: Shift+Insert to paste)"' ERR
cd "$(dirname "$0")/.."
rm -rf playground/lesson-09
mkdir -p playground/lesson-09/hub
cd playground/lesson-09
git init -q --bare hub/rates.git
git --git-dir=hub/rates.git symbolic-ref HEAD refs/heads/main
git clone -q hub/rates.git laptop 2>/dev/null
cd laptop
git symbolic-ref HEAD refs/heads/main
git config user.name "Adam Cornelius"
git config user.email "owner@example.com"
printf "RTS FREIGHT — RATE CARD\n\nStandard crate: 180 per pallet\nHazmat crate: 340 per pallet\nRush surcharge: 25 percent\n" > rates.txt
git add . && git commit -qm "Publish the rate card"
git push -q origin main 2>/dev/null || git push -q -u origin main
echo "Sandbox ready: playground/lesson-09"
echo "  hub/rates.git = the shared remote (your fake GitHub)"
echo "  laptop/       = your machine, already connected"
echo "Ruth Osei also has access, and she has opinions about the standard rate."
echo "Now:  cd ../playground/lesson-09/laptop   and follow the README."
