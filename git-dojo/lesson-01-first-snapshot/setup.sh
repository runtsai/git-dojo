#!/usr/bin/env bash
set -e
trap 'echo; echo "Something went wrong — run this for a full diagnosis:"; echo "  bash ~/git-dojo/doctor.sh"; echo "(Windows Git Bash: Shift+Insert to paste)"' ERR
cd "$(dirname "$0")/.."
rm -rf playground/lesson-01
mkdir -p playground/lesson-01
cat > playground/lesson-01/notes.txt <<'TXT'
RTS.AI working notes
Day one of learning Git for real.
TXT
if ! git config user.name >/dev/null 2>&1 || ! git config user.email >/dev/null 2>&1; then
  echo "HEADS UP: Git does not know who you are yet. Before committing, run:"
  echo '  git config --global user.name  "Your Name"'
  echo '  git config --global user.email "you@example.com"'
  echo "If you run into trouble, this will diagnose your setup:"
  echo "  bash ~/git-dojo/doctor.sh"
fi
echo "Sandbox ready at: playground/lesson-01"
echo "Now:  cd ../playground/lesson-01   and follow the README."
