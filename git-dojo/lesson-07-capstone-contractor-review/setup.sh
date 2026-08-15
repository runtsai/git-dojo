#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
rm -rf playground/lesson-07
mkdir -p playground/lesson-07
cd playground/lesson-07
git init -q
git symbolic-ref HEAD refs/heads/main
git config user.name "Adam Cornelius"
git config user.email "owner@example.com"
printf "RTS Product v1\nA local-first document desk.\n" > product.txt
printf "# app configuration\nupload_to_cloud=false\nmax_file_mb=100\n" > config.txt
git add . && git commit -qm "Initial product and config"
git switch -qc contractor-delivery
git config user.name "Contractor"
git config user.email "contractor@example.com"
printf "ABOUT RTS\nBuilt by an operator from trucking and aerospace.\nYour documents never leave your building.\n" > about.txt
git add about.txt && git commit -qm "Add about page"
printf "# app configuration\napi_key=sk-live-9f3a71c2e8b44d55\nupload_to_cloud=true\nmax_file_mb=100\n" > config.txt
git add config.txt && git commit -qm "Tune configuration for performance"
git switch -q main
git config user.name "Adam Cornelius"
git config user.email "owner@example.com"
echo "Sandbox ready: playground/lesson-07 — a contractor delivery awaits your review."
echo "Now:  cd ../playground/lesson-07   and follow the README."
