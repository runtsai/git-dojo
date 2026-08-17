/**
 * Coverage for the smoke-check setup lifecycle in scripts/src/api-smoke.ts.
 *
 * Background — original guard vs. sentinel approach
 * -------------------------------------------------
 * The original smoke check used a `crisisHasActiveSession` guard: it read the
 * first learner scenario's commit list and only called setup when the list was
 * empty (no active learner session).  Task #179 replaced this with a dedicated
 * "crisis-smoke" sentinel scenario that is:
 *   - always set up unconditionally on every smoke run (no commit-state guard)
 *   - excluded from the learner-facing GET /crisis/scenarios list
 * This makes the grader path exercisable on every restart without risking a
 * learner's in-progress playground.
 *
 * Three layers of coverage:
 *
 * 1. Pure-logic tests  – document the original guard expression and show which
 *    state shapes would have triggered/skipped setup under the old design.
 *    Kept as regression documentation; the helper is used in layer 2.
 *
 * 2. HTTP-level tests  – real crisis router against a fully-isolated temp dir.
 *    Confirms GET /state returns the correct `commits` shape for an absent
 *    playground and a committed playground, and that the sentinel is excluded
 *    from the learner-facing scenario list.
 *
 * 3. Smoke-script integration – run the actual `tsx scripts/src/api-smoke.ts`
 *    binary against a minimal mock HTTP server that records every inbound
 *    request.  Asserts the new sentinel contract:
 *      • POST /crisis/scenarios/crisis-smoke/setup is ALWAYS called
 *      • POST /crisis/scenarios/<learner-id>/setup is NEVER called
 *    This is tested both when the first learner scenario has no commits
 *    (simulating a fresh restart after session cleanup) and when it has
 *    commits (active learner session) — setup behaviour must be identical.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type RequestHandler } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpGet(port: number, urlPath: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path: urlPath }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        let body: unknown;
        try { body = JSON.parse(Buffer.concat(chunks).toString()); }
        catch { body = Buffer.concat(chunks).toString(); }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
  });
}

function g(cwd: string, ...args: string[]) {
  execFileSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Smoke Guard Test",
      GIT_AUTHOR_EMAIL: "smoke@example.com",
      GIT_COMMITTER_NAME: "Smoke Guard Test",
      GIT_COMMITTER_EMAIL: "smoke@example.com",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_GLOBAL: "/dev/null",
    },
  });
}

// ---------------------------------------------------------------------------
// 1. Pure-logic tests — original guard expression (documentation)
//
// The original smoke check used this expression to decide whether to call
// setup.  Kept as regression documentation of the state-detection semantics;
// the helper is also used in layer 2 to annotate what each state shape means.
// ---------------------------------------------------------------------------

function detectActiveSession(stateResponse: unknown): boolean {
  if (stateResponse && typeof stateResponse === "object") {
    const cs = stateResponse as { commits?: unknown[] };
    return Array.isArray(cs.commits) && cs.commits.length > 0;
  }
  return false;
}

describe("crisisHasActiveSession guard — original state-detection logic", () => {
  // No active session → original guard would have called setup

  it("returns false when commits is an empty array (no commits yet)", () => {
    expect(detectActiveSession({ commits: [] })).toBe(false);
  });

  it("returns false when commits property is absent", () => {
    expect(detectActiveSession({ branch: "main" })).toBe(false);
  });

  it("returns false when commits is undefined", () => {
    expect(detectActiveSession({ commits: undefined })).toBe(false);
  });

  it("returns false when commits is null (not an array)", () => {
    expect(detectActiveSession({ commits: null })).toBe(false);
  });

  it("returns false when commits is a non-array truthy value", () => {
    expect(detectActiveSession({ commits: "not-an-array" })).toBe(false);
  });

  it("returns false when state response is null", () => {
    expect(detectActiveSession(null)).toBe(false);
  });

  it("returns false when state response is undefined", () => {
    expect(detectActiveSession(undefined)).toBe(false);
  });

  // Active session → original guard would have skipped setup

  it("returns true when commits has one entry (learner has started work)", () => {
    expect(detectActiveSession({ commits: [{ hash: "abc123" }] })).toBe(true);
  });

  it("returns true when commits has multiple entries", () => {
    expect(detectActiveSession({ commits: [{ hash: "a" }, { hash: "b" }] })).toBe(true);
  });

  it("returns true for realistic state shape with commits", () => {
    expect(detectActiveSession({
      lessonId: "crisis-01",
      commits: [{ hash: "deadbeef", subject: "Open the rate book" }],
      files: [],
      hasBot: false,
    })).toBe(true);
  });

  it("returns false for realistic state shape without commits", () => {
    expect(detectActiveSession({
      lessonId: "crisis-01",
      commits: [],
      files: [],
      hasBot: false,
    })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. HTTP-level tests — real crisis router against isolated filesystem
//
// ISOLATION: fakeHome/git-dojo is created BEFORE setting process.env.HOME so
// crisisRoot() finds it immediately and never falls back to the workspace dir.
// ---------------------------------------------------------------------------

describe("GET /crisis/scenarios/:id/state and scenario list — sentinel contract", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    fakeHome = mkdtempSync(path.join(tmpdir(), "crisis-smoke-guard-"));
    // Pre-create git-dojo so crisisRoot() resolves here, not the workspace.
    mkdirSync(path.join(fakeHome, "git-dojo"), { recursive: true });

    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

    const { default: crisisRouter } = await import("./crisis.js");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as Record<string, unknown>)["log"] = {
        info: () => {}, warn: () => {}, error: () => {},
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
    try { rmSync(fakeHome, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  // ── Sentinel excluded from learner list ───────────────────────────────────

  it("GET /crisis/scenarios excludes the crisis-smoke sentinel from the learner list", async () => {
    const { status, body } = await httpGet(port, "/crisis/scenarios");
    expect(status).toBe(200);
    const scenarios = body as Array<{ id: string }>;
    expect(Array.isArray(scenarios)).toBe(true);
    expect(scenarios.some((s) => s.id === "crisis-smoke")).toBe(false);
    // Real learner scenarios must still appear
    expect(scenarios.some((s) => s.id === "crisis-01")).toBe(true);
  });

  // ── Absent playground → commits:[] (would trigger setup under old guard) ──

  it("state returns commits:[] when playground is absent (post-cleanup, fresh restart)", async () => {
    const playgroundDir = path.join(fakeHome, "git-dojo", "playground", "crisis-01");
    rmSync(playgroundDir, { recursive: true, force: true });

    const { status, body } = await httpGet(port, "/crisis/scenarios/crisis-01/state");
    expect(status).toBe(200);
    const state = body as { commits?: unknown[] };
    expect(Array.isArray(state.commits)).toBe(true);
    expect(state.commits!.length).toBe(0);
    expect(detectActiveSession(state)).toBe(false);
  });

  it("state returns commits:[] for an initialised repo with no commits yet", async () => {
    const playgroundDir = path.join(fakeHome, "git-dojo", "playground", "crisis-01");
    rmSync(playgroundDir, { recursive: true, force: true });
    mkdirSync(playgroundDir, { recursive: true });
    g(playgroundDir, "init", "-q", "-b", "main");
    g(playgroundDir, "config", "user.name", "Test");
    g(playgroundDir, "config", "user.email", "test@example.com");

    const { status, body } = await httpGet(port, "/crisis/scenarios/crisis-01/state");
    expect(status).toBe(200);
    const state = body as { commits?: unknown[] };
    expect(Array.isArray(state.commits)).toBe(true);
    expect(state.commits!.length).toBe(0);
    expect(detectActiveSession(state)).toBe(false);
  });

  // ── Committed playground → commits:[...] (active learner session) ─────────

  it("state returns commits when playground has commits (learner session active)", async () => {
    const playgroundDir = path.join(fakeHome, "git-dojo", "playground", "crisis-01");
    rmSync(playgroundDir, { recursive: true, force: true });
    mkdirSync(playgroundDir, { recursive: true });
    g(playgroundDir, "init", "-q", "-b", "main");
    g(playgroundDir, "config", "user.name", "Previous Operator");
    g(playgroundDir, "config", "user.email", "ops@example.com");
    writeFileSync(path.join(playgroundDir, "rates.txt"), "Rush load: $750\n");
    g(playgroundDir, "add", "-A");
    g(playgroundDir, "commit", "-q", "-m", "Open the rate book");

    const { status, body } = await httpGet(port, "/crisis/scenarios/crisis-01/state");
    expect(status).toBe(200);
    const state = body as { commits?: unknown[] };
    expect(Array.isArray(state.commits)).toBe(true);
    expect(state.commits!.length).toBeGreaterThan(0);
    expect(detectActiveSession(state)).toBe(true);
  });

  // ── Full lifecycle: session → cleanup → restart → state resets ────────────

  it("state reverts to commits:[] after playground is cleaned up (simulates server restart)", async () => {
    const playgroundDir = path.join(fakeHome, "git-dojo", "playground", "crisis-01");

    // Active session
    rmSync(playgroundDir, { recursive: true, force: true });
    mkdirSync(playgroundDir, { recursive: true });
    g(playgroundDir, "init", "-q", "-b", "main");
    g(playgroundDir, "config", "user.name", "Previous Operator");
    g(playgroundDir, "config", "user.email", "ops@example.com");
    writeFileSync(path.join(playgroundDir, "rates.txt"), "Rush load: $750\n");
    g(playgroundDir, "add", "-A");
    g(playgroundDir, "commit", "-q", "-m", "Open the rate book");
    const { body: during } = await httpGet(port, "/crisis/scenarios/crisis-01/state");
    expect(detectActiveSession(during)).toBe(true);

    // Cleanup (session ends)
    rmSync(playgroundDir, { recursive: true, force: true });

    // Next smoke run after restart
    const { status, body: after } = await httpGet(port, "/crisis/scenarios/crisis-01/state");
    expect(status).toBe(200);
    const afterState = after as { commits?: unknown[] };
    expect(Array.isArray(afterState.commits)).toBe(true);
    expect(afterState.commits!.length).toBe(0);
    expect(detectActiveSession(afterState)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Smoke-script integration — run the actual smoke binary
//
// Tests the new sentinel contract introduced to replace the learner-session
// guard: the smoke script always POSTs setup/check to "crisis-smoke" and never
// resets learner scenarios (crisis-01 etc.).
//
// Tested in two variants:
//   A) learner scenario has no commits (fresh restart after cleanup)
//   B) learner scenario has commits (active learner session)
// In both cases the sentinel must be set up and learner scenarios untouched.
// ---------------------------------------------------------------------------

/** Minimal commit that satisfies the commits[] item schema. */
function fakeCommit(n: number): object {
  return {
    hash: `${"a".repeat(40 - String(n).length)}${n}`,
    shortHash: `aaa${n}`,
    subject: `Commit ${n}`,
    authorName: "Previous Operator",
    date: "2024-01-01T00:00:00Z",
    refs: [],
    parents: [],
  };
}

/** Minimal crisis state body matching GetCrisisRepoStateResponse. */
function crisisStateBody(id: string, commits: unknown[]): object {
  return {
    lessonId: id,
    hasPlayground: commits.length > 0,
    initialized: commits.length > 0,
    currentBranch: commits.length > 0 ? "main" : null,
    detachedHead: false,
    mergeInProgress: false,
    files: [],
    commits,
    branches: commits.length > 0 ? [{ name: "main", isCurrent: true, headHash: "abc" }] : [],
    remotes: [],
    remoteBranches: [],
    syncStatus: null,
    repoFolder: null,
    summary: commits.length > 0 ? "Playground has commits." : "No repo yet.",
    hasBot: false,
  };
}

/**
 * Build and start a mock server for the smoke script.
 * `learnerCommits` controls the state of the first learner scenario (crisis-01).
 * The sentinel (crisis-smoke) is excluded from GET /crisis/scenarios, matching
 * the real server behaviour.
 */
async function startMockServer(learnerCommits: unknown[]): Promise<{
  port: number;
  server: http.Server;
  posted: () => string[];
}> {
  const recorded: string[] = [];

  const app = express();
  app.use(express.json());

  const rec: RequestHandler = (req, _res, next) => {
    if (req.method === "POST" || req.method === "DELETE") {
      recorded.push(`${req.method} ${req.path}`);
    }
    next();
  };
  app.use(rec);

  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", smokeStatus: "unknown" });
  });

  app.get("/api/dojo/overview", (_req, res) => {
    res.json({ totalLessons: 0, startedLessons: 0, totalCommits: 0, dojoFound: false });
  });

  // No lessons → lesson-specific branches all skipped
  app.get("/api/dojo/lessons", (_req, res) => { res.json([]); });

  // Learner scenarios: crisis-smoke sentinel excluded (matches real server)
  app.get("/api/crisis/scenarios", (_req, res) => {
    res.json([
      {
        id: "crisis-01",
        number: 1,
        hasPlayground: learnerCommits.length > 0,
        initialized: learnerCommits.length > 0,
        solved: false,
        path: "/tmp/crisis-01",
      },
    ]);
  });

  // Learner scenario state — controlled by the test
  app.get("/api/crisis/scenarios/crisis-01/state", (_req, res) => {
    res.json(crisisStateBody("crisis-01", learnerCommits));
  });

  // Sentinel setup/check — must always be called
  app.post("/api/crisis/scenarios/crisis-smoke/setup", (_req, res) => {
    res.json({ ok: true, message: "Sentinel setup complete.", path: "/tmp/crisis-smoke" });
  });

  app.post("/api/crisis/scenarios/crisis-smoke/check", (_req, res) => {
    res.json({ ran: true, passed: true, output: "all good" });
  });

  // Learner scenario setup — must NEVER be called by the smoke script
  app.post("/api/crisis/scenarios/crisis-01/setup", (_req, res) => {
    res.json({ ok: true, message: "Learner setup.", path: "/tmp/crisis-01" });
  });

  app.get("/api/capstone/status", (_req, res) => {
    res.json({
      githubConnected: false, githubLogin: null, repo: null,
      prNumber: null, prUrl: null, prBranch: null, missions: [], badgeEarnedAt: null,
    });
  });

  app.get("/api/progress", (_req, res) => { res.json({ entries: [] }); });
  app.post("/api/progress/complete", (_req, res) => { res.json({ entries: [] }); });

  app.post("/api/drills/due", (_req, res) => {
    res.json({ items: [], dueCount: 0, friction: [] });
  });

  app.post("/api/drills/attempt", (req, res) => {
    const { itemId, correct } = req.body as { itemId?: unknown; correct?: unknown };
    if (typeof itemId !== "string" || typeof correct !== "boolean") {
      res.status(400).json({ error: "invalid body" });
      return;
    }
    res.json({
      id: itemId,
      seenCount: 1,
      correctCount: correct ? 1 : 0,
      lastCorrect: correct,
      lastSeenAt: "2024-01-01T00:00:00Z",
      dueAt: null,
      dueNow: false,
      priority: 0,
    });
  });

  app.get("/api/export/promo-meta", (_req, res) => {
    res.json({ sceneDurations: { "scene-1": 1000 }, totalDurationMs: 1000, totalDurationSec: 1 });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return { port, server, posted: () => [...recorded] };
}

/** Locate the tsx binary installed by the scripts package. */
function tsxBin(): string {
  const candidates = [
    path.resolve(__dirname, "../../../../scripts/node_modules/.bin/tsx"),
    path.resolve(__dirname, "../../../../../scripts/node_modules/.bin/tsx"),
    path.resolve(__dirname, "../../../../node_modules/.bin/tsx"),
    path.resolve(__dirname, "../../node_modules/.bin/tsx"),
  ];
  for (const c of candidates) {
    try { execFileSync(c, ["--version"], { stdio: "ignore" }); return c; }
    catch { /* try next */ }
  }
  return "tsx";
}

const SMOKE_SCRIPT = path.resolve(__dirname, "../../../../scripts/src/api-smoke.ts");

async function runSmoke(port: number): Promise<void> {
  try {
    await execFileAsync(tsxBin(), [SMOKE_SCRIPT], {
      env: {
        ...process.env,
        API_URL: `http://127.0.0.1:${port}`,
        SKIP_EXPORT_SMOKE: "1",
      },
      timeout: 30_000,
    });
  } catch {
    // exit code may be non-zero in the mock environment; we only care about
    // which requests were recorded.
  }
}

describe("smoke-script integration — sentinel contract (crisis-smoke always set up)", () => {
  it(
    "always POSTs crisis-smoke/setup even when learner scenario has no commits (fresh restart after cleanup)",
    async () => {
      const { port, server, posted } = await startMockServer([]);
      try {
        await runSmoke(port);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }

      const posts = posted();
      // Sentinel setup must have been called unconditionally
      expect(posts.some((p) => p.includes("/crisis-smoke/setup"))).toBe(true);
      // Learner scenario must never be reset by the smoke script
      expect(posts.some((p) => p.includes("/crisis-01/setup"))).toBe(false);
    },
    35_000,
  );

  it(
    "always POSTs crisis-smoke/setup even when learner scenario has commits (active session protected)",
    async () => {
      const { port, server, posted } = await startMockServer([fakeCommit(1)]);
      try {
        await runSmoke(port);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }

      const posts = posted();
      // Sentinel setup must still have been called — commits on a learner
      // scenario no longer gate the smoke check's setup step
      expect(posts.some((p) => p.includes("/crisis-smoke/setup"))).toBe(true);
      // Learner scenario must never be reset regardless of its commit state
      expect(posts.some((p) => p.includes("/crisis-01/setup"))).toBe(false);
    },
    35_000,
  );
});
