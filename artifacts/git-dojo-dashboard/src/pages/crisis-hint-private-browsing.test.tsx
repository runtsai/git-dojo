// @vitest-environment jsdom
/**
 * Confirms that hint-reveal progress tracked via safeStorage is never lost
 * mid-session in private browsing (localStorage fully blocked).
 *
 * safeStorage mirrors every write to an in-memory map so values survive even
 * when localStorage throws SecurityError on every access. These tests
 * exercise that guarantee at the component level using the exact key format
 * that crisis.tsx uses: `crisis-hints-<crisisId>`.
 */

import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeStorage } from "@/lib/safe-storage";

// ---------------------------------------------------------------------------
// External module mocks — defined before the component import so vi.mock
// hoisting applies them correctly.
// ---------------------------------------------------------------------------

// Minimal crisis fixture — declared as a const so the vi.mock factories below
// can reference it. vi.mock is hoisted to the top of the file so the variable
// must be defined BEFORE the first vi.mock call or inlined inside the factory.
// We inline directly inside the factory to avoid the hoisting hazard.

const FAKE_CRISIS_ID = "crisis-01";

vi.mock("@/content/crises", () => ({
  crises: [
    {
      id: "crisis-01",
      number: 1,
      title: "The Stranded Correction",
      tagline: "Detached HEAD",
      briefing: ["You went back to look at an old snapshot."],
      goal: "Get back onto a branch.",
      hints: {
        nudge: "Try git log --all --oneline",
        concept: "Commits need a branch pointer.",
        command: "git branch recovery <hash>",
      },
      debrief: "Well done.",
      breakthroughId: "detached-head",
      breakthroughTitle: "Detached HEAD",
    },
  ],
}));

vi.mock("@/content/hint-steps", () => ({
  HINT_STEPS: [
    { key: "nudge", label: "Hint 1 — A nudge" },
    { key: "concept", label: "Hint 2 — The concept" },
    { key: "command", label: "Hint 3 — The exact command" },
  ],
}));

// API hooks — return a live, initialized repo so the hints ladder renders.
const FAKE_REPO = {
  initialized: true,
  hasPlayground: true,
  currentBranch: "main",
  detachedHead: false,
  summary: { ahead: 0, behind: 0, clean: true },
  files: [],
  commits: [],
  branches: ["main"],
  remoteBranches: [],
  syncStatus: "synced",
};

vi.mock("@workspace/api-client-react", () => ({
  useGetCrisisRepoState: () => ({
    data: FAKE_REPO,
    isFetching: false,
    isError: false,
    failureCount: 0,
  }),
  useSetupCrisisScenario: () => ({ mutate: vi.fn(), isPending: false }),
  useListCrisisScenarios: () => ({
    data: [{ id: FAKE_CRISIS_ID, solved: false, path: `~/git-dojo/playground/${FAKE_CRISIS_ID}` }],
  }),
  getGetCrisisRepoStateQueryKey: (id: string) => ["crisis-repo", id],
  getListCrisisScenariosQueryKey: () => ["crisis-scenarios"],
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// wouter — stub useParams to return our fixture id; Link renders as <a>.
vi.mock("wouter", () => ({
  useParams: () => ({ crisisId: FAKE_CRISIS_ID }),
  Link: ({
    href,
    children,
    className,
    onClick,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) =>
    React.createElement("a", { href, className, onClick, ...rest }, children),
}));

// lucide-react — null stubs for all icons used by crisis.tsx.
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    ArrowLeft: s,
    RefreshCw: s,
    Siren: s,
    Lightbulb: s,
    ChevronDown: s,
    Flame: s,
    Award: s,
    Target: s,
  };
});

// Heavy sub-components — not under test here.
vi.mock("@/components/repo-view/summary-panel", () => ({ SummaryPanel: () => null }));
vi.mock("@/components/repo-view/file-status", () => ({ FileStatus: () => null }));
vi.mock("@/components/repo-view/commit-timeline", () => ({ CommitTimeline: () => null }));
vi.mock("@/components/repo-view/branch-list", () => ({ BranchList: () => null }));
vi.mock("@/components/repo-view/crisis-check-runner", () => ({
  CrisisCheckRunner: () => null,
}));
vi.mock("@/components/repo-view/diff-viewer", () => ({ DiffViewer: () => null }));
vi.mock("@/components/map-peek", () => ({ MapPeek: () => null }));
vi.mock("@/pages/not-found", () => ({ default: () => React.createElement("div", null, "Not Found") }));

// ---------------------------------------------------------------------------
// Import the component AFTER mocks are registered.
// ---------------------------------------------------------------------------
import { CrisisView } from "./crisis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make every localStorage method throw a SecurityError on every call. */
function breakLocalStorage() {
  const err = () => {
    throw new DOMException("SecurityError: storage is blocked", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(err);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(err);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(err);
  vi.spyOn(Storage.prototype, "clear").mockImplementation(err);
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset in-memory fallback between tests.
  safeStorage._resetMemStore();
  // Break localStorage to simulate private browsing.
  breakLocalStorage();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Hint count — initial read when localStorage is blocked
// ---------------------------------------------------------------------------

describe("hint count — reading when localStorage is blocked", () => {
  it("returns null for the hint key when no value has been written", () => {
    // safeStorage has been reset and localStorage is broken — nothing in
    // either store for this key.
    expect(safeStorage.getItem(`crisis-hints-${FAKE_CRISIS_ID}`)).toBeNull();
  });

  it("component renders with hintsOpen = 0 (no hints revealed by default)", () => {
    render(<CrisisView />);
    // All hint buttons should be in the document, but none of the hint body
    // text should be visible (revealed is false for all when hintsOpen = 0).
    expect(screen.getByText("Hint 1 — A nudge")).toBeTruthy();
    expect(screen.queryByText("Try git log --all --oneline")).toBeNull();
  });

  it("does not throw when reading the hint key while localStorage is blocked", () => {
    expect(() =>
      safeStorage.getItem(`crisis-hints-${FAKE_CRISIS_ID}`)
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Hint count — writing when localStorage is blocked (in-memory fallback)
// ---------------------------------------------------------------------------

describe("hint count — writing when localStorage is blocked", () => {
  it("persists to the in-memory fallback so the same value is readable", () => {
    // Simulate what setHintsOpenPersisted() does inside the component.
    safeStorage.setItem(`crisis-hints-${FAKE_CRISIS_ID}`, "1");
    // Even though localStorage is broken, the value must come back from memStore.
    expect(safeStorage.getItem(`crisis-hints-${FAKE_CRISIS_ID}`)).toBe("1");
  });

  it("reflects the latest write when updated multiple times", () => {
    safeStorage.setItem(`crisis-hints-${FAKE_CRISIS_ID}`, "1");
    safeStorage.setItem(`crisis-hints-${FAKE_CRISIS_ID}`, "2");
    expect(safeStorage.getItem(`crisis-hints-${FAKE_CRISIS_ID}`)).toBe("2");
  });

  it("does not throw when writing while localStorage is blocked", () => {
    expect(() =>
      safeStorage.setItem(`crisis-hints-${FAKE_CRISIS_ID}`, "3")
    ).not.toThrow();
  });

  it("sets the in-memory fallback so re-reading returns the value after revealing a hint", () => {
    render(<CrisisView />);
    // Click the first hint button to reveal it.
    const hint1Button = screen.getByText("Hint 1 — A nudge");
    fireEvent.click(hint1Button);
    // safeStorage must have written "1" to the memory store even though
    // localStorage threw — the same value is readable in this session.
    expect(safeStorage.getItem(`crisis-hints-${FAKE_CRISIS_ID}`)).toBe("1");
  });

  it("advances the in-memory count correctly when a second hint is revealed", () => {
    render(<CrisisView />);
    // Reveal hint 1 first.
    fireEvent.click(screen.getByText("Hint 1 — A nudge"));
    // Hint 2 button becomes enabled — click it.
    fireEvent.click(screen.getByText("Hint 2 — The concept"));
    expect(safeStorage.getItem(`crisis-hints-${FAKE_CRISIS_ID}`)).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// Hint count — value pre-seeded in in-memory store before render
// ---------------------------------------------------------------------------

describe("hint count — pre-seeded in-memory store (simulates mid-session remount)", () => {
  it("reads back the pre-seeded hint count even when localStorage is blocked", () => {
    // Seed the in-memory store as if a prior write already happened this session.
    safeStorage.setItem(`crisis-hints-${FAKE_CRISIS_ID}`, "2");
    // A fresh read must return the seeded value, not null.
    expect(safeStorage.getItem(`crisis-hints-${FAKE_CRISIS_ID}`)).toBe("2");
  });

  it("component initialises hintsOpen from the pre-seeded value (hints 1 & 2 already revealed)", () => {
    // Seed before render — simulates navigating away and back mid-session.
    safeStorage.setItem(`crisis-hints-${FAKE_CRISIS_ID}`, "2");
    render(<CrisisView />);
    // Hints 1 and 2 body text should be visible because hintsOpen was seeded to 2.
    expect(screen.getByText("Try git log --all --oneline")).toBeTruthy();
    expect(screen.getByText("Commits need a branch pointer.")).toBeTruthy();
    // Hint 3 should still be hidden.
    expect(screen.queryByText("git branch recovery <hash>")).toBeNull();
  });
});
