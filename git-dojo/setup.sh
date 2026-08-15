#!/usr/bin/env bash
# Git Dojo one-time setup check.
# Safe to run any number of times. Fixes the nested-folder problem from zip
# extraction and verifies Git is installed. Touches nothing outside the
# git-dojo folder tree.

set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

echo "== Git Dojo setup check =="
echo

flatten_into() {
  # flatten_into <inner_dir> <outer_dir>: move everything (incl. dotfiles)
  # from inner to outer without overwriting, then remove inner if empty.
  local inner="$1" outer="$2"
  find "$inner" -mindepth 1 -maxdepth 1 -exec mv -n {} "$outer"/ \;
  if rmdir "$inner" 2>/dev/null; then
    return 0
  else
    echo "Moved what was safe to move; a few items were left in '$inner'"
    echo "because files with the same name already exist in '$outer'."
    echo "Compare and clean up by hand."
    return 1
  fi
}

FLATTENED=""

# --- 1a. This script itself may be inside the nested duplicate ---------------
# Layout: ~/git-dojo/git-dojo/setup.sh (outer folder holds only the inner repo)
PARENT="$(dirname "$HERE")"
BASE="$(basename "$HERE")"
PARENT_BASE="$(basename "$PARENT")"
case "$BASE" in
  git-dojo|git-dojo-main)
    if [ "$PARENT_BASE" = "git-dojo" ] || [ "$PARENT_BASE" = "git-dojo-main" ]; then
      if [ ! -e "$PARENT/reset.sh" ]; then
        echo "This copy of the dojo is nested inside an extra '$PARENT_BASE' folder"
        echo "(a zip-extraction artifact). Flattening it now..."
        if flatten_into "$HERE" "$PARENT"; then
          echo "Fixed. Lessons now live directly in: $PARENT"
        fi
        cd "$PARENT"
        HERE="$PARENT"
        FLATTENED="yes"
        echo
      fi
    fi
    ;;
esac

# --- 1b. Or the nested duplicate may be a child of this folder ---------------
if [ -z "$FLATTENED" ]; then
  for candidate in git-dojo git-dojo-main; do
    if [ -d "$candidate" ] && [ -e "$candidate/reset.sh" ] && [ ! -e "reset.sh" ]; then
      echo "Found a nested '$candidate' folder (this happens with some zip extractors)."
      echo "Flattening it now..."
      if flatten_into "$HERE/$candidate" "$HERE"; then
        echo "Fixed. Lessons now live directly in: $HERE"
      fi
      echo
      break
    fi
  done
fi

# --- 2. Verify the structure --------------------------------------------------
if [ -e "lesson-01-first-snapshot/setup.sh" ]; then
  echo "[PASS] Folder structure looks right (lesson-01 found)."
else
  echo "[FAIL] Can't find the lesson folders. Run 'ls' here — if you see a"
  echo "       single folder containing the lessons, move its contents up one"
  echo "       level, or re-extract the zip directly into your home folder."
fi

# --- 3. Verify Git is installed and new enough --------------------------------
if command -v git >/dev/null 2>&1; then
  GIT_VERSION="$(git --version | sed 's/^git version //')"
  MAJOR="$(echo "$GIT_VERSION" | cut -d. -f1)"
  MINOR="$(echo "$GIT_VERSION" | cut -d. -f2)"
  if [ "${MAJOR:-0}" -gt 2 ] 2>/dev/null || { [ "${MAJOR:-0}" -eq 2 ] && [ "${MINOR:-0}" -ge 23 ]; } 2>/dev/null; then
    echo "[PASS] Git is installed (version $GIT_VERSION)."
  else
    echo "[FAIL] Git $GIT_VERSION is too old — this course needs 2.23 or newer"
    echo "       (for 'git switch'). Please update Git."
  fi
else
  echo "[FAIL] Git is not installed (or this terminal can't see it)."
  echo "       Windows: install Git for Windows from https://git-scm.com/download/win"
  echo "       then close this window and open Git Bash."
  exit 1
fi

# --- 4. Check identity config (needed before your first commit) ---------------
NAME="$(git config --global user.name 2>/dev/null || true)"
EMAIL="$(git config --global user.email 2>/dev/null || true)"
if [ -n "$NAME" ] && [ -n "$EMAIL" ]; then
  echo "[PASS] Git knows who you are ($NAME <$EMAIL>)."
else
  echo "[TODO] Tell Git who you are (goes into every commit you seal):"
  echo '       git config --global user.name  "Your Name"'
  echo '       git config --global user.email "you@yourdomain.com"'
  echo '       git config --global init.defaultBranch main'
fi

echo
echo "Next: cd lesson-01-first-snapshot && bash setup.sh"
