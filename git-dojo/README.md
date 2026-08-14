# GIT DOJO — learn Git by doing, in a sandbox that can't hurt anything

Seven hands-on lessons, 15–30 minutes each. Every lesson happens inside a
throwaway `playground/` folder that the lessons create themselves. **Nothing
here touches your real files, your real projects, or the internet** (except
Lesson 6's optional last step, clearly marked). You can destroy and rebuild the
whole playground at any time with one command.

Built for: an owner/operator who runs an exact-object records system by hand
and is about to discover Git does it automatically. The lessons use that
vocabulary on purpose.

## What you need (once)

1. **Git installed, version 2.23 or newer** (for `git switch`). Check with: `git --version`
   - Windows: install "Git for Windows" (gitforwindows.org) and use the
     **Git Bash** terminal it gives you for these lessons.
   - Mac: `git --version` will offer to install it.
   - Or do everything in the **Replit Shell** — Git is already there.
2. **Tell Git who you are** (goes into every commit you seal):
   ```
   git config --global user.name  "Adam Cornelius"
   git config --global user.email "you@yourdomain.com"
   git config --global init.defaultBranch main
   ```
3. A terminal, opened in this `git-dojo` folder.

## How a lesson works

Each lesson folder has:

| File | What it is |
|---|---|
| `README.md` | The lesson: what you'll learn, then numbered steps to type |
| `setup.sh` | Run first (`bash setup.sh`) — builds the practice repo for that lesson |
| `check.sh` | Run when you think you're done (`bash check.sh`) — grades your work, PASS/FAIL per item |

The rhythm: `bash setup.sh` → follow the README → `bash check.sh` → all PASS →
next lesson. If a check FAILs, it tells you what's missing. Redo, re-check.
Running `setup.sh` again wipes that lesson's playground and starts it fresh —
that is always safe.

## The lessons

1. **First snapshot** — init, status, add, commit. The seal-the-record loop.
2. **The ledger** — log, diff, show. Reading history like a custody trail.
3. **Undo without erasing** — revert. Additive correction, never destruction.
4. **Branches** — draft workspaces; main stays CURRENT TRUTH.
5. **The conflict** — two drafts touch the same line; Git fails closed; you rule.
6. **Fake GitHub** — push/pull to a local "remote" that works exactly like
   GitHub, no internet, no account. Understand sync before you ever go online.
7. **Capstone: the contractor delivery** — review a branch a "contractor"
   submitted. It contains a planted bug **and a planted secret**. Find both in
   the diff, reject the bad, keep the good. This is the seat you'll occupy
   for real.
8. **The collision** — a simulated teammate (Ruth Osei, contractor) pushes to
   the shared remote while you work. Your push is rejected; fetch, read,
   merge, push. Use the dashboard's "Time passes" button (or `bash bot.sh`)
   to trigger her move.
9. **The standoff** — Ruth edits the same line you did. Pull, hit a real
   conflict, and make the ruling yourself. Same "Time passes" mechanic.

## Reset everything

```
bash reset.sh
```

Deletes `playground/` entirely. The lessons themselves are untouched. Nothing
outside this folder is ever affected.

## Publishing this later (your idea, and it's a good one)

When you finish Lesson 6 you'll know enough to make this folder itself your
first public GitHub repo — the learning material *becomes* the proof you
learned it. Before publishing: run `reset.sh` (ship lessons, not your practice
mess), read every file once as a stranger would, and make your first-ever
public commit message count. There is no better first repo than the one that
teaches the thing it's made of.

---
*Git Dojo v1.0 · built for RTS.AI owner training · sandbox-only, no production files*
