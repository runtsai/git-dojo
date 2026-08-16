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
