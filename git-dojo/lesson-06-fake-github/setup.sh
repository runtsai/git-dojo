#!/usr/bin/env bash
set -e
trap 'echo; echo "Something went wrong — run this for a full diagnosis:"; echo "  bash ~/git-dojo/doctor.sh"; echo "(Windows Git Bash: Shift+Insert to paste)"' ERR
cd "$(dirname "$0")/.."
rm -rf playground/lesson-06
mkdir -p playground/lesson-06/hub
cd playground/lesson-06
git init -q --bare hub/website.git
git --git-dir=hub/website.git symbolic-ref HEAD refs/heads/main
git clone -q hub/website.git laptop 2>/dev/null
cd laptop
git symbolic-ref HEAD refs/heads/main
git config user.name "Adam Cornelius"
git config user.email "owner@example.com"
printf "RTS Freight — public site\nWe move regulated freight with clean records.\n" > site.txt
git add . && git commit -qm "Publish site v1"
git push -q origin main 2>/dev/null || git push -q -u origin main
echo "Sandbox ready: playground/lesson-06"
echo "  hub/website.git  = your fake GitHub (records vault, no working files)"
echo "  laptop/          = your machine, already connected to it"
echo "Now:  cd ../playground/lesson-06/laptop   and follow the README."
