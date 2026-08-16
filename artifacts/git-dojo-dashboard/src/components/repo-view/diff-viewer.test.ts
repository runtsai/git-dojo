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
