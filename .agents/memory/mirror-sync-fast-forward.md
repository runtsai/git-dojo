---
name: Mirror sync must commit on top of remote history
description: Why the course-mirror sync builds its commit on the fetched remote branch instead of rebasing a fresh root commit
---
Rule: a "workspace is source of truth" mirror sync must fetch the remote branch, replace the tree, and commit on top of it — never rebase a freshly-built root commit onto the remote.

**Why:** a root commit has no merge base, so replaying it onto the remote turns every changed file into an add/add conflict. This broke the course-mirror sync (blocking post-merge) the moment any lesson file changed.

**How to apply:** when editing any sync-to-GitHub script, keep the fetch → checkout FETCH_HEAD → `git rm -rq .` → copy → commit-if-diff → push pattern; the push is then always a fast-forward.
