#!/usr/bin/env bash
# Git Dojo setup doctor.
# Run any time something feels wrong; it checks the six most common setup
# mistakes and prints the exact command to fix each one.
#
# Usage:  bash ~/git-dojo/doctor.sh
# Works from any directory — paths are absolute.

set -u

# ── helpers ──────────────────────────────────────────────────────────────────
PASS="[PASS]"
FAIL="[FAIL]"
INFO="[INFO]"

pass() { echo "$PASS $1"; }
fail() { echo; echo "$FAIL $1"; shift; for line in "$@"; do echo "       $line"; done; echo; }
info() { echo "$INFO $1"; }

# ── locate this script ───────────────────────────────────────────────────────
HERE="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$(cd ~ && pwd)"
ISSUES=0

echo "== Git Dojo setup doctor =="
echo "   Checking from: $HERE"
echo

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 1 — accidental repo in the home folder
#   Happens when someone types 'git init' in ~ before unpacking the course.
# ─────────────────────────────────────────────────────────────────────────────
if [ -d "$HOME_DIR/.git" ]; then
  ISSUES=$((ISSUES + 1))
  fail \
    "Your home folder (~) is itself a Git repository." \
    "This confuses every lesson that tries to 'git init' its own folder." \
    "Fix — remove the accidental repo (your files are NOT deleted):" \
    "  rm -rf ~/.git" \
    "(Windows Git Bash: Shift+Insert to paste)"
else
  pass "No accidental Git repo in your home folder."
fi

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 2 — accidental repo inside the dojo folder itself
#   Happens when someone runs 'git init' or 'git clone' inside ~/git-dojo.
# ─────────────────────────────────────────────────────────────────────────────
if [ -d "$HERE/.git" ]; then
  ISSUES=$((ISSUES + 1))
  fail \
    "The git-dojo course folder ($HERE) is itself a Git repository." \
    "Lesson repos must be separate; having a .git here interferes with them." \
    "Fix — remove it (your lesson files are NOT deleted):" \
    "  rm -rf ~/git-dojo/.git"
else
  pass "No accidental Git repo inside the dojo folder."
fi

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 3 — nested layout (zip extracted one folder too deep)
#   GitHub ZIP → git-dojo-course-main/ → git-dojo-course-main/lesson-01...
#   or renamed to git-dojo → git-dojo/git-dojo/lesson-01...
# ─────────────────────────────────────────────────────────────────────────────
NESTED_FOUND=""
for candidate in git-dojo git-dojo-main git-dojo-course git-dojo-course-main; do
  if [ -d "$HERE/$candidate" ] && [ -e "$HERE/$candidate/setup.sh" ]; then
    NESTED_FOUND="$candidate"
    break
  fi
done

if [ -n "$NESTED_FOUND" ]; then
  ISSUES=$((ISSUES + 1))
  fail \
    "Lessons are inside an extra '$NESTED_FOUND' subfolder." \
    "This is a zip-extraction artifact — GitHub wraps files in an extra folder." \
    "Fix — run setup.sh from the nested path; it will flatten the layout for you:" \
    "  bash ~/git-dojo/$NESTED_FOUND/setup.sh"
else
  pass "No nested folder layout detected."
fi

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 4 — lesson structure present (lesson-01 exists)
# ─────────────────────────────────────────────────────────────────────────────
if [ -e "$HERE/lesson-01-first-snapshot/setup.sh" ]; then
  pass "Lesson folders are present (lesson-01 found)."
else
  ISSUES=$((ISSUES + 1))
  fail \
    "Can't find the lesson folders inside $HERE." \
    "Expected to see lesson-01-first-snapshot/, lesson-02-the-ledger/, etc." \
    "Possible causes:" \
    "  • Lessons are in a subfolder — re-run this script from that subfolder:" \
    "    bash ~/git-dojo/git-dojo/doctor.sh" \
    "  • Wrong repo downloaded — you need the course-only repo:" \
    "    https://github.com/runtsai/git-dojo-course" \
    "    Download ZIP → extract into ~ → rename the folder to git-dojo."
fi

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 5 — playground present
# ─────────────────────────────────────────────────────────────────────────────
if [ -d "$HERE/playground" ]; then
  pass "playground/ folder is present."
else
  ISSUES=$((ISSUES + 1))
  fail \
    "The playground/ folder is missing from $HERE." \
    "Fix — create it:" \
    "  mkdir ~/git-dojo/playground"
fi

# ─────────────────────────────────────────────────────────────────────────────
# CHECK 6 — Git identity (user.name + user.email)
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
  ISSUES=$((ISSUES + 1))
  fail \
    "Git is not installed (or not on PATH)." \
    "Windows: install Git for Windows — https://git-scm.com/download/win" \
    "Mac: run 'git --version' in Terminal; macOS will offer to install it." \
    "Then close this window and reopen Git Bash before running doctor.sh again."
else
  GIT_NAME="$(git config --global user.name 2>/dev/null || true)"
  GIT_EMAIL="$(git config --global user.email 2>/dev/null || true)"
  if [ -n "$GIT_NAME" ] && [ -n "$GIT_EMAIL" ]; then
    pass "Git identity is set ($GIT_NAME <$GIT_EMAIL>)."
  else
    ISSUES=$((ISSUES + 1))
    fail \
      "Git doesn't know your name or email yet." \
      "Every commit needs this. Fix — run all three lines:" \
      '  git config --global user.name  "Your Name"' \
      '  git config --global user.email "you@yourdomain.com"' \
      '  git config --global init.defaultBranch main' \
      "(Windows Git Bash: Shift+Insert to paste)"
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # CHECK 7 — init.defaultBranch = main
  #   This environment defaults to 'master'; lessons reference 'main'.
  # ─────────────────────────────────────────────────────────────────────────
  DEFAULT_BRANCH="$(git config --global init.defaultBranch 2>/dev/null || true)"
  if [ "$DEFAULT_BRANCH" = "main" ]; then
    pass "init.defaultBranch is set to 'main'."
  else
    ISSUES=$((ISSUES + 1))
    if [ -z "$DEFAULT_BRANCH" ]; then
      fail \
        "init.defaultBranch is not set (Git will use 'master' by default)." \
        "All lessons assume 'main'. Fix:" \
        "  git config --global init.defaultBranch main"
    else
      fail \
        "init.defaultBranch is '$DEFAULT_BRANCH' — lessons expect 'main'." \
        "Fix:" \
        "  git config --global init.defaultBranch main"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo
if [ "$ISSUES" -eq 0 ]; then
  echo "All checks passed. You're good to go!"
  echo "Next: cd ~/git-dojo/lesson-01-first-snapshot && bash setup.sh"
else
  echo "$ISSUES issue(s) found — see the [FAIL] blocks above for the fix commands."
  echo "After fixing, run 'bash ~/git-dojo/doctor.sh' again to confirm."
fi
