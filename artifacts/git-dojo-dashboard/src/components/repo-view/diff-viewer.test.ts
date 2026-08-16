import { describe, it, expect } from "vitest";
import { getFileDiffDisplay, CHANGE_LABEL } from "./diff-viewer";
import type { FileDiff } from "@workspace/api-client-react";

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

// ---------------------------------------------------------------------------
// CHANGE_LABEL — badge text contract
// ---------------------------------------------------------------------------

describe("CHANGE_LABEL badge text", () => {
  it('renamed changeKind maps to "renamed" badge text', () => {
    expect(CHANGE_LABEL.renamed.text).toBe("renamed");
  });

  it('binary changeKind maps to "binary — no line view" badge text', () => {
    expect(CHANGE_LABEL.binary.text).toBe("binary — no line view");
  });

  it("all five change kinds have a non-empty badge text", () => {
    const kinds: FileDiff["changeKind"][] = [
      "added",
      "modified",
      "deleted",
      "renamed",
      "binary",
    ];
    for (const kind of kinds) {
      expect(CHANGE_LABEL[kind].text.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getFileDiffDisplay — renamed file
// ---------------------------------------------------------------------------

describe("getFileDiffDisplay — renamed file", () => {
  it("returns the new path as newPath", () => {
    const diff = makeFileDiff({
      changeKind: "renamed",
      path: "src/renamed.ts",
      renamedFrom: "src/old-name.ts",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.newPath).toBe("src/renamed.ts");
  });

  it("returns the old path as oldPath (shown struck-through in the UI)", () => {
    const diff = makeFileDiff({
      changeKind: "renamed",
      path: "src/renamed.ts",
      renamedFrom: "src/old-name.ts",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.oldPath).toBe("src/old-name.ts");
  });

  it('returns "renamed" as the badge label text', () => {
    const diff = makeFileDiff({
      changeKind: "renamed",
      path: "src/renamed.ts",
      renamedFrom: "src/old-name.ts",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.labelText).toBe("renamed");
  });

  it("reports hasLines false when lines array is empty (pure rename, no content change)", () => {
    const diff = makeFileDiff({
      changeKind: "renamed",
      path: "docs/guide.md",
      renamedFrom: "docs/old-guide.md",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.hasLines).toBe(false);
  });

  it("reports hasLines true when a rename also carries line changes", () => {
    const diff = makeFileDiff({
      changeKind: "renamed",
      path: "src/util.ts",
      renamedFrom: "src/helpers.ts",
      lines: [{ kind: "added", text: "export const x = 1;" }],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.hasLines).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getFileDiffDisplay — binary file
// ---------------------------------------------------------------------------

describe("getFileDiffDisplay — binary file", () => {
  it('returns "binary — no line view" as the badge label text', () => {
    const diff = makeFileDiff({
      changeKind: "binary",
      path: "assets/logo.png",
      renamedFrom: null,
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.labelText).toBe("binary — no line view");
  });

  it("reports hasLines false (binary files never carry line diffs)", () => {
    const diff = makeFileDiff({
      changeKind: "binary",
      path: "assets/logo.png",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.hasLines).toBe(false);
  });

  it("returns null for oldPath on a plain binary file (no rename)", () => {
    const diff = makeFileDiff({
      changeKind: "binary",
      path: "assets/image.jpg",
      renamedFrom: null,
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.oldPath).toBeNull();
  });

  it("returns the file path as newPath", () => {
    const diff = makeFileDiff({
      changeKind: "binary",
      path: "build/output.wasm",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.newPath).toBe("build/output.wasm");
  });
});

// ---------------------------------------------------------------------------
// getFileDiffDisplay — renamed binary file (binary + renamedFrom together)
// ---------------------------------------------------------------------------

describe("getFileDiffDisplay — renamed binary file", () => {
  it('returns "binary — no line view" as the badge label text', () => {
    const diff = makeFileDiff({
      changeKind: "binary",
      path: "assets/new-name.png",
      renamedFrom: "assets/old-name.png",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.labelText).toBe("binary — no line view");
  });

  it("returns the old path as a non-null oldPath (shown struck-through in the UI)", () => {
    const diff = makeFileDiff({
      changeKind: "binary",
      path: "assets/new-name.png",
      renamedFrom: "assets/old-name.png",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.oldPath).toBe("assets/old-name.png");
  });

  it("returns the new path as newPath", () => {
    const diff = makeFileDiff({
      changeKind: "binary",
      path: "assets/new-name.png",
      renamedFrom: "assets/old-name.png",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.newPath).toBe("assets/new-name.png");
  });

  it("reports hasLines false (binary files never carry line diffs, even when renamed)", () => {
    const diff = makeFileDiff({
      changeKind: "binary",
      path: "images/logo-v2.png",
      renamedFrom: "images/logo.png",
      lines: [],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.hasLines).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getFileDiffDisplay — renamed file WITH merge conflict markers
// ---------------------------------------------------------------------------
// This section guards the display layer against a future regression where
// `renamedFrom` is dropped or ignored when the file also carries conflict
// lines.  The parser (repo-state.ts) already unit-tests that renamedFrom is
// preserved in this situation; here we confirm the display function correctly
// surfaces both paths and treats conflict lines as renderable diff content.

describe("getFileDiffDisplay — renamed file with conflict markers", () => {
  // Simulate the output that repo-state.parseUnifiedDiff produces when a
  // renamed text file also has unresolved merge conflicts.  Conflict marker
  // lines (<<<<<<< / ======= / >>>>>>>) appear as "added" kind entries.
  const conflictLines = [
    { kind: "hunk" as const, text: "" },
    { kind: "context" as const, text: "common preamble" },
    { kind: "added" as const, text: "<<<<<<< HEAD" },
    { kind: "added" as const, text: "our version of the line" },
    { kind: "added" as const, text: "=======" },
    { kind: "added" as const, text: "their version of the line" },
    { kind: "added" as const, text: ">>>>>>> feature-branch" },
    { kind: "context" as const, text: "another common line" },
    { kind: "removed" as const, text: "removed line" },
  ];

  const renamedConflicted = makeFileDiff({
    changeKind: "renamed",
    path: "new.txt",
    renamedFrom: "old.txt",
    added: 5,
    removed: 1,
    lines: conflictLines,
  });

  it("retains the old path as oldPath so both filenames are shown", () => {
    const display = getFileDiffDisplay(renamedConflicted);
    expect(display.oldPath).toBe("old.txt");
  });

  it("retains the new path as newPath", () => {
    const display = getFileDiffDisplay(renamedConflicted);
    expect(display.newPath).toBe("new.txt");
  });

  it('retains "renamed" as the badge label text', () => {
    const display = getFileDiffDisplay(renamedConflicted);
    expect(display.labelText).toBe("renamed");
  });

  it("reports hasLines true so conflict-marker lines are rendered, not hidden", () => {
    const display = getFileDiffDisplay(renamedConflicted);
    expect(display.hasLines).toBe(true);
  });

  it("oldPath is non-null so the UI shows old→new instead of only the new name", () => {
    // The UI branch in FileDiffCard renders "oldPath → newPath" only when
    // oldPath is non-null.  This assertion pins that contract: a conflicted
    // rename must never collapse to the newPath-only branch.
    const display = getFileDiffDisplay(renamedConflicted);
    expect(display.oldPath).not.toBeNull();
  });

  it("works when renamedFrom uses a subdirectory path", () => {
    const diff = makeFileDiff({
      changeKind: "renamed",
      path: "src/utils/new-name.ts",
      renamedFrom: "src/helpers/old-name.ts",
      added: 3,
      removed: 1,
      lines: [
        { kind: "added" as const, text: "<<<<<<< HEAD" },
        { kind: "added" as const, text: "a" },
        { kind: "added" as const, text: ">>>>>>> feature" },
        { kind: "removed" as const, text: "b" },
      ],
    });
    const display = getFileDiffDisplay(diff);
    expect(display.oldPath).toBe("src/helpers/old-name.ts");
    expect(display.newPath).toBe("src/utils/new-name.ts");
    expect(display.hasLines).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getFileDiffDisplay — non-renamed files have null oldPath
// ---------------------------------------------------------------------------

describe("getFileDiffDisplay — non-rename changeKinds", () => {
  const nonRenameKinds: FileDiff["changeKind"][] = [
    "added",
    "modified",
    "deleted",
    "binary",
  ];

  for (const kind of nonRenameKinds) {
    it(`returns null oldPath for ${kind} file with no renamedFrom`, () => {
      const diff = makeFileDiff({ changeKind: kind, renamedFrom: null });
      expect(getFileDiffDisplay(diff).oldPath).toBeNull();
    });
  }
});
