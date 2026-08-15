# Lesson 6 — Fake GitHub (push and pull, no internet)

**What you'll learn:** what a "remote" really is, and the push/pull sync loop —
by building a working GitHub-equivalent **on your own disk**. When you touch
real GitHub afterward, nothing will be new except the URL.

The secret nobody tells beginners: GitHub is, at its core, just a Git
repository sitting on someone else's computer. You can make one on yours. A
"bare" repo is a repo with no working files — records vault only — which is
exactly what a hosting server is.

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
`https://github.com/...` URL. That is the *entire* difference.

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
**A clone is a byte-exact custody readback.** Verify it yourself:

```
git rev-parse HEAD
cd ../laptop && git rev-parse HEAD
```

Same hash, both machines. That is proof-grade replication, and you did it
with two commands.

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

Your practice history appears on the real site. Same verbs, same behavior —
you already knew how; you just proved it.

## Grade yourself

```
cd ../../../lesson-06-fake-github     # (from laptop/)
bash check.sh
```
