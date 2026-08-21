/**
 * HTTP-level tests: the /crisis/scenarios/:crisisId/commits/:commitHash/diff
 * endpoint must validate commitHash against COMMIT_HASH_RE before touching git,
 * returning 400 for every non-hash payload so git is never handed arbitrary
 * arguments.
 *
 * Security model
 * --------------
 * The route calls COMMIT_HASH_RE.test(commitHash) before any git interaction.
 * A regression in that check (or a bypass in the route) would let callers pass
 * arbitrary strings — like "--upload-pack" or path-traversal sequences — as git
 * arguments.  These tests confirm the guard fires at the HTTP layer.
 *
 * Test setup
 * ----------
 * process.env.HOME is redirected to a temp directory so crisisRoot() resolves
 * to an isolated path.  No playground is created, so a valid-hash request falls
 * through the guard and hits the "repository doesn't exist yet" 404.  No module
 * mocks are used: the real route handler and regex run against real HTTP
 * requests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GetCommitDiffResponse } from "@workspace/api-zod";

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
// Suite
// ---------------------------------------------------------------------------

describe("GET /crisis/scenarios/:crisisId/commits/:commitHash/diff — hash validation", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    // Redirect HOME so crisisRoot() resolves to an isolated temp directory.
    // No playground is created — valid-hash requests will hit 404 from the
    // "repository doesn't exist" check rather than actually calling git.
    fakeHome = mkdtempSync(path.join(tmpdir(), "commit-diff-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

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

  // -------------------------------------------------------------------------
  // Baseline: a syntactically valid 40-char hex hash passes the guard.
  //
  // No playground exists under fakeHome, so the route proceeds past hash
  // validation and returns 404 ("repository doesn't exist yet"), not 400.
  // This confirms the guard is the only thing blocking the non-hash payloads
  // below.
  // -------------------------------------------------------------------------

  it("returns 404 (not 400) for a valid 40-char hex hash when no playground exists", async () => {
    const validHash = "a".repeat(40); // 40 hex chars — satisfies COMMIT_HASH_RE
    const { status, body } = await get(
      port,
      `/crisis/scenarios/crisis-01/commits/${validHash}/diff`,
    );
    expect(status).toBe(404);
    const json = JSON.parse(body);
    // Must reach the playground-existence check, not the hash guard.
    expect(json.error).toMatch(/doesn't exist yet/i);
  });

  it("returns 404 (not 400) for a valid short (7-char) hex hash when no playground exists", async () => {
    const shortHash = "deadbee"; // 7 hex chars — above the 4-char minimum
    const { status } = await get(
      port,
      `/crisis/scenarios/crisis-01/commits/${shortHash}/diff`,
    );
    expect(status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Non-hash payloads: every one must return 400.
  //
  // The guard must fire before any git call regardless of whether a playground
  // exists, so the order of checks (hash → playground existence → git) is also
  // validated here.
  // -------------------------------------------------------------------------

  const invalidPayloads: Array<{ label: string; value: string }> = [
    // git flag injection
    { label: "--upload-pack", value: "--upload-pack" },
    { label: "--exec=id", value: "--exec=id" },
    // git ref names (symbolic, not hex)
    { label: "HEAD", value: "HEAD" },
    { label: "main", value: "main" },
    { label: "refs/heads/main", value: "refs/heads/main" },
    // path-traversal sequences
    { label: "../../../etc/passwd", value: "../../../etc/passwd" },
    { label: "..%2F..%2Fetc%2Fpasswd (decoded)", value: "..//..//etc/passwd" },
    // correct length but contains non-hex characters
    {
      label: "40 chars with non-hex 'G'",
      value: "G".repeat(40),
    },
    {
      label: "39 hex + semicolon",
      value: "a".repeat(39) + ";",
    },
    {
      label: "39 hex + space",
      value: "a".repeat(39) + " ",
    },
    // shell metacharacters / injection attempts
    { label: "shell injection with backtick", value: "`id`" },
    { label: "dollar-parens injection", value: "$(id)" },
    { label: "semicolon-separated command", value: "abc;rm${IFS}-rf${IFS}/" },
    // too short (below 4-char minimum)
    { label: "3 hex chars (too short)", value: "abc" },
    { label: "1 hex char (too short)", value: "a" },
    // empty-ish via encoded slash — Express won't route these as the param
    // itself, but a URL-encoded value that decodes to non-hex is rejected
    { label: "NUL byte encoded", value: "%00" + "a".repeat(39) },
  ];

  for (const { label, value } of invalidPayloads) {
    it(`returns 400 for commitHash=${label}`, async () => {
      const encoded = encodeURIComponent(value);
      const { status, body } = await get(
        port,
        `/crisis/scenarios/crisis-01/commits/${encoded}/diff`,
      );
      // Must be rejected by the hash guard.
      expect(status).toBe(400);
      // Must not surface an unhandled error.
      expect(status).not.toBe(500);
      // The error message must identify the problem.
      const json = JSON.parse(body);
      expect(json.error).toMatch(/invalid commit hash/i);
    });
  }

  // -------------------------------------------------------------------------
  // Unknown scenario: a valid hash with an unknown crisisId returns 404 from
  // the scenario lookup, not 400, confirming scenario lookup runs first.
  // -------------------------------------------------------------------------

  it("returns 404 for a valid hash but unknown scenario id", async () => {
    const validHash = "b".repeat(40);
    const { status } = await get(
      port,
      `/crisis/scenarios/nonexistent-scenario/commits/${validHash}/diff`,
    );
    expect(status).toBe(404);
  });
});

describe("GET /crisis/scenarios/:crisisId/commits/:commitHash/diff — real commit", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;
  let realHash: string;

  beforeAll(async () => {
    fakeHome = mkdtempSync(path.join(tmpdir(), "commit-diff-real-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

    const playgroundDir = path.join(fakeHome, "git-dojo", "playground", "crisis-01");
    mkdirSync(playgroundDir, { recursive: true });
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HOME: fakeHome,
    };
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: playgroundDir, env: gitEnv });

    git("init", "-q", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    writeFileSync(path.join(playgroundDir, "rates.txt"), "Rush load: $750\n");
    git("add", "-A");
    git("commit", "-q", "-m", "Open the rate book");
    writeFileSync(path.join(playgroundDir, "rates.txt"), "Rush load: $825\n");
    git("add", "-A");
    git("commit", "-q", "-m", "Update the rush rate");
    realHash = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: playgroundDir,
      env: gitEnv,
    })
      .toString()
      .trim();

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

  it("returns a schema-valid real diff for an existing commit", async () => {
    const { status, body } = await get(
      port,
      `/crisis/scenarios/crisis-01/commits/${realHash}/diff`,
    );

    expect(status).toBe(200);
    const diff = GetCommitDiffResponse.parse(JSON.parse(body));
    expect(diff.hash).toBe(realHash);
    expect(diff.isMerge).toBe(false);
    expect(diff.files.some((file) => file.path === "rates.txt")).toBe(true);
  });

  it("returns 404 for a valid-format hash that does not exist", async () => {
    const missingHash = "f".repeat(40);
    expect(missingHash).not.toBe(realHash);

    const { status, body } = await get(
      port,
      `/crisis/scenarios/crisis-01/commits/${missingHash}/diff`,
    );

    expect(status).toBe(404);
    expect(JSON.parse(body).error).toMatch(/no such commit/i);
  });
});
