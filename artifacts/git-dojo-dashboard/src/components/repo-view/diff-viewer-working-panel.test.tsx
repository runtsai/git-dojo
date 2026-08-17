// @vitest-environment jsdom
/**
 * Component-level regression tests for FileDiffCard (and by extension the
 * WorkingDiffPanel that feeds it) when a staged entry is a renamed file that
 * also carries merge-conflict marker lines.
 *
 * Guard: if the path-rendering branch is ever refactored to use `entry.path`
 * directly and skip `renamedFrom`, the old-name label silently disappears.
 * These tests catch that regression by asserting:
 *
 *   1. The struck-through old path is visible in the rendered card.
 *   2. The new (canonical) path is visible in the rendered card.
 *   3. Conflict-marker lines (<<<<<<< / ======= / >>>>>>>) are present in
 *      the DOM and are NOT hidden.
 */

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { FileDiffCard } from "./diff-viewer";
import type { FileDiff } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Stub icon components — jsdom doesn't need real SVG output.
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => ({
  FileText: () => null,
  X: () => null,
  User: () => null,
  Clock: () => null,
  GitMerge: () => null,
  Package: () => null,
  Wrench: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileDiff(overrides: Partial<FileDiff>): FileDiff {
  return {
    path: "src/app.ts",
    changeKind: "modified",
    renamedFrom: null,
    added: 0,
    removed: 0,
    truncated: false,
    lines: [],
    ...overrides,
  };
}

// Conflict lines as the parser produces them: conflict markers arrive as
// "added"-kind DiffLine entries so they are rendered with the green "+" row.
const CONFLICT_LINES: FileDiff["lines"] = [
  { kind: "hunk", text: "" },
  { kind: "context", text: "shared preamble line" },
  { kind: "added", text: "<<<<<<< HEAD" },
  { kind: "added", text: "our version of the change" },
  { kind: "added", text: "=======" },
  { kind: "added", text: "their version of the change" },
  { kind: "added", text: ">>>>>>> feature-branch" },
  { kind: "context", text: "another shared line" },
  { kind: "removed", text: "line that was removed" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(cleanup);

describe("FileDiffCard — renamed file with conflict markers", () => {
  const renamedConflicted = makeFileDiff({
    changeKind: "renamed",
    path: "new-name.txt",
    renamedFrom: "old-name.txt",
    added: 5,
    removed: 1,
    lines: CONFLICT_LINES,
  });

  it("renders the card into the DOM (smoke)", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    expect(
      screen.getByTestId("diff-file-new-name.txt"),
    ).toBeTruthy();
  });

  it("shows the old (struck-through) path so both filenames are visible", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    // The old path is rendered as a <span class="...line-through">old-name.txt</span>.
    expect(screen.getByText("old-name.txt")).toBeTruthy();
  });

  it("shows the new (canonical) path", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    expect(screen.getByText("new-name.txt")).toBeTruthy();
  });

  it("shows the → separator between old and new path", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    const card = screen.getByTestId("diff-file-new-name.txt");
    expect(card.textContent).toContain("→");
  });

  it("does NOT hide the conflict-marker lines (<<<<<<< HEAD is in the DOM)", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    expect(screen.getByText("<<<<<<< HEAD")).toBeTruthy();
  });

  it("does NOT hide the ======= separator marker", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    expect(screen.getByText("=======")).toBeTruthy();
  });

  it("does NOT hide the >>>>>>> conflict marker", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    expect(screen.getByText(">>>>>>> feature-branch")).toBeTruthy();
  });

  it("renders both ours and theirs conflict content lines", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    expect(screen.getByText("our version of the change")).toBeTruthy();
    expect(screen.getByText("their version of the change")).toBeTruthy();
  });

  it("does not collapse to showing only the new path (no rename branch skipping)", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    // Both paths must co-exist in the DOM; neither is hidden.
    const old = screen.queryByText("old-name.txt");
    const next = screen.queryByText("new-name.txt");
    expect(old).not.toBeNull();
    expect(next).not.toBeNull();
  });

  it("shows the 'renamed' badge", () => {
    render(<FileDiffCard diff={renamedConflicted} />);
    expect(screen.getByText("renamed")).toBeTruthy();
  });
});

describe("FileDiffCard — renamed file with conflict markers in subdirectory paths", () => {
  const subDirRenamed = makeFileDiff({
    changeKind: "renamed",
    path: "src/utils/new-name.ts",
    renamedFrom: "src/helpers/old-name.ts",
    added: 3,
    removed: 1,
    lines: [
      { kind: "added", text: "<<<<<<< HEAD" },
      { kind: "added", text: "ours" },
      { kind: "added", text: "=======" },
      { kind: "added", text: "theirs" },
      { kind: "added", text: ">>>>>>> feature" },
    ],
  });

  it("shows the subdirectory old path", () => {
    render(<FileDiffCard diff={subDirRenamed} />);
    expect(screen.getByText("src/helpers/old-name.ts")).toBeTruthy();
  });

  it("shows the subdirectory new path", () => {
    render(<FileDiffCard diff={subDirRenamed} />);
    expect(screen.getByText("src/utils/new-name.ts")).toBeTruthy();
  });

  it("renders all conflict markers for subdirectory rename", () => {
    render(<FileDiffCard diff={subDirRenamed} />);
    expect(screen.getByText("<<<<<<< HEAD")).toBeTruthy();
    expect(screen.getByText("=======")).toBeTruthy();
    expect(screen.getByText(">>>>>>> feature")).toBeTruthy();
  });
});
