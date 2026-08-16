import { describe, it, expect, beforeEach } from "vitest";
import { detectMovements } from "./territory-strip";
import type { RepoState, RepoFile, RepoCommit, SyncStatus } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _id = 0;
const counter = () => ++_id;
beforeEach(() => { _id = 0; });

function makeCommit(hash: string, subject: string, parents: string[] = []): RepoCommit {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    subject,
    authorName: "Test User",
    date: "2024-01-01T00:00:00Z",
    refs: [],
    parents,
  };
}

function base(): RepoState {
  return {
    lessonId: "lesson-01",
    hasPlayground: true,
    initialized: true,
    currentBranch: "main",
    detachedHead: false,
    mergeInProgress: false,
    files: [],
    commits: [],
    branches: [{ name: "main", isCurrent: true, headHash: "" }],
    remotes: [],
    remoteBranches: [],
    syncStatus: null,
    repoFolder: null,
    summary: "",
    hasBot: false,
  };
}

// Convenience: clone base and apply partial overrides
function state(overrides: Partial<RepoState>): RepoState {
  return { ...base(), ...overrides };
}

// ---------------------------------------------------------------------------
// Stage (Workbench → Loading Dock)
// ---------------------------------------------------------------------------

describe("stage", () => {
  it("narrates a single file moving Workbench → Dock", () => {
    const prev = state({ files: [{ path: "README.md", status: "modified" }] });
    const next = state({ files: [{ path: "README.md", status: "staged" }] });
    const events = detectMovements(prev, next, counter);
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe("workbench");
    expect(events[0].to).toBe("dock");
    expect(events[0].text).toMatch(/README\.md/);
    expect(events[0].freshKeys).toContain("README.md");
  });

  it("narrates multiple files staged at once", () => {
    const prev = state({
      files: [
        { path: "a.ts", status: "modified" },
        { path: "b.ts", status: "untracked" },
      ],
    });
    const next = state({
      files: [
        { path: "a.ts", status: "staged" },
        { path: "b.ts", status: "staged" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe("workbench");
    expect(events[0].to).toBe("dock");
    expect(events[0].freshKeys).toEqual(expect.arrayContaining(["a.ts", "b.ts"]));
  });
});

// ---------------------------------------------------------------------------
// Unstage (Loading Dock → Workbench)
// ---------------------------------------------------------------------------

describe("unstage", () => {
  it("narrates a file moving Dock → Workbench without a new commit", () => {
    const prev = state({ files: [{ path: "README.md", status: "staged" }] });
    const next = state({ files: [{ path: "README.md", status: "modified" }] });
    const events = detectMovements(prev, next, counter);
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe("dock");
    expect(events[0].to).toBe("workbench");
    expect(events[0].text).toMatch(/README\.md/);
  });

  it("does NOT emit unstage event when the file disappears due to a commit", () => {
    const commit = makeCommit("abc1234", "Add README", []);
    const prev = state({ files: [{ path: "README.md", status: "staged" }] });
    const next = state({ files: [], commits: [commit] });
    const events = detectMovements(prev, next, counter);
    // There should be a seal event, not an unstage event
    const unstageEvents = events.filter((e) => e.from === "dock" && e.to === "workbench");
    expect(unstageEvents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Commit / Seal (Loading Dock → Sealed Record)
// ---------------------------------------------------------------------------

describe("commit", () => {
  it("narrates a normal commit as a Dock → Sealed seal", () => {
    const commit = makeCommit("abc1234", "Add feature", []);
    const prev = state({ files: [{ path: "foo.ts", status: "staged" }] });
    const next = state({ files: [], commits: [commit] });
    const events = detectMovements(prev, next, counter);
    const seal = events.find((e) => e.from === "dock" && e.to === "sealed");
    expect(seal).toBeDefined();
    expect(seal!.text).toMatch(/Sealed!/);
    expect(seal!.text).toMatch(/Add feature/);
    expect(seal!.freshKeys).toContain("abc1234");
  });

  it("narrates -am commit (empty dock before) as a local seal", () => {
    // `git commit -am` stages and commits in one step — dock was empty beforehand
    const commit = makeCommit("def5678", "Quick fix via -am", []);
    // prevStaged is empty but no remote change either → isLocalSeal relies on
    // the empty-dock+no-remote path: prevStaged.size===0 AND !remoteChanged AND !behindDecreased
    const prev = state({ files: [{ path: "fix.ts", status: "modified" }] });
    const next = state({ files: [], commits: [commit] });
    const events = detectMovements(prev, next, counter);
    const seal = events.find((e) => e.from === "dock" && e.to === "sealed");
    expect(seal).toBeDefined();
    expect(seal!.text).toMatch(/Sealed!/);
    expect(seal!.text).not.toMatch(/Shared Record/i);
  });

  it("does NOT use 'Sealed!' wording for remote-sourced commits", () => {
    // Commits that came from a fetch/pull must not be narrated as local seals
    const remoteCommit = makeCommit("remote1", "Remote work", []);
    const prev = state({
      commits: [],
      remoteBranches: [{ name: "origin/main", headHash: "old111" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 1 },
    });
    const next = state({
      commits: [remoteCommit],
      remoteBranches: [{ name: "origin/main", headHash: "remote1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    const sealEvents = events.filter((e) => e.to === "sealed" && e.text.includes("Sealed!"));
    expect(sealEvents).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Merge commit
// ---------------------------------------------------------------------------

describe("merge commit", () => {
  it("narrates a merge commit with merge wording, not 'Sealed!'", () => {
    const mergeCommit = makeCommit("merge111", "Merge branch 'feature'", ["parent1", "parent2"]);
    const prev = state({ files: [{ path: "conflict.ts", status: "staged" }] });
    const next = state({ files: [], commits: [mergeCommit] });
    const events = detectMovements(prev, next, counter);
    const seal = events.find((e) => e.from === "dock" && e.to === "sealed");
    expect(seal).toBeDefined();
    expect(seal!.text).toMatch(/merge/i);
    expect(seal!.text).not.toMatch(/^Sealed!/);
  });

  it("puts merge commit hash in freshKeys", () => {
    const mergeCommit = makeCommit("merge222", "Merged", ["p1", "p2"]);
    const prev = state({ files: [{ path: "x.ts", status: "staged" }] });
    const next = state({ files: [], commits: [mergeCommit] });
    const events = detectMovements(prev, next, counter);
    const seal = events.find((e) => e.to === "sealed");
    expect(seal!.freshKeys).toContain("merge222");
  });
});

// ---------------------------------------------------------------------------
// Branch create / switch
// ---------------------------------------------------------------------------

describe("branch", () => {
  it("narrates a new branch creation", () => {
    const prev = state({
      currentBranch: "main",
      branches: [{ name: "main", isCurrent: true, headHash: "abc" }],
    });
    const next = state({
      currentBranch: "feature",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "feature", isCurrent: true, headHash: "abc" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.to === "workbench" || e.from === "sealed");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/feature/);
    expect(ev!.text).toMatch(/created|new timeline/i);
  });

  it("narrates switching to an existing branch", () => {
    const prev = state({
      currentBranch: "main",
      branches: [
        { name: "main", isCurrent: true, headHash: "abc" },
        { name: "develop", isCurrent: false, headHash: "def" },
      ],
    });
    const next = state({
      currentBranch: "develop",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "develop", isCurrent: true, headHash: "def" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/develop/);
    expect(ev!.text).toMatch(/Switched/i);
  });
});

// ---------------------------------------------------------------------------
// Detached HEAD
// ---------------------------------------------------------------------------

describe("detached HEAD", () => {
  it("narrates entering detached HEAD state", () => {
    const prev = state({ detachedHead: false, currentBranch: "main" });
    const next = state({ detachedHead: true, currentBranch: null });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/detached/i);
  });
});

// ---------------------------------------------------------------------------
// Conflict start
// ---------------------------------------------------------------------------

describe("conflict start", () => {
  it("narrates a merge conflict appearing", () => {
    const prev = state({ mergeInProgress: false, files: [] });
    const next = state({
      mergeInProgress: true,
      files: [
        { path: "CONFLICT.md", status: "conflicted" },
        { path: "other.ts", status: "conflicted" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.to === "workbench");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/conflict|merge/i);
    expect(ev!.freshKeys).toContain("CONFLICT.md");
    expect(ev!.freshKeys).toContain("other.ts");
  });
});

// ---------------------------------------------------------------------------
// Push (Sealed → Shared)
// ---------------------------------------------------------------------------

describe("push", () => {
  it("narrates a push as Sealed → Shared", () => {
    const prev = state({
      remotes: ["origin"],
      syncStatus: { remoteBranch: "origin/main", ahead: 2, behind: 0 },
    });
    const next = state({
      remotes: ["origin"],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "shared");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/push/i);
  });

  it("remote-sourced commits are never labeled Sealed!", () => {
    // Push event only, no new local commits
    const prev = state({
      remotes: ["origin"],
      commits: [makeCommit("localA", "Local A", [])],
      syncStatus: { remoteBranch: "origin/main", ahead: 1, behind: 0 },
    });
    const next = state({
      remotes: ["origin"],
      commits: [makeCommit("localA", "Local A", [])],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    const wrongSeal = events.filter((e) => e.text.includes("Sealed!"));
    expect(wrongSeal).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fetch (remote heads move, behind grows)
// ---------------------------------------------------------------------------

describe("fetch", () => {
  it("narrates a fetch as remote heads updating and behind count growing", () => {
    const prev = state({
      remotes: ["origin"],
      remoteBranches: [{ name: "origin/main", headHash: "old111" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const next = state({
      remotes: ["origin"],
      remoteBranches: [{ name: "origin/main", headHash: "new222" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 2 },
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "shared" && e.to === "sealed");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/fetch/i);
  });

  it("does NOT narrate fetch commits as 'Sealed!'", () => {
    const remoteCommit = makeCommit("remote1", "Remote work", []);
    const prev = state({
      remotes: ["origin"],
      commits: [],
      remoteBranches: [{ name: "origin/main", headHash: "old111" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const next = state({
      remotes: ["origin"],
      commits: [remoteCommit],
      remoteBranches: [{ name: "origin/main", headHash: "remote1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 1 },
    });
    const events = detectMovements(prev, next, counter);
    const sealBang = events.filter((e) => e.text.includes("Sealed!"));
    expect(sealBang).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pull with prior fetch (behind → 0)
// ---------------------------------------------------------------------------

describe("pull with prior fetch", () => {
  it("narrates behind count decreasing as commits arriving from Shared Record", () => {
    const pulledCommit = makeCommit("pulled1", "Teammate commit", []);
    const prev = state({
      remotes: ["origin"],
      commits: [makeCommit("local1", "My commit", [])],
      remoteBranches: [{ name: "origin/main", headHash: "pulled1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 1 },
    });
    const next = state({
      remotes: ["origin"],
      commits: [pulledCommit, makeCommit("local1", "My commit", [])],
      remoteBranches: [{ name: "origin/main", headHash: "pulled1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "shared" && e.to === "sealed");
    expect(ev).toBeDefined();
    // Must not say "Sealed!" for remote-sourced commits
    const sealBang = events.filter((e) => e.text.includes("Sealed!"));
    expect(sealBang).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pull WITHOUT prior fetch (remote heads move, no prior behind count)
// ---------------------------------------------------------------------------

describe("pull without prior fetch", () => {
  it("narrates commits arriving without a fetch step first", () => {
    const pulledCommit = makeCommit("direct1", "Direct pull", []);
    const prev = state({
      remotes: ["origin"],
      commits: [],
      remoteBranches: [{ name: "origin/main", headHash: "old111" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const next = state({
      remotes: ["origin"],
      commits: [pulledCommit],
      remoteBranches: [{ name: "origin/main", headHash: "direct1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    const shared = events.find((e) => e.from === "shared" && e.to === "sealed");
    expect(shared).toBeDefined();
    // Must not narrate as local seal
    const sealBang = events.filter((e) => e.text.includes("Sealed!"));
    expect(sealBang).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Clone-time remote appearance
// ---------------------------------------------------------------------------

describe("clone / remote appearance", () => {
  it("narrates the first remote appearing", () => {
    const prev = state({ remotes: [], remoteBranches: [], syncStatus: null });
    const next = state({
      remotes: ["origin"],
      remoteBranches: [{ name: "origin/main", headHash: "abc" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.to === "shared");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/remote|connected/i);
  });
});

// ---------------------------------------------------------------------------
// Broad guarantee: remote-sourced commits never get "Sealed!"
// ---------------------------------------------------------------------------

describe("remote-sourced-commits invariant", () => {
  const remoteCases: Array<{ label: string; prev: RepoState; next: RepoState }> = [
    {
      label: "fetch then pull",
      prev: state({
        remotes: ["origin"],
        commits: [],
        remoteBranches: [{ name: "origin/main", headHash: "old" }],
        syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 1 },
      }),
      next: state({
        remotes: ["origin"],
        commits: [makeCommit("rem1", "Remote", [])],
        remoteBranches: [{ name: "origin/main", headHash: "rem1" }],
        syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
      }),
    },
    {
      label: "direct pull (no prior fetch)",
      prev: state({
        remotes: ["origin"],
        commits: [],
        remoteBranches: [{ name: "origin/main", headHash: "old2" }],
        syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
      }),
      next: state({
        remotes: ["origin"],
        commits: [makeCommit("rem2", "Remote2", [])],
        remoteBranches: [{ name: "origin/main", headHash: "rem2" }],
        syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
      }),
    },
  ];

  remoteCases.forEach(({ label, prev, next }) => {
    it(`remote-sourced commit from "${label}" is not narrated as Sealed!`, () => {
      const events = detectMovements(prev, next, counter);
      const sealBang = events.filter((e) => e.text.includes("Sealed!"));
      expect(sealBang).toHaveLength(0);
    });
  });
});
