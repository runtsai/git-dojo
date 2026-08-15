# GIT DOJO — learn Git by doing, in a sandbox that can't hurt anything

Nine hands-on lessons, 15–30 minutes each. Every lesson happens inside a
throwaway `playground/` folder that the lessons create themselves. **Nothing
here touches your real files, your real projects, or the internet** (except
Lesson 6's optional last step, clearly marked). You can destroy and rebuild the
whole playground at any time with one command.

Built for: an owner/operator who runs an exact-object records system by hand
and is about to discover Git does it automatically. The lessons use that
vocabulary on purpose.

## Setup — do this once, in order

Follow these six steps exactly. On a clean Windows machine this takes about
five minutes.

### Step 1: Install Git

- **Windows:** download **Git for Windows** from
  https://git-scm.com/download/win and run the installer with the default
  settings. It installs a terminal called **Git Bash** — that's the one you'll
  use for this whole course.
- **Mac:** open Terminal and type `git --version` — macOS will offer to
  install it.
- **No install needed:** you can also do everything in the **Replit Shell**
  or **GitHub Codespaces** — Git is already there.

> **Windows: use Git Bash, NOT PowerShell.** The course uses Unix-style
> paths (`~/git-dojo/...`) and commands (`ls`) that Git Bash understands
> natively. PowerShell will half-work and then confuse you.
>
> **Pasting in Git Bash:** Ctrl+V does not paste by default. Use
> **Shift+Insert** or **right-click** inside the terminal. (To enable
> Ctrl+Shift+V: right-click the title bar → Options → Keys → check
> "Ctrl+Shift+C/V".)

### Step 2: Verify Git is installed

```
git --version
```

If you see a version number (2.23 or newer), proceed. If "command not
found", close and reopen Git Bash, or reinstall.

### Step 3: Download and extract the dojo

- Download the zip of this repo from GitHub (green **Code** button →
  **Download ZIP**).
- Extract it to your home folder (`~`).
- If the folder is named `git-dojo-main`, rename it to `git-dojo`.

### Step 4: Verify the folder structure

```
ls ~/git-dojo
```

You should see the lesson folders (`lesson-01-first-snapshot`, etc.) and
`setup.sh`. If instead you see a single `git-dojo` folder inside (a nested
duplicate — this happens with some zip extractors), fix it with one command:

```
cd ~/git-dojo && bash git-dojo/setup.sh
```

Or run the setup script any time — it detects and flattens the nesting
automatically, and checks your Git install:

```
cd ~/git-dojo && bash setup.sh
```

(PowerShell holdouts: `setup.ps1` does the same, then tells you to switch to
Git Bash.)

### Step 5: Tell Git who you are

(Goes into every commit you seal. Without the name and email, Git refuses to
commit — you'd hit "Author identity unknown" in the middle of Lesson 1.)

```
git config --global user.name  "Your Name"
git config --global user.email "you@yourdomain.com"
git config --global init.defaultBranch main
```

That last line makes new repos start on a branch called `main` (matching
GitHub and this course). The lesson scripts work either way, but without it
Git prints a long "hint: Using 'master'..." notice every time — set it and
you'll never see that.

### Step 6: Start Lesson 1

```
cd ~/git-dojo/lesson-01-first-snapshot
bash setup.sh
```

Then follow that lesson's README.

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
