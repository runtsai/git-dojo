# Lesson 3 — Undo without erasing

**What you'll learn:** `revert` — the additive correction. A bad commit is
never deleted; a new commit is sealed that undoes it, and both stay in the
ledger forever. This is your own correction rule, enforced.

Setup gives you a repo where the last commit is a **known mistake**: someone
"corrected" the safety manual by deleting the lockout step.

## Steps

```
bash setup.sh
cd ../playground/lesson-03
```

**1. See the damage.**

```
git log --oneline
git show HEAD
```

`HEAD` means "the newest commit." The show output proves it: the line
`3. Lock out power before service` was removed. That's a real defect.

**2. Look at history — do NOT delete anything.**

The wrong instinct from the file-folder world is "delete the bad version."
In Git, history is append-only, like your records. The fix is forward:

```
git revert HEAD --no-edit
```

Read what happened: Git created a **new** commit that re-adds the deleted
line. (`--no-edit` just accepts the auto-written message.)

**3. Verify both truths coexist.**

```
git log --oneline
grep "Lock out" manual.txt
```

The ledger now shows: the original, the bad edit, and the correction — all
three, permanent. The file is correct again. Nobody can later ask "was the
lockout step ever removed?" and get a shrug — the record answers.

**4. One more, from deeper history.**

There's an earlier commit whose message admits it: it added a `TODO delete
this` line to `notes.txt`. It is NOT the newest commit — reverting it means
reverting *by hash*:

```
git log --oneline            # find the hash of "Add a temporary note (mistake)"
git revert <that-hash> --no-edit
```

Git applies the undo even though other commits came after it. Check
`notes.txt` — the temp line is gone, history intact.

## Grade yourself

```
cd ../../lesson-03-undo-without-erasing
bash check.sh
```

**What you just internalized:** in Git, like in your governance, corrections
are new records that reference what they correct. The verb "delete" barely
exists — and you'll stop missing it.
