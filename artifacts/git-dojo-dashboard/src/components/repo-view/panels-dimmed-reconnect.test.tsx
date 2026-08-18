// @vitest-environment jsdom
/**
 * FileStatus, CommitTimeline, BranchList, SummaryPanel — reconnect tests.
 *
 * Mirrors the reconnect scenario already tested for TerritoryStrip (Task 189).
 * Each panel receives dimmed=true to simulate an API outage, then dimmed=false
 * when a successful poll comes back.  After recovery:
 *   - opacity-50 must be absent from the panel root.
 *   - The "last known state" label must be gone from the DOM.
 */

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { FileStatus } from "./file-status";
import { CommitTimeline } from "./commit-timeline";
import { BranchList } from "./branch-list";
import { SummaryPanel } from "./summary-panel";
import type { RepoFile, RepoCommit, RepoBranch } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Stub lucide-react — jsdom doesn't need real SVG output.
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => ({
  File: () => null,
  FilePlus: () => null,
  FileEdit: () => null,
  FileMinus: () => null,
  AlertCircle: () => null,
  HelpCircle: () => null,
  GitCommit: () => null,
  Clock: () => null,
  User: () => null,
  Cloud: () => null,
  GitBranch: () => null,
  GitMerge: () => null,
  Check: () => null,
  Info: () => null,
  AlertTriangle: () => null,
}));

// ---------------------------------------------------------------------------
// Sample fixtures
// ---------------------------------------------------------------------------

const sampleFile: RepoFile = { path: "README.md", status: "modified" };

const sampleCommit: RepoCommit = {
  hash: "abc1234abc1234abc1234abc1234abc1234abc12",
  shortHash: "abc1234",
  subject: "Initial commit",
  authorName: "Alice",
  date: new Date(0).toISOString(),
  parents: [],
};

const sampleBranch: RepoBranch = {
  name: "main",
  isCurrent: true,
  headHash: sampleCommit.hash,
};

// ---------------------------------------------------------------------------
// Helper: find the first element with opacity-50 in a container
// ---------------------------------------------------------------------------
function hasOpacity50(container: HTMLElement): boolean {
  return container.querySelector(".opacity-50") !== null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FileStatus — dimmed → reconnect", () => {
  afterEach(() => cleanup());

  it("shows 'last known state' label when dimmed", () => {
    render(<FileStatus files={[sampleFile]} dimmed={true} />);
    expect(screen.getByText("last known state")).toBeTruthy();
  });

  it("applies opacity-50 when dimmed", () => {
    const { container } = render(<FileStatus files={[sampleFile]} dimmed={true} />);
    expect(hasOpacity50(container)).toBe(true);
  });

  it("removes opacity-50 immediately after recovery", () => {
    const { rerender, container } = render(
      <FileStatus files={[sampleFile]} dimmed={false} />,
    );

    // Simulate outage.
    rerender(<FileStatus files={[sampleFile]} dimmed={true} />);
    expect(hasOpacity50(container)).toBe(true);

    // API recovers — successful poll arrives.
    rerender(<FileStatus files={[sampleFile]} dimmed={false} />);
    expect(hasOpacity50(container)).toBe(false);
  });

  it("removes 'last known state' label immediately after recovery", () => {
    const { rerender } = render(
      <FileStatus files={[sampleFile]} dimmed={false} />,
    );

    rerender(<FileStatus files={[sampleFile]} dimmed={true} />);
    expect(screen.getByText("last known state")).toBeTruthy();

    rerender(<FileStatus files={[sampleFile]} dimmed={false} />);
    expect(screen.queryByText("last known state")).toBeNull();
  });

  it("data is still present in the DOM while dimmed (last-known state retained)", () => {
    const { rerender } = render(
      <FileStatus files={[sampleFile]} dimmed={false} />,
    );
    expect(screen.getByText("README.md")).toBeTruthy();

    rerender(<FileStatus files={[sampleFile]} dimmed={true} />);
    expect(screen.getByText("README.md")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------

describe("CommitTimeline — dimmed → reconnect", () => {
  afterEach(() => cleanup());

  it("shows 'last known state' label when dimmed", () => {
    render(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={true} />,
    );
    expect(screen.getByText("last known state")).toBeTruthy();
  });

  it("applies opacity-50 when dimmed", () => {
    const { container } = render(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={true} />,
    );
    expect(hasOpacity50(container)).toBe(true);
  });

  it("removes opacity-50 immediately after recovery", () => {
    const { rerender, container } = render(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={false} />,
    );

    rerender(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={true} />,
    );
    expect(hasOpacity50(container)).toBe(true);

    rerender(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={false} />,
    );
    expect(hasOpacity50(container)).toBe(false);
  });

  it("removes 'last known state' label immediately after recovery", () => {
    const { rerender } = render(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={false} />,
    );

    rerender(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={true} />,
    );
    expect(screen.getByText("last known state")).toBeTruthy();

    rerender(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={false} />,
    );
    expect(screen.queryByText("last known state")).toBeNull();
  });

  it("commit subject is still present in the DOM while dimmed", () => {
    const { rerender } = render(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={false} />,
    );
    expect(screen.getByText("Initial commit")).toBeTruthy();

    rerender(
      <CommitTimeline commits={[sampleCommit]} branches={[sampleBranch]} dimmed={true} />,
    );
    expect(screen.getByText("Initial commit")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------

describe("BranchList — dimmed → reconnect", () => {
  afterEach(() => cleanup());

  it("shows 'last known state' label when dimmed", () => {
    render(<BranchList branches={[sampleBranch]} dimmed={true} />);
    expect(screen.getByText("last known state")).toBeTruthy();
  });

  it("applies opacity-50 when dimmed", () => {
    const { container } = render(<BranchList branches={[sampleBranch]} dimmed={true} />);
    expect(hasOpacity50(container)).toBe(true);
  });

  it("removes opacity-50 immediately after recovery", () => {
    const { rerender, container } = render(
      <BranchList branches={[sampleBranch]} dimmed={false} />,
    );

    rerender(<BranchList branches={[sampleBranch]} dimmed={true} />);
    expect(hasOpacity50(container)).toBe(true);

    rerender(<BranchList branches={[sampleBranch]} dimmed={false} />);
    expect(hasOpacity50(container)).toBe(false);
  });

  it("removes 'last known state' label immediately after recovery", () => {
    const { rerender } = render(
      <BranchList branches={[sampleBranch]} dimmed={false} />,
    );

    rerender(<BranchList branches={[sampleBranch]} dimmed={true} />);
    expect(screen.getByText("last known state")).toBeTruthy();

    rerender(<BranchList branches={[sampleBranch]} dimmed={false} />);
    expect(screen.queryByText("last known state")).toBeNull();
  });

  it("branch name is still present in the DOM while dimmed", () => {
    const { rerender } = render(
      <BranchList branches={[sampleBranch]} dimmed={false} />,
    );
    expect(screen.getByText("main")).toBeTruthy();

    rerender(<BranchList branches={[sampleBranch]} dimmed={true} />);
    expect(screen.getByText("main")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------

describe("SummaryPanel — dimmed → reconnect", () => {
  afterEach(() => cleanup());

  it("shows 'last known state' label when dimmed", () => {
    render(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={true}
      />,
    );
    expect(screen.getByText("last known state")).toBeTruthy();
  });

  it("applies opacity-50 when dimmed", () => {
    const { container } = render(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={true}
      />,
    );
    expect(hasOpacity50(container)).toBe(true);
  });

  it("removes opacity-50 immediately after recovery", () => {
    const { rerender, container } = render(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={false}
      />,
    );

    rerender(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={true}
      />,
    );
    expect(hasOpacity50(container)).toBe(true);

    rerender(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={false}
      />,
    );
    expect(hasOpacity50(container)).toBe(false);
  });

  it("removes 'last known state' label immediately after recovery", () => {
    const { rerender } = render(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={false}
      />,
    );

    rerender(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={true}
      />,
    );
    expect(screen.getByText("last known state")).toBeTruthy();

    rerender(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={false}
      />,
    );
    expect(screen.queryByText("last known state")).toBeNull();
  });

  it("summary text is still present in the DOM while dimmed", () => {
    const { rerender } = render(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={false}
      />,
    );
    expect(screen.getByText("Working tree clean.")).toBeTruthy();

    rerender(
      <SummaryPanel
        summary="Working tree clean."
        isDetached={false}
        currentBranch="main"
        dimmed={true}
      />,
    );
    expect(screen.getByText("Working tree clean.")).toBeTruthy();
  });
});
