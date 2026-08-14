#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
rm -rf playground/lesson-08
mkdir -p playground/lesson-08/hub
cd playground/lesson-08
git init -q --bare -b main hub/handbook.git
git clone -q hub/handbook.git laptop 2>/dev/null
cd laptop
git symbolic-ref HEAD refs/heads/main
git config user.name "Adam Cornelius"
git config user.email "owner@example.com"
printf "RTS FREIGHT — OPERATIONS HANDBOOK\n\nSection 1: Intake\nEvery shipment gets a record before it gets a truck.\n" > handbook.txt
git add . && git commit -qm "Start the operations handbook"
git push -q origin main 2>/dev/null || git push -q -u origin main
echo "Sandbox ready: playground/lesson-08"
echo "  hub/handbook.git = the shared remote (your fake GitHub)"
echo "  laptop/          = your machine, already connected"
echo "A contractor, Ruth Osei, also has access to this repository."
echo "Now:  cd ../playground/lesson-08/laptop   and follow the README."
