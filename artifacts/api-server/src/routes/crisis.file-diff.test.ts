/**
 * HTTP-level tests: the /crisis/scenarios/:crisisId/file-diff endpoint must
 * return 404 for path-traversal payloads and never expose content from outside
 * the playground.
 *
 * Security model
 * --------------
 * The endpoint calls readWorkingFileDiff(pg, filePath).  That function first
 * asks git for the working-copy status of the playground via readRepoState,
 * then looks up the requested filePath in that list.  A traversal path like
 * ../../../etc/passwd can never appear in `git status --porcelain` output, so
 * the path-lookup finds no entry → readWorkingFileDiff returns null → 404.
 *
 * Test setup
 * ----------
 * process.env.HOME is redirected to a temp directory so crisisRoot() resolves
 * to a real isolated git repository we create here.  No module mocks are used:
 * existsSync, isRepo, readRepoState, and readWorkingFileDiff all run against
 * the real filesystem and real git process so the actual security gate is
 * exercised end-to-end.
 *
 * Coverage
 * --------
 * Suite 1 — path-traversal rejection + baseline (crisis-01 simple modification)
 * Suite 2 — mid-merge conflict coverage: both conflicted files (rates.txt AND
 *            drivers.txt) must return 200 + valid WorkingFileDiff shape so that
 *            no conflicted file is silently unreported by the endpoint.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function get(port: number, urlPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path: urlPath }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }),
      );
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Git helper
// ---------------------------------------------------------------------------

function g(cwd: string, ...args: string[]) {
  execFileSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: cwd,
    },
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("GET /crisis/scenarios/:crisisId/file-diff — path-traversal rejection", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    // 1. Redirect os.homedir() to an isolated temp directory.
    //    On Linux, os.homedir() reads process.env.HOME, so this is sufficient
    //    without any module mocking.
    fakeHome = mkdtempSync(path.join(tmpdir(), "crisis-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

    // 2. Create a real git playground for crisis-01 under the fake home.
    //    crisisRoot() computes path.join(os.homedir(), "git-dojo"); since
    //    HOME now points to fakeHome, the playground is fakeHome/git-dojo/playground/crisis-01.
    const playgroundDir = path.join(fakeHome, "git-dojo", "playground", "crisis-01");
    mkdirSync(playgroundDir, { recursive: true });

    g(playgroundDir, "init", "-q", "-b", "main");
    g(playgroundDir, "config", "user.name", "Test");
    g(playgroundDir, "config", "user.email", "test@example.com");

    // Commit an initial version so the repo has a HEAD.
    writeFileSync(path.join(playgroundDir, "rates.txt"), "Rush load: $750\n");
    g(playgroundDir, "add", "-A");
    g(playgroundDir, "commit", "-q", "-m", "Open the rate book");

    // Leave rates.txt modified (unstaged) so git status reports it as changed.
    writeFileSync(path.join(playgroundDir, "rates.txt"), "Rush load: $825\n");

    // 3. Start a real Express server with the crisis router.
    const { default: crisisRouter } = await import("./crisis.js");

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as Record<string, unknown>)["log"] = {
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      next();
    });
    app.use("/", crisisRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    // Restore HOME before cleanup so other tests are not affected.
    if (originalHome !== undefined) process.env.HOME = originalHome;
    else delete process.env.HOME;
    try {
      rmSync(fakeHome, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  // -------------------------------------------------------------------------
  // Baseline: a legitimately modified file returns 200
  //
  // Confirms the full readRepoState → readWorkingFileDiff → HTTP pipeline is
  // wired correctly against the real git repository before we test traversal.
  // -------------------------------------------------------------------------

  it("returns 200 for a legitimately modified file (rates.txt)", async () => {
    const { status, body } = await get(
      port,
      "/crisis/scenarios/crisis-01/file-diff?filePath=rates.txt",
    );
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json).toHaveProperty("path", "rates.txt");
  });

  // -------------------------------------------------------------------------
  // Path-traversal payloads
  //
  // The real readWorkingFileDiff queries `git status --porcelain` against the
  // real repository.  None of these strings can appear in git status output,
  // so every request must return 404 — never 200, never 500.
  // -------------------------------------------------------------------------

  const traversalPayloads: string[] = [
    "../../../etc/passwd",
    "../../../../../../etc/shadow",
    "../rates.txt",                        // sibling-playground escape
    "subdir/../../../../../../etc/hosts",
    "....//....//etc/passwd",              // doubled-dot bypass attempt
    "./../rates.txt",
  ];

  for (const payload of traversalPayloads) {
    it(`returns 404 for filePath=${payload}`, async () => {
      const encoded = encodeURIComponent(payload);
      const { status, body } = await get(
        port,
        `/crisis/scenarios/crisis-01/file-diff?filePath=${encoded}`,
      );
      // Must never return file contents.
      expect(status).not.toBe(200);
      // Must not surface an unhandled error.
      expect(status).not.toBe(500);
      // The safe response is 404.
      expect(status).toBe(404);
      // Body must not contain content that would indicate a file-system leak.
      expect(body).not.toContain("root:");
      expect(body).not.toContain("/bin/bash");
    });
  }

  // -------------------------------------------------------------------------
  // Structural edge cases
  // -------------------------------------------------------------------------

  it("returns 404 for an unknown scenario id", async () => {
    const { status } = await get(
      port,
      "/crisis/scenarios/nonexistent-scenario/file-diff?filePath=rates.txt",
    );
    expect(status).toBe(404);
  });

  it("returns 400 when filePath is omitted", async () => {
    const { status } = await get(port, "/crisis/scenarios/crisis-01/file-diff");
    expect(status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — mid-merge conflict: both conflicted files are reported
//
// The crisis-02 scenario leaves the playground mid-merge with conflict markers
// in rates.txt AND drivers.txt.  The file-diff endpoint must return 200 with a
// valid WorkingFileDiff-shaped body for EACH conflicted file, not just the
// first one.  This ensures no conflicted file is silently unreported.
// ---------------------------------------------------------------------------

/**
 * Minimal structural check that a response body matches the WorkingFileDiff
 * shape returned by GetCrisisFileDiffResponse.  We validate the fields the
 * router serialises rather than importing and running the full Zod schema, so
 * the test has no compile-time dependency on the generated package.
 */
function assertWorkingFileDiffShape(json: unknown, expectedPath: string): void {
  expect(json).toBeDefined();
  expect(typeof json).toBe("object");
  const obj = json as Record<string, unknown>;

  // Top-level required fields
  expect(obj["path"]).toBe(expectedPath);
  expect(typeof obj["status"]).toBe("string");
  expect(typeof obj["summary"]).toBe("string");

  // staged / unstaged must be null or a FileDiff object.
  // For mid-merge conflicted files both may be null — that is the correct
  // shape: the conflict markers are in the working file itself, not in a diff
  // that git can surface through --cached or plain diff.
  for (const key of ["staged", "unstaged"] as const) {
    const val = obj[key];
    if (val !== null) {
      expect(typeof val).toBe("object");
      const diff = val as Record<string, unknown>;
      expect(typeof diff["path"]).toBe("string");
      expect(typeof diff["changeKind"]).toBe("string");
      expect(typeof diff["added"]).toBe("number");
      expect(typeof diff["removed"]).toBe("number");
      expect(typeof diff["truncated"]).toBe("boolean");
      expect(Array.isArray(diff["lines"])).toBe(true);
    }
  }
}

describe("GET /crisis/scenarios/crisis-02/file-diff — both conflicted files reported", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    fakeHome = mkdtempSync(path.join(tmpdir(), "crisis-filediff-02-"));
    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

    // Build a crisis-02-style playground: two branches both edit rates.txt and
    // drivers.txt at the same line, then merge is attempted → both files end up
    // with conflict markers in the working copy.
    const playgroundDir = path.join(fakeHome, "git-dojo", "playground", "crisis-02");
    mkdirSync(playgroundDir, { recursive: true });

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: "Previous Operator",
      GIT_AUTHOR_EMAIL: "ops@example.com",
      GIT_COMMITTER_NAME: "Previous Operator",
      GIT_COMMITTER_EMAIL: "ops@example.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: fakeHome,
    };

    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: playgroundDir, env });

    // Baseline commit on main
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Previous Operator");
    git("config", "user.email", "ops@example.com");

    const RATES = "RTS Freight rates\nStandard load: $500\nRush load: $750\nFuel surcharge: $40\n";
    const DRIVERS = "Active drivers\nM. Alvarez\nJ. Okafor\n";

    writeFileSync(path.join(playgroundDir, "rates.txt"), RATES);
    writeFileSync(path.join(playgroundDir, "drivers.txt"), DRIVERS);
    git("add", "-A");
    git("commit", "-q", "-m", "Open the books");

    // rate-overhaul branch: change fuel surcharge to $80, add T. Brandt
    git("switch", "-q", "-c", "rate-overhaul");
    writeFileSync(
      path.join(playgroundDir, "rates.txt"),
      RATES.replace("Fuel surcharge: $40", "Fuel surcharge: $80"),
    );
    writeFileSync(path.join(playgroundDir, "drivers.txt"), DRIVERS + "T. Brandt\n");
    git("add", "-A");
    git("commit", "-q", "-m", "Overhaul: raise fuel surcharge, add Brandt");

    // main branch: change fuel surcharge to $65, add R. Chen
    git("switch", "-q", "main");
    writeFileSync(
      path.join(playgroundDir, "rates.txt"),
      RATES.replace("Fuel surcharge: $40", "Fuel surcharge: $65"),
    );
    writeFileSync(path.join(playgroundDir, "drivers.txt"), DRIVERS + "R. Chen\n");
    git("add", "-A");
    git("commit", "-q", "-m", "Mainline: raise fuel surcharge, add Chen");

    // Attempt merge — expected to leave both files conflicted mid-merge.
    try {
      git("merge", "rate-overhaul");
    } catch {
      /* expected: conflict; playground is now mid-merge */
    }

    // Mount the real crisis router.
    const { default: crisisRouter } = await import("./crisis.js");

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as Record<string, unknown>)["log"] = {
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      next();
    });
    app.use("/", crisisRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    if (originalHome !== undefined) process.env.HOME = originalHome;
    else delete process.env.HOME;
    try {
      rmSync(fakeHome, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it("returns 200 + valid WorkingFileDiff shape for rates.txt while mid-merge", async () => {
    const { status, body } = await get(
      port,
      "/crisis/scenarios/crisis-02/file-diff?filePath=rates.txt",
    );
    expect(status).toBe(200);
    const json = JSON.parse(body) as unknown;
    assertWorkingFileDiffShape(json, "rates.txt");
  });

  it("returns 200 + valid WorkingFileDiff shape for drivers.txt while mid-merge", async () => {
    const { status, body } = await get(
      port,
      "/crisis/scenarios/crisis-02/file-diff?filePath=drivers.txt",
    );
    expect(status).toBe(200);
    const json = JSON.parse(body) as unknown;
    assertWorkingFileDiffShape(json, "drivers.txt");
  });

  it("status field is 'conflicted' for both files while mid-merge", async () => {
    for (const file of ["rates.txt", "drivers.txt"]) {
      const { status, body } = await get(
        port,
        `/crisis/scenarios/crisis-02/file-diff?filePath=${file}`,
      );
      expect(status).toBe(200);
      const json = JSON.parse(body) as Record<string, unknown>;
      // A mid-merge conflicted file must be reported with status "conflicted"
      // so the dashboard can highlight it correctly.
      expect(json["status"]).toBe("conflicted");
    }
  });
});
