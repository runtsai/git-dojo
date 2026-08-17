import { describe, it, expect, beforeEach } from "vitest";
import { detectMovements, isStaleGap, STALE_GAP_MS } from "./territory-strip";
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
    // No workbench files differ between snapshots → freshKeys is empty
    expect(ev!.freshKeys).toEqual([]);
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
    // No workbench files differ between snapshots → freshKeys is empty
    expect(ev!.freshKeys).toEqual([]);
  });

  it("populates freshKeys with files that appear on the workbench after a branch switch", () => {
    const prev = state({
      currentBranch: "main",
      branches: [
        { name: "main", isCurrent: true, headHash: "abc" },
        { name: "feature", isCurrent: false, headHash: "def" },
      ],
      files: [],
    });
    const next = state({
      currentBranch: "feature",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "feature", isCurrent: true, headHash: "def" },
      ],
      // These files are specific to the feature branch and weren't on the
      // workbench before the switch.
      files: [
        { path: "feature.ts", status: "untracked" },
        { path: "notes.md", status: "modified" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(ev).toBeDefined();
    expect(ev!.freshKeys).toContain("feature.ts");
    expect(ev!.freshKeys).toContain("notes.md");
  });

  it("does not include files that were already on the workbench before the switch", () => {
    const prev = state({
      currentBranch: "main",
      branches: [
        { name: "main", isCurrent: true, headHash: "abc" },
        { name: "hotfix", isCurrent: false, headHash: "def" },
      ],
      // This file was already on the workbench on main
      files: [{ path: "existing.ts", status: "modified" }],
    });
    const next = state({
      currentBranch: "hotfix",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "hotfix", isCurrent: true, headHash: "def" },
      ],
      // existing.ts was already present; newfile.ts appeared from the branch
      files: [
        { path: "existing.ts", status: "modified" },
        { path: "newfile.ts", status: "untracked" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(ev).toBeDefined();
    // Only the newly-appeared file should be highlighted
    expect(ev!.freshKeys).toContain("newfile.ts");
    expect(ev!.freshKeys).not.toContain("existing.ts");
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

  it("emits the detached-HEAD event and no duplicate workbench-appearance event when files appear in the same poll", () => {
    // Before: on main branch, clean workbench
    const prev = state({
      detachedHead: false,
      currentBranch: "main",
      branches: [{ name: "main", isCurrent: true, headHash: "abc" }],
      files: [],
    });
    // After: detached HEAD (checked out an old commit), workbench files become visible
    const next = state({
      detachedHead: true,
      currentBranch: null,
      branches: [{ name: "main", isCurrent: false, headHash: "abc" }],
      files: [
        { path: "old-file.ts", status: "modified" },
        { path: "legacy.md", status: "untracked" },
      ],
    });
    const events = detectMovements(prev, next, counter);

    // The detached-HEAD event must fire
    const detachedEv = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(detachedEv).toBeDefined();
    expect(detachedEv!.text).toMatch(/detached/i);
    // Newly-visible workbench files must be in freshKeys of the detached-HEAD event
    expect(detachedEv!.freshKeys).toContain("old-file.ts");
    expect(detachedEv!.freshKeys).toContain("legacy.md");

    // No separate workbench-appearance event must fire for those same files
    const appearanceEvents = events.filter(
      (e) => e.to === "workbench" && e !== detachedEv,
    );
    expect(appearanceEvents).toHaveLength(0);
  });

  it("total event count is exactly 1 when detached-HEAD entry and file appearance occur together", () => {
    const prev = state({
      detachedHead: false,
      currentBranch: "main",
      files: [],
    });
    const next = state({
      detachedHead: true,
      currentBranch: null,
      files: [{ path: "snapshot.ts", status: "modified" }],
    });
    const events = detectMovements(prev, next, counter);
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe("sealed");
    expect(events[0].to).toBe("workbench");
    expect(events[0].text).toMatch(/detached/i);
  });

  it("populates freshKeys with files newly appearing on the workbench when entering detached HEAD", () => {
    // Before: on main branch with no workbench files
    const prev = state({
      detachedHead: false,
      currentBranch: "main",
      branches: [{ name: "main", isCurrent: true, headHash: "abc" }],
      files: [],
    });
    // After: detached HEAD — old commit checked out, two files now visible on workbench
    const next = state({
      detachedHead: true,
      currentBranch: null,
      branches: [{ name: "main", isCurrent: false, headHash: "abc" }],
      files: [
        { path: "ancient.ts", status: "modified" },
        { path: "history.md", status: "untracked" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/detached/i);
    expect(ev!.freshKeys).toContain("ancient.ts");
    expect(ev!.freshKeys).toContain("history.md");
  });

  it("freshKeys is empty when entering detached HEAD with no new workbench files", () => {
    // Before: on main branch, already has a modified file on the workbench
    const prev = state({
      detachedHead: false,
      currentBranch: "main",
      branches: [{ name: "main", isCurrent: true, headHash: "abc" }],
      files: [{ path: "carried.ts", status: "modified" }],
    });
    // After: detached HEAD — same file is still on the workbench (no new files appeared)
    const next = state({
      detachedHead: true,
      currentBranch: null,
      branches: [{ name: "main", isCurrent: false, headHash: "abc" }],
      files: [{ path: "carried.ts", status: "modified" }],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(ev).toBeDefined();
    expect(ev!.text).toMatch(/detached/i);
    // carried.ts was already on the workbench before — it must NOT be highlighted
    expect(ev!.freshKeys).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Interactive-rebase scenario: HEAD stays detached but moves between commits,
  // so workbench files differ between two consecutive polls.
  // -------------------------------------------------------------------------

  it("detached HEAD → detached HEAD: emits at most one workbench-appearance event (no duplicate)", () => {
    // First detached-HEAD poll: HEAD is on commit A, one file visible.
    const first = state({
      detachedHead: true,
      currentBranch: null,
      files: [{ path: "old-snapshot.ts", status: "modified" }],
    });
    // Second poll: HEAD moved to commit B (rebase step), different file visible,
    // but still detached — no branch change, no detachedHead flag change.
    const second = state({
      detachedHead: true,
      currentBranch: null,
      files: [
        { path: "old-snapshot.ts", status: "modified" },
        { path: "new-commit-file.ts", status: "untracked" },
      ],
    });
    const events = detectMovements(first, second, counter);

    // There must be no more than one workbench-appearance event.
    const workbenchEvents = events.filter((e) => e.to === "workbench");
    expect(workbenchEvents.length).toBeLessThanOrEqual(1);
  });

  it("detached HEAD → detached HEAD: freshKeys contains only the delta files, not already-present workbench files", () => {
    // old-snapshot.ts was already on the workbench in the previous detached poll.
    // new-commit-file.ts is freshly visible after HEAD moved to the next commit.
    const first = state({
      detachedHead: true,
      currentBranch: null,
      files: [{ path: "old-snapshot.ts", status: "modified" }],
    });
    const second = state({
      detachedHead: true,
      currentBranch: null,
      files: [
        { path: "old-snapshot.ts", status: "modified" },
        { path: "new-commit-file.ts", status: "untracked" },
      ],
    });
    const events = detectMovements(first, second, counter);

    // The sole workbench event must highlight only the newly-appeared file.
    const workbenchEv = events.find((e) => e.to === "workbench");
    expect(workbenchEv).toBeDefined();
    expect(workbenchEv!.freshKeys).toContain("new-commit-file.ts");
    // The file that was already visible before the rebase step must NOT be highlighted.
    expect(workbenchEv!.freshKeys).not.toContain("old-snapshot.ts");
  });

  it("detached HEAD → detached HEAD: no event fires when workbench files are identical between polls", () => {
    // HEAD stays on the same commit between two polls — nothing changed.
    const snap = state({
      detachedHead: true,
      currentBranch: null,
      files: [{ path: "readme.md", status: "modified" }],
    });
    const events = detectMovements(snap, snap, counter);
    expect(events).toHaveLength(0);
  });

  it("detached HEAD → detached HEAD: no workbench-appearance event when all files were already on the workbench", () => {
    // Both polls share the exact same workbench files; only an unrelated field
    // (e.g. a commit subject) differs. The delta is empty → no event.
    const first = state({
      detachedHead: true,
      currentBranch: null,
      files: [
        { path: "alpha.ts", status: "modified" },
        { path: "beta.ts", status: "untracked" },
      ],
    });
    const second = state({
      detachedHead: true,
      currentBranch: null,
      files: [
        { path: "alpha.ts", status: "modified" },
        { path: "beta.ts", status: "untracked" },
      ],
    });
    const events = detectMovements(first, second, counter);
    const workbenchEvents = events.filter((e) => e.to === "workbench");
    expect(workbenchEvents).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Leaving detached HEAD: reattaching to a branch after inspecting an old commit
  // -------------------------------------------------------------------------

  it("leaving detached HEAD back to a branch populates freshKeys with newly-appeared workbench files", () => {
    // Before: detached HEAD — inspecting an old commit, no workbench files
    const prev = state({
      detachedHead: true,
      currentBranch: null,
      branches: [{ name: "main", isCurrent: false, headHash: "abc" }],
      files: [],
    });
    // After: reattached to main — two files appear on the workbench (e.g. from
    // uncommitted changes that were shelved while detached)
    const next = state({
      detachedHead: false,
      currentBranch: "main",
      branches: [{ name: "main", isCurrent: true, headHash: "abc" }],
      files: [
        { path: "reattached.ts", status: "modified" },
        { path: "notes.md", status: "untracked" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(ev).toBeDefined();
    // freshKeys must include the paths that newly appeared on the workbench
    expect(ev!.freshKeys).toContain("reattached.ts");
    expect(ev!.freshKeys).toContain("notes.md");
  });

  it("leaving detached HEAD back to a branch produces empty freshKeys when no new workbench files appear", () => {
    // Before: detached HEAD with a modified file visible on the workbench
    const prev = state({
      detachedHead: true,
      currentBranch: null,
      branches: [{ name: "main", isCurrent: false, headHash: "abc" }],
      files: [{ path: "carried.ts", status: "modified" }],
    });
    // After: reattached to main — the same file is still on the workbench
    // (no new files appeared as a result of the switch)
    const next = state({
      detachedHead: false,
      currentBranch: "main",
      branches: [{ name: "main", isCurrent: true, headHash: "abc" }],
      files: [{ path: "carried.ts", status: "modified" }],
    });
    const events = detectMovements(prev, next, counter);
    const ev = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(ev).toBeDefined();
    // carried.ts was already on the workbench before reattachment — must NOT be highlighted
    expect(ev!.freshKeys).toEqual([]);
  });

  it("detached HEAD → detached HEAD: file count decreases between polls — no workbench-appearance event fires", () => {
    // Scenario: during an interactive rebase HEAD moves from a commit with more
    // workbench files to a commit with fewer.  Only files disappear; no new
    // paths appear.  The strip must not emit a workbench-appearance event for
    // paths that no longer exist in the snapshot, and freshKeys must be empty.
    const first = state({
      detachedHead: true,
      currentBranch: null,
      files: [
        { path: "kept.ts", status: "modified" },
        { path: "removed-by-rebase.ts", status: "untracked" },
      ],
    });
    // Second poll: HEAD moved to an earlier commit that doesn't include
    // removed-by-rebase.ts — only kept.ts remains on the workbench.
    const second = state({
      detachedHead: true,
      currentBranch: null,
      files: [{ path: "kept.ts", status: "modified" }],
    });
    const events = detectMovements(first, second, counter);

    // No new paths appeared → no workbench-appearance event should fire.
    const workbenchEvents = events.filter((e) => e.to === "workbench");
    expect(workbenchEvents).toHaveLength(0);

    // freshKeys across all events must be empty — no stale path should be highlighted.
    const allFreshKeys = events.flatMap((e) => e.freshKeys);
    expect(allFreshKeys).toHaveLength(0);
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

// ---------------------------------------------------------------------------
// Compound: git pull --rebase (remote commits arrive + branch advances)
// ---------------------------------------------------------------------------

describe("compound: pull --rebase", () => {
  it("narrates incoming remote commits without emitting Sealed!", () => {
    const localCommit = makeCommit("local1", "My work", []);
    const remoteCommit = makeCommit("remote1", "Teammate work", []);
    // After rebase: local commit is replayed on top of the remote commit
    const rebasedLocal = makeCommit("local1r", "My work (rebased)", ["remote1"]);
    const prev = state({
      remotes: ["origin"],
      commits: [localCommit],
      remoteBranches: [{ name: "origin/main", headHash: "remote1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 1, behind: 1 },
    });
    const next = state({
      remotes: ["origin"],
      commits: [rebasedLocal, remoteCommit],
      remoteBranches: [{ name: "origin/main", headHash: "remote1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 1, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    // Remote commits arrived → narrated as coming from Shared Record
    const sharedToSealed = events.find((e) => e.from === "shared" && e.to === "sealed");
    expect(sharedToSealed).toBeDefined();
    // No "Sealed!" for the remote-sourced commits
    const wrongSeal = events.filter((e) => e.text.includes("Sealed!"));
    expect(wrongSeal).toHaveLength(0);
  });

  it("highest-priority movement wins: pull emits shared→sealed, not dock→sealed", () => {
    const remoteCommit = makeCommit("r1", "Remote commit", []);
    const prev = state({
      remotes: ["origin"],
      commits: [],
      remoteBranches: [{ name: "origin/main", headHash: "old1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 1 },
    });
    const next = state({
      remotes: ["origin"],
      commits: [remoteCommit],
      remoteBranches: [{ name: "origin/main", headHash: "r1" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    // Must not narrate as a local seal
    const dockToSealed = events.filter((e) => e.from === "dock" && e.to === "sealed");
    expect(dockToSealed).toHaveLength(0);
    // Must narrate as coming from the Shared Record
    const sharedToSealed = events.find((e) => e.from === "shared" && e.to === "sealed");
    expect(sharedToSealed).toBeDefined();
  });

  it("puts new commit hashes in freshKeys of the shared→sealed event (direct pull path)", () => {
    // Direct pull: remote heads move but behind was 0 — uses the fallback path
    // which does populate freshKeys with the arriving commit hashes.
    const remoteCommit = makeCommit("r2", "Remote feature", []);
    const prev = state({
      remotes: ["origin"],
      commits: [],
      remoteBranches: [{ name: "origin/main", headHash: "old2" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const next = state({
      remotes: ["origin"],
      commits: [remoteCommit],
      remoteBranches: [{ name: "origin/main", headHash: "r2" }],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    const sharedToSealed = events.find((e) => e.from === "shared" && e.to === "sealed");
    expect(sharedToSealed).toBeDefined();
    expect(sharedToSealed!.freshKeys).toContain("r2");
  });
});

// ---------------------------------------------------------------------------
// Compound: git stash pop (files restored to workbench)
// ---------------------------------------------------------------------------

describe("compound: git stash pop", () => {
  it("narrates files restored to the Workbench after a stash pop", () => {
    const prev = state({ files: [] });
    const next = state({
      files: [
        { path: "work.ts", status: "modified" },
        { path: "new-file.ts", status: "untracked" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    // Files appeared on the Workbench
    const ev = events.find((e) => e.to === "workbench");
    expect(ev).toBeDefined();
    expect(ev!.freshKeys).toContain("work.ts");
    // No spurious Sealed! emitted
    const wrongSeal = events.filter((e) => e.text.includes("Sealed!"));
    expect(wrongSeal).toHaveLength(0);
  });

  it("stash pop landing a conflict narrates the conflict, not a seal", () => {
    const prev = state({ files: [], mergeInProgress: false });
    const next = state({
      files: [{ path: "conflict.ts", status: "conflicted" }],
      mergeInProgress: true,
    });
    const events = detectMovements(prev, next, counter);
    const conflictEv = events.find((e) => e.to === "workbench" && /conflict/i.test(e.text));
    expect(conflictEv).toBeDefined();
    expect(conflictEv!.freshKeys).toContain("conflict.ts");
    const wrongSeal = events.filter((e) => e.text.includes("Sealed!"));
    expect(wrongSeal).toHaveLength(0);
  });

  it("stash pop is the sole event when no other state changes occur", () => {
    const prev = state({ files: [] });
    const next = state({
      files: [{ path: "stashed.ts", status: "modified" }],
    });
    const events = detectMovements(prev, next, counter);
    // Only one event: something appeared on the Workbench
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe("workbench");
  });
});

// ---------------------------------------------------------------------------
// isStaleGap — pure helper for reconnect re-baseline detection
//
// The TerritoryStrip component passes React Query's `dataUpdatedAt` (which
// advances on EVERY successful fetch, even when data is reference-identical)
// as `lastFetchedAt`.  The effect runs on every [repo, lastFetchedAt] change,
// so prevFetchedAtRef advances on every successful poll — stable polls never
// accumulate a false gap.
// ---------------------------------------------------------------------------

describe("isStaleGap", () => {
  it("returns false when prevFetchedAt is 0 (first load — no prior fetch)", () => {
    expect(isStaleGap(0, Date.now())).toBe(false);
  });

  it("returns false when consecutive polls are within the threshold", () => {
    const base = 1_000_000;
    // Simulate two polls 4 s apart (normal cadence)
    expect(isStaleGap(base, base + 4_000)).toBe(false);
    // One poll just below the threshold
    expect(isStaleGap(base, base + STALE_GAP_MS - 1)).toBe(false);
  });

  it("returns false when the gap exactly equals the threshold (boundary — strictly greater-than)", () => {
    const base = 1_000_000;
    expect(isStaleGap(base, base + STALE_GAP_MS)).toBe(false);
  });

  it("returns true when the gap exceeds the threshold (API was down)", () => {
    const base = 1_000_000;
    expect(isStaleGap(base, base + 30_000)).toBe(true);
    expect(isStaleGap(base, base + 60_000)).toBe(true);
  });

  it("returns false after recovery when polls resume at normal cadence", () => {
    // Simulate: gap fired once (stale = true, re-baselined).
    // The component then updates prevFetchedAtRef to currentFetchedAt.
    // Next poll is only 4 s later → not stale.
    const recovered = 2_000_000;
    expect(isStaleGap(recovered, recovered + 4_000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reconnect / re-baseline — detectMovements behaviour after a gap
//
// When isStaleGap returns true the component skips detectMovements and
// re-baselines prevRef.  These tests verify the pure-function layer produces
// correct output for the polls that immediately follow the re-baseline.
// ---------------------------------------------------------------------------

describe("reconnect / re-baseline (detectMovements)", () => {
  it("produces no events when prev and next are identical (clean re-baseline)", () => {
    // After a gap the component re-sets prevRef to the recovered snapshot.
    // The very next poll compares identical states → no movement narration.
    const snap = state({
      files: [{ path: "README.md", status: "modified" }],
      commits: [makeCommit("abc1234", "Initial commit", [])],
    });
    const events = detectMovements(snap, snap, counter);
    expect(events).toHaveLength(0);
  });

  it("correctly narrates a git-add performed after a re-baseline", () => {
    // First post-gap poll re-baselines. The next poll shows the file staged.
    const baseline = state({ files: [{ path: "work.ts", status: "modified" }] });
    const afterAdd  = state({ files: [{ path: "work.ts", status: "staged" }] });
    const events = detectMovements(baseline, afterAdd, counter);
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe("workbench");
    expect(events[0].to).toBe("dock");
    expect(events[0].freshKeys).toContain("work.ts");
  });

  it("correctly narrates a commit performed after a re-baseline", () => {
    const baseline    = state({ files: [{ path: "feat.ts", status: "staged" }], commits: [] });
    const afterCommit = state({ files: [], commits: [makeCommit("deadbeef", "Add feature", [])] });
    const events = detectMovements(baseline, afterCommit, counter);
    const seal = events.find((e) => e.from === "dock" && e.to === "sealed");
    expect(seal).toBeDefined();
    expect(seal!.text).toMatch(/Sealed!/);
    expect(seal!.freshKeys).toContain("deadbeef");
  });

  it("does not emit branch-switch events when lesson context changes across the gap", () => {
    // A different lessonId means the component does NOT call detectMovements at all.
    // This test documents what detectMovements would wrongly emit without that guard.
    const prevLesson = { ...base(), lessonId: "lesson-01", currentBranch: "main" };
    const nextLesson = { ...base(), lessonId: "lesson-02", currentBranch: "main" };
    const events = detectMovements(prevLesson, nextLesson, counter);
    // Branch names are identical, so no switch event even without the guard.
    const branchSwitch = events.filter((e) => e.from === "sealed" && e.to === "workbench");
    expect(branchSwitch).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Compound: commit then push in one poll cycle (sealed + pushed simultaneously)
// ---------------------------------------------------------------------------

describe("compound: commit then push in one poll cycle", () => {
  it("emits Sealed! when a local commit lands (dock was non-empty) even if already pushed", () => {
    const newCommit = makeCommit("abc123", "Add feature", []);
    const prev = state({
      remotes: ["origin"],
      files: [{ path: "feature.ts", status: "staged" }],
      commits: [],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    // Commit and push both happened before the next poll — dock cleared,
    // commit sealed, already pushed (ahead stays 0).
    const next = state({
      remotes: ["origin"],
      files: [],
      commits: [newCommit],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    const sealEv = events.find((e) => e.from === "dock" && e.to === "sealed");
    expect(sealEv).toBeDefined();
    expect(sealEv!.text).toMatch(/Sealed!/);
    expect(sealEv!.freshKeys).toContain("abc123");
  });

  it("emits both Sealed! and a push event when commit+push happen and ahead was 0 before", () => {
    // Commit + immediate push: ahead stays at 0 the whole time, but the new
    // commit is already in sync — the narration must acknowledge the push.
    const newCommit = makeCommit("abc123", "Add feature", []);
    const prev = state({
      remotes: ["origin"],
      files: [{ path: "feature.ts", status: "staged" }],
      commits: [],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const next = state({
      remotes: ["origin"],
      files: [],
      commits: [newCommit],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    // Seal event fires for the local commit
    const sealEv = events.find((e) => e.text.includes("Sealed!"));
    expect(sealEv).toBeDefined();
    // Push event also fires — commit was immediately synchronized
    const pushEv = events.find((e) => e.from === "sealed" && e.to === "shared");
    expect(pushEv).toBeDefined();
    expect(pushEv!.text).toMatch(/push/i);
    expect(pushEv!.text).toMatch(/1 commit/);
  });

  it("emits both Sealed! and push with correct total count when commit+push happen and ahead was > 0 before", () => {
    // Scenario: user had 1 unsent commit (ahead=1) plus staged changes.
    // They committed a 2nd change and immediately pushed everything.
    // Poll sees: staged gone, new commit appeared, ahead dropped from 1 to 0.
    // Total pushed = 1 (old unsent) + 1 (new sealed) = 2 commits.
    const prevCommit = makeCommit("prev1", "Previous commit", []);
    const newCommit = makeCommit("new1", "New commit", ["prev1"]);
    const prev = state({
      remotes: ["origin"],
      files: [{ path: "feature.ts", status: "staged" }],
      commits: [prevCommit],
      syncStatus: { remoteBranch: "origin/main", ahead: 1, behind: 0 },
    });
    const next = state({
      remotes: ["origin"],
      files: [],
      commits: [newCommit, prevCommit],
      syncStatus: { remoteBranch: "origin/main", ahead: 0, behind: 0 },
    });
    const events = detectMovements(prev, next, counter);
    // Seal event for the new local commit
    const sealEv = events.find((e) => e.from === "dock" && e.to === "sealed");
    expect(sealEv).toBeDefined();
    expect(sealEv!.text).toMatch(/Sealed!/);
    // Push event must report BOTH the old unsent commit AND the new one = 2 total
    const pushEv = events.find((e) => e.from === "sealed" && e.to === "shared");
    expect(pushEv).toBeDefined();
    expect(pushEv!.text).toMatch(/push/i);
    expect(pushEv!.text).toMatch(/2 commit/);
  });
});

// ---------------------------------------------------------------------------
// Compound: branch switch + workbench files appearing in the same poll cycle
// ---------------------------------------------------------------------------

describe("compound: branch switch + workbench files appear in same poll", () => {
  it("emits the branch-switch event and no duplicate workbench-appearance event", () => {
    // Before: on main, clean workbench
    const prev = state({
      currentBranch: "main",
      branches: [
        { name: "main", isCurrent: true, headHash: "abc" },
        { name: "feature", isCurrent: false, headHash: "abc" },
      ],
      files: [],
    });
    // After: switched to feature, which has untracked/modified files now visible
    const next = state({
      currentBranch: "feature",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "feature", isCurrent: true, headHash: "abc" },
      ],
      files: [
        { path: "feature.ts", status: "untracked" },
        { path: "README.md", status: "modified" },
      ],
    });
    const events = detectMovements(prev, next, counter);

    // The branch-switch event must be present
    const switchEv = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(switchEv).toBeDefined();
    expect(switchEv!.text).toMatch(/feature/);
    expect(switchEv!.text).toMatch(/Switched/i);

    // No separate workbench-appearance event must fire for the new files
    const appearanceEvents = events.filter(
      (e) => e.to === "workbench" && e !== switchEv,
    );
    expect(appearanceEvents).toHaveLength(0);
  });

  it("emits new-branch event and no duplicate workbench-appearance when branch is created with dirty files", () => {
    // Before: on main, clean workbench
    const prev = state({
      currentBranch: "main",
      branches: [{ name: "main", isCurrent: true, headHash: "abc" }],
      files: [],
    });
    // After: switched to a brand-new branch with a modified file visible
    const next = state({
      currentBranch: "experiment",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "experiment", isCurrent: true, headHash: "abc" },
      ],
      files: [{ path: "scratch.ts", status: "modified" }],
    });
    const events = detectMovements(prev, next, counter);

    // Must narrate branch creation
    const createEv = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(createEv).toBeDefined();
    expect(createEv!.text).toMatch(/experiment/);
    expect(createEv!.text).toMatch(/created|new timeline/i);

    // No redundant workbench-appearance event for the modified file
    const extra = events.filter((e) => e.to === "workbench" && e !== createEv);
    expect(extra).toHaveLength(0);
  });

  it("total event count is exactly 1 when only branch-switch + file appearance occur together", () => {
    const prev = state({
      currentBranch: "main",
      branches: [
        { name: "main", isCurrent: true, headHash: "abc" },
        { name: "other", isCurrent: false, headHash: "abc" },
      ],
      files: [],
    });
    const next = state({
      currentBranch: "other",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "other", isCurrent: true, headHash: "abc" },
      ],
      files: [
        { path: "a.ts", status: "untracked" },
        { path: "b.ts", status: "modified" },
      ],
    });
    const events = detectMovements(prev, next, counter);
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe("sealed");
    expect(events[0].to).toBe("workbench");
  });
});

// ---------------------------------------------------------------------------
// Branch switch: staged files and freshKeys
//
// workbenchFiles() includes staged_and_modified (the file has both staged and
// unstaged changes) so those paths are eligible for the freshKeys diff.  A
// staged_and_modified file that exists on BOTH sides of the switch was not
// brought in by the switch and must be excluded; one that appears only on the
// new branch was brought in and must be included.
// Pure "staged" files are never in workbenchFiles, so they cannot become
// freshKeys regardless, but the staged_and_modified case needs explicit cover.
// ---------------------------------------------------------------------------

describe("branch switch: staged files and freshKeys", () => {
  it("does not include a staged_and_modified file that carries over from the old branch", () => {
    // The file was already staged_and_modified on main before the switch.
    // After switching to feature it remains staged_and_modified — it was not
    // brought in by the switch and must not receive the orange highlight ring.
    const prev = state({
      currentBranch: "main",
      branches: [
        { name: "main", isCurrent: true, headHash: "abc" },
        { name: "feature", isCurrent: false, headHash: "def" },
      ],
      files: [{ path: "carry.ts", status: "staged_and_modified" }],
    });
    const next = state({
      currentBranch: "feature",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "feature", isCurrent: true, headHash: "def" },
      ],
      // carry.ts is still staged_and_modified after the switch — it carried over.
      files: [{ path: "carry.ts", status: "staged_and_modified" }],
    });
    const events = detectMovements(prev, next, counter);
    const switchEv = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(switchEv).toBeDefined();
    // The file that carried over must NOT be highlighted
    expect(switchEv!.freshKeys).not.toContain("carry.ts");
  });

  it("includes a staged_and_modified file that appears only after the branch switch", () => {
    // branch-specific.ts did not exist on main at all; it is unique to feature
    // and becomes visible (staged_and_modified) only after the switch.
    // That means it was brought in by the switch and must appear in freshKeys.
    const prev = state({
      currentBranch: "main",
      branches: [
        { name: "main", isCurrent: true, headHash: "abc" },
        { name: "feature", isCurrent: false, headHash: "def" },
      ],
      files: [],
    });
    const next = state({
      currentBranch: "feature",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "feature", isCurrent: true, headHash: "def" },
      ],
      files: [{ path: "branch-specific.ts", status: "staged_and_modified" }],
    });
    const events = detectMovements(prev, next, counter);
    const switchEv = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(switchEv).toBeDefined();
    // The file that only appeared because of the switch must be highlighted
    expect(switchEv!.freshKeys).toContain("branch-specific.ts");
  });

  it("does not include a purely staged file that carries over from the old branch", () => {
    // staged.ts has status "staged" on both branches — it was already on the
    // Loading Dock before the switch and remains there afterwards.
    // workbenchFiles() never includes purely staged files, so this file must
    // never appear in freshKeys regardless of what future refactors do inside
    // the branch-switch block.
    const prev = state({
      currentBranch: "main",
      branches: [
        { name: "main", isCurrent: true, headHash: "abc" },
        { name: "feature", isCurrent: false, headHash: "def" },
      ],
      files: [{ path: "staged.ts", status: "staged" }],
    });
    const next = state({
      currentBranch: "feature",
      branches: [
        { name: "main", isCurrent: false, headHash: "abc" },
        { name: "feature", isCurrent: true, headHash: "def" },
      ],
      // staged.ts is still purely staged after the switch — it carried over.
      files: [{ path: "staged.ts", status: "staged" }],
    });
    const events = detectMovements(prev, next, counter);
    const switchEv = events.find((e) => e.from === "sealed" && e.to === "workbench");
    expect(switchEv).toBeDefined();
    // A purely staged file must NOT receive the orange highlight ring
    expect(switchEv!.freshKeys).not.toContain("staged.ts");
  });
});
