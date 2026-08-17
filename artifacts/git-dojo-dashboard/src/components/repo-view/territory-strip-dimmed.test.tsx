// @vitest-environment jsdom
/**
 * TerritoryStrip — dimmed-state rendering tests.
 *
 * Mounts TerritoryStrip with a successful initial state, then simulates API
 * failure (dimmed=true) and recovery (dimmed=false), asserting that:
 *   1. The strip stays in the DOM throughout (never goes blank).
 *   2. The `opacity-50` class is present while dimmed.
 *   3. The "last known state" label is visible while dimmed.
 *   4. Both the opacity and the label clear once the API recovers.
 */

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { TerritoryStrip } from "./territory-strip";
import type { RepoState } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Stub icon components — jsdom doesn't need real SVG output.
// All stubs must be inline (vi.mock factories are hoisted before variable init).
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => ({
  ArrowRight: () => null,
  ArrowDown: () => null,
  FolderOpen: () => null,
}));

vi.mock("@/components/git-icons", () => ({
  ComputerIcon: () => null,
  TrayIcon: () => null,
  SealedBoxIcon: () => null,
  CloudIcon: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(overrides: Partial<RepoState> = {}): RepoState {
  return {
    lessonId: "lesson-01",
    hasPlayground: true,
    initialized: true,
    currentBranch: "main",
    detachedHead: false,
    mergeInProgress: false,
    files: [],
    commits: [],
    branches: [{ name: "main", isCurrent: true, headHash: "" }],
    remotes: [],
    remoteBranches: [],
    syncStatus: null,
    repoFolder: null,
    summary: "",
    hasBot: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TerritoryStrip — dimmed state (API unreachable)", () => {
  afterEach(() => cleanup());

  it("renders in the DOM with opacity-50 class when dimmed after initial fetch", () => {
    const repo = makeRepo();
    render(<TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={true} />);
    const strip = screen.getByTestId("territory-strip");
    expect(strip).toBeTruthy();
    expect(strip.className).toContain("opacity-50");
  });

  it("shows the 'last known state' label when dimmed", () => {
    const repo = makeRepo();
    render(<TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={true} />);
    expect(screen.getByText("last known state")).toBeTruthy();
  });

  it("does not show 'last known state' when not dimmed (normal state)", () => {
    const repo = makeRepo();
    render(<TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={false} />);
    expect(screen.queryByText("last known state")).toBeNull();
  });

  it("does not apply opacity-50 when not dimmed", () => {
    const repo = makeRepo();
    render(<TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={false} />);
    const strip = screen.getByTestId("territory-strip");
    expect(strip.className).not.toContain("opacity-50");
  });

  it("strip stays in the DOM and becomes dimmed when API goes down", () => {
    const repo = makeRepo();

    // Initial successful fetch — strip is fully visible.
    const { rerender } = render(
      <TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={false} />,
    );
    let strip = screen.getByTestId("territory-strip");
    expect(strip).toBeTruthy();
    expect(strip.className).not.toContain("opacity-50");

    // API goes down — strip must stay in the DOM, now dimmed.
    rerender(<TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={true} />);
    strip = screen.getByTestId("territory-strip");
    expect(strip).toBeTruthy();                        // still in DOM
    expect(strip.className).toContain("opacity-50");   // visually dimmed
    expect(screen.getByText("last known state")).toBeTruthy(); // label visible
  });

  it("strip resumes normal rendering after the API recovers", () => {
    const repo = makeRepo();

    // Simulate: successful fetch → API failure → API recovery.
    const { rerender } = render(
      <TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={false} />,
    );

    // API goes down.
    rerender(<TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={true} />);
    expect(screen.getByTestId("territory-strip").className).toContain("opacity-50");

    // API recovers — new successful fetch arrives with a later timestamp.
    rerender(
      <TerritoryStrip repo={repo} lastFetchedAt={5000} dimmed={false} />,
    );
    const strip = screen.getByTestId("territory-strip");
    expect(strip).toBeTruthy();                              // still in DOM
    expect(strip.className).not.toContain("opacity-50");    // no longer dimmed
    expect(screen.queryByText("last known state")).toBeNull(); // label gone
  });

  it("strip with file-chip data stays in the DOM while dimmed (last-known state retained)", () => {
    // Simulate a repo with staged and unstaged files — the visible data is the
    // "last known state" that must persist while the API is unreachable.
    const repo = makeRepo({
      files: [
        { path: "README.md", status: "modified" },
        { path: "src/app.ts", status: "staged" },
      ],
    });

    const { rerender } = render(
      <TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={false} />,
    );

    // Confirm the workbench file is visible initially.
    expect(screen.getByText("README.md")).toBeTruthy();

    // API goes down — existing content must still appear, just dimmed.
    rerender(<TerritoryStrip repo={repo} lastFetchedAt={1000} dimmed={true} />);
    const strip = screen.getByTestId("territory-strip");
    expect(strip).toBeTruthy();
    expect(strip.className).toContain("opacity-50");
    // File chip still present inside the dimmed strip.
    expect(screen.getByText("README.md")).toBeTruthy();
  });
});
