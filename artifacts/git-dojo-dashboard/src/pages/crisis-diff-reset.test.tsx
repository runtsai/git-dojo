// @vitest-environment jsdom
/**
 * Diff viewer reset on crisis navigation.
 *
 * Renders the real CrisisView component, opens the diff panel via a file or
 * commit click, then navigates to a different crisis URL and asserts the
 * DiffViewer panel disappears.
 *
 * This mirrors exactly what a user does when they navigate directly between
 * two crisis URLs (e.g. /crisis/crisis-01 → /crisis/crisis-02) while a diff
 * panel is open — the useEffect keyed on crisisId must reset diffSelection.
 */

import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CrisisView } from "./crisis";

// ---------------------------------------------------------------------------
// lucide-react: override the node-env stub so jsdom can render icons as null.
// All stubs are defined inline — vi.mock factories are hoisted before any
// top-level variable initialisation, so references to outer variables fail.
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    // Icons used by CrisisView
    ArrowLeft: s, RefreshCw: s, Siren: s, Lightbulb: s,
    ChevronDown: s, Flame: s, Award: s, Target: s,
    // Icons used by the real DiffViewer
    X: s, FileText: s, User: s, Clock: s,
    GitMerge: s, Package: s, Wrench: s,
  };
});

// ---------------------------------------------------------------------------
// wouter: controllable crisisId
// ---------------------------------------------------------------------------
const mockUseParams = vi.fn<() => { crisisId: string }>();

vi.mock("wouter", () => ({
  useParams: () => mockUseParams(),
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
// API client hooks
// useGetCrisisRepoState returns an initialised repo so the live panel renders.
// useGetCrisisFileDiff / useGetCrisisCommitDiff stay pending so DiffViewer
// renders its loading state without needing real HTTP.
// ---------------------------------------------------------------------------
vi.mock("@workspace/api-client-react", () => ({
  useGetCrisisRepoState: () => ({
    data: {
      initialized: true,
      summary: {
        branch: "main",
        ahead: 0,
        behind: 0,
        conflicts: 0,
        staged: 0,
        unstaged: 1,
      },
      detachedHead: false,
      currentBranch: "main",
      files: [
        {
          path: "rates.ts",
          changeKind: "modified",
          staged: false,
          renamedFrom: null,
          added: 1,
          removed: 0,
          truncated: false,
          lines: [],
        },
      ],
      commits: [
        {
          hash: "abc1234def5678",
          shortHash: "abc1234",
          message: "init",
          author: "dev",
          date: "2024-01-01T00:00:00Z",
          parents: [],
        },
      ],
    },
    isFetching: false,
    isError: false,
    failureCount: 0,
  }),
  getGetCrisisRepoStateQueryKey: (id: string) => ["crisis-repo", id],
  useSetupCrisisScenario: () => ({ mutate: vi.fn(), isPending: false }),
  useListCrisisScenarios: () => ({ data: [] }),
  getListCrisisScenariosQueryKey: () => ["list-crisis"],
  // All four diff hooks must be present — DiffViewer imports every variant
  // regardless of which source (lesson vs crisis) is active in a given render.
  useGetCrisisFileDiff: () => ({ data: undefined, isPending: true }),
  useGetCrisisCommitDiff: () => ({ data: undefined, isPending: true }),
  useGetWorkingFileDiff: () => ({ data: undefined, isPending: true }),
  useGetCommitDiff: () => ({ data: undefined, isPending: true }),
}));

// ---------------------------------------------------------------------------
// Sub-components
// SummaryPanel, BranchList, CrisisCheckRunner, MapPeek → null stubs.
// FileStatus → button that fires onFileClick so the test can open a file diff.
// CommitTimeline → button that fires onCommitClick so the test can open a commit diff.
// DiffViewer is NOT mocked — we keep it real to test the actual reset path.
// ---------------------------------------------------------------------------
vi.mock("@/components/repo-view/summary-panel", () => ({
  SummaryPanel: () => null,
}));

vi.mock("@/components/repo-view/file-status", () => ({
  FileStatus: ({
    onFileClick,
  }: {
    files: unknown[];
    onFileClick: (f: { path: string }) => void;
  }) =>
    React.createElement(
      "button",
      {
        "data-testid": "trigger-file-diff",
        onClick: () => onFileClick({ path: "rates.ts" }),
      },
      "open file diff",
    ),
}));

vi.mock("@/components/repo-view/commit-timeline", () => ({
  CommitTimeline: ({
    onCommitClick,
  }: {
    commits: unknown[];
    onCommitClick: (c: { hash: string; shortHash: string }) => void;
  }) =>
    React.createElement(
      "button",
      {
        "data-testid": "trigger-commit-diff",
        onClick: () =>
          onCommitClick({ hash: "abc1234def5678", shortHash: "abc1234" }),
      },
      "open commit diff",
    ),
}));

vi.mock("@/components/repo-view/branch-list", () => ({
  BranchList: () => null,
}));

vi.mock("@/components/repo-view/crisis-check-runner", () => ({
  CrisisCheckRunner: () => null,
}));

vi.mock("@/components/map-peek", () => ({
  MapPeek: () => null,
}));

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

// NotFound is rendered when the crisis isn't found — stub it to avoid its deps
vi.mock("@/pages/not-found", () => ({
  default: () => React.createElement("div", { "data-testid": "not-found" }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderOnCrisis01() {
  mockUseParams.mockReturnValue({ crisisId: "crisis-01" });
  return render(<CrisisView />);
}

function navigateToCrisis02(rerender: (ui: React.ReactElement) => void) {
  act(() => {
    mockUseParams.mockReturnValue({ crisisId: "crisis-02" });
    rerender(<CrisisView />);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("diff viewer closes when navigating to a different crisis URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("closes a file-diff panel after navigating from crisis-01 to crisis-02", () => {
    const { rerender } = renderOnCrisis01();

    // Open the file diff panel
    fireEvent.click(screen.getByTestId("trigger-file-diff"));
    expect(screen.getByTestId("diff-viewer")).toBeTruthy();

    // Navigate to a different crisis URL
    navigateToCrisis02(rerender);

    // The diff viewer must be gone
    expect(screen.queryByTestId("diff-viewer")).toBeNull();
  });

  it("closes a commit-diff panel after navigating from crisis-01 to crisis-02", () => {
    const { rerender } = renderOnCrisis01();

    // Open the commit diff panel
    fireEvent.click(screen.getByTestId("trigger-commit-diff"));
    expect(screen.getByTestId("diff-viewer")).toBeTruthy();

    // Navigate to a different crisis URL
    navigateToCrisis02(rerender);

    expect(screen.queryByTestId("diff-viewer")).toBeNull();
  });

  it("diff viewer stays open when the same crisis URL is re-rendered without navigation", () => {
    const { rerender } = renderOnCrisis01();

    fireEvent.click(screen.getByTestId("trigger-file-diff"));
    expect(screen.getByTestId("diff-viewer")).toBeTruthy();

    // Re-render with the same crisis — crisisId is unchanged, effect must not fire
    act(() => {
      rerender(<CrisisView />);
    });

    expect(screen.getByTestId("diff-viewer")).toBeTruthy();
  });

  it("diff viewer is absent on the new crisis when no panel was open before navigation", () => {
    const { rerender } = renderOnCrisis01();

    // No diff opened at all
    expect(screen.queryByTestId("diff-viewer")).toBeNull();

    navigateToCrisis02(rerender);

    expect(screen.queryByTestId("diff-viewer")).toBeNull();
  });
});
