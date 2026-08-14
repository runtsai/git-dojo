# Lesson 2 — The ledger

**What you'll learn:** reading history. `log` is the custody trail, `show` is
pulling one sealed record, `diff` compares any two points in time.

Setup builds you a repo **with history already in it** — five commits made by
someone else. Your job is pure records work: answer questions from the ledger.

## Steps

```
bash setup.sh
cd ../playground/lesson-02
```

**1. Read the ledger, compact form.**

```
git log --oneline
```

Five entries. Newest at top. Each line: short hash + message.

**2. Read it with full detail.**

```
git log
```

Author, date, full message per commit. (Press `q` to quit the pager if it
captures your screen — that's normal.)

**3. Pull one exact record.**

Pick the commit whose message mentions **pricing**. Copy its short hash, then:

```
git show <that-hash>
```

You get the full record: who, when, why, and the exact line changes. This is
byte-level custody on demand.

**4. Diff across time.**

Compare the oldest commit to the newest — what changed over the whole history?

```
git log --oneline        # note the BOTTOM hash (oldest) and TOP hash (newest)
git diff <oldest> <newest>
```

**5. Answer the audit question — write it in the record.**

One of the five commits changed the delivery fee in `pricing.txt`. Find which
commit did it (hint: `git log --oneline -- pricing.txt` shows only commits
touching that file, or use `git log -p pricing.txt` to see each change).

Create a file called `audit.txt` containing exactly one line in this form
(use the real short hash you found):

```
The delivery fee was changed in commit <shorthash>
```

Then seal it: `git add audit.txt` and commit with the message
`Audit: identify the delivery fee change`.

## Grade yourself

```
cd ../../lesson-02-the-ledger
bash check.sh
```
