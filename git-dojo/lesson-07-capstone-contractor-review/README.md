# Lesson 7 — Capstone: the contractor delivery

**The scenario.** You own a small product repo. A contractor was hired to add
an "About" page and tune the config. Their work has arrived on a branch called
`contractor-delivery`. Your job — the real job, the one this whole dojo
trains — is to **review the diff before anything merges**.

Two things are wrong with the delivery. This README won't tell you what they
are. The diff will, if you actually read it.

## Steps

```
bash setup.sh
cd ../playground/lesson-07
```

**1. Survey what arrived.**

```
git branch
git log --oneline --all
```

You're on `main`. The `contractor-delivery` branch carries their commits.

**2. Read the full diff — the whole review in one command.**

```
git diff main contractor-delivery
```

Read every line the way you'd read a challenger's findings table: `-` is what
they removed, `+` is what they added. Go slowly. There are three files
involved. Two of the changes are good, honest work. Two lines should stop the
merge cold.

*Hints only if stuck:* one problem is a **credential that should never enter
a repository** (Lesson guide Part 5 warned you: history is forever). The
other is a **silent functional change nobody authorized** — compare what the
config said before against what it says after, and ask who approved that.

**3. Write your findings — the reviewer's record.**

Create `review.txt` on **main** with exactly two lines, in your own words but
each naming one of the two problems and the file it lives in. Example shape
(don't copy literally — name what YOU found):

```
FINDING 1: <file> — <what is wrong>
FINDING 2: <file> — <what is wrong>
```

Seal it: `git add review.txt` · `git commit -m "Review findings on contractor delivery"`

**4. Disposition: reject the bad, keep the good — surgically.**

The About page is good work; the config file is contaminated. Take only what
passed review. The cleanest beginner-safe way:

```
git restore --source=contractor-delivery -- about.txt
git add about.txt
git commit -m "Adopt contractor about page after review"
```

(`restore --source` copies one file's state from another branch — a partial
acceptance. The contaminated config never touches main.)

**5. Close out the rejected candidate — preserved, not deleted.**

Do **not** delete the branch this time. In real life the rejected work stays
on record while the contractor fixes it. Instead, mark your ruling where
future-you will find it: add one line to `review.txt`:

```
DISPOSITION: about page adopted; config change rejected pending correction
```

Commit it: `git commit -am "Record disposition on contractor delivery"`.

## Grade yourself

```
cd ../../lesson-07-capstone-contractor-review
bash check.sh
```

All PASS here means something real: **you can now receive code from anyone —
contractor, AI lane, future employee — read exactly what they did, catch what
doesn't belong, accept precisely what passed, and leave a record of the
ruling.** That is the owner's seat. It's yours now.
