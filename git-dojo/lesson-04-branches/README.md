# Lesson 4 — Branches

**What you'll learn:** working on a draft without touching the trunk. `main`
is CURRENT TRUTH: YES. A branch is a CANDIDATE — it becomes truth only when
merged, and costs nothing to throw away.

Setup gives you a tiny company website (one HTML file) on `main`.

## Steps

```
bash setup.sh
cd ../playground/lesson-04
```

**1. Confirm where you're standing.**

```
git branch
```

One branch, `main`, with a `*` on it — that's you. Everything you commit lands
where the `*` is.

**2. Open a draft workspace.**

```
git switch -c new-tagline
```

`-c` = create and move there in one step. Run `git branch` again: two labels
now, `*` on yours. `main` is frozen in place behind you.

**3. Make the draft change.**

Open `index.html`, change the tagline line from
`We haul it right.` to `Clean records. Moved right.` — save, then:

```
git add index.html
git commit -m "Propose new tagline"
```

**4. Prove main never felt it.**

```
git switch main
grep tagline index.html
```

The file on `main` still says the OLD tagline. When Git can switch safely, it
updates the tracked files in your working folder to match the branch you chose.
The branches share earlier history, but their tips can carry different work.
Go back: `git switch new-tagline` — the new tagline returns.

**5. Make a second, throwaway draft — then kill it.**

```
git switch main
git switch -c bad-idea
```

Edit `index.html`: change the company name to something ridiculous. Save, then
seal it the same way you always do:

```
git add index.html
git commit -m "Rename company (bad idea)"
```

Then reject the whole candidate:

```
git switch main
git branch -D bad-idea
```

The `bad-idea` branch label is gone — and `main` never contained its commit.
The commit may still be recoverable through the reflog until Git eventually
prunes it. **This is why branches make you brave:** experiments stay separate
from the trunk unless you choose to merge them.

**6. Merge the good draft — the owner-approval act.**

```
git switch main
git merge --no-ff new-tagline -m "Approve and adopt new tagline"
```

When Git could otherwise fast-forward by sliding the branch label ahead,
`--no-ff` forces a real merge commit — so your approval is a permanent, dated
record with your message on it, not a silent shortcut. `main` now carries the
tagline commit. The candidate became truth by explicit decision — yours.

## Grade yourself

```
cd ../../lesson-04-branches
bash check.sh
```
