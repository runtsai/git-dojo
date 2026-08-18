// @vitest-environment jsdom
/**
 * CrisisView stale-repo preservation during API outage
 *
 * Verifies that when `data` becomes undefined mid-session (API slow / unreachable),
 * the repo content panel remains visible via the lastKnownRepoRef instead of
 * flipping back to the "disaster hasn't happened yet" placeholder.
 *
 * Also verifies that the stale-repo fallback is scoped to the active crisisId:
 * navigating to a different crisis while data is undefined must not bleed through
 * the previous crisis's repo state.
 */

import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CrisisView } from "./crisis";

// ---------------------------------------------------------------------------
// Mutable crisisId — must be hoisted so the wouter factory can close over it.
// ---------------------------------------------------------------------------
const mockParams = vi.hoisted(() => ({ crisisId: "crisis-01" }));

// ---------------------------------------------------------------------------
// lucide-react stubs
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    ArrowLeft: s, RefreshCw: s, Siren: s, Lightbulb: s,
    ChevronDown: s, Flame: s, Award: s, Target: s,
    X: s, FileText: s, User: s, Clock: s, GitMerge: s, Package: s, Wrench: s,
  };
});

// ---------------------------------------------------------------------------
// wouter: returns whatever crisisId is set in mockParams
// ---------------------------------------------------------------------------
vi.mock("wouter", () => ({
  useParams: () => ({ crisisId: mockParams.crisisId }),
  Link: ({
    href,
    children,
    className,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) =>
    React.createElement("a", { href, className, ...rest }, children),
}));

// ---------------------------------------------------------------------------
// React Query
// ---------------------------------------------------------------------------
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// A minimal initialized repo (disaster already triggered).
// ---------------------------------------------------------------------------
const MOCK_REPO = {
  initialized: true,
  summary: {
    branch: "main",
    ahead: 0,
    behind: 0,
    conflicts: 0,
    staged: 0,
    unstaged: 0,
  },
  detachedHead: false,
  currentBranch: "main",
  files: [],
  commits: [],
};

vi.mock("@workspace/api-client-react", () => ({
  useGetCrisisRepoState: vi.fn(),
  useSetupCrisisScenario: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useListCrisisScenarios: vi.fn(() => ({
    data: [
      { id: "crisis-01", solved: false, path: "~/git-dojo/playground/crisis-01" },
      { id: "crisis-02", solved: false, path: "~/git-dojo/playground/crisis-02" },
    ],
  })),
  getGetCrisisRepoStateQueryKey: (id: string) => ["crisis-repo", id],
  getListCrisisScenariosQueryKey: () => ["list-crisis"],
  useGetWorkingFileDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCommitDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCrisisFileDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCrisisCommitDiff: vi.fn(() => ({ data: undefined, isPending: true })),
}));

// ---------------------------------------------------------------------------
// Sub-component stubs
// ---------------------------------------------------------------------------
vi.mock("@/components/repo-view/summary-panel", () => ({ SummaryPanel: () => null }));
vi.mock("@/components/repo-view/file-status", () => ({ FileStatus: () => null }));
vi.mock("@/components/repo-view/commit-timeline", () => ({ CommitTimeline: () => null }));
vi.mock("@/components/repo-view/branch-list", () => ({ BranchList: () => null }));
vi.mock("@/components/repo-view/crisis-check-runner", () => ({ CrisisCheckRunner: () => null }));
vi.mock("@/components/repo-view/diff-viewer", () => ({ DiffViewer: () => null }));
vi.mock("@/components/map-peek", () => ({ MapPeek: () => null }));

vi.mock("@/lib/safe-storage", () => ({
  safeStorage: {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/content/hint-steps", () => ({
  HINT_STEPS: [],
}));

vi.mock("@/pages/not-found", () => ({
  default: () => React.createElement("div", { "data-testid": "not-found" }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { useGetCrisisRepoState } from "@workspace/api-client-react";

const PLACEHOLDER_TEXT = "The disaster hasn't happened yet";

function setQueryState({
  isFetching,
  failureCount,
  data,
  isError = false,
}: {
  isFetching: boolean;
  failureCount: number;
  data: typeof MOCK_REPO | undefined;
  isError?: boolean;
}) {
  vi.mocked(useGetCrisisRepoState).mockReturnValue({
    data,
    isFetching,
    isError,
    failureCount,
  } as ReturnType<typeof useGetCrisisRepoState>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("CrisisView stale-repo preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.crisisId = "crisis-01";
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the placeholder when no repo data has ever been received", () => {
    setQueryState({ isFetching: false, failureCount: 0, data: undefined });
    render(<CrisisView />);
    expect(screen.getByText(PLACEHOLDER_TEXT)).toBeTruthy();
  });

  it("hides the placeholder once the repo is initialized", () => {
    setQueryState({ isFetching: false, failureCount: 0, data: MOCK_REPO });
    render(<CrisisView />);
    expect(screen.queryByText(PLACEHOLDER_TEXT)).toBeNull();
  });

  it("keeps the repo content visible when data becomes undefined mid-session (API outage)", () => {
    // Step 1: healthy state — repo loaded and initialized.
    setQueryState({ isFetching: false, failureCount: 0, data: MOCK_REPO });
    const { rerender } = render(<CrisisView />);
    expect(screen.queryByText(PLACEHOLDER_TEXT)).toBeNull();

    // Step 2: API goes silent — data is undefined, failureCount rises.
    // Without lastKnownRepoRef the component would flip back to the placeholder.
    act(() => {
      setQueryState({ isFetching: true, failureCount: 1, data: undefined });
      rerender(<CrisisView />);
    });

    // The "disaster hasn't happened yet" placeholder must NOT appear — stale
    // repo data should be used to keep the content panel visible.
    expect(screen.queryByText(PLACEHOLDER_TEXT)).toBeNull();
  });

  it("keeps the repo content visible across multiple failed poll cycles", () => {
    setQueryState({ isFetching: false, failureCount: 0, data: MOCK_REPO });
    const { rerender } = render(<CrisisView />);

    // Simulate several consecutive failed poll cycles.
    for (let count = 1; count <= 3; count++) {
      act(() => {
        setQueryState({ isFetching: true, failureCount: count, data: undefined });
        rerender(<CrisisView />);
      });
      expect(screen.queryByText(PLACEHOLDER_TEXT)).toBeNull();
    }
  });

  it("keeps the repo content visible even when isError is true (all retries exhausted)", () => {
    setQueryState({ isFetching: false, failureCount: 0, data: MOCK_REPO });
    const { rerender } = render(<CrisisView />);

    act(() => {
      setQueryState({ isFetching: false, failureCount: 3, data: undefined, isError: true });
      rerender(<CrisisView />);
    });

    expect(screen.queryByText(PLACEHOLDER_TEXT)).toBeNull();
  });

  it("shows the placeholder when only an uninitialized repo was seen before the outage", () => {
    // The ref only updates when initialized = true (disaster triggered).
    // An uninitialized repo response is intentionally not persisted, so a
    // subsequent outage still shows the placeholder rather than stale
    // pre-trigger state.
    const uninitializedRepo = { ...MOCK_REPO, initialized: false };
    setQueryState({ isFetching: false, failureCount: 0, data: uninitializedRepo });
    const { rerender } = render(<CrisisView />);
    expect(screen.getByText(PLACEHOLDER_TEXT)).toBeTruthy();

    act(() => {
      setQueryState({ isFetching: true, failureCount: 1, data: undefined });
      rerender(<CrisisView />);
    });

    // Still shows placeholder — no initialized repo was ever seen.
    expect(screen.getByText(PLACEHOLDER_TEXT)).toBeTruthy();
  });

  it("clears the stale display once the API returns a fresh initialized repo", () => {
    setQueryState({ isFetching: false, failureCount: 0, data: MOCK_REPO });
    const { rerender } = render(<CrisisView />);

    // Outage
    act(() => {
      setQueryState({ isFetching: true, failureCount: 1, data: undefined });
      rerender(<CrisisView />);
    });
    expect(screen.queryByText(PLACEHOLDER_TEXT)).toBeNull();

    // Recovery
    act(() => {
      setQueryState({ isFetching: false, failureCount: 0, data: MOCK_REPO });
      rerender(<CrisisView />);
    });
    expect(screen.queryByText(PLACEHOLDER_TEXT)).toBeNull();
  });

  it("does NOT bleed the previous crisis repo into a newly-navigated crisis", () => {
    // Step 1: crisis-01 is live — ref is populated with crisis-01 data.
    mockParams.crisisId = "crisis-01";
    setQueryState({ isFetching: false, failureCount: 0, data: MOCK_REPO });
    const { rerender } = render(<CrisisView />);
    expect(screen.queryByText(PLACEHOLDER_TEXT)).toBeNull();

    // Step 2: user navigates to crisis-02; initial fetch is still in-flight
    // (data is undefined).  The ref holds crisis-01 data but the active ID is
    // now crisis-02, so the stale fallback must NOT fire — placeholder should
    // be shown for crisis-02 as if it were a fresh visit.
    act(() => {
      mockParams.crisisId = "crisis-02";
      setQueryState({ isFetching: true, failureCount: 0, data: undefined });
      rerender(<CrisisView />);
    });

    expect(screen.getByText(PLACEHOLDER_TEXT)).toBeTruthy();
  });
});
