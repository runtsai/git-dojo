export type ModuleDef = {
  id: string;
  title: string;
  path: string;
};

export type TierDef = {
  id: string;
  title: string;
  description: string;
  status?: "coming_soon" | "active";
  modules?: ModuleDef[];
};

export const tiers: TierDef[] = [
  {
    id: "tier-1",
    title: "The Ground Truth",
    description: "What GitHub actually is and how to read the record.",
    status: "active",
    modules: [
      { id: "1.1", title: "What GitHub actually is", path: "/learn/1-1" },
      { id: "1.2", title: "The repository home screen", path: "/learn/1-2" },
      { id: "1.3", title: "Reading history visually", path: "/learn/1-3" },
      { id: "1.4", title: "Repo settings basics", path: "/learn/1-4" },
      { id: "1.5", title: "The global nav", path: "/learn/1-5" },
    ]
  },
  {
    id: "tier-2",
    title: "Reviewing a Contractor's Work",
    description: "Be the owner: read a pull request, pin comments on the diff, and make the call.",
    status: "active",
    modules: [
      { id: "2.1", title: "What a pull request really is", path: "/learn/2-1" },
      { id: "2.2", title: "Files changed: read every line", path: "/learn/2-2" },
      { id: "2.3", title: "The verdict: approve or block", path: "/learn/2-3" },
      { id: "2.4", title: "Ruth's fix: close the loop", path: "/learn/2-4" },
    ]
  },
  {
    id: "tier-3",
    title: "Protect the Trunk",
    description: "Branch rules and required checks.",
    status: "coming_soon"
  },
  {
    id: "tier-4",
    title: "Run Automation",
    description: "GitHub Actions basics.",
    status: "coming_soon"
  },
  {
    id: "tier-5",
    title: "Run the Organization",
    description: "Teams, permissions, and billing.",
    status: "coming_soon"
  },
  {
    id: "tier-6",
    title: "Publish What You Learned",
    description: "Pages and releases.",
    status: "coming_soon"
  }
];
