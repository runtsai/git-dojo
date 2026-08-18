import { describe, it, expect, beforeEach } from "vitest";
import { layoutGraph, colorForHash } from "./commit-timeline";
import type { RepoCommit } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _hash = 0;
function makeCommit(subject: string, parents: string[] = []): RepoCommit {
  const hash = `commit${String(++_hash).padStart(3, "0")}`;
  return {
    hash,
    shortHash: hash.slice(0, 7),
    subject,
    authorName: "Test",
    date: "2024-01-01T00:00:00Z",
    refs: [],
    parents,
  };
}

beforeEach(() => { _hash = 0; });

// ---------------------------------------------------------------------------
// Linear history (single branch)
// ---------------------------------------------------------------------------

describe("linear history", () => {
  it("assigns all commits to column 0", () => {
    const c1 = makeCommit("Initial");
    const c2 = makeCommit("Second", [c1.hash]);
    const c3 = makeCommit("Third", [c2.hash]);
    const { rows } = layoutGraph([c3, c2, c1]);
    expect(rows.every((r) => r.col === 0)).toBe(true);
  });

  it("produces no edges for a single commit", () => {
    const c1 = makeCommit("Only");
    const { edges } = layoutGraph([c1]);
    expect(edges).toHaveLength(0);
  });

  it("produces one edge for two linear commits", () => {
    const c1 = makeCommit("A");
    const c2 = makeCommit("B", [c1.hash]);
    const { rows, edges } = layoutGraph([c2, c1]);
    expect(edges).toHaveLength(1);
    const [e] = edges;
    // edge runs from the child (row 0) to the parent (row 1)
    expect(e.fromRow).toBe(0);
    expect(e.toRow).toBe(1);
    // both endpoints must be on the same column for a linear graph
    expect(e.fromCol).toBe(rows[0]!.col);
    expect(e.toCol).toBe(rows[1]!.col);
  });
});

// ---------------------------------------------------------------------------
// Divergent branches (two tips)
// ---------------------------------------------------------------------------

describe("divergent branches", () => {
  it("assigns tips to different columns", () => {
    //   A (col 0) — the shared root
    //   |\
    //   B  C  — diverged tips (both children of A; presented newest first)
    const a = makeCommit("Root");
    const b = makeCommit("Branch-B", [a.hash]);
    const c = makeCommit("Branch-C", [a.hash]);
    // commits ordered newest first: b and c are tips, a is the shared base
    const { rows } = layoutGraph([b, c, a]);
    const colB = rows.find((r) => r.commit.hash === b.hash)!.col;
    const colC = rows.find((r) => r.commit.hash === c.hash)!.col;
    expect(colB).not.toBe(colC);
  });

  it("every edge endpoint lands on its parent's actual column", () => {
    const a = makeCommit("Root");
    const b = makeCommit("Branch-B", [a.hash]);
    const c = makeCommit("Branch-C", [a.hash]);
    const { rows, edges } = layoutGraph([b, c, a]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(colByHash.get(parentCommit.hash));
    }
  });
});

// ---------------------------------------------------------------------------
// Merge commit
// ---------------------------------------------------------------------------

describe("merge commit", () => {
  it("merge commit edge endpoints land on their parents' final columns", () => {
    //  C  ← merge commit (parents: B, D)
    //  |  \
    //  B   D  ← two branches
    //  |   |
    //  A   A  ← shared root
    const a = makeCommit("Root");
    const b = makeCommit("Feature-B", [a.hash]);
    const d = makeCommit("Feature-D", [a.hash]);
    const mergeC = makeCommit("Merge B+D", [b.hash, d.hash]);
    // newest first
    const { rows, edges } = layoutGraph([mergeC, b, d, a]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(
        colByHash.get(parentCommit.hash),
        `edge to ${parentCommit.subject} should land on col ${colByHash.get(parentCommit.hash)}, got ${e.toCol}`,
      );
    }
  });

  it("merge commit is placed on some column (not undefined)", () => {
    const a = makeCommit("Root");
    const b = makeCommit("Branch", [a.hash]);
    const m = makeCommit("Merge", [b.hash, a.hash]);
    const { rows } = layoutGraph([m, b, a]);
    const mergeRow = rows.find((r) => r.commit.hash === m.hash)!;
    expect(mergeRow.col).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// maxCol
// ---------------------------------------------------------------------------

describe("maxCol", () => {
  it("is 0 for a linear history", () => {
    const a = makeCommit("A");
    const b = makeCommit("B", [a.hash]);
    const { maxCol } = layoutGraph([b, a]);
    expect(maxCol).toBe(0);
  });

  it("is at least 1 when two divergent branches exist", () => {
    const a = makeCommit("Root");
    const b = makeCommit("B", [a.hash]);
    const c = makeCommit("C", [a.hash]);
    const { maxCol } = layoutGraph([b, c, a]);
    expect(maxCol).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Edge resolution: no deferred -1 endpoints survive
// ---------------------------------------------------------------------------

describe("edge resolution", () => {
  it("all edge toCol values are resolved (no -1 sentinel left)", () => {
    const a = makeCommit("Root");
    const b = makeCommit("Branch", [a.hash]);
    const c = makeCommit("Branch-C", [a.hash]);
    const m = makeCommit("Merge", [b.hash, c.hash]);
    const { edges } = layoutGraph([m, b, c, a]);
    for (const e of edges) {
      expect(e.toCol).not.toBe(-1);
      expect(e.fromCol).not.toBe(-1);
    }
  });
});

// ---------------------------------------------------------------------------
// 3+ simultaneous branches
// ---------------------------------------------------------------------------

describe("three simultaneous branches", () => {
  // History shape (newest first in array):
  //   B  C  D   ← three tips, all children of A
  //    \ | /
  //      A       ← shared root
  let a: ReturnType<typeof makeCommit>;
  let b: ReturnType<typeof makeCommit>;
  let c: ReturnType<typeof makeCommit>;
  let d: ReturnType<typeof makeCommit>;
  beforeEach(() => {
    a = makeCommit("Root");
    b = makeCommit("Branch-B", [a.hash]);
    c = makeCommit("Branch-C", [a.hash]);
    d = makeCommit("Branch-D", [a.hash]);
  });

  it("each tip gets a unique column", () => {
    const { rows } = layoutGraph([b, c, d, a]);
    const colB = rows.find((r) => r.commit.hash === b.hash)!.col;
    const colC = rows.find((r) => r.commit.hash === c.hash)!.col;
    const colD = rows.find((r) => r.commit.hash === d.hash)!.col;
    expect(colB).not.toBe(colC);
    expect(colB).not.toBe(colD);
    expect(colC).not.toBe(colD);
  });

  it("every edge endpoint lands on its parent's actual column", () => {
    const { rows, edges } = layoutGraph([b, c, d, a]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(colByHash.get(parentCommit.hash));
    }
  });

  it("maxCol is at least 2 when three branches exist simultaneously", () => {
    const { maxCol } = layoutGraph([b, c, d, a]);
    expect(maxCol).toBeGreaterThanOrEqual(2);
  });

  it("no -1 sentinel survives resolution with three branches", () => {
    const { edges } = layoutGraph([b, c, d, a]);
    for (const e of edges) {
      expect(e.toCol).not.toBe(-1);
      expect(e.fromCol).not.toBe(-1);
    }
  });
});

describe("four simultaneous branches", () => {
  // History shape (newest first in array):
  //   B  C  D  E  ← four tips, all children of A
  //    \ | / | /
  //        A      ← shared root
  it("each tip gets a unique column", () => {
    const a = makeCommit("Root");
    const b = makeCommit("Branch-B", [a.hash]);
    const c = makeCommit("Branch-C", [a.hash]);
    const d = makeCommit("Branch-D", [a.hash]);
    const e = makeCommit("Branch-E", [a.hash]);
    const { rows } = layoutGraph([b, c, d, e, a]);
    const cols = [b, c, d, e].map((x) => rows.find((r) => r.commit.hash === x.hash)!.col);
    // All four columns must be distinct
    const unique = new Set(cols);
    expect(unique.size).toBe(4);
  });

  it("every edge endpoint lands on its parent's actual column", () => {
    const a = makeCommit("Root");
    const b = makeCommit("Branch-B", [a.hash]);
    const c = makeCommit("Branch-C", [a.hash]);
    const d = makeCommit("Branch-D", [a.hash]);
    const e = makeCommit("Branch-E", [a.hash]);
    const { rows, edges } = layoutGraph([b, c, d, e, a]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const edge of edges) {
      const parentCommit = rows[edge.toRow]!.commit;
      expect(edge.toCol).toBe(colByHash.get(parentCommit.hash));
    }
  });

  it("maxCol is at least 3 when four branches exist simultaneously", () => {
    const a = makeCommit("Root");
    const b = makeCommit("Branch-B", [a.hash]);
    const c = makeCommit("Branch-C", [a.hash]);
    const d = makeCommit("Branch-D", [a.hash]);
    const e = makeCommit("Branch-E", [a.hash]);
    const { maxCol } = layoutGraph([b, c, d, e, a]);
    expect(maxCol).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Back-to-back merges (fan-in): freed lanes are reused in order
// ---------------------------------------------------------------------------

describe("back-to-back merges (fan-in)", () => {
  // History shape (newest first in array):
  //
  //   M2          ← merge of M1 and D  (row 0)
  //   |  \
  //   M1   D      ← merge of B and C   (rows 1, 2)
  //   | \  |
  //   B  C  |     ← two side branches  (rows 3, 4)
  //   |  |  |
  //   A  A  A     ← shared root        (row 5)
  //
  // When M1 is laid out, C's lane is freed.
  // When M2 is laid out, D's lane is freed.
  // A subsequent tip should reuse the lowest-index freed lane.

  it("all edge endpoints land on the parent's actual column", () => {
    const a = makeCommit("Root");
    const b = makeCommit("Feature-B", [a.hash]);
    const c = makeCommit("Feature-C", [a.hash]);
    const d = makeCommit("Feature-D", [a.hash]);
    const m1 = makeCommit("Merge B+C", [b.hash, c.hash]);
    const m2 = makeCommit("Merge M1+D", [m1.hash, d.hash]);
    // newest first
    const { rows, edges } = layoutGraph([m2, m1, b, c, d, a]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(colByHash.get(parentCommit.hash));
    }
  });

  it("no -1 sentinel survives resolution in a fan-in graph", () => {
    const a = makeCommit("Root");
    const b = makeCommit("Feature-B", [a.hash]);
    const c = makeCommit("Feature-C", [a.hash]);
    const d = makeCommit("Feature-D", [a.hash]);
    const m1 = makeCommit("Merge B+C", [b.hash, c.hash]);
    const m2 = makeCommit("Merge M1+D", [m1.hash, d.hash]);
    const { edges } = layoutGraph([m2, m1, b, c, d, a]);
    for (const e of edges) {
      expect(e.toCol).not.toBe(-1);
      expect(e.fromCol).not.toBe(-1);
    }
  });

  it("maxCol stays bounded after lanes are freed by a merge (no unnecessary lane expansion)", () => {
    // B (col 0) and C (col 1) are simultaneous branches; M1 merges them.
    // After A (the shared root) is processed both lanes collapse into one and become free.
    // maxCol must remain 1 — no commit should force a third column to open.
    const a = makeCommit("Root");
    const b = makeCommit("Feature-B", [a.hash]);
    const c = makeCommit("Feature-C", [a.hash]);
    const m1 = makeCommit("Merge B+C", [b.hash, c.hash]);
    const { maxCol } = layoutGraph([m1, b, c, a]);
    // Two simultaneous branches need exactly 2 columns (0 and 1); maxCol must be 1.
    expect(maxCol).toBe(1);
  });

  it("back-to-back merges produce correct unique columns for all simultaneous branches", () => {
    // Three branches B, C, D exist simultaneously before any merge.
    // Verify they each sit on distinct columns.
    const a = makeCommit("Root");
    const b = makeCommit("Feature-B", [a.hash]);
    const c = makeCommit("Feature-C", [a.hash]);
    const d = makeCommit("Feature-D", [a.hash]);
    const m1 = makeCommit("Merge B+C", [b.hash, c.hash]);
    const m2 = makeCommit("Merge M1+D", [m1.hash, d.hash]);
    const { rows } = layoutGraph([m2, m1, b, c, d, a]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    // At the point B, C, D are all live simultaneously they must occupy distinct columns.
    const colB = colByHash.get(b.hash)!;
    const colC = colByHash.get(c.hash)!;
    const colD = colByHash.get(d.hash)!;
    expect(colB).not.toBe(colC);
    expect(colB).not.toBe(colD);
    expect(colC).not.toBe(colD);
  });
});

// ---------------------------------------------------------------------------
// Branch survives its own merge (merged-in branch continues forward)
// ---------------------------------------------------------------------------

describe("branch survives its own merge", () => {
  // History shape (newest first in array):
  //
  //   b2            ← branch continues AFTER it was merged into main  (row 0)
  //   |
  //   b1            ← this commit is BOTH a merge parent AND has a child on the branch  (row 3)
  //   |  \
  //   |   merge     ← merge commit on main: parents [main1, b1]       (row 1)
  //   |   |
  //   |  main1                                                         (row 2)
  //   |   |
  //   root                                                             (row 4)
  //
  // b1 sits in two roles simultaneously:
  //   • it is the second parent of `merge`  (branch was merged in)
  //   • it is the first parent of `b2`      (branch kept going)
  // This topology can cause column re-assignment and crossing edge lines.

  let root: ReturnType<typeof makeCommit>;
  let main1: ReturnType<typeof makeCommit>;
  let b1: ReturnType<typeof makeCommit>;
  let b2: ReturnType<typeof makeCommit>;
  let merge: ReturnType<typeof makeCommit>;

  beforeEach(() => {
    root  = makeCommit("Root");
    main1 = makeCommit("Main-1",  [root.hash]);
    b1    = makeCommit("Branch-1",[root.hash]);
    merge = makeCommit("Merge B1 into main", [main1.hash, b1.hash]);
    b2    = makeCommit("Branch-2",[b1.hash]);
  });

  it("every edge endpoint lands on the parent's actual column", () => {
    // newest first: b2 is the tip on the still-live branch, merge is on main
    const { rows, edges } = layoutGraph([b2, merge, main1, b1, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(
        colByHash.get(parentCommit.hash),
        `edge to "${parentCommit.subject}" should land on col ${colByHash.get(parentCommit.hash)}, got ${e.toCol}`,
      );
    }
  });

  it("no -1 sentinel survives when a branch outlives its own merge", () => {
    const { edges } = layoutGraph([b2, merge, main1, b1, root]);
    for (const e of edges) {
      expect(e.toCol).not.toBe(-1);
      expect(e.fromCol).not.toBe(-1);
    }
  });

  it("b1 and b2 sit on the same column (branch lane is preserved after the merge)", () => {
    const { rows } = layoutGraph([b2, merge, main1, b1, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    expect(colByHash.get(b1.hash)).toBe(colByHash.get(b2.hash));
  });

  it("b1 and merge sit on different columns (they coexist in the graph)", () => {
    const { rows } = layoutGraph([b2, merge, main1, b1, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    expect(colByHash.get(b1.hash)).not.toBe(colByHash.get(merge.hash));
  });

  it("maxCol is at least 1 (two lanes are open while branch and main coexist)", () => {
    const { maxCol } = layoutGraph([b2, merge, main1, b1, root]);
    expect(maxCol).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Long-running branch merged twice into main
// ---------------------------------------------------------------------------

describe("long-running branch merged twice into main", () => {
  // Topology (newest → oldest, left = branch, right = main):
  //
  //   b4              ← branch continues after second merge  (row 0)
  //   |
  //   b3       merge2 ← second merge: parents [main2, b3]   (rows 1, 2 or swapped)
  //   |        |
  //   b2      main2   ← main advances between merges        (row 3)
  //   |        |
  //   b1      merge1  ← first merge: parents [main1, b1]   (rows 4, 5 or swapped)
  //   |        |
  //   |       main1                                          (row 6)
  //   |        |
  //   root                                                   (row 7 or 8)
  //
  // The branch (b1→b2→b3→b4) is merged into main at two separate points.
  // Between the two merges the branch keeps accumulating commits (b2, b3).
  // After the second merge the branch continues (b4).
  // This topology can cause lane re-assignment that produces crossing edges.

  let root: ReturnType<typeof makeCommit>;
  let main1: ReturnType<typeof makeCommit>;
  let main2: ReturnType<typeof makeCommit>;
  let b1: ReturnType<typeof makeCommit>;
  let b2: ReturnType<typeof makeCommit>;
  let b3: ReturnType<typeof makeCommit>;
  let b4: ReturnType<typeof makeCommit>;
  let merge1: ReturnType<typeof makeCommit>;
  let merge2: ReturnType<typeof makeCommit>;

  beforeEach(() => {
    root   = makeCommit("Root");
    main1  = makeCommit("Main-1",  [root.hash]);
    b1     = makeCommit("Branch-1",[root.hash]);
    merge1 = makeCommit("Merge-1-into-main", [main1.hash, b1.hash]);
    b2     = makeCommit("Branch-2",[b1.hash]);
    main2  = makeCommit("Main-2",  [merge1.hash]);
    b3     = makeCommit("Branch-3",[b2.hash]);
    merge2 = makeCommit("Merge-2-into-main", [main2.hash, b3.hash]);
    b4     = makeCommit("Branch-4",[b3.hash]);
  });

  it("every edge endpoint lands on its parent's actual column", () => {
    // newest first: b4 and merge2 are tips; parents must follow
    const { rows, edges } = layoutGraph([b4, merge2, main2, b3, merge1, b2, main1, b1, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(
        colByHash.get(parentCommit.hash),
        `edge to "${parentCommit.subject}" should land on col ${colByHash.get(parentCommit.hash)}, got ${e.toCol}`,
      );
    }
  });

  it("no -1 sentinel survives when a branch is merged twice", () => {
    const { edges } = layoutGraph([b4, merge2, main2, b3, merge1, b2, main1, b1, root]);
    for (const e of edges) {
      expect(e.toCol).not.toBe(-1);
      expect(e.fromCol).not.toBe(-1);
    }
  });

  it("branch commits all sit on the same column (lane is preserved across both merges)", () => {
    const { rows } = layoutGraph([b4, merge2, main2, b3, merge1, b2, main1, b1, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    // b1 → b2 → b3 → b4 must share a single column so no crossing occurs.
    const branchCol = colByHash.get(b1.hash)!;
    expect(colByHash.get(b2.hash)).toBe(branchCol);
    expect(colByHash.get(b3.hash)).toBe(branchCol);
    expect(colByHash.get(b4.hash)).toBe(branchCol);
  });

  it("merge commits sit on a different column than the branch (lanes never overlap)", () => {
    const { rows } = layoutGraph([b4, merge2, main2, b3, merge1, b2, main1, b1, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    const branchCol = colByHash.get(b1.hash)!;
    expect(colByHash.get(merge1.hash)).not.toBe(branchCol);
    expect(colByHash.get(merge2.hash)).not.toBe(branchCol);
  });

  it("maxCol is at least 1 (two lanes are open while branch and main coexist)", () => {
    const { maxCol } = layoutGraph([b4, merge2, main2, b3, merge1, b2, main1, b1, root]);
    expect(maxCol).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Long-running branch merged three times into main
// ---------------------------------------------------------------------------

describe("long-running branch merged three times into main", () => {
  // Topology (newest → oldest, left = branch, right = main):
  //
  //   b5              ← branch continues after third merge  (tip)
  //   |
  //   b4       merge3 ← third merge:  parents [main3, b4]
  //   |        |
  //   b3      main3   ← main advances between second and third merge
  //   |        |
  //   b2      merge2  ← second merge: parents [main2, b2]
  //   |        |
  //   b1      main2   ← main advances between first and second merge
  //   |        |
  //   |       merge1  ← first merge:  parents [main1, b1]
  //   |        |
  //   |       main1   ← main advances before first merge
  //   |        |
  //   root
  //
  // The branch (b1→b2→b3→b4→b5) is merged into main at three separate points.
  // Between merges the branch keeps accumulating commits, and continues forward
  // after the last merge. This topology applies additional pressure to lane
  // re-assignment and can expose column-overlap bugs the double-merge case misses.

  let root: ReturnType<typeof makeCommit>;
  let main1: ReturnType<typeof makeCommit>;
  let main2: ReturnType<typeof makeCommit>;
  let main3: ReturnType<typeof makeCommit>;
  let b1: ReturnType<typeof makeCommit>;
  let b2: ReturnType<typeof makeCommit>;
  let b3: ReturnType<typeof makeCommit>;
  let b4: ReturnType<typeof makeCommit>;
  let b5: ReturnType<typeof makeCommit>;
  let merge1: ReturnType<typeof makeCommit>;
  let merge2: ReturnType<typeof makeCommit>;
  let merge3: ReturnType<typeof makeCommit>;

  beforeEach(() => {
    root   = makeCommit("Root");
    main1  = makeCommit("Main-1",  [root.hash]);
    b1     = makeCommit("Branch-1", [root.hash]);
    merge1 = makeCommit("Merge-1-into-main", [main1.hash, b1.hash]);
    b2     = makeCommit("Branch-2", [b1.hash]);
    main2  = makeCommit("Main-2",  [merge1.hash]);
    merge2 = makeCommit("Merge-2-into-main", [main2.hash, b2.hash]);
    b3     = makeCommit("Branch-3", [b2.hash]);
    main3  = makeCommit("Main-3",  [merge2.hash]);
    b4     = makeCommit("Branch-4", [b3.hash]);
    merge3 = makeCommit("Merge-3-into-main", [main3.hash, b4.hash]);
    b5     = makeCommit("Branch-5", [b4.hash]);
  });

  // Newest-first ordering for all tests in this suite.
  // Tips: b5 (branch continues) and merge3 (latest main tip).
  function commits() {
    return [b5, merge3, main3, b4, merge2, b3, main2, b2, merge1, b1, main1, root];
  }

  it("every edge endpoint lands on its parent's actual column", () => {
    const { rows, edges } = layoutGraph(commits());
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(
        colByHash.get(parentCommit.hash),
        `edge to "${parentCommit.subject}" should land on col ${colByHash.get(parentCommit.hash)}, got ${e.toCol}`,
      );
    }
  });

  it("no -1 sentinel survives when a branch is merged three times", () => {
    const { edges } = layoutGraph(commits());
    for (const e of edges) {
      expect(e.toCol).not.toBe(-1);
      expect(e.fromCol).not.toBe(-1);
    }
  });

  it("all branch commits sit on the same column (lane preserved across all three merges)", () => {
    const { rows } = layoutGraph(commits());
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    const branchCol = colByHash.get(b1.hash)!;
    expect(colByHash.get(b2.hash)).toBe(branchCol);
    expect(colByHash.get(b3.hash)).toBe(branchCol);
    expect(colByHash.get(b4.hash)).toBe(branchCol);
    expect(colByHash.get(b5.hash)).toBe(branchCol);
  });

  it("all three merge commits sit on a different column than the branch (lanes never overlap)", () => {
    const { rows } = layoutGraph(commits());
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    const branchCol = colByHash.get(b1.hash)!;
    expect(colByHash.get(merge1.hash)).not.toBe(branchCol);
    expect(colByHash.get(merge2.hash)).not.toBe(branchCol);
    expect(colByHash.get(merge3.hash)).not.toBe(branchCol);
  });

  it("maxCol is at least 1 (two lanes open while branch and main coexist across three merges)", () => {
    const { maxCol } = layoutGraph(commits());
    expect(maxCol).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Color stability: same commit always gets the same color
// ---------------------------------------------------------------------------

describe("colorForHash", () => {
  it("returns a non-empty string", () => {
    expect(colorForHash("abc123")).toBeTruthy();
  });

  it("is deterministic — same input always produces the same output", () => {
    expect(colorForHash("deadbeef")).toBe(colorForHash("deadbeef"));
  });

  it("different hashes can produce different colors", () => {
    // At least two of these must differ (pigeonhole: 6 colors, many hashes)
    const hashes = ["aaa", "bbb", "ccc", "ddd", "eee", "fff", "ggg", "hhh"];
    const colors = hashes.map(colorForHash);
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Color is adjacency-aware: what still holds unconditionally
//
// Adjacency avoidance means a commit's color can vary across layout
// configurations (the same commit adjacent to different neighbors may receive
// different palette entries). What IS still guaranteed:
//   • A commit on a lane with no active adjacent lanes gets colorForHash.
//   • Within a single layout, concurrently-adjacent lanes have distinct colors.
//   • Merge extra-parent edge color matches the extra-parent's node color.
//
// The cross-layout stability tests (same commit in differently-filtered or
// reordered lists) have been intentionally removed — they conflict with the
// adjacency-avoidance contract.
// ---------------------------------------------------------------------------

describe("isolated lane always gets its hash-preferred color", () => {
  it("a single commit with no neighbors gets colorForHash", () => {
    const only = makeCommit("Only");
    const { rows } = layoutGraph([only]);
    expect(rows[0]!.color).toBe(colorForHash(only.hash));
  });

  it("linear chain: every commit is on col 0 with no neighbors and gets colorForHash", () => {
    const a = makeCommit("A");
    const b = makeCommit("B", [a.hash]);
    const c = makeCommit("C", [b.hash]);
    const { rows } = layoutGraph([c, b, a]);
    for (const r of rows) {
      expect(r.color).toBe(colorForHash(r.commit.hash));
    }
  });
});

// ---------------------------------------------------------------------------
// Adjacency avoidance corrects hash collisions — deterministic fixtures
// ---------------------------------------------------------------------------

/**
 * Scans sequentially-generated commit hashes and returns the first two that
 * map to the same LANE_COLORS entry. With 6 palette slots and 20 candidates,
 * pigeonhole guarantees a collision.
 */
function findCollidingPair(
  root: ReturnType<typeof makeCommit>,
): [ReturnType<typeof makeCommit>, ReturnType<typeof makeCommit>] {
  const candidates: ReturnType<typeof makeCommit>[] = [];
  for (let k = 0; k < 20; k++) {
    candidates.push(makeCommit(`Cand-${k}`, [root.hash]));
  }
  const byColor = new Map<string, ReturnType<typeof makeCommit>[]>();
  for (const c of candidates) {
    const pref = colorForHash(c.hash);
    if (!byColor.has(pref)) byColor.set(pref, []);
    byColor.get(pref)!.push(c);
  }
  const group = [...byColor.values()].find((g) => g.length >= 2);
  if (!group || group.length < 2) throw new Error("No palette collision found — pigeonhole invariant violated");
  return [group[0]!, group[1]!];
}

describe("adjacency avoidance corrects hash collisions", () => {
  it("two adjacent tips that prefer the same palette color get different assigned colors", () => {
    const root = makeCommit("Root");
    const [tip1, tip2] = findCollidingPair(root);

    // Confirm the preferred colors genuinely collide.
    expect(colorForHash(tip1.hash)).toBe(colorForHash(tip2.hash));

    const { rows } = layoutGraph([tip1, tip2, root]);
    const r1 = rows.find((r) => r.commit.hash === tip1.hash)!;
    const r2 = rows.find((r) => r.commit.hash === tip2.hash)!;

    // They must be placed on adjacent columns.
    expect(Math.abs(r1.col - r2.col)).toBe(1);
    // Despite the preferred-color collision, assigned colors must differ.
    expect(r1.color).not.toBe(r2.color);
  });

  it("merge commit and adjacent extra-parent lane always have different colors", () => {
    // merge is on col 0; extra-parent lane opens on col 1 (adjacent).
    // Regardless of hash-preferred color, adjacency must be respected.
    const root = makeCommit("Root");
    const fp   = makeCommit("FirstParent",  [root.hash]);
    const ep   = makeCommit("ExtraParent",  [root.hash]);
    const m    = makeCommit("Merge",        [fp.hash, ep.hash]);

    const { rows } = layoutGraph([m, fp, ep, root]);
    const mergeRow = rows.find((r) => r.commit.hash === m.hash)!;
    const epRow    = rows.find((r) => r.commit.hash === ep.hash)!;

    expect(Math.abs(mergeRow.col - epRow.col)).toBe(1);
    expect(mergeRow.color).not.toBe(epRow.color);
  });

  it("merge extra-parent edge color matches the extra-parent node color (no edge/node drift)", () => {
    // The merge edge to the extra parent is drawn when the merge commit is processed.
    // The extra-parent node is drawn later. Both must carry the same color so the
    // graph line flows visually from edge to node without a color jump.
    const root = makeCommit("Root");
    const fp   = makeCommit("FirstParent", [root.hash]);
    // Use a colliding pair so adjacency adjustment fires on the extra-parent lane.
    const [ep] = findCollidingPair(root);
    const m    = makeCommit("Merge", [fp.hash, ep.hash]);

    const { rows, edges } = layoutGraph([m, fp, ep, root]);

    const epRow      = rows.find((r) => r.commit.hash === ep.hash)!;
    const mRowIndex  = rows.findIndex((r) => r.commit.hash === m.hash);
    const epRowIndex = rows.findIndex((r) => r.commit.hash === ep.hash);

    const mergeParentEdge = edges.find(
      (e) => e.fromRow === mRowIndex && e.toRow === epRowIndex,
    );
    expect(mergeParentEdge).toBeDefined();
    expect(mergeParentEdge!.color).toBe(epRow.color);
  });

  it("second merge reusing an already-active extra-parent lane: edge and node colors agree", () => {
    // Topology (newest first):
    //   X       — has extraParent as its first parent (opens the ep lane)
    //   M       — merge of [firstParent, extraParent] (reuses the ep lane; existing >= 0)
    //   firstParent
    //   extraParent
    //   root
    //
    // When M is processed, the ep lane already exists (opened by X).  The merge
    // edge M→ep must use the same color as the ep node — no color jump in the graph.
    const root        = makeCommit("Root");
    const firstParent = makeCommit("FirstParent",  [root.hash]);
    const extraParent = makeCommit("ExtraParent",  [root.hash]);
    const x           = makeCommit("X",            [extraParent.hash]);
    const m           = makeCommit("Merge",        [firstParent.hash, extraParent.hash]);

    const { rows, edges } = layoutGraph([x, m, firstParent, extraParent, root]);

    const epRow      = rows.find((r) => r.commit.hash === extraParent.hash)!;
    const mRowIndex  = rows.findIndex((r) => r.commit.hash === m.hash);
    const epRowIndex = rows.findIndex((r) => r.commit.hash === extraParent.hash);

    // There must be an edge from M to extraParent.
    const mergeParentEdge = edges.find(
      (e) => e.fromRow === mRowIndex && e.toRow === epRowIndex,
    );
    expect(mergeParentEdge).toBeDefined();
    // The edge color and the node color must be identical.
    expect(mergeParentEdge!.color).toBe(epRow.color);
  });
});

// ---------------------------------------------------------------------------
// Adjacent lane color uniqueness
// ---------------------------------------------------------------------------

describe("adjacent lane color uniqueness", () => {
  it("6 simultaneous branch tips all have distinct colors", () => {
    // Six branches diverge from a shared root — each gets its own lane (cols 0-5).
    // With only 6 colors available, the adjacency-avoidance logic must ensure that
    // no two neighboring columns end up with the same color.
    const root = makeCommit("Root");
    const tips = Array.from({ length: 6 }, (_, k) =>
      makeCommit(`Branch-${k + 1}`, [root.hash]),
    );
    const { rows } = layoutGraph([...tips, root]);
    const tipColors = tips.map(
      (t) => rows.find((r) => r.commit.hash === t.hash)!.color,
    );
    const unique = new Set(tipColors);
    expect(unique.size).toBe(6);
  });

  it("no two adjacent columns share a color in a 6-branch graph", () => {
    const root = makeCommit("Root");
    const tips = Array.from({ length: 6 }, (_, k) =>
      makeCommit(`Branch-${k + 1}`, [root.hash]),
    );
    const { rows } = layoutGraph([...tips, root]);
    // Build col→color map for the tips (they sit on cols 0-5 simultaneously).
    const colColor = new Map<number, string>();
    for (const t of tips) {
      const r = rows.find((row) => row.commit.hash === t.hash)!;
      colColor.set(r.col, r.color);
    }
    // For every pair of adjacent columns verify they differ.
    const cols = [...colColor.keys()].sort((a, b) => a - b);
    for (let i = 0; i < cols.length - 1; i++) {
      const left = cols[i]!;
      const right = cols[i + 1]!;
      if (right === left + 1) {
        expect(colColor.get(left)).not.toBe(
          colColor.get(right),
          `cols ${left} and ${right} both use color ${colColor.get(left)}`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Cascading merge: a merge commit is itself merged into a third branch
// ---------------------------------------------------------------------------

describe("cascading merge (merge commit re-merged into a third branch)", () => {
  // Topology (newest first in array):
  //
  //   M2               ← merge into branch C: parents [c3, M1]   (row 0)
  //   |  \
  //   c3   M1          ← branch C tip; M1 is the extra parent     (rows 1, 2)
  //   |    | \
  //   |    c1  c2      ← branches A and B                         (rows 3, 4)
  //   |    |   |
  //   root              ← shared root                              (row 5)
  //
  // M1 merges c1 and c2 — M1 is itself a merge commit.
  // M2 is produced by "git checkout C; git merge M1", so c3 is the first
  // parent (the continuing lane) and M1 is the extra parent being merged in.
  // This topology exercises the path where layoutGraph encounters M1 (already
  // placed as a merge node) as the non-first parent of a subsequent commit.

  let root: ReturnType<typeof makeCommit>;
  let c1: ReturnType<typeof makeCommit>;
  let c2: ReturnType<typeof makeCommit>;
  let c3: ReturnType<typeof makeCommit>;
  let m1: ReturnType<typeof makeCommit>;
  let m2: ReturnType<typeof makeCommit>;

  beforeEach(() => {
    root = makeCommit("Root");
    c1   = makeCommit("Branch-A-1", [root.hash]);
    c2   = makeCommit("Branch-B-1", [root.hash]);
    c3   = makeCommit("Branch-C-1", [root.hash]);
    m1   = makeCommit("Merge A+B",  [c1.hash, c2.hash]);
    // M2 is on branch C; first parent is c3 (continuing lane), extra parent is M1
    m2   = makeCommit("Merge M1 into C", [c3.hash, m1.hash]);
  });

  it("every edge endpoint lands on its parent's actual column", () => {
    // newest first: M2 is tip of branch C (after absorbing M1)
    const { rows, edges } = layoutGraph([m2, c3, m1, c1, c2, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(
        colByHash.get(parentCommit.hash),
        `edge to "${parentCommit.subject}" should land on col ${colByHash.get(parentCommit.hash)}, got ${e.toCol}`,
      );
    }
  });

  it("no -1 sentinel survives when a merge commit is the extra parent of another merge", () => {
    const { edges } = layoutGraph([m2, c3, m1, c1, c2, root]);
    for (const e of edges) {
      expect(e.toCol).not.toBe(-1);
      expect(e.fromCol).not.toBe(-1);
    }
  });

  it("c1, c2, and c3 all sit on distinct columns (three simultaneous lanes)", () => {
    const { rows } = layoutGraph([m2, c3, m1, c1, c2, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    const colC1 = colByHash.get(c1.hash)!;
    const colC2 = colByHash.get(c2.hash)!;
    const colC3 = colByHash.get(c3.hash)!;
    expect(colC1).not.toBe(colC2);
    expect(colC1).not.toBe(colC3);
    expect(colC2).not.toBe(colC3);
  });

  it("M1 sits on a valid column (not undefined, not negative)", () => {
    const { rows } = layoutGraph([m2, c3, m1, c1, c2, root]);
    const m1Row = rows.find((r) => r.commit.hash === m1.hash)!;
    expect(m1Row.col).toBeGreaterThanOrEqual(0);
  });

  it("M2 sits on the same column as c3 (first-parent lane is preserved)", () => {
    const { rows } = layoutGraph([m2, c3, m1, c1, c2, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    // M2's first parent is c3, so M2 should continue on c3's lane
    expect(colByHash.get(m2.hash)).toBe(colByHash.get(c3.hash));
  });

  it("M1 sits on a different column than M2 (extra-parent lane is distinct)", () => {
    const { rows } = layoutGraph([m2, c3, m1, c1, c2, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    expect(colByHash.get(m2.hash)).not.toBe(colByHash.get(m1.hash));
  });

  it("maxCol is at least 2 (three branches are simultaneously live before any merge)", () => {
    const { maxCol } = layoutGraph([m2, c3, m1, c1, c2, root]);
    expect(maxCol).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Two merge commits share the same non-first (extra) parent
// ---------------------------------------------------------------------------

describe("two merge commits share the same non-first parent", () => {
  // Topology (newest first in array):
  //
  //   M1    M2          ← two independent merge commits              (rows 0, 1)
  //   | \  / |
  //   A   S   B         ← A is M1's first parent, B is M2's first   (rows 2, 3, 4)
  //   |   |   |           parent, S is the shared EXTRA parent of
  //   root               both M1 and M2                              (row 5)
  //
  // M1 = merge([A, S])   — S is M1's second parent
  // M2 = merge([B, S])   — S is M2's second parent
  //
  // This topology can cause the lane-tracking logic to assign the same column
  // to two simultaneously-live lanes (both M1 and M2 open a lane pointing to S
  // while S has not yet been processed), or leave -1 sentinels unresolved when
  // both lanes collapse onto S.

  let root: ReturnType<typeof makeCommit>;
  let a: ReturnType<typeof makeCommit>;
  let b: ReturnType<typeof makeCommit>;
  let s: ReturnType<typeof makeCommit>; // shared extra parent
  let m1: ReturnType<typeof makeCommit>;
  let m2: ReturnType<typeof makeCommit>;

  beforeEach(() => {
    root = makeCommit("Root");
    a    = makeCommit("Branch-A", [root.hash]);
    b    = makeCommit("Branch-B", [root.hash]);
    s    = makeCommit("Shared-Extra", [root.hash]);
    m1   = makeCommit("Merge-A+S",   [a.hash, s.hash]);
    m2   = makeCommit("Merge-B+S",   [b.hash, s.hash]);
  });

  it("every edge endpoint lands on its parent's actual column", () => {
    // Both M1 and M2 are tips; present newest first.
    const { rows, edges } = layoutGraph([m1, m2, a, b, s, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    for (const e of edges) {
      const parentCommit = rows[e.toRow]!.commit;
      expect(e.toCol).toBe(
        colByHash.get(parentCommit.hash),
        `edge to "${parentCommit.subject}" should land on col ${colByHash.get(parentCommit.hash)}, got ${e.toCol}`,
      );
    }
  });

  it("no -1 sentinel survives when two merges share a non-first parent", () => {
    const { edges } = layoutGraph([m1, m2, a, b, s, root]);
    for (const e of edges) {
      expect(e.toCol).not.toBe(-1);
      expect(e.fromCol).not.toBe(-1);
    }
  });

  it("M1 and M2 sit on distinct columns", () => {
    const { rows } = layoutGraph([m1, m2, a, b, s, root]);
    const colByHash = new Map(rows.map((r) => [r.commit.hash, r.col]));
    expect(colByHash.get(m1.hash)).not.toBe(colByHash.get(m2.hash));
  });

  it("the shared extra parent S lands on a valid non-negative column", () => {
    const { rows } = layoutGraph([m1, m2, a, b, s, root]);
    const sRow = rows.find((r) => r.commit.hash === s.hash)!;
    expect(sRow.col).toBeGreaterThanOrEqual(0);
  });

  it("the shared extra parent S lands on the correct column (edge endpoints match)", () => {
    // Re-assert the column alignment specifically for S to make debugging easy
    // if the shared-parent collapse logic regresses.
    const { rows, edges } = layoutGraph([m1, m2, a, b, s, root]);
    const sRow = rows.find((r) => r.commit.hash === s.hash)!;
    const sRowIndex = rows.indexOf(sRow);
    // Every edge that targets S must arrive at S's actual column.
    const edgesToS = edges.filter((e) => e.toRow === sRowIndex);
    for (const e of edgesToS) {
      expect(e.toCol).toBe(sRow.col);
    }
  });
});

// ---------------------------------------------------------------------------
// 3-column window color uniqueness — 8+ simultaneous branches
// ---------------------------------------------------------------------------

describe("3-column window color uniqueness with 8+ simultaneous branches", () => {
  // 8 branches diverge from the same root commit. They are all processed at the
  // same time (each is a tip child of root), so they sit on columns 0-7
  // simultaneously. The expanded 12-color palette and the updated pickColor
  // logic must ensure that for every trio of consecutive columns [n, n+1, n+2],
  // no two of the three assigned colors are identical.

  function build8Branches() {
    const root = makeCommit("Root");
    const tips = Array.from({ length: 8 }, (_, k) =>
      makeCommit(`Branch-${k + 1}`, [root.hash]),
    );
    return { root, tips };
  }

  it("every column among 8 simultaneous branches gets a distinct column index", () => {
    const { root, tips } = build8Branches();
    const { rows } = layoutGraph([...tips, root]);
    const cols = tips.map(
      (t) => rows.find((r) => r.commit.hash === t.hash)!.col,
    );
    expect(new Set(cols).size).toBe(8);
  });

  it("no color repeats within any 3-column window when 8 simultaneous branches exist", () => {
    const { root, tips } = build8Branches();
    const { rows } = layoutGraph([...tips, root]);

    // Build col→color map for the simultaneous tip rows only.
    const colColor = new Map<number, string>();
    for (const t of tips) {
      const r = rows.find((row) => row.commit.hash === t.hash)!;
      colColor.set(r.col, r.color);
    }

    const cols = [...colColor.keys()].sort((a, b) => a - b);

    // Slide a window of width 3 across all consecutive column triplets.
    for (let i = 0; i < cols.length - 2; i++) {
      const [a, b, c] = [cols[i]!, cols[i + 1]!, cols[i + 2]!];
      // Only test windows where columns are truly consecutive (no gap).
      if (b !== a + 1 || c !== b + 1) continue;
      const ca = colColor.get(a)!;
      const cb = colColor.get(b)!;
      const cc = colColor.get(c)!;
      expect(ca).not.toBe(cb, `cols ${a} and ${b} share color ${ca}`);
      expect(ca).not.toBe(cc, `cols ${a} and ${c} share color ${ca}`);
      expect(cb).not.toBe(cc, `cols ${b} and ${c} share color ${cb}`);
    }
  });

  it("no color repeats within any 3-column window when 12 simultaneous branches exist", () => {
    // Push all 12 colors into play at once — requires the full extended palette.
    const root = makeCommit("Root");
    const tips = Array.from({ length: 12 }, (_, k) =>
      makeCommit(`Branch-${k + 1}`, [root.hash]),
    );
    const { rows } = layoutGraph([...tips, root]);

    const colColor = new Map<number, string>();
    for (const t of tips) {
      const r = rows.find((row) => row.commit.hash === t.hash)!;
      colColor.set(r.col, r.color);
    }

    const cols = [...colColor.keys()].sort((a, b) => a - b);

    for (let i = 0; i < cols.length - 2; i++) {
      const [a, b, c] = [cols[i]!, cols[i + 1]!, cols[i + 2]!];
      if (b !== a + 1 || c !== b + 1) continue;
      const ca = colColor.get(a)!;
      const cb = colColor.get(b)!;
      const cc = colColor.get(c)!;
      expect(ca).not.toBe(cb, `cols ${a} and ${b} share color ${ca}`);
      expect(ca).not.toBe(cc, `cols ${a} and ${c} share color ${ca}`);
      expect(cb).not.toBe(cc, `cols ${b} and ${c} share color ${cb}`);
    }
  });
});
