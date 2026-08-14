export interface BreakthroughMeta {
  id: string;
  title: string;
  hook: string;
  misconception: string;
  breakthrough: string;
}

export const breakthroughs: BreakthroughMeta[] = [
  {
    id: "two-machines",
    title: "Two Machines",
    hook: "Think Git and GitHub are the same thing? Unplug the internet and see.",
    misconception: "Git and GitHub are the same thing, or Git requires the internet.",
    breakthrough: "Git is a local program; GitHub is just a website hosting a copy of your records."
  },
  {
    id: "snapshots-not-diffs",
    title: "Snapshots, Not Diffs",
    hook: "Think a commit stores what changed? Come break that idea.",
    misconception: "A commit stores a list of file changes (a diff).",
    breakthrough: "A commit is a complete photograph of all your files at a moment in time; the diff is just computed on the fly."
  },
  {
    id: "branches-are-stickers",
    title: "Branches Are Stickers",
    hook: "Think branches copy your project? Let's peel back the label.",
    misconception: "Creating a branch duplicates your project folder.",
    breakthrough: "A branch is literally just a 41-byte name tag pointing at a specific photograph."
  },
  {
    id: "loading-dock",
    title: "The Loading Dock",
    hook: "Wondering why you have to 'add' before you 'commit'? Manage the dock.",
    misconception: "Saving in Git is an unnecessarily complicated one-step process.",
    breakthrough: "The staging area exists so you can craft exactly what goes into the sealed record, even if your desk is a mess."
  },
  {
    id: "fetch-is-looking",
    title: "Fetch Is Looking",
    hook: "Afraid to pull and break things? Try fetching first.",
    misconception: "Pulling is the only way to see what others did, and it's dangerous.",
    breakthrough: "Fetch just checks the mail safely; pull checks the mail and immediately opens it on your desk."
  },
  {
    id: "merge-reveals",
    title: "Merge Reveals",
    hook: "Think merging moves commits around? Watch the lines.",
    misconception: "Merging re-creates the branch's work as new changes on the main line.",
    breakthrough: "The commits were always there; merging just connects them into your line of sight."
  },
  {
    id: "detached-head",
    title: "Detached HEAD",
    hook: "See a scary 'detached HEAD' message? Take a breath.",
    misconception: "Detached HEAD is an error state and you've lost work.",
    breakthrough: "HEAD is just where you're standing. Standing in the archive room to look at old photographs is perfectly allowed."
  },
  {
    id: "conflicts-are-questions",
    title: "Conflicts Are Questions",
    hook: "Think a conflict means something is broken? Hand Git the pen.",
    misconception: "Merge conflicts mean the repository is damaged.",
    breakthrough: "A conflict is just Git refusing to guess about your company's records; it hands you the pen to decide."
  },
  {
    id: "nothing-is-lost",
    title: "Nothing Is Lost",
    hook: "Terrified of deleting everything? Look behind the curtain.",
    misconception: "One wrong command destroys work forever.",
    breakthrough: "Once sealed, a commit is nearly indestructible for 90 days — most 'disasters' are just misplaced labels."
  }
];
