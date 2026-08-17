// @vitest-environment jsdom
/**
 * LessonContent — title fallback
 *
 * Confirms that the lesson detail page heading and document.title both fall
 * back to the lesson ID when the API returns a lesson with no title (empty
 * string, whitespace-only, or absent field).
 */

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LessonView } from "./lesson";

// ---------------------------------------------------------------------------
// lucide-react stubs
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    ArrowLeft: s, ChevronDown: s, ChevronUp: s,
    Map: s, RefreshCw: s, Terminal: s, GitBranch: s, Info: s,
    X: s, FileText: s, User: s, Clock: s, GitMerge: s, Package: s, Wrench: s,
  };
});

// ---------------------------------------------------------------------------
// wouter: pin lessonId to "lesson-01"
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
// A minimal repo in a healthy state so we reach the heading render
// ---------------------------------------------------------------------------
const MOCK_REPO = {
  hasPlayground: true,
  initialized: true,
  summary: { branch: "main", ahead: 0, behind: 0, conflicts: 0, staged: 0, unstaged: 0 },
  detachedHead: false,
  currentBranch: "main",
  files: [],
  commits: [],
  branches: [],
  remoteBranches: [],
  syncStatus: null,
  hasBot: false,
};

import { useGetRepoState, useListLessons } from "@workspace/api-client-react";

vi.mock("@workspace/api-client-react", () => ({
  useGetRepoState: vi.fn(),
  useListLessons: vi.fn(),
  getGetRepoStateQueryKey: (id: string) => ["repo-state", id],
  useGetWorkingFileDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCommitDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCrisisFileDiff: vi.fn(() => ({ data: undefined, isPending: true })),
  useGetCrisisCommitDiff: vi.fn(() => ({ data: undefined, isPending: true })),
}));

function setupRepoState() {
  vi.mocked(useGetRepoState).mockReturnValue({
    data: MOCK_REPO,
    isLoading: false,
    isFetching: false,
    isError: false,
    failureCount: 0,
    dataUpdatedAt: Date.now(),
  } as ReturnType<typeof useGetRepoState>);
}

function setupLessons(title: string | undefined) {
  vi.mocked(useListLessons).mockReturnValue({
    data: [{ id: "lesson-01", title, folderName: "lesson-01" }],
    isLoading: false,
  } as ReturnType<typeof useListLessons>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LessonContent — title fallback in heading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRepoState();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the lesson title when it is present", () => {
    setupLessons("First Commit");
    render(<LessonView />);
    expect(screen.getByText("First Commit")).toBeTruthy();
  });

  it("falls back to the lesson ID when title is an empty string", () => {
    setupLessons("");
    render(<LessonView />);
    expect(screen.getByText("lesson-01")).toBeTruthy();
  });

  it("falls back to the lesson ID when title is whitespace-only", () => {
    setupLessons("   ");
    render(<LessonView />);
    expect(screen.getByText("lesson-01")).toBeTruthy();
  });

  it("falls back to the lesson ID when title is undefined", () => {
    setupLessons(undefined);
    render(<LessonView />);
    expect(screen.getByText("lesson-01")).toBeTruthy();
  });

  it("sets document.title to the lesson ID when title is missing", () => {
    setupLessons("");
    render(<LessonView />);
    expect(document.title).toBe("lesson-01 | Test Center");
  });

  it("sets document.title to the real title when it is present", () => {
    setupLessons("First Commit");
    render(<LessonView />);
    expect(document.title).toBe("First Commit | Test Center");
  });
});
