---
name: Git default branch is master here
description: Workspace git has no init.defaultBranch=main; lesson scripts must pin main explicitly.
---
The rule: any Git Dojo lesson setup script that creates repos must pin the branch name — `git init -q --bare -b main ...` for bare hubs and `git symbolic-ref HEAD refs/heads/main` in fresh clones of empty remotes — because graders and READMEs reference `main`.

**Why:** the environment's git defaults to `master`; a teammate-mission setup silently produced `master` branches and every push/grader step referencing `main` failed with "src refspec main does not match any".

**How to apply:** when authoring or copying a lesson setup.sh, never rely on the global default branch name.
Also: hub-style lessons keep the learner's working copy in `playground/lesson-NN/laptop/` beside the bare remote; the API's repo-state resolver checks `laptop/` when the playground root is not itself a repo.
