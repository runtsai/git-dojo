// @vitest-environment jsdom
/**
 * LessonView manifest guard — 404 integration test.
 *
 * Renders the real LessonView component with an unknown lessonId and confirms:
 *   1. The NotFound page (containing "404") is rendered.
 *   2. No data-fetching API hooks (useGetRepoState, useListLessons) are called,
 *      because the guard bails out before LessonContent is ever mounted.
 */

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LessonView } from "./lesson";
import {
  useGetRepoState,
  useListLessons,
} from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// lucide-react: render icons as null so jsdom doesn't choke on SVG quirks.
// All stubs must be inline — vi.mock factories are hoisted before variable init.
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    AlertCircle: s,
    ArrowLeft: s,
    ChevronDown: s,
    ChevronUp: s,
    Map: s,
    RefreshCw: s,
    Terminal: s,
    GitBranch: s,
    Info: s,
  };
});

// ---------------------------------------------------------------------------
// wouter: control lessonId via mockUseParams
// ---------------------------------------------------------------------------
const mockUseParams = vi.fn<() => { lessonId: string }>();

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
// API client hooks — vi.fn() inline so the factory runs without needing
// outer variables (which are uninitialised at hoist time).  We retrieve the
// spy references via vi.mocked() after import.
// ---------------------------------------------------------------------------
vi.mock("@workspace/api-client-react", () => ({
  useGetRepoState: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    failureCount: 0,
    dataUpdatedAt: 0,
  })),
  useListLessons: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
  getGetRepoStateQueryKey: (id: string) => ["repo-state", id],
  // Diff hooks referenced by DiffViewer — keep pending so they never throw
  useGetWorkingFileDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCommitDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCrisisFileDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCrisisCommitDiff: vi.fn(() => ({ data: undefined, isPending: true })),
}));

// ---------------------------------------------------------------------------
// React Query
// ---------------------------------------------------------------------------
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Sub-components only reached when LessonContent is mounted (i.e. never for
// an invalid ID, but the imports must resolve).
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
// Tests
// ---------------------------------------------------------------------------

describe("LessonView manifest guard — unknown lessonId shows NotFound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the 404 page when the lessonId is not in the manifest", () => {
    mockUseParams.mockReturnValue({ lessonId: "lesson-99" });
    render(<LessonView />);
    expect(screen.getByText("404")).toBeTruthy();
  });

  it("renders the 404 page for a random unknown path segment", () => {
    mockUseParams.mockReturnValue({ lessonId: "random-path" });
    render(<LessonView />);
    expect(screen.getByText("404")).toBeTruthy();
  });

  it("renders the 404 page when lessonId is an empty string", () => {
    mockUseParams.mockReturnValue({ lessonId: "" });
    render(<LessonView />);
    expect(screen.getByText("404")).toBeTruthy();
  });

  it("does not call useGetRepoState for an unknown lessonId", () => {
    mockUseParams.mockReturnValue({ lessonId: "lesson-99" });
    render(<LessonView />);
    expect(vi.mocked(useGetRepoState)).not.toHaveBeenCalled();
  });

  it("does not call useListLessons for an unknown lessonId", () => {
    mockUseParams.mockReturnValue({ lessonId: "lesson-99" });
    render(<LessonView />);
    expect(vi.mocked(useListLessons)).not.toHaveBeenCalled();
  });
});
