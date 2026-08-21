/**
 * Confirms the /crisis/scenarios/:crisisId/file-diff endpoint degrades
 * gracefully when the playground directory disappears between the initial
 * existence check and the git calls inside readWorkingFileDiff.
 *
 * Race condition being tested
 * ---------------------------
 * The route handler checks existsSync(pg) && isRepo(pg) before calling
 * readWorkingFileDiff.  In the gap between that check and the git spawns
 * inside readWorkingFileDiff, an external process can delete the directory
 * (e.g. a concurrent setup run, manual cleanup, or Replit workspace reset).
 * Without an explicit try/catch the Express default error handler emits a
 * 500 with a raw stack trace.
 *
 * Test strategy
 * -------------
 * vi.mock replaces readWorkingFileDiff with a function that always rejects
 * with an ENOENT error, simulating the git process failing mid-request
 * because the directory it was given no longer exists.  The other repo-state
 * exports (isRepo, readRepoState, …) are kept real so the route's initial
 * guard still behaves correctly.
 *
 * A real git playground is created in a temp directory so existsSync(pg) and
 * isRepo(pg) both return true and the handler proceeds past the guard into
 * the readWorkingFileDiff call — which then throws.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Module mock — must be declared before any import that resolves repo-state.
// vi.mock is hoisted to the top of the module by vitest, so it intercepts the
// import inside crisis.ts regardless of declaration order in this file.
// ---------------------------------------------------------------------------

vi.mock("../lib/repo-state.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/repo-state.js")>();
  return {
    ...original,
    readWorkingFileDiff: vi.fn().mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file or directory, scandir '/gone'"), {
        code: "ENOENT",
      }),
    ),
  };
});

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

describe("GET /crisis/scenarios/:crisisId/file-diff — directory disappears mid-request", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    // 1. Redirect os.homedir() so crisisRoot() resolves inside our temp dir.
    fakeHome = mkdtempSync(path.join(tmpdir(), "crisis-disappear-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

    // 2. Create a real git playground for crisis-01.
    //    existsSync(pg) and isRepo(pg) must both return true so the handler
    //    reaches the readWorkingFileDiff call (which the mock then throws from).
    const playgroundDir = path.join(fakeHome, "git-dojo", "playground", "crisis-01");
    mkdirSync(playgroundDir, { recursive: true });

    g(playgroundDir, "init", "-q", "-b", "main");
    g(playgroundDir, "config", "user.name", "Test");
    g(playgroundDir, "config", "user.email", "test@example.com");

    writeFileSync(path.join(playgroundDir, "rates.txt"), "Rush load: $750\n");
    g(playgroundDir, "add", "-A");
    g(playgroundDir, "commit", "-q", "-m", "Open the rate book");

    // Modify the file (but don't stage) so status reports it as changed.
    writeFileSync(path.join(playgroundDir, "rates.txt"), "Rush load: $825\n");

    // 3. Start the crisis router.  readWorkingFileDiff is already mocked above.
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

  it("returns a non-500 status when readWorkingFileDiff throws mid-request", async () => {
    const { status } = await get(
      port,
      "/crisis/scenarios/crisis-01/file-diff?filePath=rates.txt",
    );
    // The endpoint must never surface a 500 when git fails mid-request.
    expect(status).not.toBe(500);
  });

  it("returns 404 specifically when the playground disappears mid-request", async () => {
    const { status } = await get(
      port,
      "/crisis/scenarios/crisis-01/file-diff?filePath=rates.txt",
    );
    expect(status).toBe(404);
  });

  it("returns a JSON error message, not a raw stack trace", async () => {
    const { body } = await get(
      port,
      "/crisis/scenarios/crisis-01/file-diff?filePath=rates.txt",
    );

    // Body must be valid JSON with an 'error' field.
    let json: Record<string, unknown>;
    expect(() => {
      json = JSON.parse(body) as Record<string, unknown>;
    }).not.toThrow();
    expect(json!).toHaveProperty("error");
    expect(typeof json!["error"]).toBe("string");

    // Must not expose a raw stack trace.
    expect(body).not.toContain("at Object.");
    expect(body).not.toContain("node_modules");
    expect(body).not.toContain("Error: ENOENT");
  });
});
