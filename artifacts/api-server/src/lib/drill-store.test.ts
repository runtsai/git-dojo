/**
 * Tests for queryDue friction sort stability.
 *
 * When two sources decay to the same effectiveFailures score mid-session their
 * relative order in the weak-spots list must not flip.  The sort uses a
 * tie-break (raw failures desc → sourceId asc) so the ordering is fully
 * deterministic regardless of floating-point convergence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Control the filesystem so load() returns whatever we need without touching
// disk.
// ---------------------------------------------------------------------------

const mockFileContents: { value: string | null } = { value: null };

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => mockFileContents.value !== null),
    readFileSync: vi.fn(() => {
      if (mockFileContents.value === null) throw new Error("ENOENT");
      return mockFileContents.value;
    }),
    // Capture writes so that a second load() call within the same test sees
    // the updated state (e.g. recoveredSince stamped by the first queryDue).
    writeFileSync: vi.fn((_path: unknown, content: unknown) => {
      if (typeof content === "string") mockFileContents.value = content;
    }),
    mkdirSync: vi.fn(),
  };
});

// Import AFTER mocks are registered.
const { queryDue, recordGraderResult } = await import("./drill-store.js");

// Grab the mocked writeFileSync so stateful tests can make it persist.
const { writeFileSync } = await import("node:fs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const DECAY_K = Math.LN2 / HALF_LIFE_MS;

/** Build a failure run entry at a given age (ms before `now`). */
function failureAt(ageMs: number, now: number) {
  return { at: new Date(now - ageMs).toISOString(), passed: false };
}
function passAt(ageMs: number, now: number) {
  return { at: new Date(now - ageMs).toISOString(), passed: true };
}

function setDrillData(frictionMap: Record<string, { failures: number; passes: number; runs: Array<{ at: string; passed: boolean }> }>) {
  mockFileContents.value = JSON.stringify({
    items: {},
    friction: frictionMap,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("queryDue friction sort stability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFileContents.value = null;
  });

  it("sorts higher effectiveFailures before lower", () => {
    const now = Date.now();
    // source-a: 3 recent failures → higher score
    // source-b: 1 recent failure  → lower score
    setDrillData({
      "source-a": {
        failures: 3,
        passes: 0,
        runs: [
          failureAt(1_000, now),
          failureAt(2_000, now),
          failureAt(3_000, now),
        ],
      },
      "source-b": {
        failures: 1,
        passes: 0,
        runs: [failureAt(1_000, now)],
      },
    });

    const candidates = [
      { id: "d1", sourceId: "source-a" },
      { id: "d2", sourceId: "source-b" },
    ];
    const { friction } = queryDue(candidates);
    expect(friction.length).toBe(2);
    expect(friction[0].sourceId).toBe("source-a");
    expect(friction[1].sourceId).toBe("source-b");
    expect(friction[0].effectiveFailures).toBeGreaterThan(friction[1].effectiveFailures);
  });

  it("is stable by sourceId when two sources have identical decayed scores", () => {
    const now = Date.now();
    // Identical run histories at identical ages → identical effectiveFailures.
    // The tie-break must produce a deterministic order (sourceId asc).
    const age = 1_000;
    setDrillData({
      "source-z": { failures: 1, passes: 0, runs: [failureAt(age, now)] },
      "source-a": { failures: 1, passes: 0, runs: [failureAt(age, now)] },
    });

    const candidates = [
      { id: "d1", sourceId: "source-z" },
      { id: "d2", sourceId: "source-a" },
    ];
    const { friction } = queryDue(candidates);
    expect(friction.length).toBe(2);
    // Both have identical effectiveFailures and identical raw failures;
    // tie-break on sourceId ascending → "source-a" before "source-z".
    expect(friction[0].sourceId).toBe("source-a");
    expect(friction[1].sourceId).toBe("source-z");
  });

  it("is stable by raw failures when decayed scores are equal but raw counts differ", () => {
    const now = Date.now();
    // source-old: many old failures that have decayed to the same rounded score
    //             as source-new with one recent failure, but raw count is higher.
    // We manufacture equal effectiveFailures by making source-old's failures so
    // old that their decay is negligible, while source-new has one very recent
    // failure.  Then we bump source-old's raw total to 10 vs source-new's 1.
    // The tie-break should keep source-old first (higher raw failures).
    const veryOldAge = 200 * 24 * 60 * 60 * 1000; // 200 days → ~0.0 contribution
    const recentAge  = 1_000;                        // 1 second → ~1.0 contribution

    // Compute actual decayed contributions to be precise
    const oldContrib    = Math.exp(-DECAY_K * veryOldAge); // ≈ 2.5e-5
    const recentContrib = Math.exp(-DECAY_K * recentAge);  // ≈ 1.0

    // source-old: one very old failure (score ≈ 0) and high raw count
    // source-new: one very recent failure (score ≈ 1.0) and low raw count
    // We want their rounded effectiveFailures to differ (new > old), so this
    // test also covers the *primary* sort branch keeping new first.
    setDrillData({
      "source-old": { failures: 10, passes: 5, runs: [failureAt(veryOldAge, now)] },
      "source-new": { failures: 1,  passes: 0, runs: [failureAt(recentAge, now)] },
    });

    const candidates = [
      { id: "d1", sourceId: "source-old" },
      { id: "d2", sourceId: "source-new" },
    ];
    const { friction } = queryDue(candidates);
    // source-new has a higher effectiveFailures (recent failure scores ~1.0)
    // than source-old (very stale failure scores ~0.0).
    expect(friction[0].sourceId).toBe("source-new");
    expect(friction[1].sourceId).toBe("source-old");

    // Now confirm: when we give both the same effectiveFailures (both with one
    // very-recent failure), raw count tie-break kicks in.
    setDrillData({
      "source-many": { failures: 10, passes: 5, runs: [failureAt(recentAge, now)] },
      "source-few":  { failures: 1,  passes: 0, runs: [failureAt(recentAge, now)] },
    });
    const candidates2 = [
      { id: "d3", sourceId: "source-many" },
      { id: "d4", sourceId: "source-few" },
    ];
    const { friction: friction2 } = queryDue(candidates2);
    expect(friction2[0].sourceId).toBe("source-many"); // higher raw failures first
    expect(friction2[1].sourceId).toBe("source-few");
  });

  it("produces a stable order when scores converge to the same rounded value mid-session", () => {
    // Two sources start with different effectiveFailures scores at T1.  After
    // 20 days both failures have decayed enough that their rounded scores are
    // equal.  The tie-break (sourceId asc) must then produce a consistent
    // order on every repeated call — simulating rapid panel refreshes within a
    // single browser session.
    //
    // Decay arithmetic (half-life = 14 days, DECAY_K = ln2 / 14d):
    //   source-z: 1 failure at 4.65 days old → score ≈ 2^(-4.65/14) ≈ 0.796 → rounds to 0.8
    //   source-a: 1 failure at 6.85 days old → score ≈ 2^(-6.85/14) ≈ 0.713 → rounds to 0.7
    //   At T1: order is [source-z (0.8), source-a (0.7)]
    //
    //   After +20 days:
    //   source-z: age 24.65d → score ≈ 2^(-24.65/14) ≈ 0.295 → rounds to 0.3
    //   source-a: age 26.85d → score ≈ 2^(-26.85/14) ≈ 0.265 → rounds to 0.3
    //   At T2: both round to 0.3 → tie, resolved by sourceId asc → [source-a, source-z]
    //
    // Without the tie-break the sort is unstable at T2 (undefined for equal keys);
    // with it, every call at T2 produces [source-a, source-z] deterministically.

    const dayMs = 24 * 60 * 60 * 1000;
    const baseTime = new Date("2025-06-01T00:00:00Z").getTime();

    const ageZ = Math.round(4.65 * dayMs); // source-z failure age at T1
    const ageA = Math.round(6.85 * dayMs); // source-a failure age at T1

    setDrillData({
      "source-z": {
        failures: 1,
        passes: 0,
        runs: [{ at: new Date(baseTime - ageZ).toISOString(), passed: false }],
      },
      "source-a": {
        failures: 1,
        passes: 0,
        runs: [{ at: new Date(baseTime - ageA).toISOString(), passed: false }],
      },
    });

    const candidates = [
      { id: "d1", sourceId: "source-z" },
      { id: "d2", sourceId: "source-a" },
    ];

    try {
      vi.useFakeTimers();

      // ── T1: scores are different ──────────────────────────────────────────
      vi.setSystemTime(baseTime);
      const { friction: frictionT1 } = queryDue(candidates);
      expect(frictionT1.length).toBe(2);
      // source-z has higher effectiveFailures (more recent failure) → listed first.
      expect(frictionT1[0].sourceId).toBe("source-z");
      expect(frictionT1[0].effectiveFailures).toBeGreaterThan(frictionT1[1].effectiveFailures);

      // ── T2: +20 days — both decay to the same rounded score ──────────────
      vi.setSystemTime(baseTime + 20 * dayMs);
      // Confirm rounded equality:
      const { friction: probe } = queryDue(candidates);
      expect(probe[0].effectiveFailures).toBe(probe[1].effectiveFailures);

      // Call multiple times to confirm order never alternates at the tie point.
      const orders = new Set<string>();
      for (let i = 0; i < 8; i++) {
        const { friction } = queryDue(candidates);
        orders.add(friction.map((f) => f.sourceId).join(","));
      }
      expect(orders.size).toBe(1);
      // At the tie point the sourceId tie-break selects the alphabetically
      // earlier id first ("source-a" < "source-z").
      const [first, second] = [...orders][0]!.split(",");
      expect(first).toBe("source-a");
      expect(second).toBe("source-z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("source whose decayed score rounds to zero sorts to the bottom but remains present when recentFailures > 0", () => {
    // A source whose only failures are extremely old has a decayed score that
    // rounds to 0.  It must sort after all sources with effectiveFailures > 0,
    // but it must still appear in the list because the recovery filter only
    // removes an entry when recentFailures === 0 && recentPasses > 0 — a
    // source with only (very old) failures has recentFailures > 0.
    const now = Date.now();

    // Failure so old (200 days) its decay contribution is negligible (~2.5e-5)
    const veryOldAge = 200 * 24 * 60 * 60 * 1000;

    setDrillData({
      "source-zero": {
        // One very old failure: decayed score ≈ 0, but recentFailures = 1
        failures: 3,
        passes: 0,
        runs: [failureAt(veryOldAge, now)],
      },
      "source-active": {
        // Recent failure: decayed score ≈ 1.0
        failures: 1,
        passes: 0,
        runs: [failureAt(1_000, now)],
      },
    });

    const candidates = [
      { id: "d1", sourceId: "source-zero" },
      { id: "d2", sourceId: "source-active" },
    ];
    const { friction } = queryDue(candidates);

    // Both sources must appear (recentFailures > 0 for each, so neither is
    // caught by the recovery filter).
    expect(friction.length).toBe(2);
    const zeroEntry = friction.find((f) => f.sourceId === "source-zero")!;
    const activeEntry = friction.find((f) => f.sourceId === "source-active")!;
    expect(zeroEntry).toBeDefined();
    expect(activeEntry).toBeDefined();

    // source-zero must NOT be flagged as recovered (it has recentFailures > 0).
    expect(zeroEntry.recovered).toBe(false);

    // source-active has a higher effectiveFailures and sorts first.
    expect(friction[0].sourceId).toBe("source-active");
    expect(friction[1].sourceId).toBe("source-zero");

    // The score ordering must hold.
    expect(activeEntry.effectiveFailures).toBeGreaterThan(zeroEntry.effectiveFailures);
  });

  it("source at score zero sorts below a second zero-score source by sourceId tie-break", () => {
    // Two sources both fully decayed to effectiveFailures = 0.  The sort must
    // still be deterministic: tie-break on raw failures desc, then sourceId asc.
    const now = Date.now();
    const veryOldAge = 200 * 24 * 60 * 60 * 1000;

    setDrillData({
      "source-z": {
        failures: 2,
        passes: 0,
        runs: [failureAt(veryOldAge, now)],
      },
      "source-a": {
        failures: 2,
        passes: 0,
        runs: [failureAt(veryOldAge, now)],
      },
    });

    const candidates = [
      { id: "d1", sourceId: "source-z" },
      { id: "d2", sourceId: "source-a" },
    ];
    const { friction } = queryDue(candidates);

    expect(friction.length).toBe(2);
    // Same effectiveFailures (≈ 0) and same raw failures → tie-break on sourceId asc.
    expect(friction[0].effectiveFailures).toBe(friction[1].effectiveFailures);
    expect(friction[0].sourceId).toBe("source-a");
    expect(friction[1].sourceId).toBe("source-z");
  });

  it("zero-score recovered source disappears on the next call while active sources retain their order", () => {
    // Scenario: source-zero has very old failures (effectiveFailures ≈ 0) and
    // a recent all-pass run-tail that qualifies it as "recovered".  Two active
    // sources with effectiveFailures > 0 are also present.
    //
    // Call 1: all three sources appear — active sources first (ordered by score),
    //         source-zero last with recovered: true and effectiveFailures ≈ 0.
    // Call 2: source-zero is omitted (one-shot recovery badge); the surviving
    //         pair keeps its score-descending order with no positional gaps.
    const now = Date.now();
    const veryOldAge = 200 * 24 * 60 * 60 * 1000; // 200 days → decay ≈ 0

    // source-zero: 3 very old failures (score≈0) + 5 recent passes filling
    // the newer half of the window → recentFailures=0, recentPasses=5 → recovered.
    // raw failures > 0 so the friction loop includes it.
    setDrillData({
      "source-high": {
        failures: 5,
        passes: 0,
        runs: [
          failureAt(1_000, now),
          failureAt(2_000, now),
          failureAt(3_000, now),
          failureAt(4_000, now),
          failureAt(5_000, now),
        ],
      },
      "source-low": {
        failures: 2,
        passes: 0,
        runs: [failureAt(1_000, now), failureAt(2_000, now)],
      },
      "source-zero": {
        failures: 3,
        passes: 5,
        runs: [
          // 3 very old failures (contribute ≈ 0 to decayed score)
          failureAt(veryOldAge, now),
          failureAt(veryOldAge + 1_000, now),
          failureAt(veryOldAge + 2_000, now),
          // 5 recent passes (fill the newer half → recovered)
          passAt(5_000, now),
          passAt(4_000, now),
          passAt(3_000, now),
          passAt(2_000, now),
          passAt(1_000, now),
        ],
      },
    });

    const candidates = [
      { id: "d1", sourceId: "source-high" },
      { id: "d2", sourceId: "source-low" },
      { id: "d3", sourceId: "source-zero" },
    ];

    // ── Call 1: all three appear, zero-score source is last and recovered ──
    const { friction: first } = queryDue(candidates);
    expect(first.length).toBe(3);

    const zeroEntry = first.find((f) => f.sourceId === "source-zero")!;
    expect(zeroEntry).toBeDefined();
    expect(zeroEntry.recovered).toBe(true);
    expect(zeroEntry.effectiveFailures).toBe(0);

    // Active sources come before the recovered entry.
    expect(first[0].sourceId).toBe("source-high");
    expect(first[1].sourceId).toBe("source-low");
    expect(first[2].sourceId).toBe("source-zero");

    // Active sources are ordered by effectiveFailures descending.
    expect(first[0].effectiveFailures).toBeGreaterThan(first[1].effectiveFailures);
    expect(first[1].effectiveFailures).toBeGreaterThan(0);

    // ── Call 2: source-zero is omitted; active pair retains its order ──────
    const { friction: second } = queryDue(candidates);
    expect(second.length).toBe(2);
    expect(second.some((f) => f.sourceId === "source-zero")).toBe(false);

    expect(second[0].sourceId).toBe("source-high");
    expect(second[1].sourceId).toBe("source-low");
    expect(second[0].effectiveFailures).toBeGreaterThan(second[1].effectiveFailures);
  });

  it("fully recovered entry appears once with recovered:true, then is excluded on the next call", () => {
    const now = Date.now();
    setDrillData({
      "source-recovered": {
        failures: 5,
        passes: 10,
        // All-pass recent window → recovered state
        runs: Array.from({ length: 10 }, (_, i) => passAt(i * 1_000, now)),
      },
      "source-weak": {
        failures: 2,
        passes: 0,
        runs: [failureAt(1_000, now), failureAt(2_000, now)],
      },
    });

    const candidates = [
      { id: "d1", sourceId: "source-recovered" },
      { id: "d2", sourceId: "source-weak" },
    ];

    // First call: recovered entry should appear with recovered:true at the end.
    const { friction: first } = queryDue(candidates);
    expect(first.length).toBe(2);
    const weakEntry = first.find((e) => e.sourceId === "source-weak")!;
    const recoveredEntry = first.find((e) => e.sourceId === "source-recovered")!;
    expect(weakEntry).toBeDefined();
    expect(recoveredEntry).toBeDefined();
    expect(recoveredEntry.recovered).toBe(true);
    expect(weakEntry.recovered).toBe(false);
    // Active entries sort before recovered ones.
    expect(first[0].sourceId).toBe("source-weak");
    expect(first[1].sourceId).toBe("source-recovered");

    // Second call (same persisted state): recovered entry should be omitted.
    const { friction: second } = queryDue(candidates);
    expect(second.length).toBe(1);
    expect(second[0].sourceId).toBe("source-weak");
  });
});

// ---------------------------------------------------------------------------
// End-to-end recovery tests via recordGraderResult
// RECENT_WINDOW = 10, half = floor(10/2) = 5
// Recovery fires when recentFailures === 0 && recentPasses > 0
// (i.e. the newer half of the last 10 runs contains only passes)
// ---------------------------------------------------------------------------

describe("queryDue recovery filter — end-to-end via recordGraderResult", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFileContents.value = null;
    // Wire writeFileSync to persist into mockFileContents so that
    // recordGraderResult → save() → load() → queryDue() all share state.
    vi.mocked(writeFileSync).mockImplementation((_path, content) => {
      mockFileContents.value = content as string;
    });
  });

  it("shows recovered badge once then hides a source after enough passes fill the recent half-window", () => {
    const candidates = [{ id: "d1", sourceId: "source-a" }];

    // Record 3 failures — source should appear as an active weak spot.
    recordGraderResult("source-a", false);
    recordGraderResult("source-a", false);
    recordGraderResult("source-a", false);

    const { friction: before } = queryDue(candidates);
    expect(before.some((f) => f.sourceId === "source-a")).toBe(true);
    expect(before.find((f) => f.sourceId === "source-a")!.recovered).toBe(false);

    // Record 5 consecutive passes so the newer half of the recent window
    // (last 5 of the last 10 runs) contains only passes.
    // Total runs: [F, F, F, P, P, P, P, P] → newerHalf = [P, P, P, P, P]
    // → recentFailures === 0, recentPasses === 5 → recovered.
    for (let i = 0; i < 5; i++) {
      recordGraderResult("source-a", true);
    }

    // First post-recovery call: badge shows with recovered:true.
    const { friction: badge } = queryDue(candidates);
    expect(badge.some((f) => f.sourceId === "source-a")).toBe(true);
    expect(badge.find((f) => f.sourceId === "source-a")!.recovered).toBe(true);

    // Second call: entry is omitted (one-refresh lifecycle).
    const { friction: after } = queryDue(candidates);
    expect(after.some((f) => f.sourceId === "source-a")).toBe(false);
  });

  it("keeps a source in friction when only some passes arrived and a failure remains in the recent half", () => {
    // Build: [F, F, F, P, P, P, F] — total 7 runs.
    // newerHalf = last 5 = [F, P, P, P, F] → recentFailures = 2 → NOT excluded.
    const candidates = [{ id: "d1", sourceId: "source-partial" }];

    recordGraderResult("source-partial", false);
    recordGraderResult("source-partial", false);
    recordGraderResult("source-partial", false);
    recordGraderResult("source-partial", true);
    recordGraderResult("source-partial", true);
    recordGraderResult("source-partial", true);
    recordGraderResult("source-partial", false); // failure in recent window

    const { friction } = queryDue(candidates);
    expect(friction.some((f) => f.sourceId === "source-partial")).toBe(true);
    const entry = friction.find((f) => f.sourceId === "source-partial")!;
    expect(entry.recentFailures).toBeGreaterThan(0);
  });

  it("still shows a source that has only old failures and no recent runs (empty newer half)", () => {
    // The newer half uses the last RECENT_WINDOW (10) runs, split at half (5).
    // When fewer than 5 total runs exist, newerHalf = all runs.
    // A single failure: newerHalf = [F] → recentFailures = 1 → NOT excluded.
    const now = Date.now();
    setDrillData({
      "source-old-only": {
        failures: 3,
        passes: 0,
        // All runs are older than the recent window split (aged 20+ days),
        // but the filter is position-based not time-based, so position matters.
        runs: [
          failureAt(20 * 24 * 60 * 60 * 1000, now),
          failureAt(21 * 24 * 60 * 60 * 1000, now),
          failureAt(22 * 24 * 60 * 60 * 1000, now),
        ],
      },
    });

    const candidates = [{ id: "d1", sourceId: "source-old-only" }];
    const { friction } = queryDue(candidates);
    // 3 runs → newerHalf = last 3 (all failures) → recentFailures = 3 → shown
    expect(friction.some((f) => f.sourceId === "source-old-only")).toBe(true);
  });

  it("seeds trend data from legacy aggregate counts so trend fields are non-zero after the first new run", () => {
    // A legacy record has failures + passes > 0 but runs: [].
    // After exactly one new grader run, the trend fields (recentPasses +
    // recentFailures) must be non-zero — i.e. the seeded window is visible to
    // the trend detector without waiting for RECENT_WINDOW runs to accumulate.
    setDrillData({
      "source-legacy": {
        failures: 3,
        passes: 7,
        runs: [], // legacy: no rolling window yet
      },
    });

    // Wire writeFileSync to persist so the second load() inside queryDue sees
    // the state written by recordGraderResult.
    vi.mocked(writeFileSync).mockImplementation((_path, content) => {
      mockFileContents.value = content as string;
    });

    const candidates = [{ id: "d1", sourceId: "source-legacy" }];

    // Record exactly one new grader result on the legacy source.
    recordGraderResult("source-legacy", false);

    const { friction } = queryDue(candidates);
    const entry = friction.find((f) => f.sourceId === "source-legacy");
    expect(entry).toBeDefined();

    // Trend fields must be non-zero: the seeded window must provide enough
    // history for at least one half of the trend split to have data.
    expect(entry!.recentPasses + entry!.recentFailures).toBeGreaterThan(0);

    // The raw aggregate totals must be updated for the new run.
    expect(entry!.failures).toBeGreaterThan(0);
  });

  it("legacy friction record (empty runs, non-zero failures) appears in friction list with all rolling-window fields at zero and is not skipped", () => {
    // A FrictionRecord whose `runs` array is empty (legacy format, pre-rolling-window)
    // but whose `failures` count is non-zero must:
    //   1. appear in the friction list (failures > 0 gate passes)
    //   2. expose all four rolling-window counters as 0 (no runs to draw from)
    //   3. NOT be treated as recovered (recentPasses === 0, so isRecovered is false)
    setDrillData({
      "source-legacy": {
        failures: 4,
        passes: 1,
        runs: [], // legacy record — rolling window not yet populated
      },
    });

    const candidates = [{ id: "d1", sourceId: "source-legacy" }];
    const { friction } = queryDue(candidates);

    // 1. Entry IS included in the friction list.
    expect(friction.length).toBe(1);
    const entry = friction.find((f) => f.sourceId === "source-legacy")!;
    expect(entry).toBeDefined();

    // 2. All four rolling-window fields are 0 (empty runs → nothing to compute).
    expect(entry.recentPasses).toBe(0);
    expect(entry.recentFailures).toBe(0);
    expect(entry.olderPasses).toBe(0);
    expect(entry.olderFailures).toBe(0);

    // 3. Entry is NOT marked as recovered (recentPasses === 0 prevents it).
    expect(entry.recovered).toBe(false);
  });


  it("shows recovered badge once then hides a source that recovers after 10+ runs fill the window with passes at the end", () => {
    // 10 failures then 5 passes gives runs = [F×5, P×5] (window = last 10).
    // newerHalf (last 5) = [P, P, P, P, P] → fully recovered.
    const candidates = [{ id: "d1", sourceId: "source-long" }];

    for (let i = 0; i < 10; i++) recordGraderResult("source-long", false);
    // Verify it's present as an active weak spot before recovery.
    const { friction: mid } = queryDue(candidates);
    expect(mid.some((f) => f.sourceId === "source-long")).toBe(true);
    expect(mid.find((f) => f.sourceId === "source-long")!.recovered).toBe(false);

    for (let i = 0; i < 5; i++) recordGraderResult("source-long", true);

    // First post-recovery call: badge shows with recovered:true.
    const { friction: badge } = queryDue(candidates);
    expect(badge.some((f) => f.sourceId === "source-long")).toBe(true);
    expect(badge.find((f) => f.sourceId === "source-long")!.recovered).toBe(true);

    // Second call: entry is omitted (one-refresh lifecycle).
    const { friction: final } = queryDue(candidates);
    expect(final.some((f) => f.sourceId === "source-long")).toBe(false);
  });
});
