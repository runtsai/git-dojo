export interface CrisisHints {
  nudge: string;
  concept: string;
  command: string;
}

export interface CrisisMeta {
  id: string;
  number: number;
  title: string;
  tagline: string;
  briefing: string[];
  goal: string;
  hints: CrisisHints;
  debrief: string;
  breakthroughId: string;
  breakthroughTitle: string;
}

export const crises: CrisisMeta[] = [
  {
    id: "crisis-01",
    number: 1,
    title: "The Stranded Correction",
    tagline: "Detached HEAD, with real work sealed in the wrong place.",
    briefing: [
      "You went back to look at an old snapshot of the rate book — perfectly allowed. But while you were standing there, a client called and you sealed an emergency rush-rate correction on the spot.",
      "Now the dashboard says 'detached HEAD', and that correction isn't on any branch. If you just walk back to main, the commit gets left behind with no name tag pointing at it.",
    ],
    goal: "Get back onto a branch, and make sure the emergency correction is reachable from a branch — not stranded.",
    hints: {
      nudge: "The commit exists and is fine. The problem is that no branch name points at it. What sticks a name tag on where you're standing?",
      concept: "Detached HEAD means you're standing at a commit with no branch label. A branch is just a name tag — create one where you stand, and everything you sealed there is safe forever.",
      command: "git switch -c rescue   (then, if you want it on main:  git switch main  and  git merge rescue)",
    },
    debrief: "Detached HEAD was never the emergency — leaving without a name tag was. One branch created where you stood, and the 'lost' commit became ordinary, permanent history.",
    breakthroughId: "detached-head",
    breakthroughTitle: "Detached HEAD",
  },
  {
    id: "crisis-02",
    number: 2,
    title: "The Two-File Pileup",
    tagline: "A merge stopped dead across two files at once.",
    briefing: [
      "Two rulings were made in parallel: the rate-overhaul branch raised the fuel surcharge to $80 and hired T. Brandt. Meanwhile main raised the same surcharge to $65 and hired R. Chen.",
      "The merge is frozen mid-flight. Git refused to guess on either file and is waiting for your ruling. The official decision: the surcharge is $80, and both new drivers stay.",
    ],
    goal: "Resolve both files by hand — surcharge $80, both drivers kept — then complete the merge.",
    hints: {
      nudge: "Open each conflicted file in an editor. Git wrote both versions into the file, separated by marker lines. Your job is to leave only the final ruling.",
      concept: "A conflict isn't damage — it's a question, asked once per disputed region, per file. Answer every question, delete every marker, then git add each file to say 'ruled', and commit to close the case.",
      command: "edit rates.txt and drivers.txt by hand → git add rates.txt drivers.txt → git commit",
    },
    debrief: "Nothing was ever broken. Git failed closed, held both versions side by side, and waited. You made two rulings, signed them, and the record moved on.",
    breakthroughId: "conflicts-are-questions",
    breakthroughTitle: "Conflicts Are Questions",
  },
  {
    id: "crisis-03",
    number: 3,
    title: "The Public Mistake",
    tagline: "A bad commit everyone has already seen. Erasing is not an option.",
    briefing: [
      "Someone sealed a commit that deleted the entire client ledger — and it's already been shared. Other copies of this record exist. If you rewrite history here, every other copy now disagrees with yours.",
      "The rule for shared history: you don't tear out the page. You write a new page that says 'the previous page was wrong', on the record, with your name on it.",
    ],
    goal: "Restore the client ledger with a new commit that undoes the deletion — while keeping the mistake visible in history.",
    hints: {
      nudge: "You need a command that creates a NEW commit expressing the opposite of a previous commit. Not one that removes commits.",
      concept: "revert is the public correction: it computes the exact opposite of a commit and seals it on top. reset is private-only surgery — never on shared history.",
      command: "git revert HEAD",
    },
    debrief: "The ledger is back, the mistake is still on record, and every shared copy stays consistent. Revert corrects in public; reset only ever belongs in private.",
    breakthroughId: "nothing-is-lost",
    breakthroughTitle: "Nothing Is Lost",
  },
  {
    id: "crisis-04",
    number: 4,
    title: "The Jumbled Seal",
    tagline: "One commit, two unrelated changes. Pull the seal without losing the work.",
    briefing: [
      "The last commit is titled 'Update everything' — and it lives up to the name: a rate increase AND a new driver hire, sealed together in one jumbled record. Nobody has seen it yet.",
      "The auditor wants one change per sealed record. You need to pull the seal off, keep every bit of the work, and re-seal it as two clean commits.",
    ],
    goal: "Remove the 'Update everything' commit but keep its changes, then commit the rate change and the driver hire separately.",
    hints: {
      nudge: "There's a version of reset that un-commits but leaves everything staged, exactly as it was the moment before you sealed it.",
      concept: "reset --soft moves the branch label back one commit and touches nothing else — your files and staging area are untouched. Then you unstage, and stage-and-seal each change on its own.",
      command: "git reset --soft HEAD~1 → git restore --staged . → git add rates.txt → git commit -m \"...\" → git add drivers.txt → git commit -m \"...\"",
    },
    debrief: "No work was lost — only the seal moved. soft touches the label, mixed touches the staging area, hard touches your files. Know which dial you're turning.",
    breakthroughId: "nothing-is-lost",
    breakthroughTitle: "Nothing Is Lost",
  },
  {
    id: "crisis-05",
    number: 5,
    title: "The Scorched Desk",
    tagline: "The working folder is trashed. The sealed record is fine.",
    briefing: [
      "Someone — possibly a cat, possibly a late night — overwrote the rate book with '90% OFF???' and replaced the driver roster with nonsense. One of the wrecked files is even staged.",
      "None of it has been committed. The last sealed snapshot is untouched and perfect. You don't need to fix anything by hand. You need to burn the desk down to the last seal.",
    ],
    goal: "Discard every uncommitted change — staged and unstaged — so the folder exactly matches the last commit. No sealed history harmed.",
    hints: {
      nudge: "Everything you want to keep is already sealed. Everything you want gone is unsealed. There's one command that draws exactly that line.",
      concept: "reset --hard makes your folder and staging area exactly match a commit. It destroys unsealed work — which, this one time, is precisely what you want. Sealed commits are never touched.",
      command: "git reset --hard",
    },
    debrief: "This is the only genuinely destructive command in the family — and it can only destroy what was never sealed. Commit early, and the flamethrower can't reach anything that matters.",
    breakthroughId: "nothing-is-lost",
    breakthroughTitle: "Nothing Is Lost",
  },
  {
    id: "crisis-06",
    number: 6,
    title: "The Vanished Week",
    tagline: "Two commits gone from the history. Or so it appears.",
    briefing: [
      "You arrive to find the last two commits — the client ledger and the Q3 fuel surcharge adjustment — gone. The log ends two entries early, as if that week never happened. Someone ran a hard reset.",
      "Here's the secret: the commits are not gone. A hard reset only moved the branch label backwards. The sealed snapshots still exist, unlabeled, for about 90 days. Git kept a diary of every place HEAD has ever been.",
    ],
    goal: "Use the reflog to find where the branch was before the disaster, and move it back. Both commits reachable again, clean desk, on a branch.",
    hints: {
      nudge: "Git records every position HEAD has ever had — including right before the disaster. Find that diary.",
      concept: "git reflog lists every move, newest first. Find the entry from just before the reset (the one that created 'Adjust fuel surcharge for Q3'), and hard-reset the branch forward to it. Yes — the rescue uses the same command as the disaster.",
      command: "git reflog → find the hash next to the last good position → git reset --hard <that-hash>",
    },
    debrief: "The 'lost' week was sitting in the archive the whole time, label removed. Once sealed, a commit is nearly indestructible for 90 days. The reflog is the map back.",
    breakthroughId: "nothing-is-lost",
    breakthroughTitle: "Nothing Is Lost",
  },
];
