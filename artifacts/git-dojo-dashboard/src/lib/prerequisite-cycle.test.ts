/**
 * Confirms that the MODULE_PREREQUISITES graph derived from `tiers` contains
 * no cycles, and that `findPrerequisiteCycle` would detect one if a developer
 * accidentally introduced a circular dependency (e.g. 2.4 requires 2.3,
 * 2.3 requires 2.4).
 *
 * A cycle in this graph would lock every module in the chain permanently
 * unreachable — the learner can never satisfy a prerequisite that itself
 * requires the module being unlocked.
 *
 * The startup guard in lib/course-content/src/index.ts throws at import time
 * when a cycle is found, so a server restart or test run will catch it before
 * any learner is affected.  These tests exercise:
 *   1. The live tiers data has no cycles right now.
 *   2. findPrerequisiteCycle returns null for valid chains.
 *   3. findPrerequisiteCycle catches a direct two-node cycle.
 *   4. findPrerequisiteCycle catches a longer cycle buried in a larger graph.
 *   5. An empty prerequisite map is fine.
 *   6. A self-referential module (requires itself) is caught.
 */

import { describe, it, expect } from "vitest";
import { MODULE_PREREQUISITES, findPrerequisiteCycle } from "@workspace/course-content";

// ---------------------------------------------------------------------------
// 1. Live data — current tiers must be acyclic
// ---------------------------------------------------------------------------

describe("MODULE_PREREQUISITES — live tiers data", () => {
  it("contains no circular prerequisite chains", () => {
    const cycle = findPrerequisiteCycle(MODULE_PREREQUISITES);
    expect(
      cycle,
      `Circular prerequisite chain detected in tiers: ${cycle}. ` +
        "A cycle permanently locks every module in the chain. Fix the prerequisite declarations.",
    ).toBeNull();
  });

  it("importing @workspace/course-content does not throw (startup guard passes)", () => {
    // If the startup guard at the bottom of index.ts had thrown, this test
    // file would have failed to load at all.  Reaching this assertion proves
    // the guard ran and found no cycle.
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. findPrerequisiteCycle — returns null for valid graphs
// ---------------------------------------------------------------------------

describe("findPrerequisiteCycle — acyclic graphs", () => {
  it("returns null for an empty map", () => {
    expect(findPrerequisiteCycle({})).toBeNull();
  });

  it("returns null for a single-entry chain (A requires B, B has no prereq)", () => {
    expect(findPrerequisiteCycle({ A: "B" })).toBeNull();
  });

  it("returns null for a linear chain of three (A→B→C, C has no prereq)", () => {
    expect(findPrerequisiteCycle({ A: "B", B: "C" })).toBeNull();
  });

  it("returns null for two independent chains", () => {
    // A→B and X→Y are separate; neither forms a loop
    expect(findPrerequisiteCycle({ A: "B", X: "Y" })).toBeNull();
  });

  it("returns null when keys point to modules not in the map (no prereq of their own)", () => {
    // 2.4 requires 2.3; 2.3 has no entry (no prereq) — real-world pattern
    expect(findPrerequisiteCycle({ "2.4": "2.3" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. findPrerequisiteCycle — catches direct two-node cycle
// ---------------------------------------------------------------------------

describe("findPrerequisiteCycle — two-node cycle (A⇄B)", () => {
  it("returns a non-null string when A requires B and B requires A", () => {
    const result = findPrerequisiteCycle({ A: "B", B: "A" });
    expect(result).not.toBeNull();
  });

  it("the returned string mentions both nodes", () => {
    const result = findPrerequisiteCycle({ A: "B", B: "A" })!;
    expect(result).toContain("A");
    expect(result).toContain("B");
  });

  it("the returned string contains the '→' separator", () => {
    const result = findPrerequisiteCycle({ A: "B", B: "A" })!;
    expect(result).toContain("→");
  });
});

// ---------------------------------------------------------------------------
// 4. findPrerequisiteCycle — catches longer cycle buried in a larger graph
// ---------------------------------------------------------------------------

describe("findPrerequisiteCycle — three-node cycle with an innocent entry", () => {
  //  Graph:  X→A, A→B, B→C, C→A  (X is fine; A→B→C→A is the cycle)
  const prereqs = { X: "A", A: "B", B: "C", C: "A" };

  it("returns a non-null string", () => {
    expect(findPrerequisiteCycle(prereqs)).not.toBeNull();
  });

  it("the returned string includes the cyclic nodes A, B, and C", () => {
    const result = findPrerequisiteCycle(prereqs)!;
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).toContain("C");
  });
});

// ---------------------------------------------------------------------------
// 5. findPrerequisiteCycle — catches self-referential module
// ---------------------------------------------------------------------------

describe("findPrerequisiteCycle — self-referential module (A requires A)", () => {
  it("returns a non-null string", () => {
    expect(findPrerequisiteCycle({ A: "A" })).not.toBeNull();
  });

  it("the returned string contains 'A'", () => {
    const result = findPrerequisiteCycle({ A: "A" })!;
    expect(result).toContain("A");
  });
});
