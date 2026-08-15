export type RelatedLink = {
  label: string;
  url: string;
};

export type W5 = {
  what: string;
  where: string;
  why: string;
  when: string;
  how: string;
  links?: RelatedLink[];
  never?: string;
};

export type MapPlace = {
  id: string;
  label: string;
  region: 'computer' | 'website';
  w5: W5;
};

export type MapFlow = {
  id: string;
  label: string;
  from: string | 'you';
  to: string;
  w5: W5;
};

export type JourneyStep = {
  flowId: string;
  message: string;
};

export type Journey = {
  id: string;
  label: string;
  steps: JourneyStep[];
};

/**
 * Where a lesson, module, or breakthrough "lives" on the Map.
 * Used by the MapPeek widget to light up the territory during a lesson.
 */
export type MapLocation = {
  placeIds: string[];
  flowIds: string[];
  /** One-line "You are here: ..." caption. */
  caption: string;
};

export const mapPlaces: MapPlace[] = [
  {
    id: "workbench",
    label: "The Workbench",
    region: "computer",
    w5: {
      what: "Your live working folder.",
      where: "On your laptop (the actual files you open in your editor).",
      why: "To safely edit the CURRENT TRUTH without permanently modifying the sealed record.",
      when: "Every time you open the project.",
      how: "Just open files and type.",
      never: "Unsaved edits here never exist in Git until you stage them."
    }
  },
  {
    id: "dock",
    label: "The Loading Dock",
    region: "computer",
    w5: {
      what: "The staging area (Git index).",
      where: "Hidden inside the .git folder on your machine.",
      why: "To carefully box up specific file changes together before sealing them.",
      when: "After editing, before committing.",
      how: "git add",
      links: [{ label: "Breakthrough: Loading Dock", url: "/breakthroughs/loading-dock" }]
    }
  },
  {
    id: "sealed",
    label: "Your Sealed Record",
    region: "computer",
    w5: {
      what: "Your local repository's permanent history.",
      where: "Hidden inside the .git folder.",
      why: "To keep a permanent custody trail of all local work.",
      when: "When you commit, switch branches, or merge.",
      how: "git commit, git checkout",
      links: [{ label: "Breakthrough: Snapshots", url: "/breakthroughs/snapshots-not-diffs" }]
    }
  },
  {
    id: "shared",
    label: "The Shared Record",
    region: "website",
    w5: {
      what: "The remote repository.",
      where: "On GitHub's servers.",
      why: "The central source of truth for the entire company.",
      when: "Pushing your work, fetching others' work, or merging PRs.",
      how: "git push, git fetch, or GitHub's Merge button",
      links: [{ label: "Breakthrough: Two Machines", url: "/breakthroughs/two-machines" }]
    }
  },
  {
    id: "front-office",
    label: "The Front Office",
    region: "website",
    w5: {
      what: "Issues and Discussions.",
      where: "The 'Issues' tab on GitHub.",
      why: "To track bugs, plan features, and assign tasks before code is written.",
      when: "Before starting work, to agree on what needs doing.",
      how: "Click 'New Issue'"
    }
  },
  {
    id: "pr-desk",
    label: "The Proposal Desk",
    region: "website",
    w5: {
      what: "Pull Requests (PRs).",
      where: "The 'Pull Requests' tab on GitHub.",
      why: "To propose changes and discuss them before they hit the main company timeline.",
      when: "When a feature branch is ready for review.",
      how: "Click 'New Pull Request'"
    }
  },
  {
    id: "robot",
    label: "The Robot Coworker",
    region: "website",
    w5: {
      what: "Automated Checks (CI/CD).",
      where: "Inside a PR, near the bottom (the green checks or red X's).",
      why: "To act as a quality gate, ensuring no broken code enters the main timeline.",
      when: "Runs automatically when a PR is opened or updated.",
      how: "Controlled by GitHub Actions configuration.",
      links: [{ label: "Breakthrough: Robot Coworker", url: "/breakthroughs/the-robot-coworker" }]
    }
  },
  {
    id: "review",
    label: "The Review",
    region: "website",
    w5: {
      what: "Human approval step.",
      where: "Inside a PR (the 'Files changed' tab).",
      why: "Human sign-off on the company's custody trail.",
      when: "After automated checks pass.",
      how: "Click 'Review changes' -> 'Approve'"
    }
  }
];

export const mapFlows: MapFlow[] = [
  {
    id: "edit",
    label: "edit",
    from: "you",
    to: "workbench",
    w5: {
      what: "Making changes to your local files.",
      where: "In your editor.",
      why: "To do the actual work.",
      when: "Constantly.",
      how: "Typing and hitting save."
    }
  },
  {
    id: "add",
    label: "add",
    from: "workbench",
    to: "dock",
    w5: {
      what: "Staging files.",
      where: "Moving changes from the workbench to the loading dock.",
      why: "To select exactly which edits belong in the next sealed record.",
      when: "When you have a logical chunk of work ready to save.",
      how: "git add <file>",
      never: "Never modifies your actual files; it just takes a snapshot of them."
    }
  },
  {
    id: "commit",
    label: "commit",
    from: "dock",
    to: "sealed",
    w5: {
      what: "Sealing the record.",
      where: "Moving the loading dock's contents into the permanent local history.",
      why: "To create an indestructible photograph of the project at this exact moment.",
      when: "When the dock contains a complete, working idea.",
      how: "git commit -m 'Message'",
      never: "Never leaves your computer. The website doesn't know about this yet."
    }
  },
  {
    id: "branch",
    label: "branch/switch",
    from: "sealed",
    to: "sealed",
    w5: {
      what: "Moving your HEAD pointer or creating a new timeline.",
      where: "Entirely inside your local repository.",
      why: "To safely experiment without touching the main timeline.",
      when: "Before starting a new feature.",
      how: "git checkout -b <name> or git switch",
      links: [{ label: "Breakthrough: Branches", url: "/breakthroughs/branches-are-stickers" }]
    }
  },
  {
    id: "push",
    label: "push",
    from: "sealed",
    to: "shared",
    w5: {
      what: "Uploading your sealed records.",
      where: "Sending commits from your machine to GitHub.",
      why: "To back up your work and make it visible to the team.",
      when: "When you have local commits ready to share.",
      how: "git push",
      never: "Never works if the remote has commits you haven't seen yet (diverged)."
    }
  },
  {
    id: "fetch",
    label: "fetch",
    from: "shared",
    to: "sealed",
    w5: {
      what: "Downloading remote records safely.",
      where: "Pulling commits from GitHub into your local repository's hidden storage.",
      why: "To see what others have done without risking your current work.",
      when: "When you want to inspect a coworker's branch.",
      how: "git fetch",
      never: "Never touches your Workbench files. Completely safe.",
      links: [{ label: "Breakthrough: Fetch", url: "/breakthroughs/fetch-is-looking" }]
    }
  },
  {
    id: "pull",
    label: "pull",
    from: "shared",
    to: "sealed",
    w5: {
      what: "Fetching AND merging.",
      where: "Downloading from GitHub and immediately forcing it into your active branch.",
      why: "To catch up your local branch with the team's updates.",
      when: "When you are ready to integrate remote changes into your active work.",
      how: "git pull",
      never: "Never safe to do if your workbench has uncommitted, conflicting edits."
    }
  },
  {
    id: "issue",
    label: "issue",
    from: "front-office",
    to: "you",
    w5: {
      what: "Task assignment.",
      where: "Reading an issue on GitHub and preparing to work locally.",
      why: "To start work on an agreed-upon problem.",
      when: "At the start of a sprint or task.",
      how: "Reading the issue, then branching."
    }
  },
  {
    id: "open_pr",
    label: "open PR",
    from: "shared",
    to: "pr-desk",
    w5: {
      what: "Creating a Pull Request.",
      where: "On GitHub, linking a pushed branch to the main timeline.",
      why: "To formally propose your commits for review and integration.",
      when: "After pushing your completed feature branch.",
      how: "Click 'New Pull Request' on GitHub."
    }
  },
  {
    id: "checks",
    label: "checks",
    from: "pr-desk",
    to: "robot",
    w5: {
      what: "Automated verification.",
      where: "GitHub Actions scanning the PR's commits.",
      why: "To catch broken code before humans waste time reviewing it.",
      when: "Immediately after a PR is opened or updated.",
      how: "Automatic."
    }
  },
  {
    id: "do_review",
    label: "review",
    from: "robot",
    to: "review",
    w5: {
      what: "Human inspection.",
      where: "A team member reading the diff in the PR.",
      why: "To ensure the code meets company standards and solves the issue.",
      when: "After checks pass.",
      how: "Reading the code and approving."
    }
  },
  {
    id: "merge",
    label: "merge",
    from: "review",
    to: "shared",
    w5: {
      what: "Integrating the proposal.",
      where: "Clicking the green Merge button on GitHub.",
      why: "To make the contractor's work part of the official company timeline.",
      when: "After checks pass and a human approves.",
      how: "Click 'Merge Pull Request'.",
      links: [{ label: "Breakthrough: Three Ways to Merge", url: "/breakthroughs/three-ways-to-merge" }]
    }
  },
  {
    id: "inspect",
    label: "inspect",
    from: "sealed",
    to: "workbench",
    w5: {
      what: "Checking out a fetched branch.",
      where: "Moving a branch's files from the sealed record into your live workbench.",
      why: "To actually see and test the files on your computer.",
      when: "After fetching someone else's branch.",
      how: "git checkout <branch>"
    }
  }
];

/**
 * lessonId -> map location. Keys cover:
 * - Test Center CLI lessons ("lesson-01"...)
 * - Visual track modules ("1.1", "2.3", ...)
 * - Breakthrough ids ("loading-dock", ...)
 */
export const lessonLocations: Record<string, MapLocation> = {
  // --- Test Center (CLI) lessons ---
  "lesson-01": {
    placeIds: ["workbench", "dock", "sealed"],
    flowIds: ["edit", "add", "commit"],
    caption: "Your Computer — edit on the Workbench, stage at the Loading Dock, seal the record.",
  },
  "lesson-02": {
    placeIds: ["sealed"],
    flowIds: ["commit"],
    caption: "Your Sealed Record — reading the permanent local ledger.",
  },
  "lesson-03": {
    placeIds: ["workbench", "sealed"],
    flowIds: ["inspect", "commit"],
    caption: "Your Sealed Record — undoing by adding new records, never erasing.",
  },
  "lesson-04": {
    placeIds: ["sealed"],
    flowIds: ["branch"],
    caption: "Your Sealed Record — branching into a safe parallel timeline.",
  },
  "lesson-05": {
    placeIds: ["workbench", "sealed"],
    flowIds: ["branch"],
    caption: "Your Computer — merging two timelines and answering the conflict.",
  },
  "lesson-06": {
    placeIds: ["sealed", "shared"],
    flowIds: ["push", "fetch", "pull"],
    caption: "Between your Sealed Record and the Shared Record — syncing two machines.",
  },
  "lesson-07": {
    placeIds: ["pr-desk", "robot", "review", "shared"],
    flowIds: ["open_pr", "checks", "do_review", "merge"],
    caption: "The Website — a proposal travels from the Proposal Desk to the Shared Record.",
  },
  "lesson-08": {
    placeIds: ["sealed", "shared"],
    flowIds: ["push", "pull"],
    caption: "Between your Sealed Record and the Shared Record — two histories collided.",
  },
  "lesson-09": {
    placeIds: ["sealed", "shared"],
    flowIds: ["fetch", "pull", "push"],
    caption: "Between your Sealed Record and the Shared Record — resolving a standoff safely.",
  },

  // --- Visual track modules ---
  "1.1": {
    placeIds: ["shared", "front-office"],
    flowIds: [],
    caption: "The Website (GitHub) — the company's Shared Record and Front Office.",
  },
  "1.2": {
    placeIds: ["shared"],
    flowIds: [],
    caption: "The Shared Record — a repository's home screen.",
  },
  "1.3": {
    placeIds: ["shared"],
    flowIds: ["commit"],
    caption: "The Shared Record — reading sealed history visually.",
  },
  "1.4": {
    placeIds: ["shared"],
    flowIds: [],
    caption: "The Shared Record — the settings behind the repository.",
  },
  "1.5": {
    placeIds: ["shared", "front-office"],
    flowIds: [],
    caption: "The Website (GitHub) — finding your way around the whole site.",
  },
  "2.1": {
    placeIds: ["pr-desk"],
    flowIds: ["open_pr"],
    caption: "The Proposal Desk — where a pull request formally proposes changes.",
  },
  "2.2": {
    placeIds: ["pr-desk", "review"],
    flowIds: ["do_review"],
    caption: "The Review — reading every changed line of the proposal.",
  },
  "2.3": {
    placeIds: ["review", "robot"],
    flowIds: ["do_review", "merge"],
    caption: "The Review — the human verdict before work joins the Shared Record.",
  },

  // --- Crisis Room scenarios ---
  "crisis-01": {
    placeIds: ["workbench", "sealed"],
    flowIds: ["inspect", "branch"],
    caption: "Your Sealed Record — stranded on a snapshot, a branch name tag makes it safe.",
  },
  "crisis-02": {
    placeIds: ["workbench", "dock", "sealed"],
    flowIds: ["add", "commit"],
    caption: "Your Computer — untangling a pileup between the Workbench and the Loading Dock.",
  },
  "crisis-03": {
    placeIds: ["sealed", "shared"],
    flowIds: ["push"],
    caption: "Between your Sealed Record and the Shared Record — a mistake already went public.",
  },
  "crisis-04": {
    placeIds: ["dock", "sealed"],
    flowIds: ["add", "commit"],
    caption: "Your Sealed Record — a jumbled seal needs to be redone properly.",
  },
  "crisis-05": {
    placeIds: ["workbench", "sealed"],
    flowIds: ["inspect"],
    caption: "Your Computer — recovering the Workbench from the Sealed Record.",
  },
  "crisis-06": {
    placeIds: ["sealed"],
    flowIds: ["commit"],
    caption: "Your Sealed Record — a vanished week is still in there; nothing is lost.",
  },

  // --- Breakthroughs ---
  "two-machines": {
    placeIds: ["sealed", "shared"],
    flowIds: ["push", "fetch"],
    caption: "Two machines — your Sealed Record and GitHub's Shared Record are separate copies.",
  },
  "snapshots-not-diffs": {
    placeIds: ["sealed"],
    flowIds: ["commit"],
    caption: "Your Sealed Record — every commit is a full photograph, not a diff.",
  },
  "branches-are-stickers": {
    placeIds: ["sealed"],
    flowIds: ["branch"],
    caption: "Your Sealed Record — branches are movable stickers on the timeline.",
  },
  "loading-dock": {
    placeIds: ["dock"],
    flowIds: ["add", "commit"],
    caption: "The Loading Dock — boxing up exactly what goes in the next sealed record.",
  },
  "fetch-is-looking": {
    placeIds: ["sealed", "shared"],
    flowIds: ["fetch"],
    caption: "fetch — safely downloading from the Shared Record without touching your files.",
  },
  "merge-reveals": {
    placeIds: ["sealed"],
    flowIds: ["branch"],
    caption: "Your Sealed Record — merging reveals how two timelines relate.",
  },
  "detached-head": {
    placeIds: ["workbench", "sealed"],
    flowIds: ["inspect"],
    caption: "Your Computer — visiting an old snapshot on the Workbench.",
  },
  "conflicts-are-questions": {
    placeIds: ["workbench", "sealed"],
    flowIds: ["pull"],
    caption: "Your Computer — a conflict is Git asking you a question on the Workbench.",
  },
  "nothing-is-lost": {
    placeIds: ["sealed"],
    flowIds: [],
    caption: "Your Sealed Record — committed work is never truly lost.",
  },
  "three-ways-to-merge": {
    placeIds: ["review", "shared"],
    flowIds: ["merge"],
    caption: "The merge — three ways a proposal can join the Shared Record.",
  },
  "secrets-never-heal": {
    placeIds: ["sealed", "shared"],
    flowIds: ["push"],
    caption: "push — once a secret reaches the Shared Record, history remembers it.",
  },
  "the-robot-coworker": {
    placeIds: ["robot"],
    flowIds: ["checks"],
    caption: "The Robot Coworker — automated checks guarding the Shared Record.",
  },
};

export const mapJourneys: Journey[] = [
  {
    id: "solo",
    label: "A day of solo work",
    steps: [
      { flowId: "edit", message: "You make changes to files on your local machine." },
      { flowId: "add", message: "You stage the specific files you want to record." },
      { flowId: "commit", message: "You seal those staged files into a permanent local snapshot." },
      { flowId: "push", message: "You push your sealed record to GitHub to back it up and share it." }
    ]
  },
  {
    id: "contractor",
    label: "Taking in a contractor's work",
    steps: [
      { flowId: "issue", message: "A task is agreed upon in the Front Office." },
      { flowId: "branch", message: "The contractor creates an isolated branch to work safely." },
      { flowId: "open_pr", message: "They push their work and open a Proposal (PR)." },
      { flowId: "checks", message: "The Robot Coworker instantly verifies their code doesn't break tests." },
      { flowId: "do_review", message: "You review the passing code and give human approval." },
      { flowId: "merge", message: "You merge their timeline into the company's main Shared Record." },
      { flowId: "pull", message: "You pull the newly updated main line down to your own machine." }
    ]
  },
  {
    id: "sync",
    label: "Staying in sync",
    steps: [
      { flowId: "fetch", message: "You safely download your coworkers' new records without touching your files." },
      { flowId: "inspect", message: "You check out their branch to inspect it on your Workbench." },
      { flowId: "pull", message: "Once satisfied, you pull the updates into your active timeline." }
    ]
  }
];
