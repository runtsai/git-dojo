import type { SimDiffFile, SimPrCommentData } from "@/components/sim/sim-pr";

/**
 * The contractor delivery pull request used across the Tier 2 review modules.
 * Same story as CLI Lesson 7: Ruth Osei delivers an About page and a config
 * "tune" that quietly adds a live credential and flips uploads on.
 */

export const contractorPr = {
  title: "Add about page and tune configuration",
  number: 12,
  author: "Ruth Osei",
  sourceBranch: "contractor-delivery",
  targetBranch: "main",
  commitCount: 2,
};

export const prDescription: SimPrCommentData = {
  author: "Ruth Osei",
  initials: "RO",
  role: "Contractor",
  time: "2 days ago",
  color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  body: "Delivery as scoped: the About page is written and I tuned the configuration for better performance. Ready for your review. Invoice to follow once this is merged.",
};

export const prConversation: SimPrCommentData[] = [
  prDescription,
  {
    author: "Adam Cornelius",
    initials: "AC",
    role: "Owner",
    time: "yesterday",
    color: "bg-primary/20 text-primary border-primary/30",
    body: "Thanks Ruth. I'll read the full diff before anything merges — company policy, nothing personal.",
  },
];

/** Line indexes are within each file's diff, 0-based. */
export const prFiles: SimDiffFile[] = [
  {
    file: "about.txt",
    lines: [
      { type: "add", text: "ABOUT RTS" },
      { type: "add", text: "Built by an operator from trucking and aerospace." },
      { type: "add", text: "Your documents never leave your building." },
    ],
  },
  {
    file: "config.txt",
    lines: [
      { type: "ctx", text: "# app configuration" },
      { type: "add", text: "api_key=sk-live-9f3a71c2e8b44d55" },
      { type: "del", text: "upload_to_cloud=false" },
      { type: "add", text: "upload_to_cloud=true" },
      { type: "ctx", text: "max_file_mb=100" },
    ],
  },
];

/** The two lines that must stop the merge. */
export const dangerLines = {
  secret: { file: "config.txt", lineIndex: 1 },
  behavior: { file: "config.txt", lineIndex: 3 },
};

export const ownerGuidelines = [
  "No credentials, keys, or passwords may ever enter the repository. History is forever.",
  "No functional or configuration behavior changes beyond what was scoped and authorized.",
  "Style nitpicks are comments, not blockers. Safety problems always block the merge.",
  "Be specific and courteous: point at the exact line and say what must change.",
];
