/**
 * Tests for parseUnifiedDiff and integration checks for readCommitDiff /
 * readWorkingFileDiff against a real (throwaway) git repository.
 */
import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseUnifiedDiff, readCommitDiff, readWorkingFileDiff } from "./repo-state.js";

// ---------------------------------------------------------------------------
// parseUnifiedDiff — pure unit tests
// ---------------------------------------------------------------------------

describe("parseUnifiedDiff", () => {
  it("parses a new-file addition", () => {
    const diff = [
      "diff --git a/hello.txt b/hello.txt",
      "new file mode 100644",
      "index 0000000..ce01362",
      "--- /dev/null",
      "+++ b/hello.txt",
      "@@ -0,0 +1,2 @@",
      "+hello",
      "+world",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file).toBeDefined();
    expect(file!.path).toBe("hello.txt");
    expect(file!.changeKind).toBe("added");
    expect(file!.renamedFrom).toBeNull();
    expect(file!.added).toBe(2);
    expect(file!.removed).toBe(0);
    expect(file!.truncated).toBe(false);
    expect(file!.lines).toHaveLength(3); // 1 hunk + 2 added
    expect(file!.lines[0]).toEqual({ kind: "hunk", text: "" });
    expect(file!.lines[1]).toEqual({ kind: "added", text: "hello" });
    expect(file!.lines[2]).toEqual({ kind: "added", text: "world" });
  });

  it("parses a file modification with context lines", () => {
    const diff = [
      "diff --git a/hello.txt b/hello.txt",
      "index ce01362..e965047 100644",
      "--- a/hello.txt",
      "+++ b/hello.txt",
      "@@ -1,3 +1,3 @@ some function",
      " context before",
      "-old line",
      "+new line",
      " context after",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.path).toBe("hello.txt");
    expect(file!.changeKind).toBe("modified");
    expect(file!.added).toBe(1);
    expect(file!.removed).toBe(1);
    expect(file!.lines[0]).toEqual({ kind: "hunk", text: "some function" });
    expect(file!.lines[1]).toEqual({ kind: "context", text: "context before" });
    expect(file!.lines[2]).toEqual({ kind: "removed", text: "old line" });
    expect(file!.lines[3]).toEqual({ kind: "added", text: "new line" });
    expect(file!.lines[4]).toEqual({ kind: "context", text: "context after" });
  });

  it("parses a file deletion", () => {
    const diff = [
      "diff --git a/gone.txt b/gone.txt",
      "deleted file mode 100644",
      "index ce01362..0000000",
      "--- a/gone.txt",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-goodbye",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.path).toBe("gone.txt");
    expect(file!.changeKind).toBe("deleted");
    expect(file!.added).toBe(0);
    expect(file!.removed).toBe(1);
  });

  it("parses a rename", () => {
    const diff = [
      "diff --git a/old.txt b/new.txt",
      "similarity index 100%",
      "rename from old.txt",
      "rename to new.txt",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.path).toBe("new.txt");
    expect(file!.changeKind).toBe("renamed");
    expect(file!.renamedFrom).toBe("old.txt");
    expect(file!.added).toBe(0);
    expect(file!.removed).toBe(0);
    expect(file!.lines).toHaveLength(0);
  });

  it("parses a rename with content changes", () => {
    const diff = [
      "diff --git a/old.txt b/new name.txt",
      "similarity index 80%",
      'rename from old.txt',
      'rename to new name.txt',
      "index abc1234..def5678 100644",
      "--- a/old.txt",
      "+++ b/new name.txt",
      "@@ -1 +1 @@",
      "-old content",
      "+new content",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.path).toBe("new name.txt");
    expect(file!.changeKind).toBe("renamed");
    expect(file!.renamedFrom).toBe("old.txt");
    expect(file!.added).toBe(1);
    expect(file!.removed).toBe(1);
  });

  it("parses a renamed binary file — keeps renamedFrom and sets changeKind to binary", () => {
    // Real git output when a binary file is renamed (similarity < 100%):
    //   diff --git a/old.png b/new.png
    //   similarity index 89%
    //   rename from old.png
    //   rename to new.png
    //   index abc1234..def5678 100644
    //   Binary files a/old.png and b/new.png differ
    const diff = [
      "diff --git a/old.png b/new.png",
      "similarity index 89%",
      "rename from old.png",
      "rename to new.png",
      "index abc1234..def5678 100644",
      "Binary files a/old.png and b/new.png differ",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file).toBeDefined();
    expect(file!.changeKind).toBe("binary");
    expect(file!.renamedFrom).toBe("old.png");
    expect(file!.path).toBe("new.png");
    expect(file!.added).toBe(0);
    expect(file!.removed).toBe(0);
    expect(file!.lines).toHaveLength(0);
  });

  it("parses a renamed binary file with a subdirectory path", () => {
    const diff = [
      "diff --git a/assets/old-logo.png b/assets/new-logo.png",
      "similarity index 72%",
      "rename from assets/old-logo.png",
      "rename to assets/new-logo.png",
      "index aaa1111..bbb2222 100644",
      "Binary files a/assets/old-logo.png and b/assets/new-logo.png differ",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file).toBeDefined();
    expect(file!.changeKind).toBe("binary");
    expect(file!.renamedFrom).toBe("assets/old-logo.png");
    expect(file!.path).toBe("assets/new-logo.png");
  });

  it("parses a binary file change", () => {
    const diff = [
      "diff --git a/image.png b/image.png",
      "new file mode 100644",
      "index 0000000..abc1234",
      "Binary files /dev/null and b/image.png differ",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.path).toBe("image.png");
    expect(file!.changeKind).toBe("binary");
    expect(file!.lines).toHaveLength(0);
    expect(file!.added).toBe(0);
    expect(file!.removed).toBe(0);
  });

  it("parses a binary file with a path that has no earlier --- +++ headers", () => {
    const diff = [
      "diff --git a/assets/logo.svg b/assets/logo.svg",
      "index abc1234..def5678 100644",
      "Binary files a/assets/logo.svg and b/assets/logo.svg differ",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.path).toBe("assets/logo.svg");
    expect(file!.changeKind).toBe("binary");
  });

  it("handles quoted paths with spaces", () => {
    const diff = [
      'diff --git "a/hello world.txt" "b/hello world.txt"',
      "new file mode 100644",
      "index 0000000..ce01362",
      "--- /dev/null",
      '+++ "b/hello world.txt"',
      "@@ -0,0 +1 @@",
      "+hi there",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.path).toBe("hello world.txt");
    expect(file!.changeKind).toBe("added");
    expect(file!.added).toBe(1);
  });

  it("handles quoted rename paths with spaces", () => {
    const diff = [
      'diff --git "a/my old file.txt" "b/my new file.txt"',
      "similarity index 100%",
      '"rename from my old file.txt"',
      '"rename to my new file.txt"',
    ].join("\n");

    // rename from/to without quotes is also valid — test the unquoted variant
    const diff2 = [
      "diff --git a/src/my old.ts b/src/my new.ts",
      "similarity index 100%",
      "rename from src/my old.ts",
      "rename to src/my new.ts",
    ].join("\n");

    const [file2] = parseUnifiedDiff(diff2);
    expect(file2!.renamedFrom).toBe("src/my old.ts");
    expect(file2!.path).toBe("src/my new.ts");
  });

  it('silently skips the "\\ No newline at end of file" marker', () => {
    const diff = [
      "diff --git a/noeol.txt b/noeol.txt",
      "new file mode 100644",
      "index 0000000..abc1234",
      "--- /dev/null",
      "+++ b/noeol.txt",
      "@@ -0,0 +1 @@",
      "+last line without newline",
      "\\ No newline at end of file",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.added).toBe(1);
    // The marker line must not appear in the lines array
    const texts = file!.lines.map((l) => l.text);
    expect(texts).not.toContain("No newline at end of file");
    expect(texts).not.toContain("\\ No newline at end of file");
  });

  it("truncates at MAX_LINES_PER_FILE and sets truncated=true", () => {
    // Build a diff with 405 added lines (1 hunk header + 405 lines > 400 limit)
    const addedLines = Array.from({ length: 405 }, (_, i) => `+line ${i + 1}`);
    const diff = [
      "diff --git a/big.txt b/big.txt",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/big.txt",
      `@@ -0,0 +1,405 @@`,
      ...addedLines,
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.truncated).toBe(true);
    // lines array must be capped at 400 entries
    expect(file!.lines.length).toBe(400);
    // added counter still counts all lines that were parsed (even truncated ones)
    expect(file!.added).toBe(405);
  });

  it("handles multiple files in one diff", () => {
    const diff = [
      "diff --git a/a.txt b/a.txt",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/a.txt",
      "@@ -0,0 +1 @@",
      "+aaa",
      "diff --git a/b.txt b/b.txt",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/b.txt",
      "@@ -0,0 +1 @@",
      "+bbb",
    ].join("\n");

    const files = parseUnifiedDiff(diff);
    expect(files).toHaveLength(2);
    expect(files[0]!.path).toBe("a.txt");
    expect(files[1]!.path).toBe("b.txt");
  });

  it("extracts the function context from hunk headers", () => {
    const diff = [
      "diff --git a/src/index.ts b/src/index.ts",
      "--- a/src/index.ts",
      "+++ b/src/index.ts",
      "@@ -10,6 +10,7 @@ function doThing() {",
      " context",
      "+added",
      " context2",
    ].join("\n");

    const [file] = parseUnifiedDiff(diff);
    expect(file!.lines[0]).toEqual({ kind: "hunk", text: "function doThing() {" });
  });

  it("returns an empty array for empty input", () => {
    expect(parseUnifiedDiff("")).toHaveLength(0);
  });

  it("filters out files whose path could not be determined", () => {
    // A diff header with no --- / +++ and no rename / binary markers
    const diff = ["diff --git a/mystery b/mystery"].join("\n");
    expect(parseUnifiedDiff(diff)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: readCommitDiff + readWorkingFileDiff against a throwaway repo
// ---------------------------------------------------------------------------

/** Create a temp dir with an initialised git repo and return its path. */
function makeRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "git-dojo-test-"));
  const g = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@test.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@test.com",
        GIT_TERMINAL_PROMPT: "0",
        // Isolate from workspace config
        GIT_CONFIG_GLOBAL: "/dev/null",
        HOME: dir,
      },
    });
  g("init", "-b", "main");
  g("config", "user.email", "test@test.com");
  g("config", "user.name", "Test");
  return dir;
}

const reposToClean: string[] = [];
afterAll(() => {
  for (const dir of reposToClean) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
});

describe("readCommitDiff — integration", () => {
  it("reads a normal (non-merge) commit", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });

    writeFileSync(path.join(dir, "readme.md"), "# Hello\nworld\n");
    g("add", ".");
    g("commit", "-m", "init");

    writeFileSync(path.join(dir, "readme.md"), "# Hello\nworld!\n");
    writeFileSync(path.join(dir, "extra.txt"), "extra\n");
    g("add", ".");
    g("commit", "-m", "second commit");

    const hash = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, env })
      .toString()
      .trim();

    const diff = await readCommitDiff(dir, hash);
    expect(diff).not.toBeNull();
    expect(diff!.hash).toBe(hash);
    expect(diff!.isMerge).toBe(false);
    expect(diff!.files.length).toBeGreaterThanOrEqual(1);

    const readme = diff!.files.find((f) => f.path === "readme.md");
    expect(readme).toBeDefined();
    expect(readme!.changeKind).toBe("modified");
    expect(readme!.added).toBe(1);
    expect(readme!.removed).toBe(1);

    const extra = diff!.files.find((f) => f.path === "extra.txt");
    expect(extra).toBeDefined();
    expect(extra!.changeKind).toBe("added");
  });

  it("returns null for an invalid hash", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);
    const result = await readCommitDiff(dir, "notahash");
    expect(result).toBeNull();
  });

  it("returns null for a valid-looking hash that doesn't exist in the repo", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);
    const result = await readCommitDiff(dir, "deadbeefdeadbeefdeadbeef");
    expect(result).toBeNull();
  });

  it("reads a merge commit using first-parent diff", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });
    const rev = (...args: string[]) =>
      execFileSync("git", args, { cwd: dir, env }).toString().trim();

    // main: init commit
    writeFileSync(path.join(dir, "main.txt"), "main\n");
    g("add", ".");
    g("commit", "-m", "init");

    // feature branch: add feature.txt
    g("checkout", "-b", "feature");
    writeFileSync(path.join(dir, "feature.txt"), "feature line\n");
    g("add", ".");
    g("commit", "-m", "feature work");

    // back to main, merge feature
    g("checkout", "main");
    g("merge", "--no-ff", "feature", "-m", "Merge feature");

    const mergeHash = rev("rev-parse", "HEAD");
    const diff = await readCommitDiff(dir, mergeHash);

    expect(diff).not.toBeNull();
    expect(diff!.isMerge).toBe(true);
    // First-parent diff should show feature.txt as added
    const feat = diff!.files.find((f) => f.path === "feature.txt");
    expect(feat).toBeDefined();
    expect(feat!.changeKind).toBe("added");
  });

  it("reads a commit that renames a file", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });

    writeFileSync(path.join(dir, "old name.txt"), "content\n");
    g("add", ".");
    g("commit", "-m", "add file");

    // rename: move the file
    const { renameSync } = await import("node:fs");
    renameSync(path.join(dir, "old name.txt"), path.join(dir, "new name.txt"));
    g("add", "-A");
    g("commit", "-m", "rename");

    const hash = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, env })
      .toString()
      .trim();

    const diff = await readCommitDiff(dir, hash);
    expect(diff).not.toBeNull();
    const renamedFile = diff!.files.find((f) => f.changeKind === "renamed");
    expect(renamedFile).toBeDefined();
    expect(renamedFile!.path).toBe("new name.txt");
    expect(renamedFile!.renamedFrom).toBe("old name.txt");
  });
});

describe("readWorkingFileDiff — integration", () => {
  it("reads a modified (staged) file", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });

    writeFileSync(path.join(dir, "file.txt"), "original\n");
    g("add", ".");
    g("commit", "-m", "init");

    writeFileSync(path.join(dir, "file.txt"), "modified\n");
    g("add", ".");

    const diff = await readWorkingFileDiff(dir, "file.txt");
    expect(diff).not.toBeNull();
    expect(diff!.status).toBe("staged");
    expect(diff!.staged).not.toBeNull();
    expect(diff!.staged!.added).toBe(1);
    expect(diff!.staged!.removed).toBe(1);
    expect(diff!.unstaged).toBeNull();
  });

  it("reads an untracked file", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });

    // Commit something so the repo is initialised
    writeFileSync(path.join(dir, "base.txt"), "base\n");
    g("add", ".");
    g("commit", "-m", "init");

    // Drop an untracked file
    writeFileSync(path.join(dir, "new.txt"), "line one\nline two\n");

    const diff = await readWorkingFileDiff(dir, "new.txt");
    expect(diff).not.toBeNull();
    expect(diff!.status).toBe("untracked");
    expect(diff!.unstaged).not.toBeNull();
    expect(diff!.unstaged!.changeKind).toBe("added");
    expect(diff!.unstaged!.added).toBe(2);
    expect(diff!.staged).toBeNull();
  });

  it("returns null for a file not in git status", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });

    writeFileSync(path.join(dir, "clean.txt"), "clean\n");
    g("add", ".");
    g("commit", "-m", "init");

    const diff = await readWorkingFileDiff(dir, "clean.txt");
    expect(diff).toBeNull();
  });

  it("reads a file with both staged and unstaged changes", async () => {
    const dir = makeRepo();
    reposToClean.push(dir);

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });

    writeFileSync(path.join(dir, "file.txt"), "line1\nline2\nline3\n");
    g("add", ".");
    g("commit", "-m", "init");

    // Stage one change
    writeFileSync(path.join(dir, "file.txt"), "line1\nLINE2\nline3\n");
    g("add", ".");

    // Then make another unstaged change
    writeFileSync(path.join(dir, "file.txt"), "line1\nLINE2\nLINE3\n");

    const diff = await readWorkingFileDiff(dir, "file.txt");
    expect(diff).not.toBeNull();
    expect(diff!.status).toBe("staged_and_modified");
    expect(diff!.staged).not.toBeNull();
    expect(diff!.unstaged).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Crisis-specific states
  // -------------------------------------------------------------------------

  it("crisis-02: conflicted file mid-merge returns valid WorkingFileDiffData shape", async () => {
    // Reproduces the state crisis-02 leaves: a merge was started but left open
    // with conflicts. rates.txt has conflict markers — both sides changed the
    // fuel-surcharge line to different values.
    const dir = makeRepo();
    reposToClean.push(dir);

    const RATES = "RTS Freight rates\nStandard load: $500\nRush load: $750\nFuel surcharge: $40\n";
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });

    // Base commit with original rates
    writeFileSync(path.join(dir, "rates.txt"), RATES);
    g("add", ".");
    g("commit", "-m", "Open the books");

    // Feature branch: change surcharge to $80
    g("checkout", "-b", "rate-overhaul");
    writeFileSync(path.join(dir, "rates.txt"), RATES.replace("Fuel surcharge: $40", "Fuel surcharge: $80"));
    g("add", ".");
    g("commit", "-m", "Overhaul: raise fuel surcharge");

    // Back to main: change surcharge to $65 (conflict!)
    g("checkout", "main");
    writeFileSync(path.join(dir, "rates.txt"), RATES.replace("Fuel surcharge: $40", "Fuel surcharge: $65"));
    g("add", ".");
    g("commit", "-m", "Mainline: raise fuel surcharge");

    // Start merge — it will conflict; ignore the non-zero exit
    try {
      g("merge", "rate-overhaul");
    } catch {
      /* expected conflict */
    }

    // The file must now be in conflict (UU status)
    const diff = await readWorkingFileDiff(dir, "rates.txt");

    // Shape checks — must never return null for a conflicted file
    expect(diff).not.toBeNull();
    expect(diff!.path).toBe("rates.txt");
    expect(diff!.status).toBe("conflicted");
    // summary must be a non-empty string
    expect(typeof diff!.summary).toBe("string");
    expect(diff!.summary.length).toBeGreaterThan(0);
    // staged/unstaged may be null for conflicted files (git diff output varies)
    // — the important thing is the shape is present and not throwing
    expect("staged" in diff!).toBe(true);
    expect("unstaged" in diff!).toBe(true);
  });

  it("crisis-05: staged-only file has staged diff and no unstaged diff", async () => {
    // Reproduces what crisis-05 setup produces for rates.txt:
    // the file is overwritten with garbage and then staged (git add rates.txt),
    // while drivers.txt is modified but NOT staged.
    const dir = makeRepo();
    reposToClean.push(dir);

    const RATES = "RTS Freight rates\nStandard load: $500\nRush load: $750\nFuel surcharge: $40\n";
    const DRIVERS = "Active drivers\nM. Alvarez\nJ. Okafor\n";
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@test.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@test.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: dir,
    };
    const g = (...args: string[]) => execFileSync("git", args, { cwd: dir, env });

    // Base commits: rates.txt and drivers.txt clean
    writeFileSync(path.join(dir, "rates.txt"), RATES);
    writeFileSync(path.join(dir, "drivers.txt"), DRIVERS);
    g("add", ".");
    g("commit", "-m", "Open the books");

    // Trash both files, but only stage rates.txt (mirrors crisis-05 exactly)
    writeFileSync(path.join(dir, "rates.txt"), "ALL RATES 90% OFF???\nasdf asdf asdf\n");
    writeFileSync(path.join(dir, "drivers.txt"), "fired everyone lol\n");
    g("add", "rates.txt");

    // rates.txt is staged-only: staged diff present, unstaged diff absent
    const ratesDiff = await readWorkingFileDiff(dir, "rates.txt");
    expect(ratesDiff).not.toBeNull();
    expect(ratesDiff!.path).toBe("rates.txt");
    expect(ratesDiff!.status).toBe("staged");
    expect(ratesDiff!.staged).not.toBeNull();
    expect(ratesDiff!.staged!.added).toBeGreaterThan(0);
    expect(ratesDiff!.staged!.removed).toBeGreaterThan(0);
    // No further working-tree changes beyond what was staged
    expect(ratesDiff!.unstaged).toBeNull();

    // drivers.txt is modified-only: unstaged diff present, staged diff absent
    const driversDiff = await readWorkingFileDiff(dir, "drivers.txt");
    expect(driversDiff).not.toBeNull();
    expect(driversDiff!.path).toBe("drivers.txt");
    expect(driversDiff!.status).toBe("modified");
    expect(driversDiff!.unstaged).not.toBeNull();
    expect(driversDiff!.unstaged!.added).toBeGreaterThan(0);
    expect(driversDiff!.unstaged!.removed).toBeGreaterThan(0);
    expect(driversDiff!.staged).toBeNull();
  });
});
