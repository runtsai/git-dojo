# Lesson 1 — First snapshot

**What you'll learn:** turning a folder into a repository, seeing what changed,
and sealing a commit — the loop you'll run thousands of times.

**Your vocabulary:** a commit is a frozen exact-object with an auto-computed
hash. `git status` is asking "what's unsealed?". `git add` is assembling the
package. `git commit` is sealing it into the record.

## Steps

Start here (from inside this lesson folder):

```
bash setup.sh
cd ../playground/lesson-01
```

**1. Make this folder a repository.**

```
git init
```

One hidden `.git` folder appeared. That's the entire records office. Delete it
and it's a normal folder again — that's how contained this is.

**2. Ask what Git sees.**

```
git status
```

It reports `notes.txt` as *untracked* — a file in the room that isn't in the
record system yet. Get used to running `git status` before and after
everything; it always tells you where you stand.

**3. Stage the file, then seal your first commit.**

```
git add notes.txt
git commit -m "Open the record: first working notes"
```

Read the output. That short code (like `a1b2c3d`) is the **hash** — the
exact-object ID of this snapshot. You didn't compute it. You never will again.

**4. Change something, and watch Git notice.**

Open `notes.txt` in any editor, add a line, save. Then:

```
git status
git diff
```

`diff` shows the exact changed lines: `-` removed, `+` added. This is the DIFF
record, generated on demand.

**5. Seal the change as a second commit.**

```
git add notes.txt
git commit -m "Add second thought to notes"
```

**6. Create a NEW file, and commit it too.**

Make `ideas.txt` with anything in it, then stage and commit it with a real
message. (No hand-holding this time — you know the loop.)

**7. Prove the ledger exists.**

```
git log --oneline
```

Three sealed records, newest first, each with its hash. You built a custody
trail without maintaining one.

## Grade yourself

```
cd ../../lesson-01-first-snapshot
bash check.sh
```

All PASS → Lesson 2. Any FAIL → it tells you what's missing; fix and re-run.
