/**
 * The warm-up drill bank. Two formats:
 *
 * - `concept`: tap-to-answer recall cards drawn from module and
 *   breakthrough content.
 * - `command`: "type the command that does X", checked with tolerant
 *   matching (whitespace, optional `$`, placeholder arguments).
 *
 * Each item is unlocked by content the learner has already completed
 * (module ids like "1.1", lesson ids like "lesson-01", crisis ids like
 * "crisis-01"). Items tied to a graded lesson/crisis also carry that id
 * as `sourceId`, so the server can boost priority when the learner's
 * grader history shows friction there.
 */

export interface ConceptDrill {
  id: string;
  type: "concept";
  prompt: string;
  options: string[];
  answerIndex: number;
  explain: string;
  sourceLabel: string;
  sourceId?: string;
  /**
   * The breakthrough id this drill reinforces (e.g. "two-machines").
   * Set on bt-* drills so the coverage check can verify every breakthrough
   * has at least one warm-up question.
   */
  breakthroughId?: string;
  unlockedBy: string[];
}

export interface CommandDrill {
  id: string;
  type: "command";
  prompt: string;
  /**
   * Accepted answers. `<word>` is a placeholder matching any single
   * argument (e.g. a branch name or hash). The first entry is shown as
   * the canonical answer after the attempt.
   */
  answers: string[];
  explain: string;
  sourceLabel: string;
  sourceId?: string;
  /**
   * The breakthrough id this drill reinforces (e.g. "two-machines").
   * Set on bt-* drills so the coverage check can verify every breakthrough
   * has at least one warm-up question.
   */
  breakthroughId?: string;
  unlockedBy: string[];
}

export type DrillItem = ConceptDrill | CommandDrill;

/** Normalizes learner input for tolerant command matching. */
export function normalizeCommand(input: string): string {
  return input
    .trim()
    .replace(/^\$\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/^git\s+/, "git ")
    .toLowerCase();
}

/** Checks a typed command against an accepted pattern (with `<placeholders>`). */
export function commandMatches(input: string, pattern: string): boolean {
  const norm = normalizeCommand(input);
  const regex = new RegExp(
    "^" +
      pattern
        .toLowerCase()
        .split(/\s+/)
        .map((token) =>
          token.startsWith("<") && token.endsWith(">")
            ? "\\S+"
            : token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("\\s+") +
      "$",
  );
  return regex.test(norm);
}

export function checkCommandAnswer(input: string, item: CommandDrill): boolean {
  return item.answers.some((a) => commandMatches(input, a));
}

export const drillBank: DrillItem[] = [
  // ── Tier 1 — The Ground Truth ────────────────────────────────────────
  {
    id: "t1-git-vs-github",
    type: "concept",
    prompt: "What is the difference between Git and GitHub?",
    options: [
      "They are two names for the same product",
      "Git tracks history on your machine; GitHub hosts a shared copy online",
      "GitHub tracks history; Git is the website that displays it",
      "Git is the paid version of GitHub",
    ],
    answerIndex: 1,
    explain:
      "Git is the local record-keeper on your machine. GitHub is a website that hosts a copy of that record so people can share and review it.",
    sourceLabel: "Module 1.1 — What GitHub actually is",
    unlockedBy: ["1.1"],
  },
  {
    id: "t1-commit-history-answers",
    type: "concept",
    prompt: "The commit history of a repository tells you…",
    options: [
      "Only the current contents of each file",
      "Who changed what, and when — a custody trail",
      "Which files are largest",
      "Who is allowed to push",
    ],
    answerIndex: 1,
    explain:
      "Every commit records author, time, and the exact change. That custody trail is why the history is the ground truth.",
    sourceLabel: "Module 1.1 — What GitHub actually is",
    unlockedBy: ["1.1"],
  },
  {
    id: "t1-repo-front-door",
    type: "concept",
    prompt: "You open an unfamiliar repository. What should you orient on first?",
    options: [
      "The Settings tab",
      "The newest issue",
      "Name, description, README and the file tree — the repo's front door",
      "The list of forks",
    ],
    answerIndex: 2,
    explain:
      "The repository home screen puts context next to content: name, description, README, files, commit count. Orient before acting.",
    sourceLabel: "Module 1.2 — The repository home screen",
    unlockedBy: ["1.2"],
  },
  {
    id: "t1-diff-reads",
    type: "concept",
    prompt: "In a commit's diff, what do the removed and added lines show?",
    options: [
      "The whole file before and after",
      "Exactly which lines changed: old lines out, new lines in",
      "A summary written by the author",
      "Only the files that were renamed",
    ],
    answerIndex: 1,
    explain:
      "A diff is the computed comparison between two snapshots: removed lines from the old version, added lines from the new one.",
    sourceLabel: "Module 1.3 — Reading history visually",
    unlockedBy: ["1.3"],
  },
  {
    id: "t1-danger-zone",
    type: "concept",
    prompt: "Why does GitHub isolate repository deletion in a red \u201cDanger Zone\u201d?",
    options: [
      "It is a legacy design quirk",
      "Deletion is genuinely destructive and cannot be undone from the website",
      "Red attracts attention to premium features",
      "Deletion requires a paid plan",
    ],
    answerIndex: 1,
    explain:
      "Almost everything in Git can be undone — repository deletion is one of the few truly destructive acts, so it is fenced off.",
    sourceLabel: "Module 1.4 — Repo settings basics",
    unlockedBy: ["1.4"],
  },
  {
    id: "t1-global-nav",
    type: "concept",
    prompt: "Where do review requests and mentions from teammates arrive on GitHub?",
    options: [
      "In the repository README",
      "In your notifications inbox in the global nav",
      "In the Danger Zone",
      "They only arrive by email",
    ],
    answerIndex: 1,
    explain:
      "The global top bar is your hub: search finds repositories, and the inbox collects the collaboration you owe attention to.",
    sourceLabel: "Module 1.5 — The global nav",
    unlockedBy: ["1.5"],
  },

  // ── Tier 2 — Reviewing a Contractor's Work ──────────────────────────
  {
    id: "t2-pr-is-proposal",
    type: "concept",
    prompt: "What is a pull request?",
    options: [
      "A command that downloads changes to your machine",
      "A proposal: changes wait in a holding area until someone merges them",
      "An automatic merge performed by GitHub",
      "A backup of the main branch",
    ],
    answerIndex: 1,
    explain:
      "Nothing merges automatically. A PR is a controlled gate and paper trail between a branch and its base.",
    sourceLabel: "Module 2.1 — What a pull request really is",
    unlockedBy: ["2.1"],
  },
  {
    id: "t2-files-changed",
    type: "concept",
    prompt: "Before approving a PR, where is the source of truth about what it does?",
    options: [
      "The PR title and description",
      "The author's reputation",
      "The Files changed tab — every added and removed line",
      "The number of commits",
    ],
    answerIndex: 2,
    explain:
      "Descriptions can say anything. The Files changed tab shows what will actually enter the history. Trust, but read every line.",
    sourceLabel: "Module 2.2 — Files changed: read every line",
    unlockedBy: ["2.2"],
  },
  {
    id: "t2-verdict",
    type: "concept",
    prompt: "A PR adds a hardcoded password to a config file. Your review verdict?",
    options: [
      "Comment — mention it politely",
      "Approve — it can be fixed later",
      "Request changes — it blocks the merge until fixed",
      "Close the PR without explanation",
    ],
    answerIndex: 2,
    explain:
      "Secrets and unsafe changes are exactly what Request changes is for: it formally blocks the merge until the problem is fixed.",
    sourceLabel: "Module 2.3 — The verdict: approve or block",
    unlockedBy: ["2.3"],
  },
  {
    id: "t2-close-the-loop",
    type: "concept",
    prompt:
      "Ruth fixed both blockers you raised in your review. What should you do next?",
    options: [
      "Leave the PR open — she'll follow up when she's ready",
      "Approve and leave a short note confirming the fixes look good",
      "Request changes again to be thorough",
      "Merge without reviewing — you already checked once",
    ],
    answerIndex: 1,
    explain:
      "Once all blockers are resolved, a brief approval closes the loop: it unblocks the merge and lets the author know their work is done. Staying silent or re-requesting changes leaves the PR in limbo.",
    sourceLabel: "Module 2.4 — Ruth's fix: close the loop",
    unlockedBy: ["2.4"],
  },

  {
    id: "m2-4-close-loop",
    type: "concept",
    prompt:
      "You requested changes on a PR. Ruth pushes a fix. What should you do next?",
    options: [
      "Merge the PR immediately — the fix is probably fine",
      "Re-open your review and check whether your original concern is resolved",
      "Close the PR and ask Ruth to open a new one",
      "Leave a comment but take no further action",
    ],
    answerIndex: 1,
    explain:
      "Requesting changes puts the ball back in the author's court. Once they push a fix, you return to the PR, verify the concern is addressed, and approve or request further changes.",
    sourceLabel: "Module 2.4 — Ruth's fix: close the loop",
    unlockedBy: ["2.4"],
  },

  // ── Breakthroughs ────────────────────────────────────────────────────
  {
    id: "bt-two-machines",
    type: "concept",
    prompt: "Do you need an internet connection to make a Git commit?",
    options: [
      "Yes — commits are saved to GitHub",
      "No — Git records history locally; GitHub only holds a hosted copy",
      "Only for the first commit",
      "Only on private repositories",
    ],
    answerIndex: 1,
    explain:
      "Two machines: your Git works entirely on your machine. Syncing with GitHub is a separate, optional step.",
    sourceLabel: "Breakthrough — Two Machines",
    breakthroughId: "two-machines",
    unlockedBy: ["1.1", "lesson-01"],
  },
  {
    id: "bt-snapshots",
    type: "concept",
    prompt: "What does a commit actually store?",
    options: [
      "Just the lines you changed",
      "A full snapshot of the project at that moment",
      "A compressed copy of the previous commit",
      "Only the files you opened",
    ],
    answerIndex: 1,
    explain:
      "Snapshots, not diffs: each commit is a complete photograph of the project. Diffs are computed views between snapshots.",
    sourceLabel: "Breakthrough — Snapshots, Not Diffs",
    breakthroughId: "snapshots-not-diffs",
    unlockedBy: ["1.3", "lesson-02"],
  },
  {
    id: "bt-branch-sticker",
    type: "concept",
    prompt: "What is a branch, physically?",
    options: [
      "A full copy of the project folder",
      "A tiny movable label pointing at one commit",
      "A separate repository",
      "A zip archive of your changes",
    ],
    answerIndex: 1,
    explain:
      "Branches are stickers: a branch is just a name pointing at a snapshot. That's why creating one is instant and free.",
    sourceLabel: "Breakthrough — Branches Are Stickers",
    breakthroughId: "branches-are-stickers",
    unlockedBy: ["lesson-04"],
  },
  {
    id: "bt-loading-dock",
    type: "concept",
    prompt: "What is the staging area for?",
    options: [
      "A backup in case you lose your work",
      "Composing exactly what goes into the next commit, even from a messy desk",
      "Uploading files to GitHub",
      "Temporarily hiding files from Git",
    ],
    answerIndex: 1,
    explain:
      "The loading dock: `git add` chooses precisely which changes ship in the next commit — the rest stays on your desk.",
    sourceLabel: "Breakthrough — The Loading Dock",
    breakthroughId: "loading-dock",
    unlockedBy: ["lesson-01"],
  },
  {
    id: "bt-fetch-vs-pull",
    type: "concept",
    prompt: "What's the difference between git fetch and git pull?",
    options: [
      "They are identical",
      "Fetch downloads and looks without touching your work; pull also merges into it",
      "Pull is fetch for private repositories",
      "Fetch uploads, pull downloads",
    ],
    answerIndex: 1,
    explain:
      "Fetch is looking — always safe. Pull is fetch plus merge, which changes your working copy.",
    sourceLabel: "Breakthrough — Fetch Is Looking",
    breakthroughId: "fetch-is-looking",
    unlockedBy: ["lesson-06", "lesson-08", "lesson-09"],
  },
  {
    id: "bt-merge-reveals",
    type: "concept",
    prompt: "What does a merge actually do with the commits on two branches?",
    options: [
      "Rewrites them into new commits",
      "Deletes the branch's commits after copying their content",
      "Connects timelines — the commits already exist; merge joins them",
      "Uploads them to GitHub",
    ],
    answerIndex: 2,
    explain:
      "Merge reveals: the work was already committed. Merging connects the two lines of history so both are visible from one place.",
    sourceLabel: "Breakthrough — Merge Reveals",
    breakthroughId: "merge-reveals",
    unlockedBy: ["lesson-04"],
  },
  {
    id: "bt-detached-head",
    type: "concept",
    prompt: "You check out an old commit and see \u201cdetached HEAD\u201d. What does it mean?",
    options: [
      "Your repository is corrupted",
      "You're standing on an old snapshot instead of a branch — looking is allowed",
      "Your latest commits were deleted",
      "You must re-clone the repository",
    ],
    answerIndex: 1,
    explain:
      "HEAD is simply where you are standing. Visiting an old snapshot is legal; just put new work on a branch before leaving.",
    sourceLabel: "Breakthrough — Detached HEAD",
    breakthroughId: "detached-head",
    unlockedBy: ["crisis-01"],
  },
  {
    id: "bt-conflicts",
    type: "concept",
    prompt: "What is a merge conflict, really?",
    options: [
      "Git breaking under pressure",
      "Two teammates being locked out of the repository",
      "Git refusing to guess between two versions and asking you to decide",
      "A corrupted commit",
    ],
    answerIndex: 2,
    explain:
      "Conflicts are questions. Git shows both versions of each disputed region and waits for a human decision — nothing is broken.",
    sourceLabel: "Breakthrough — Conflicts Are Questions",
    breakthroughId: "conflicts-are-questions",
    unlockedBy: ["lesson-05", "crisis-02"],
  },
  {
    id: "bt-nothing-lost",
    type: "concept",
    prompt: "You ran a bad reset and your commits \u201cvanished\u201d. Are they gone?",
    options: [
      "Yes — reset destroys commits immediately",
      "Almost never: sealed commits survive ~90 days and reflog can find them",
      "Only if you had pushed them",
      "Only GitHub support can recover them",
    ],
    answerIndex: 1,
    explain:
      "Nothing is lost: most \u201cdisasters\u201d are moved labels. `git reflog` remembers where you've been so you can point a label back.",
    sourceLabel: "Breakthrough — Nothing Is Lost",
    breakthroughId: "nothing-is-lost",
    unlockedBy: ["crisis-06", "lesson-03"],
  },
  {
    id: "bt-three-merges",
    type: "concept",
    prompt: "Which merge strategy collapses a PR into one tidy commit on main?",
    options: [
      "Merge commit",
      "Squash and merge",
      "Rebase and merge",
      "Fast-forward fetch",
    ],
    answerIndex: 1,
    explain:
      "Merge commit keeps the true shape, squash collapses to a single commit, rebase replays commits into a straight line.",
    sourceLabel: "Breakthrough — Three Ways to Merge",
    breakthroughId: "three-ways-to-merge",
    unlockedBy: ["2.1", "lesson-07"],
  },
  {
    id: "bt-secrets",
    type: "concept",
    prompt: "You committed an API key, then deleted it in a later commit. Are you safe?",
    options: [
      "Yes — the file no longer contains the key",
      "No — the old snapshot still holds it; revoke the credential",
      "Yes, if the repository is private",
      "Only if the commit was squashed",
    ],
    answerIndex: 1,
    explain:
      "Secrets never heal: history keeps every snapshot, so deleting later doesn't erase the leak. Kill the credential itself.",
    sourceLabel: "Breakthrough — Secrets Never Heal",
    breakthroughId: "secrets-never-heal",
    unlockedBy: ["1.4", "2.2"],
  },
  {
    id: "bt-robot-coworker",
    type: "concept",
    prompt: "What are the automated \u201cchecks\u201d that run on every pull request?",
    options: [
      "GitHub scanning for viruses",
      "CI — an automated quality gate that can block the merge",
      "A spell-checker for commit messages",
      "A backup process",
    ],
    answerIndex: 1,
    explain:
      "The robot coworker: CI runs the project's own tests on each PR and reports pass/fail before a human merges.",
    sourceLabel: "Breakthrough — The Robot Coworker",
    breakthroughId: "the-robot-coworker",
    unlockedBy: ["2.1", "lesson-07"],
  },

  // ── Test Center command recall ──────────────────────────────────────
  {
    id: "cmd-init",
    type: "command",
    prompt: "Start tracking history in the current folder (create a new repository).",
    answers: ["git init"],
    explain: "git init creates the hidden .git folder where all history lives.",
    sourceLabel: "Lesson 01 — First Snapshot",
    sourceId: "lesson-01",
    unlockedBy: ["lesson-01"],
  },
  {
    id: "cmd-status",
    type: "command",
    prompt: "See which files are changed, staged, or untracked right now.",
    answers: ["git status"],
    explain: "git status is the safest command in Git — run it whenever unsure.",
    sourceLabel: "Lesson 01 — First Snapshot",
    sourceId: "lesson-01",
    unlockedBy: ["lesson-01"],
  },
  {
    id: "cmd-add",
    type: "command",
    prompt: "Put the file notes.txt on the loading dock for the next commit.",
    answers: ["git add notes.txt", "git add <file>"],
    explain: "git add stages exactly the changes you choose to seal next.",
    sourceLabel: "Lesson 01 — First Snapshot",
    sourceId: "lesson-01",
    unlockedBy: ["lesson-01"],
  },
  {
    id: "cmd-commit",
    type: "command",
    prompt: "Seal the staged changes into history with the message \u201cadd rates\u201d.",
    answers: ['git commit -m "add rates"', "git commit -m 'add rates'", "git commit -m <message>"],
    explain: "git commit -m seals a snapshot with a message explaining why.",
    sourceLabel: "Lesson 01 — First Snapshot",
    sourceId: "lesson-01",
    unlockedBy: ["lesson-01"],
  },
  {
    id: "cmd-log",
    type: "command",
    prompt: "Read the ledger: list the commits in this repository.",
    answers: ["git log", "git log --oneline"],
    explain: "git log walks the custody trail; --oneline gives the compact view.",
    sourceLabel: "Lesson 02 — The Ledger",
    sourceId: "lesson-02",
    unlockedBy: ["lesson-02"],
  },
  {
    id: "cmd-diff",
    type: "command",
    prompt: "See exactly what you've changed but not yet staged.",
    answers: ["git diff"],
    explain: "git diff compares your desk against the last sealed snapshot.",
    sourceLabel: "Lesson 02 — The Ledger",
    sourceId: "lesson-02",
    unlockedBy: ["lesson-02"],
  },
  {
    id: "cmd-restore",
    type: "command",
    prompt: "Throw away your uncommitted edits to rates.txt and get the committed version back.",
    answers: ["git restore rates.txt", "git restore <file>", "git checkout -- rates.txt"],
    explain: "git restore <file> rewinds one file on your desk to the last commit.",
    sourceLabel: "Lesson 03 — Undo Without Erasing",
    sourceId: "lesson-03",
    unlockedBy: ["lesson-03"],
  },
  {
    id: "cmd-revert",
    type: "command",
    prompt: "Undo the most recent commit publicly, keeping history intact.",
    answers: ["git revert HEAD", "git revert head"],
    explain:
      "git revert adds a new commit that reverses the old one — the honest undo for shared history.",
    sourceLabel: "Lesson 03 — Undo Without Erasing",
    sourceId: "lesson-03",
    unlockedBy: ["lesson-03"],
  },
  {
    id: "cmd-switch-c",
    type: "command",
    prompt: "Create a new branch called experiment and move onto it in one step.",
    answers: ["git switch -c experiment", "git switch -c <branch>", "git checkout -b experiment"],
    explain: "git switch -c makes the sticker and moves you onto it at once.",
    sourceLabel: "Lesson 04 — Branches",
    sourceId: "lesson-04",
    unlockedBy: ["lesson-04"],
  },
  {
    id: "cmd-merge",
    type: "command",
    prompt: "You're on main. Bring the commits from the experiment branch into it.",
    answers: ["git merge experiment", "git merge <branch>"],
    explain: "git merge connects the branch's timeline into the one you're standing on.",
    sourceLabel: "Lesson 04 — Branches",
    sourceId: "lesson-04",
    unlockedBy: ["lesson-04"],
  },
  {
    id: "cmd-conflict-finish",
    type: "command",
    prompt: "You've edited a conflicted file and removed the markers. What's the next command?",
    answers: ["git add rates.txt", "git add <file>", "git add ."],
    explain:
      "Staging the resolved file tells Git your answer to its question; then commit seals the merge.",
    sourceLabel: "Lesson 05 — The Conflict",
    sourceId: "lesson-05",
    unlockedBy: ["lesson-05"],
  },
  {
    id: "cmd-clone",
    type: "command",
    prompt: "Get your own local copy of a hosted repository at <url>.",
    answers: ["git clone <url>"],
    explain: "git clone copies the whole repository — full history included — to your machine.",
    sourceLabel: "Lesson 06 — Fake GitHub",
    sourceId: "lesson-06",
    unlockedBy: ["lesson-06"],
  },
  {
    id: "cmd-push",
    type: "command",
    prompt: "Send your new local commits to the hosted copy (origin, branch main).",
    answers: ["git push", "git push origin main", "git push origin <branch>"],
    explain: "git push uploads your sealed commits to the shared remote.",
    sourceLabel: "Lesson 06 — Fake GitHub",
    sourceId: "lesson-06",
    unlockedBy: ["lesson-06"],
  },
  {
    id: "cmd-fetch",
    type: "command",
    prompt: "Safely download what teammates pushed — without touching your working copy.",
    answers: ["git fetch", "git fetch origin"],
    explain: "git fetch is looking: it updates your view of the remote and changes nothing on your desk.",
    sourceLabel: "Lesson 08 — The Collision",
    sourceId: "lesson-08",
    unlockedBy: ["lesson-08"],
  },
  {
    id: "cmd-pull",
    type: "command",
    prompt: "Download teammates' commits and merge them into your current branch.",
    answers: ["git pull", "git pull origin main", "git pull origin <branch>"],
    explain: "git pull is fetch + merge — it does change your working copy.",
    sourceLabel: "Lesson 08 — The Collision",
    sourceId: "lesson-08",
    unlockedBy: ["lesson-08"],
  },

  // ── Crisis Room command recall ──────────────────────────────────────
  {
    id: "cmd-crisis-rescue",
    type: "command",
    prompt: "You're in detached HEAD with a valuable new commit. Save it under a branch called rescue.",
    answers: ["git switch -c rescue", "git switch -c <branch>", "git checkout -b rescue"],
    explain:
      "A branch label keeps the stranded commit reachable — then you can merge it from main.",
    sourceLabel: "Crisis 01 — The Stranded Correction",
    sourceId: "crisis-01",
    unlockedBy: ["crisis-01"],
  },
  {
    id: "cmd-crisis-revert",
    type: "command",
    prompt: "A bad commit is already shared with the team. Undo it without rewriting history.",
    answers: ["git revert HEAD", "git revert <hash>"],
    explain:
      "Public mistakes get public corrections: revert preserves history; reset is only for private surgery.",
    sourceLabel: "Crisis 03 — The Public Mistake",
    sourceId: "crisis-03",
    unlockedBy: ["crisis-03"],
  },
  {
    id: "cmd-crisis-soft-reset",
    type: "command",
    prompt: "Un-seal your last (unshared) commit but keep all its work staged.",
    answers: ["git reset --soft HEAD~1", "git reset --soft head~1"],
    explain:
      "--soft moves the branch label back one commit; your work stays staged, ready to re-commit properly.",
    sourceLabel: "Crisis 04 — The Jumbled Seal",
    sourceId: "crisis-04",
    unlockedBy: ["crisis-04"],
  },
  {
    id: "cmd-crisis-hard-reset",
    type: "command",
    prompt: "Scrap every uncommitted change — staged and unstaged — and return to the last commit.",
    answers: ["git reset --hard", "git reset --hard HEAD"],
    explain:
      "git reset --hard clears the desk completely. Sealed history is safe; uncommitted work is gone.",
    sourceLabel: "Crisis 05 — The Scorched Desk",
    sourceId: "crisis-05",
    unlockedBy: ["crisis-05"],
  },
  {
    id: "cmd-crisis-reflog",
    type: "command",
    prompt: "A week of commits \u201cvanished\u201d after a bad reset. What command shows where HEAD has been?",
    answers: ["git reflog"],
    explain:
      "The reflog is Git's private diary of every place HEAD has pointed — find the old hash, then reset back to it.",
    sourceLabel: "Crisis 06 — The Vanished Week",
    sourceId: "crisis-06",
    unlockedBy: ["crisis-06"],
  },
];

/**
 * Items the learner has unlocked: anything whose `unlockedBy` list
 * intersects the set of completed module/lesson/crisis ids.
 */
export function eligibleDrills(completedIds: Set<string>): DrillItem[] {
  return drillBank.filter((item) => item.unlockedBy.some((id) => completedIds.has(id)));
}
