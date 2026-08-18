// @vitest-environment jsdom
/**
 * CrisisView 404 guard.
 *
 * Confirms that rendering CrisisView with an unknown crisisId (one that
 * doesn't exist in the crises manifest) causes:
 *   1. The NotFound page (showing "404") to render.
 *   2. No data-fetching hook to fire (useGetCrisisRepoState enabled: false).
 */

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CrisisView } from "./crisis";

// ---------------------------------------------------------------------------
// lucide-react stubs — all icons used by CrisisView and NotFound
// ---------------------------------------------------------------------------
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
    AlertCircle: s, // used by NotFound
    X: s,
    FileText: s,
    User: s,
    Clock: s,
    GitMerge: s,
    Package: s,
    Wrench: s,
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
// API client hooks — spied so we can assert enabled: false for unknown IDs
// ---------------------------------------------------------------------------
const mockUseGetCrisisRepoState = vi.fn();
const mockUseListCrisisScenarios = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useGetCrisisRepoState: (...args: unknown[]) =>
    mockUseGetCrisisRepoState(...args),
  getGetCrisisRepoStateQueryKey: (id: string) => ["crisis-repo", id],
  useSetupCrisisScenario: () => ({ mutate: vi.fn(), isPending: false }),
  useListCrisisScenarios: (...args: unknown[]) =>
    mockUseListCrisisScenarios(...args),
  getListCrisisScenariosQueryKey: () => ["list-crisis"],
  useGetCrisisFileDiff: () => ({ data: undefined, isPending: true }),
  useGetCrisisCommitDiff: () => ({ data: undefined, isPending: true }),
  useGetWorkingFileDiff: () => ({ data: undefined, isPending: true }),
  useGetCommitDiff: () => ({ data: undefined, isPending: true }),
}));

// ---------------------------------------------------------------------------
// Sub-components that are not relevant to this test
// ---------------------------------------------------------------------------
vi.mock("@/components/repo-view/summary-panel", () => ({
  SummaryPanel: () => null,
}));

vi.mock("@/components/repo-view/file-status", () => ({
  FileStatus: () => null,
}));

vi.mock("@/components/repo-view/commit-timeline", () => ({
  CommitTimeline: () => null,
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

vi.mock("@/components/repo-view/diff-viewer", () => ({
  DiffViewer: () => null,
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

// NOTE: NotFound is intentionally NOT mocked — we render the real component
// to verify the "404" heading is present in the output.

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CrisisView 404 guard — unknown crisis ID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default stubs so CrisisView doesn't crash for any crisisId.
    mockUseGetCrisisRepoState.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: false,
      failureCount: 0,
    });
    mockUseListCrisisScenarios.mockReturnValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the 404 page when crisisId is not in the manifest', () => {
    mockUseParams.mockReturnValue({ crisisId: "crisis-99" });
    render(<CrisisView />);

    expect(screen.getByText("404")).toBeTruthy();
  });

  it('shows "Page Not Found" when crisisId is not in the manifest', () => {
    mockUseParams.mockReturnValue({ crisisId: "crisis-99" });
    render(<CrisisView />);

    expect(screen.getByText("Page Not Found")).toBeTruthy();
  });

  it('does not fire data-fetching for the invalid ID (both hooks have enabled: false)', () => {
    mockUseParams.mockReturnValue({ crisisId: "crisis-99" });
    render(<CrisisView />);

    // useGetCrisisRepoState is always called (hooks cannot be conditional)
    // but must have enabled: false so no HTTP request is made.
    expect(mockUseGetCrisisRepoState).toHaveBeenCalled();
    const repoStateArgs = mockUseGetCrisisRepoState.mock.calls[0];
    const repoStateOptions = repoStateArgs[1] as { query: { enabled: boolean } };
    expect(repoStateOptions.query.enabled).toBe(false);

    // useListCrisisScenarios must also have enabled: false — an unknown
    // crisis ID must not trigger the scenarios list endpoint.
    expect(mockUseListCrisisScenarios).toHaveBeenCalled();
    const scenariosArgs = mockUseListCrisisScenarios.mock.calls[0];
    const scenariosOptions = scenariosArgs[0] as { query: { enabled: boolean } };
    expect(scenariosOptions.query.enabled).toBe(false);
  });

  it('does not render crisis content when the ID is unknown', () => {
    mockUseParams.mockReturnValue({ crisisId: "crisis-99" });
    render(<CrisisView />);

    // None of the real crisis UI should be present
    expect(screen.queryByText("Back to Crisis Room")).toBeNull();
    expect(screen.queryByText("Trigger the Disaster")).toBeNull();
    expect(screen.queryByText("Incident Briefing")).toBeNull();
  });

  it('does not render 404 for a valid crisis ID (guard is selective)', () => {
    mockUseParams.mockReturnValue({ crisisId: "crisis-01" });
    render(<CrisisView />);

    expect(screen.queryByText("404")).toBeNull();
  });
});
