// @vitest-environment jsdom
/**
 * WeakSpotsPanel — all weak spots cleared (recovered-only friction list)
 *
 * Verifies the edge case where every friction entry is recovered:
 *   1. "Recently recovered" heading is visible.
 *   2. "Where you've struggled" heading is absent.
 *   3. Each recovered row shows the checkmark badge and "All recent checks passed" label.
 */

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// lucide-react — stub all icons used by warm-up.tsx
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => {
  const s = ({ className }: { className?: string } = {}) =>
    React.createElement("span", { className });
  return {
    ArrowLeft: s,
    ArrowRight: s,
    Check: s,
    Dumbbell: s,
    Terminal: s,
    X: s,
    Sparkles: s,
    AlertTriangle: s,
    TrendingUp: s,
    TrendingDown: s,
    Minus: s,
  };
});

// ---------------------------------------------------------------------------
// wouter — minimal Link stub
// ---------------------------------------------------------------------------
vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    className,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) =>
    React.createElement("a", { href, className, ...rest }, children),
}));

// ---------------------------------------------------------------------------
// @workspace/api-client-react — only recordDrillAttempt is called at runtime
// ---------------------------------------------------------------------------
vi.mock("@workspace/api-client-react", () => ({
  recordDrillAttempt: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Drill content — not exercised by these tests; return minimal stubs so the
// module resolves without importing the full bank.
// ---------------------------------------------------------------------------
vi.mock("@/content/drills", () => ({
  checkCommandAnswer: vi.fn(() => ({ correct: false, explain: "" })),
  drillBank: [],
}));

// ---------------------------------------------------------------------------
// useDrillStatus — the hook that feeds WarmUp (and thus WeakSpotsPanel)
// ---------------------------------------------------------------------------
vi.mock("@/hooks/use-drills", () => ({
  useDrillStatus: vi.fn(),
}));

// ---------------------------------------------------------------------------
// trend — real implementation not needed; stub to keep tests isolated
// ---------------------------------------------------------------------------
vi.mock("@/lib/trend", () => ({
  computeTrend: vi.fn(() => "stable"),
}));

// ---------------------------------------------------------------------------
// Import component and hook AFTER mocks are registered (vi.mock is hoisted,
// but the import order here documents intent clearly).
// ---------------------------------------------------------------------------
import { WarmUp } from "./warm-up";
import { useDrillStatus } from "@/hooks/use-drills";
import type { DrillFrictionEntry } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal eligible drill item so WarmUp renders the lobby (not the empty state). */
const STUB_ELIGIBLE = [
  { id: "drill-01", type: "concept" as const, prompt: "What does git reset do?", sourceLabel: "Lesson 01", sourceId: "lesson-01" },
];

/** A stub stats entry to avoid undefined de-refs inside WarmUp. */
const STUB_STATS = [
  { id: "drill-01", seenCount: 0, lastCorrect: null, lastSeenAt: null, dueNow: false },
];

function makeRecoveredEntry(sourceId: string): DrillFrictionEntry {
  return {
    sourceId,
    failures: 3,
    passes: 7,
    effectiveFailures: 0,
    recentPasses: 3,
    recentFailures: 0,
    olderPasses: 4,
    olderFailures: 3,
    windowFailures: 0,
    windowPasses: 10,
    recovered: true,
  };
}

function setDrillStatus(friction: DrillFrictionEntry[]) {
  vi.mocked(useDrillStatus).mockReturnValue({
    isLoading: false,
    eligible: STUB_ELIGIBLE,
    stats: STUB_STATS,
    dueCount: 0,
    friction,
    refetchDue: vi.fn(),
  } as unknown as ReturnType<typeof useDrillStatus>);
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("WeakSpotsPanel — all weak spots cleared (recovered-only list)", () => {
  it('shows the "Recently recovered" heading when every entry is recovered', () => {
    setDrillStatus([makeRecoveredEntry("lesson-01"), makeRecoveredEntry("lesson-02")]);
    render(<WarmUp />);
    expect(screen.getByText("Recently recovered")).toBeTruthy();
  });

  it('does not show the "Where you\'ve struggled" heading when active list is empty', () => {
    setDrillStatus([makeRecoveredEntry("lesson-01"), makeRecoveredEntry("lesson-02")]);
    render(<WarmUp />);
    expect(screen.queryByText("Where you've struggled")).toBeNull();
  });

  it('shows the "All recent checks passed" label for every recovered row', () => {
    setDrillStatus([makeRecoveredEntry("lesson-01"), makeRecoveredEntry("lesson-02")]);
    render(<WarmUp />);
    const labels = screen.getAllByText("All recent checks passed");
    expect(labels.length).toBe(2);
  });

  it('shows the "Recovered" badge text for each recovered row', () => {
    setDrillStatus([makeRecoveredEntry("lesson-01"), makeRecoveredEntry("crisis-03")]);
    render(<WarmUp />);
    const badges = screen.getAllByText("Recovered");
    expect(badges.length).toBe(2);
  });

  it("renders one recovered row per entry in the friction list", () => {
    const entries = [
      makeRecoveredEntry("lesson-01"),
      makeRecoveredEntry("lesson-02"),
      makeRecoveredEntry("crisis-01"),
    ];
    setDrillStatus(entries);
    render(<WarmUp />);
    // Each row gets a "Recovered" badge; count must match the entry count.
    expect(screen.getAllByText("Recovered").length).toBe(3);
  });

  it("does not render WeakSpotsPanel at all when friction list is empty", () => {
    setDrillStatus([]);
    render(<WarmUp />);
    expect(screen.queryByText("Recently recovered")).toBeNull();
    expect(screen.queryByText("Where you've struggled")).toBeNull();
  });
});
