# Lesson 6 — Fake GitHub (push and pull, no internet)

**What you'll learn:** what a Git "remote" really is, and the push/pull sync
loop — by building the Git repository part of a hosting service **on your own
disk**. When you touch real GitHub afterward, the transport commands will
already be familiar.

GitHub is a hosting platform backed by Git repositories. It adds authentication,
pull requests, Actions, permissions, and other collaboration tools. You can
reproduce the repository part on your own computer: a "bare" repo has no
working files — records vault only — and is the kind of repo a hosting server
stores.

Setup creates: `hub/website.git` (the fake GitHub) and `laptop/` (your
machine's copy, already connected to it).

## Steps

```
bash setup.sh
cd ../playground/lesson-06/laptop
```

**1. Inspect the connection.**

```
git remote -v
```

`origin` → a path ending in `hub/website.git`. `origin` is just the
conventional name for "the shared copy." On real GitHub this would be an
`https://github.com/...` URL. The Git transport works the same way, while
GitHub adds authentication and collaboration rules around it.

**2. Make a change and push it up.**

Edit `site.txt` (add a line), then:

```
git add site.txt
git commit -m "Add services line to site"
git push
```

Your commit now exists in TWO places: your laptop repo and the hub. That's
the offsite custody copy, made in one word.

**3. Simulate the contractor.** A second person clones the hub:

```
cd ..
git clone hub/website.git contractor
cd contractor
git config user.name  "Sam Okafor"
git config user.email "sam@contractor.example"
git log --oneline
```

The two `config` lines make this clone a genuinely different person — the
contractor, Sam Okafor — so the commit Sam makes next carries Sam's name, not
yours. Read that log — the contractor received your full history, hashes
identical.
**A matching commit hash proves both repos have the same commit.** Verify it
yourself:

```
git rev-parse HEAD
cd ../laptop && git rev-parse HEAD
```

Same hash, both machines. Their `HEAD` points to the same snapshot and history.
That does not mean every ref, config setting, hook, or uncommitted working-tree
file is identical.

**4. The contractor ships work; you receive it.**

```
cd ../contractor
```

Edit `site.txt` (add a "Contact us" line), commit with a real message, and
`git push`. Then walk back to your laptop and pull it down:

```
cd ../laptop
git pull
git log --oneline
```

Their commit is now on your machine — author name and all. You just ran the
entire owner⇄contractor sync loop that every software team on earth uses.

**5. (Optional, when ready — the only online step in the dojo)**
Create a free private repo on github.com, then from `laptop/`:

```
git remote add github <the-URL-github-shows-you>
git push github main
```

Your practice history appears on the real site. The transport verbs are the
same, but GitHub may enforce permissions and branch-protection rules. You
already know the core push workflow.

## Grade yourself

```
cd ../../../lesson-06-fake-github     # (from laptop/)
bash check.sh
```
