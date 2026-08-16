import { describe, it, expect } from "vitest";
import { computeTrend } from "./trend";
import type { DrillFrictionEntry } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  overrides: Partial<
    Pick<
      DrillFrictionEntry,
      "recentPasses" | "recentFailures" | "olderPasses" | "olderFailures"
    >
  >,
): DrillFrictionEntry {
  return {
    sourceId: "test-source",
    failures: 5,
    passes: 2,
    effectiveFailures: 3,
    recentPasses: overrides.recentPasses ?? 0,
    recentFailures: overrides.recentFailures ?? 0,
    olderPasses: overrides.olderPasses ?? 0,
    olderFailures: overrides.olderFailures ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Legacy records — no rolling window data
// ---------------------------------------------------------------------------

describe("computeTrend — legacy record with no rolling-window data", () => {
  it('returns "unknown" when all four counts are zero', () => {
    const entry = makeEntry({});
    expect(computeTrend(entry)).toBe("unknown");
  });

  it('returns "unknown" regardless of raw aggregate failures/passes totals', () => {
    // Simulate a source that has failed 20 times historically but was written
    // before the runs[] field was introduced — all rolling-window fields are 0.
    const entry: DrillFrictionEntry = {
      sourceId: "lesson-old",
      failures: 20,
      passes: 3,
      effectiveFailures: 0, // decayed to 0 because runs is empty
      recentPasses: 0,
      recentFailures: 0,
      olderPasses: 0,
      olderFailures: 0,
    };
    expect(computeTrend(entry)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Only newer-half data (older half is empty)
// ---------------------------------------------------------------------------

describe("computeTrend — only newer-half data available", () => {
  it('returns "improving" when newer pass rate > 50 %', () => {
    const entry = makeEntry({ recentPasses: 3, recentFailures: 1 }); // 75 %
    expect(computeTrend(entry)).toBe("improving");
  });

  it('returns "regressing" when newer pass rate < 50 %', () => {
    const entry = makeEntry({ recentPasses: 1, recentFailures: 3 }); // 25 %
    expect(computeTrend(entry)).toBe("regressing");
  });

  it('returns "stable" when newer pass rate is exactly 50 %', () => {
    const entry = makeEntry({ recentPasses: 2, recentFailures: 2 });
    expect(computeTrend(entry)).toBe("stable");
  });
});

// ---------------------------------------------------------------------------
// Both halves have data
// ---------------------------------------------------------------------------

describe("computeTrend — both halves populated", () => {
  it('returns "improving" when recent pass rate exceeds older pass rate', () => {
    const entry = makeEntry({
      recentPasses: 4,
      recentFailures: 1, // 80 %
      olderPasses: 1,
      olderFailures: 4, // 20 %
    });
    expect(computeTrend(entry)).toBe("improving");
  });

  it('returns "regressing" when recent pass rate is below older pass rate', () => {
    const entry = makeEntry({
      recentPasses: 1,
      recentFailures: 4, // 20 %
      olderPasses: 4,
      olderFailures: 1, // 80 %
    });
    expect(computeTrend(entry)).toBe("regressing");
  });

  it('returns "stable" when both halves have identical pass rates', () => {
    const entry = makeEntry({
      recentPasses: 3,
      recentFailures: 2, // 60 %
      olderPasses: 3,
      olderFailures: 2, // 60 %
    });
    expect(computeTrend(entry)).toBe("stable");
  });

  it('returns "stable" when both halves are all-failures (0 % each)', () => {
    const entry = makeEntry({
      recentPasses: 0,
      recentFailures: 5,
      olderPasses: 0,
      olderFailures: 5,
    });
    expect(computeTrend(entry)).toBe("stable");
  });

  it('returns "stable" when both halves are all-passes (100 % each)', () => {
    const entry = makeEntry({
      recentPasses: 5,
      recentFailures: 0,
      olderPasses: 5,
      olderFailures: 0,
    });
    expect(computeTrend(entry)).toBe("stable");
  });
});

// ---------------------------------------------------------------------------
// Newer half is empty but older half is not — degenerate case
// ---------------------------------------------------------------------------

describe("computeTrend — newer half empty, older half populated", () => {
  it('returns "stable" (cannot draw a trend without recent data)', () => {
    const entry = makeEntry({
      recentPasses: 0,
      recentFailures: 0,
      olderPasses: 2,
      olderFailures: 3,
    });
    expect(computeTrend(entry)).toBe("stable");
  });
});
