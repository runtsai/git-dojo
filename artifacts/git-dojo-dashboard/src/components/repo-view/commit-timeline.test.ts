import { describe, it, expect, beforeEach } from "vitest";
import { layoutGraph } from "./commit-timeline";
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
