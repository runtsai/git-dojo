# Lesson 9 — The standoff: resolve a real conflict

**The scenario.** You and the contractor **Ruth Osei** both edit the *same
line* of the rate card at the same time. She believes the standard crate rate
should be 195. You just got off the phone with your biggest customer: it's
200, signed. Git cannot decide who is right — that ruling is yours.

## Steps

```
bash setup.sh
cd ../playground/lesson-09/laptop
```

**1. Make your change.** Set the standard line in `rates.txt` to
`Standard crate: 200 per pallet`. You can open the file in an editor, or run
this one line, which rewrites just that line:

```
sed -i 's/^Standard crate: .*/Standard crate: 200 per pallet/' rates.txt
```

Then seal it:

```
git add rates.txt
git commit -m "Set standard crate rate to 200 per signed contract"
```

**2. Time passes.** In the dashboard's Test Center, press **Time passes** —
Ruth pushes her competing change to the same line. (Or run
`bash ../../../lesson-09-the-standoff/bot.sh`.)

**3. Push, get rejected, fetch and merge.**

```
git push
git fetch
git merge origin/main
```

(Plain `git pull` may refuse to act until you tell Git whether pulls should
merge or rebase — being explicit avoids that and shows you what pull really
does.) This time the merge stops:

```
CONFLICT (content): Merge conflict in rates.txt
```

Git has *failed closed*. Nothing is lost — both versions are preserved inside
the file, waiting for your ruling.

**4. Open `rates.txt` and read the conflict block.**

```
<<<<<<< HEAD
Standard crate: 200 per pallet
=======
Standard crate: 195 per pallet
>>>>>>> ...
```

Top is yours, bottom is Ruth's. Delete the three marker lines and keep the
line that is actually correct — the signed 200:

```
Standard crate: 200 per pallet
```

**5. Seal the ruling and publish it.**

```
git add rates.txt
git commit --no-edit
git push
```

The commit message Git offers ("Merge branch...") is fine — it is the record
of the standoff and who resolved it. `--no-edit` accepts that message without
opening a text editor; without it, Git would drop you into an editor to confirm
the message, which is easy to get stuck in.

**6. Verify.** Run the grader, or press **Run Check** in the dashboard:

```
bash ../../../lesson-09-the-standoff/check.sh
```

## What you proved

Conflicts are Git at its most honest: two humans disagreed about one line,
and the tool refused to silently pick a winner. History now shows her
proposal, your ruling, and the merge that reconciled them.
