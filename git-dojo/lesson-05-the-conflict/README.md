# Lesson 5 — The conflict

**What you'll learn:** what a merge conflict actually is, why it's Git
*fail-closing* rather than failing, and how you — the human — resolve it.

Setup builds the collision for you: two branches that each changed **the same
line** of the pricing sheet to different values. One raised the delivery fee
to $80 citing fuel; the other raised it to $95 citing insurance. Both are
already committed on their own branches. Someone has to rule.

## Steps

```
bash setup.sh
cd ../playground/lesson-05
```

**1. See the two candidates.**

```
git log --oneline --all
git branch
```

You're on `main`. Two branches wait: `fuel-adjustment` and
`insurance-adjustment`.

**2. Merge the first one — clean.**

```
git merge fuel-adjustment -m "Adopt fuel-based fee adjustment"
cat pricing.txt
```

No drama. Fee now $80. `main` moved.

**3. Merge the second — and meet the conflict.**

```
git merge insurance-adjustment
```

Git **stops** and reports a conflict in `pricing.txt`. Read the message
calmly. Nothing is broken, nothing is lost. Git found two authoritative
sources disagreeing about one line and refused to guess. Sound familiar? It's
your own rule: *conflicting exact objects are a halt condition; the human
rules.* Run `git status` — it names the conflicted file and even tells you
what to do.

**4. Open the file and read the conflict markers.**

Open `pricing.txt`. You'll find:

```
<<<<<<< HEAD
Delivery fee: $80
=======
Delivery fee: $95
>>>>>>> insurance-adjustment
```

Translation: between `<<<<<<<` and `=======` is what YOUR side (main, after
the fuel merge) says. Between `=======` and `>>>>>>>` is what the incoming
branch says. Git wrote both truths into the file and handed you the pen.

**5. Rule on it.**

The owner's decision: insurance costs are real too — the fee should be **$95**.
Edit the file so that section is exactly one clean line:

```
Delivery fee: $95
```

Delete the three marker lines entirely. Save.

**6. Seal the ruling.**

```
git add pricing.txt
git commit -m "Resolve fee conflict: adopt \$95 covering fuel and insurance"
```

The merge completes. `git log --oneline` shows both branch histories AND your
resolution — the disagreement and its ruling, permanently on record.

## Grade yourself

```
cd ../../lesson-05-the-conflict
bash check.sh
```

**Keep this feeling:** the conflict looked scary and took ninety seconds. It
will never look scary again — it's the machine asking for your judgment,
which is the whole reason you're in the loop.
