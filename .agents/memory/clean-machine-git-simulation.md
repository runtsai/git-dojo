---
name: Simulating a clean machine for git in this Replit env
description: HOME override alone does not isolate git config here; what to unset for true clean-machine tests
---

Overriding `HOME` is NOT enough to simulate a fresh learner machine for git in
this environment. Replit also sets `GIT_CONFIG_GLOBAL` and `XDG_CONFIG_HOME`,
which override `$HOME/.gitconfig` and preset `init.defaultBranch=main` plus a
real identity — so tests silently inherit the workspace config.

**Why:** A course audit looked "clean pass" until the hidden config was
neutralized; the real Windows default (`master`, no identity) then broke
lessons 4-7.

**How to apply:** For any clean-machine git test, run commands with
`env -u GIT_CONFIG_GLOBAL -u XDG_CONFIG_HOME HOME=/tmp/fakehome bash -c '...'`
and test BOTH worlds: with and without `init.defaultBranch main`. Course
lesson scripts must never depend on the learner's default branch — pin with
`git symbolic-ref HEAD refs/heads/main` after `git init` (works on git 2.23+,
unlike `git init -b` which needs 2.28).
