// @vitest-environment jsdom
/**
 * Reconnecting banner lifecycle — LessonContent (lesson.tsx)
 *
 * Verifies that:
 *   1. No banner is shown while the API is healthy (failureCount = 0).
 *   2. The banner appears once isFetching is true and failureCount >= 1
 *      (second poll cycle after the first miss).
 *   3. The banner disappears when the API recovers (failureCount resets to 0
 *      and isFetching falls back to false after a successful fetch).
 *
 * Uses the real LessonView → LessonContent component with all sub-components
 * stubbed so only the banner logic under test is exercised.
 */

import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LessonView } from "./lesson";

// ---------------------------------------------------------------------------
// lucide-react stubs (must be inline — factory is hoisted before variable init)
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    ArrowLeft: s, ChevronDown: s, ChevronUp: s,
    Map: s, RefreshCw: s, Terminal: s, GitBranch: s, Info: s,
    // DiffViewer icons (imported even when the viewer isn't open)
    X: s, FileText: s, User: s, Clock: s, GitMerge: s, Package: s, Wrench: s,
  };
});

// ---------------------------------------------------------------------------
// wouter: pin lessonId to a known valid id
// ---------------------------------------------------------------------------
vi.mock("wouter", () => ({
  useParams: () => ({ lessonId: "lesson-01" }),
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
// A minimal repo object with playground + initialized = true so LessonContent
// renders past the "no playground" / "not initialized" guards and reaches the
// banner region.
// ---------------------------------------------------------------------------
const MOCK_REPO = {
  hasPlayground: true,
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
  branches: [],
  remoteBranches: [],
  syncStatus: null,
  hasBot: false,
};

// useGetRepoState is a vi.fn() so each test can override the return value.
vi.mock("@workspace/api-client-react", () => ({
  useGetRepoState: vi.fn(),
  useListLessons: vi.fn(() => ({
    data: [{ id: "lesson-01", title: "Lesson One", folderName: "lesson-01" }],
    isLoading: false,
  })),
  getGetRepoStateQueryKey: (id: string) => ["repo-state", id],
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
vi.mock("@/components/repo-view/check-runner", () => ({ CheckRunner: () => null }));
vi.mock("@/components/repo-view/teammate-action", () => ({ TeammateAction: () => null }));
vi.mock("@/components/repo-view/territory-strip", () => ({ TerritoryStrip: () => null }));
vi.mock("@/components/repo-view/diff-viewer", () => ({ DiffViewer: () => null }));
vi.mock("@/components/map-peek", () => ({ MapPeek: () => null }));
vi.mock("@/components/ui/command-block", () => ({ CommandBlock: () => null }));

vi.mock("@/lib/safe-storage", () => ({
  safeStorage: {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { useGetRepoState } from "@workspace/api-client-react";

const BANNER_TEXT = "Lost contact with the practice watcher — reconnecting…";

function setQueryState({
  isFetching,
  failureCount,
  data = MOCK_REPO,
  isLoading = false,
  dataUpdatedAt = Date.now(),
}: {
  isFetching: boolean;
  failureCount: number;
  data?: typeof MOCK_REPO | undefined;
  isLoading?: boolean;
  dataUpdatedAt?: number;
}) {
  vi.mocked(useGetRepoState).mockReturnValue({
    data,
    isLoading,
    isFetching,
    isError: false,
    failureCount,
    dataUpdatedAt,
  } as ReturnType<typeof useGetRepoState>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LessonContent reconnecting banner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not show the banner when the API is healthy (failureCount = 0)", () => {
    setQueryState({ isFetching: false, failureCount: 0 });
    render(<LessonView />);
    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });

  it("does not show the banner on the first failed cycle (failureCount = 0, isFetching = true)", () => {
    // failureCount is still 0 during the very first retry attempt
    setQueryState({ isFetching: true, failureCount: 0 });
    render(<LessonView />);
    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });

  it("shows the banner when isFetching and failureCount >= 1", () => {
    setQueryState({ isFetching: true, failureCount: 1 });
    render(<LessonView />);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
  });

  it("shows the banner when failureCount is 2 or more", () => {
    setQueryState({ isFetching: true, failureCount: 2 });
    render(<LessonView />);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
  });

  it("clears the banner after the API recovers (failureCount resets to 0)", () => {
    // Step 1: simulate two failed poll cycles → banner should appear
    setQueryState({ isFetching: true, failureCount: 1 });
    const { rerender } = render(<LessonView />);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();

    // Step 2: API recovers — React Query resets failureCount to 0 and
    // isFetching becomes false after a successful fetch completes.
    act(() => {
      setQueryState({ isFetching: false, failureCount: 0 });
      rerender(<LessonView />);
    });

    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });

  it("clears the banner even when the next successful fetch is still in-flight (isFetching true, failureCount 0)", () => {
    // failureCount resets to 0 the moment a response succeeds, which can
    // happen while isFetching is still true on a subsequent background refetch.
    setQueryState({ isFetching: true, failureCount: 1 });
    const { rerender } = render(<LessonView />);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();

    act(() => {
      // failureCount reset to 0 but a new background fetch is already in-flight
      setQueryState({ isFetching: true, failureCount: 0 });
      rerender(<LessonView />);
    });

    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });

  it("banner has role='status' so assistive tech announces the recovery", () => {
    setQueryState({ isFetching: true, failureCount: 1 });
    render(<LessonView />);
    const banner = screen.getByRole("status");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain("reconnecting");
  });
});
