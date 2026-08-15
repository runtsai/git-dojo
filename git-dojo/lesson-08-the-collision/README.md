# Lesson 8 — The collision: your first rejected push

**The scenario.** You are no longer alone in the repository. A contractor,
**Ruth Osei**, has push access to the same shared remote. You will both change
the operations handbook at the same time — and Git will force the two of you
to reconcile before the record moves forward. This is the single most common
"scary moment" of team Git, defanged in a sandbox.

## Steps

```
bash setup.sh
cd ../playground/lesson-08/laptop
```

**1. Do your own work first.** Add a safety section to the handbook and seal it:

```
printf "\nSection 3: Safety\nNo driver dispatches without a rest log.\n" >> handbook.txt
git add handbook.txt
git commit -m "Add safety section to the handbook"
```

**2. Time passes.** Open this lesson in the dashboard's Test Center and press
**Time passes** — Ruth pushes her own commit to the shared remote while you
were typing. (No dashboard handy? Run `bash ../../../lesson-08-the-collision/bot.sh`.)

**3. Try to push.**

```
git push
```

**Rejected.** Read the message. Git is saying: *the remote has commits you
have never seen — I will not let you publish blind.*

**4. Fetch and look before you merge.** Never merge what you haven't read:

```
git fetch
git log --oneline main..origin/main
git diff main...origin/main
```

The three dots matter: `main...origin/main` shows only what Ruth added since
you two last agreed, not your own unpushed work turned inside out. You'll see
one new file, `invoicing.txt`, with her invoicing section. It doesn't touch the
lines you edited — this will merge cleanly.

**5. Merge her work into yours, then push.**

```
git merge origin/main --no-edit
git push
```

(`--no-edit` accepts Git's ready-made merge message so it does not open a text
editor. Without it, Git would drop you into an editor to confirm the message —
harmless, but easy to get stuck in.)

(`git pull` does fetch + merge in one step. Learn them separately once, so you
know what pull actually does.)

**6. Verify.** Run the grader from the lesson folder, or press
**Run Check** in the dashboard:

```
bash ../../../lesson-08-the-collision/check.sh
```

## What you proved

A rejected push is not a failure. It is the shared record refusing to lose
anyone's work. Fetch, read, merge, push — that rhythm is the whole social
contract of team Git.
