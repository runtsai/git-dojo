---
name: Replit strips nested .git in workspace
description: Nested git repos inside /home/runner/workspace get their .git removed by Replit's checkpoint system
---

Replit's checkpoint/gitsafe system owns `/home/runner/workspace/.git` and silently deletes nested `.git` directories created inside the workspace. Any tutorial/sandbox that needs its own real git repos (e.g. the user's Git Dojo course) must run OUTSIDE the workspace, e.g. `~/git-dojo`.

**Why:** User ran `git init` in `git-dojo/playground/lesson-01`, committed successfully, then the nested `.git` vanished and git commands resolved up to the workspace repo, showing Replit checkpoint commits and "nothing to commit".

**How to apply:** The active dojo copy is at `/home/runner/git-dojo` (outside workspace, may not survive environment rebuilds — recreate by copying `workspace/git-dojo` and rerunning setup.sh). Never tell the user to practice git inside `~/workspace/git-dojo`.
