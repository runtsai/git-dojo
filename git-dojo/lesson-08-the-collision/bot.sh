#!/usr/bin/env bash
# Teammate engine — plays Ruth Osei's scripted commit into the shared remote.
set -e
BASE="$(dirname "$0")/../playground/lesson-08"
cd "$BASE" 2>/dev/null || { echo "The sandbox does not exist yet. Run setup.sh first."; exit 1; }
[ -d hub/handbook.git ] || { echo "The shared remote is missing. Run setup.sh again."; exit 1; }

if git -C hub/handbook.git log --format=%s main 2>/dev/null | grep -q "invoicing"; then
  echo "Ruth Osei has already pushed her work. Nothing new on the remote."
  exit 0
fi

rm -rf .ruth
git clone -q hub/handbook.git .ruth
cd .ruth
git config user.name "Ruth Osei"
git config user.email "ruth@osei-consulting.example"
printf "Section 2: Invoicing\nInvoices go out within 48 hours of delivery confirmation.\nAttach the signed proof-of-delivery to every invoice.\n" > invoicing.txt
git add invoicing.txt
git commit -qm "Add invoicing steps to the handbook"
git push -q origin main
cd ..
rm -rf .ruth
echo "While you were working, Ruth Osei pushed a commit to the shared remote:"
echo "  Add invoicing steps to the handbook"
echo "Your laptop does not have it yet. Your next push will be rejected until you fetch and merge."
