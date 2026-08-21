/**
 * Tests for the capstone write endpoints — POST /api/capstone/repo,
 * POST /api/capstone/verify/:missionId, DELETE /api/capstone/repo.
 *
 * These endpoints require a live GitHub connection and are stateful/destructive,
 * so the smoke check skips them unless SMOKE_CAPSTONE_WRITES=1.  This test
 * validates that the success-path response bodies conform to the generated Zod
 * schemas (CreateCapstoneRepoResponse, VerifyCapstoneMissionResponse,
 * DeleteCapstoneRepoResponse) so a shape regression can't go undetected until
 * a learner actually starts the capstone.
 *
 * All external I/O is mocked:
 *   - ghJson / getConnectedLogin / getConnectedLoginResult → lib/github
 *   - loadCapstone / saveCapstone / clearCapstone → lib/capstone-store
 *   - recordCompletion             → lib/progress-store
 *
 * Timer-based delays (the 1500 ms auto_init wait) are mocked with vi.useFakeTimers.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import {
  CreateCapstoneRepoResponse,
  VerifyCapstoneMissionResponse,
  DeleteCapstoneRepoResponse,
} from "@workspace/api-zod";

/**
 * Minimal local type for a Zod schema — avoids importing from `zod` directly
 * (not a declared direct dependency of this package).
 */
interface Schema {
  safeParse(val: unknown): {
    success: boolean;
    data?: unknown;
    error?: { issues: Array<{ path: (string | number)[]; message: string }> };
  };
}

// ---------------------------------------------------------------------------
// Mock setup — must happen before the router is imported
// ---------------------------------------------------------------------------

// ---- GitHub connector -------------------------------------------------------
const mockGetConnectedLogin = vi.fn<() => Promise<string | null>>();
const mockGetConnectedLoginResult = vi.fn<
  () => Promise<{ login: string | null; unavailable: boolean; errorMessage: string | null }>
>();
const mockGhJson = vi.fn<
  (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>
>();

vi.mock("../lib/github.js", () => ({
  getConnectedLogin: (...args: unknown[]) => mockGetConnectedLogin(...(args as [])),
  getConnectedLoginResult: (...args: unknown[]) =>
    mockGetConnectedLoginResult(...(args as [])),
  isGitHubUnavailable: (result: { ok: boolean; status: number }) =>
    !result.ok &&
    (result.status === 0 ||
      result.status === 408 ||
      result.status === 429 ||
      result.status >= 500),
  ghJson: (...args: unknown[]) =>
    mockGhJson(...(args as [string, (object | undefined)?])),
  // ghFetch is not used directly by the router
  ghFetch: vi.fn(),
}));

// ---- Capstone store ---------------------------------------------------------
import type { CapstoneState } from "../lib/capstone-store.js";

let mockCapstoneState: CapstoneState | null = null;

vi.mock("../lib/capstone-store.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/capstone-store.js")>();
  return {
    ...original,
    loadCapstone: vi.fn(() => mockCapstoneState),
    saveCapstone: vi.fn((s: CapstoneState) => {
      mockCapstoneState = s;
    }),
    clearCapstone: vi.fn(() => {
      mockCapstoneState = null;
    }),
  };
});

// ---- Progress store ---------------------------------------------------------
vi.mock("../lib/progress-store.js", () => ({
  loadEntries: vi.fn(() => []),
  recordCompletion: vi.fn(),
}));

// Import router AFTER mocks are registered.
const { default: capstoneRouter } = await import("./capstone.js");

// ---------------------------------------------------------------------------
// Minimal Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
// Wire up a stub request logger that the router references via req.log
app.use((_req, _res, next) => {
  (
    _req as unknown as {
      log: { info: () => void; warn: () => void; error: () => void };
    }
  ).log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  next();
});
app.use("/api", capstoneRouter);

let server: Server;
let base: string;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        base = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

beforeEach(() => {
  vi.clearAllMocks();
  mockCapstoneState = null;
  // Default: GitHub connected.
  mockGetConnectedLogin.mockResolvedValue("testuser");
  mockGetConnectedLoginResult.mockResolvedValue({
    login: "testuser",
    unavailable: false,
    errorMessage: null,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo() {
  return {
    id: 123456,
    name: "dojo-live-capstone",
    full_name: "testuser/dojo-live-capstone",
    html_url: "https://github.com/testuser/dojo-live-capstone",
    clone_url: "https://github.com/testuser/dojo-live-capstone.git",
    default_branch: "main",
    owner: { login: "testuser" },
  };
}

function makeCapstoneState(overrides: Partial<CapstoneState> = {}): CapstoneState {
  return {
    owner: "testuser",
    repoId: 123456,
    repoName: "dojo-live-capstone",
    repoFullName: "testuser/dojo-live-capstone",
    htmlUrl: "https://github.com/testuser/dojo-live-capstone",
    cloneUrl: "https://github.com/testuser/dojo-live-capstone.git",
    defaultBranch: "main",
    prNumber: 42,
    prUrl: "https://github.com/testuser/dojo-live-capstone/pull/42",
    prBranch: "dojo/practice-pr-abc1",
    seedShas: ["seed-sha-1"],
    missionsVerifiedAt: {},
    badgeEarnedAt: null,
    createdByDojo: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** ghJson mock that returns a canned 404 for any path. */
function ghJsonNotFound() {
  return { ok: false, status: 404, data: null, errorMessage: "Not Found" };
}

/** Validate that a fetch response body parses cleanly against a Zod schema. */
async function assertSchemaMatch(
  res: Response,
  schema: Schema,
): Promise<unknown> {
  expect(res.ok, `expected 2xx, got ${res.status}`).toBe(true);
  const body: unknown = await res.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = (result.error?.issues ?? [])
      .map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Response body failed schema validation — ${issues}`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /api/capstone/repo
// ---------------------------------------------------------------------------

describe("POST /api/capstone/repo — response shape", () => {
  it("200 success path: response matches CreateCapstoneRepoResponse schema", async () => {
    vi.useFakeTimers();

    const repo = makeRepo();

    // Wire ghJson to answer each call in the sequence the route makes them.
    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      const method = init?.method?.toUpperCase() ?? "GET";

      // 1. Collision check — repo does not exist yet
      if (method === "GET" && path === "/repos/testuser/dojo-live-capstone") {
        return ghJsonNotFound();
      }
      // 2. Create the repo
      if (method === "POST" && path === "/user/repos") {
        return { ok: true, status: 201, data: repo, errorMessage: null };
      }
      // 3. Read seed commits
      if (
        method === "GET" &&
        path.startsWith("/repos/testuser/dojo-live-capstone/commits")
      ) {
        return {
          ok: true,
          status: 200,
          data: [{ sha: "seed-sha-1" }],
          errorMessage: null,
        };
      }
      // 4. List open PRs — none yet
      if (
        method === "GET" &&
        path.includes("/pulls?state=open")
      ) {
        return { ok: true, status: 200, data: [], errorMessage: null };
      }
      // 5. Read HEAD sha for PR branch creation
      if (method === "GET" && path.includes("/git/ref/heads/")) {
        return {
          ok: true,
          status: 200,
          data: { object: { sha: "head-sha-abc" } },
          errorMessage: null,
        };
      }
      // 6. Create the PR branch
      if (method === "POST" && path.includes("/git/refs")) {
        return { ok: true, status: 201, data: {}, errorMessage: null };
      }
      // 7. Seed file commit
      if (method === "PUT" && path.includes("/contents/DOJO_MISSION")) {
        return {
          ok: true,
          status: 201,
          data: { commit: { sha: "file-commit-sha" } },
          errorMessage: null,
        };
      }
      // 8. Open the practice PR
      if (method === "POST" && path.includes("/pulls")) {
        return {
          ok: true,
          status: 201,
          data: {
            number: 42,
            html_url: "https://github.com/testuser/dojo-live-capstone/pull/42",
          },
          errorMessage: null,
        };
      }

      throw new Error(`Unexpected ghJson call: ${method} ${path}`);
    });

    const fetchPromise = fetch(`${base}/api/capstone/repo`, { method: "POST" });

    // Advance fake timers past the 1500 ms auto_init wait.
    await vi.runAllTimersAsync();

    const res = await fetchPromise;
    await assertSchemaMatch(res, CreateCapstoneRepoResponse);

    vi.useRealTimers();
  });

  it("returns 409 (not a schema error) when GitHub is not connected", async () => {
    mockGetConnectedLogin.mockResolvedValue(null);

    const res = await fetch(`${base}/api/capstone/repo`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("is idempotent: reuses existing trusted state and returns CreateCapstoneRepoResponse", async () => {
    const state = makeCapstoneState();
    mockCapstoneState = state;

    // verifyStateTrust fetches the live repo to confirm the id
    mockGhJson.mockResolvedValue({
      ok: true,
      status: 200,
      data: makeRepo(),
      errorMessage: null,
    });

    const res = await fetch(`${base}/api/capstone/repo`, { method: "POST" });
    await assertSchemaMatch(res, CreateCapstoneRepoResponse);
  });
});

// ---------------------------------------------------------------------------
// POST /api/capstone/verify/:missionId
// ---------------------------------------------------------------------------

describe("POST /api/capstone/verify/:missionId — response shape", () => {
  /**
   * Helper that runs a verify call for one missionId, wiring the ghJson mock
   * to what that mission branch needs, and checks the schema.
   */
  async function runVerify(
    missionId: string,
    ghSetup: (path: string, init?: { method?: string }) => unknown,
    stateOverrides: Partial<CapstoneState> = {},
  ) {
    mockCapstoneState = makeCapstoneState(stateOverrides);

    // verifyStateTrust always needs the repo id check first
    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) =>
      ghSetup(path, init),
    );

    const res = await fetch(`${base}/api/capstone/verify/${missionId}`, {
      method: "POST",
    });
    return assertSchemaMatch(res, VerifyCapstoneMissionResponse);
  }

  it("push-commit: response matches schema when a learner commit is found", async () => {
    await runVerify("push-commit", (path) => {
      // verifyStateTrust: confirm repo id
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      // commits list — include one non-seed commit
      if (path.includes("/commits")) {
        return {
          ok: true,
          status: 200,
          data: [
            { sha: "learner-sha-1", commit: { message: "My first real commit" } },
            { sha: "seed-sha-1", commit: { message: "Initial commit" } },
          ],
          errorMessage: null,
        };
      }
      // PR state check (to exclude merge commit)
      if (path.includes("/pulls/42")) {
        return {
          ok: true,
          status: 200,
          data: { merge_commit_sha: null, title: "Dojo practice PR" },
          errorMessage: null,
        };
      }
      throw new Error(`Unexpected ghJson call: ${path}`);
    });
  });

  it("push-commit: response matches schema even when no learner commit exists yet", async () => {
    await runVerify("push-commit", (path) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes("/commits")) {
        return {
          ok: true,
          status: 200,
          data: [{ sha: "seed-sha-1", commit: { message: "Initial commit" } }],
          errorMessage: null,
        };
      }
      if (path.includes("/pulls/42")) {
        return {
          ok: true,
          status: 200,
          data: { merge_commit_sha: null, title: "Dojo practice PR" },
          errorMessage: null,
        };
      }
      throw new Error(`Unexpected ghJson call: ${path}`);
    });
  });

  it("create-branch: response matches schema when a learner branch is found", async () => {
    await runVerify("create-branch", (path) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes("/branches")) {
        return {
          ok: true,
          status: 200,
          data: [
            { name: "main" },
            { name: "dojo/practice-pr-abc1" },
            { name: "my-feature" }, // learner branch
          ],
          errorMessage: null,
        };
      }
      throw new Error(`Unexpected ghJson call: ${path}`);
    });
  });

  it("create-branch: response matches schema when no learner branch exists", async () => {
    await runVerify("create-branch", (path) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes("/branches")) {
        return {
          ok: true,
          status: 200,
          data: [{ name: "main" }, { name: "dojo/practice-pr-abc1" }],
          errorMessage: null,
        };
      }
      throw new Error(`Unexpected ghJson call: ${path}`);
    });
  });

  it("merge-pr: response matches schema when the PR is merged", async () => {
    await runVerify("merge-pr", (path) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes("/pulls/42")) {
        return {
          ok: true,
          status: 200,
          data: { merged: true, state: "closed" },
          errorMessage: null,
        };
      }
      throw new Error(`Unexpected ghJson call: ${path}`);
    });
  });

  it("merge-pr: response matches schema when the PR is still open", async () => {
    await runVerify("merge-pr", (path) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes("/pulls/42")) {
        return {
          ok: true,
          status: 200,
          data: { merged: false, state: "open" },
          errorMessage: null,
        };
      }
      throw new Error(`Unexpected ghJson call: ${path}`);
    });
  });

  it("returns 409 when GitHub is not connected", async () => {
    mockGetConnectedLoginResult.mockResolvedValue({
      login: null,
      unavailable: false,
      errorMessage: "Bad credentials",
    });
    mockCapstoneState = makeCapstoneState();

    const res = await fetch(`${base}/api/capstone/verify/push-commit`, {
      method: "POST",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("returns 404 for an unknown missionId", async () => {
    const res = await fetch(`${base}/api/capstone/verify/unknown-mission`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("concurrent verify: badge awarded exactly once when two merge-pr calls race", async () => {
    // Start with the other two missions already verified so both concurrent
    // requests will each conclude that all missions are done and attempt to
    // award the badge.
    mockCapstoneState = makeCapstoneState({
      missionsVerifiedAt: {
        "push-commit": "2026-01-01T00:00:00.000Z",
        "create-branch": "2026-01-01T00:01:00.000Z",
      },
    });

    const { loadCapstone, saveCapstone } = await import("../lib/capstone-store.js");
    const { recordCompletion } = await import("../lib/progress-store.js");

    // Override the capstone-store mocks so every call returns an independent
    // deep clone of the shared state — exactly as the real implementation does
    // when it deserialises JSON from disk on each call. Without this, both
    // concurrent requests share the same object reference: a mutation by one
    // is instantly visible to the other through its own `state` pointer, so
    // the race never actually manifests in tests even without the fix.
    vi.mocked(loadCapstone).mockImplementation(
      () => (mockCapstoneState ? (JSON.parse(JSON.stringify(mockCapstoneState)) as CapstoneState) : null),
    );
    vi.mocked(saveCapstone).mockImplementation((s: CapstoneState) => {
      mockCapstoneState = JSON.parse(JSON.stringify(s)) as CapstoneState;
    });

    try {
      // A short async delay on the PR-state check ensures both requests are
      // in-flight simultaneously, so both read the pre-badge snapshot before
      // either reaches the badge-write block.
      mockGhJson.mockImplementation(async (path: string) => {
        if (path === "/repos/testuser/dojo-live-capstone") {
          return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
        }
        if (path.includes("/pulls/42")) {
          await new Promise<void>((resolve) => setTimeout(resolve, 20));
          return {
            ok: true,
            status: 200,
            data: { merged: true, state: "closed" },
            errorMessage: null,
          };
        }
        throw new Error(`Unexpected ghJson call: ${path}`);
      });

      // Fire both verify requests simultaneously.
      const [res1, res2] = await Promise.all([
        fetch(`${base}/api/capstone/verify/merge-pr`, { method: "POST" }),
        fetch(`${base}/api/capstone/verify/merge-pr`, { method: "POST" }),
      ]);

      expect(res1.ok, `first response not ok: ${res1.status}`).toBe(true);
      expect(res2.ok, `second response not ok: ${res2.status}`).toBe(true);

      // recordCompletion must be called exactly once — the race guard in the
      // handler reloads fresh state before writing so only one request wins
      // the badge.
      expect(recordCompletion).toHaveBeenCalledTimes(1);
      expect(recordCompletion).toHaveBeenCalledWith("go-live-capstone", "live");

      // The persisted badgeEarnedAt must be a single valid ISO timestamp.
      expect(mockCapstoneState).not.toBeNull();
      expect(typeof mockCapstoneState!.badgeEarnedAt).toBe("string");
      expect(
        Number.isFinite(Date.parse(mockCapstoneState!.badgeEarnedAt!)),
        "badgeEarnedAt must be a valid ISO date string",
      ).toBe(true);
    } finally {
      // Restore the original shallow implementations so subsequent tests are
      // unaffected (vi.clearAllMocks in beforeEach clears call counts but not
      // implementations set via mockImplementation).
      vi.mocked(loadCapstone).mockImplementation(() => mockCapstoneState);
      vi.mocked(saveCapstone).mockImplementation((s: CapstoneState) => {
        mockCapstoneState = s;
      });
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/capstone/repo — mid-operation GitHub failures
// ---------------------------------------------------------------------------

describe("POST /api/capstone/repo — mid-operation GitHub failures", () => {
  /**
   * The route inserts `await new Promise(r => setTimeout(r, 1500))` after the
   * repo is created.  vi.runAllTimersAsync() is unreliable here because the
   * setTimeout is created asynchronously (after several awaited ghJson calls)
   * and may not be in the timer queue when runAllTimersAsync sweeps.
   *
   * Instead we spy on globalThis.setTimeout and invoke the callback immediately,
   * so the auto-init wait resolves synchronously — no fake-timer mechanics needed.
   */
  beforeEach(() => {
    const _originalSetTimeout = globalThis.setTimeout.bind(globalThis);
    vi.spyOn(globalThis, "setTimeout").mockImplementation(
      (fn: Parameters<typeof setTimeout>[0], _delay?: number, ...args: unknown[]) => {
        // Invoke the callback immediately so the route's 1500 ms auto_init
        // wait resolves without blocking the test.
        if (typeof fn === "function") (fn as (...a: unknown[]) => void)(...args);
        // Return a real Timeout object (via a 0-ms no-op) so callers such as
        // undici's internal parser that expect .unref() on the return value
        // do not crash.
        return _originalSetTimeout(() => {}, 0);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Canned successful responses for each step preceding the one under test. */
  const repo = makeRepo();
  const collisionCheck404 = { ok: false, status: 404, data: null, errorMessage: "Not Found" };
  const createRepoOk = { ok: true, status: 201, data: repo, errorMessage: null };
  const readCommitsOk = { ok: true, status: 200, data: [{ sha: "seed-sha-1" }], errorMessage: null };
  const listPRsOk = { ok: true, status: 200, data: [], errorMessage: null };
  const readHeadRefOk = { ok: true, status: 200, data: { object: { sha: "head-sha-abc" } }, errorMessage: null };
  const createBranchOk = { ok: true, status: 201, data: {}, errorMessage: null };
  const seedFileOk = { ok: true, status: 201, data: { commit: { sha: "file-sha" } }, errorMessage: null };
  const networkFail = { ok: false, status: 0, data: null, errorMessage: "network error" };

  it("returns 409 when repo creation fails; state stays null", async () => {
    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && path === "/repos/testuser/dojo-live-capstone") return collisionCheck404;
      if (method === "POST" && path === "/user/repos") return networkFail;
      throw new Error(`Unexpected: ${method} ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/repo`, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    // No state should have been saved — we never got a repo id back
    expect(mockCapstoneState).toBeNull();
  });

  it("returns 409 when reading HEAD ref fails (pre-branch step); state has repo but no PR", async () => {
    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && path === "/repos/testuser/dojo-live-capstone") return collisionCheck404;
      if (method === "POST" && path === "/user/repos") return createRepoOk;
      if (method === "GET" && path.includes("/commits")) return readCommitsOk;
      if (method === "GET" && path.includes("/pulls?state=open")) return listPRsOk;
      if (method === "GET" && path.includes("/git/ref/heads/")) return networkFail; // ← fails here
      throw new Error(`Unexpected: ${method} ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/repo`, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    // State was saved after repo creation (prNumber=null); no partial PR info
    expect(mockCapstoneState).not.toBeNull();
    expect(mockCapstoneState!.prNumber).toBeNull();
  });

  it("returns 409 when branch creation fails; state has repo but no PR", async () => {
    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && path === "/repos/testuser/dojo-live-capstone") return collisionCheck404;
      if (method === "POST" && path === "/user/repos") return createRepoOk;
      if (method === "GET" && path.includes("/commits")) return readCommitsOk;
      if (method === "GET" && path.includes("/pulls?state=open")) return listPRsOk;
      if (method === "GET" && path.includes("/git/ref/heads/")) return readHeadRefOk;
      if (method === "POST" && path.includes("/git/refs")) return networkFail; // ← fails here
      throw new Error(`Unexpected: ${method} ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/repo`, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(mockCapstoneState!.prNumber).toBeNull();
  });

  it("returns 409 when file seeding fails; state has repo but no PR", async () => {
    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && path === "/repos/testuser/dojo-live-capstone") return collisionCheck404;
      if (method === "POST" && path === "/user/repos") return createRepoOk;
      if (method === "GET" && path.includes("/commits")) return readCommitsOk;
      if (method === "GET" && path.includes("/pulls?state=open")) return listPRsOk;
      if (method === "GET" && path.includes("/git/ref/heads/")) return readHeadRefOk;
      if (method === "POST" && path.includes("/git/refs")) return createBranchOk;
      if (method === "PUT" && path.includes("/contents/DOJO_MISSION")) return networkFail; // ← fails here
      throw new Error(`Unexpected: ${method} ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/repo`, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(mockCapstoneState!.prNumber).toBeNull();
  });

  it("returns 409 when opening the practice PR fails; state has repo but no PR", async () => {
    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && path === "/repos/testuser/dojo-live-capstone") return collisionCheck404;
      if (method === "POST" && path === "/user/repos") return createRepoOk;
      if (method === "GET" && path.includes("/commits")) return readCommitsOk;
      if (method === "GET" && path.includes("/pulls?state=open")) return listPRsOk;
      if (method === "GET" && path.includes("/git/ref/heads/")) return readHeadRefOk;
      if (method === "POST" && path.includes("/git/refs")) return createBranchOk;
      if (method === "PUT" && path.includes("/contents/DOJO_MISSION")) return seedFileOk;
      if (method === "POST" && path.includes("/pulls")) return networkFail; // ← fails here
      throw new Error(`Unexpected: ${method} ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/repo`, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    // Repo exists in state but no PR was persisted
    expect(mockCapstoneState!.prNumber).toBeNull();
    expect(mockCapstoneState!.prUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /api/capstone/verify/:missionId — mid-operation GitHub failures
// ---------------------------------------------------------------------------

describe("POST /api/capstone/verify/:missionId — mid-operation GitHub failures", () => {
  it("signals GitHub unavailable and preserves state when the login check cannot connect", async () => {
    const state = makeCapstoneState();
    mockCapstoneState = state;
    mockGetConnectedLoginResult.mockResolvedValue({
      login: null,
      unavailable: true,
      errorMessage: "connector timeout",
    });

    const res = await fetch(`${base}/api/capstone/verify/push-commit`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verified: boolean;
      githubUnavailable: boolean;
      detail: string;
    };
    expect(body.verified).toBe(false);
    expect(body.githubUnavailable).toBe(true);
    expect(body.detail).toContain("connector timeout");
    expect(mockCapstoneState).toEqual(state);
    expect(mockGhJson).not.toHaveBeenCalled();
  });

  it("signals GitHub unavailable and preserves state when the repo trust check cannot connect", async () => {
    const state = makeCapstoneState();
    mockCapstoneState = state;

    mockGhJson.mockResolvedValue({
      ok: false,
      status: 503,
      data: null,
      errorMessage: "Service Unavailable",
    });

    const res = await fetch(`${base}/api/capstone/verify/push-commit`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verified: boolean;
      githubUnavailable: boolean;
      detail: string;
    };
    expect(body.verified).toBe(false);
    expect(body.githubUnavailable).toBe(true);
    expect(body.detail).toContain("Service Unavailable");
    expect(mockCapstoneState).toEqual(state);
  });

  it("still resets state for a confirmed missing repository", async () => {
    mockCapstoneState = makeCapstoneState();
    mockGhJson.mockResolvedValue(ghJsonNotFound());

    const res = await fetch(`${base}/api/capstone/verify/push-commit`, {
      method: "POST",
    });

    expect(res.status).toBe(409);
    expect(mockCapstoneState).toBeNull();
  });

  /**
   * When ghJson fails during the mission-specific check (after verifyStateTrust
   * succeeds), the route returns verified:false with githubUnavailable:true so
   * the dashboard can distinguish an outage from incomplete mission work.
   */
  it("push-commit: signals GitHub unavailable when commits fetch fails", async () => {
    mockCapstoneState = makeCapstoneState();
    const networkFail = { ok: false, status: 0, data: null, errorMessage: "network error" };

    mockGhJson.mockImplementation(async (path: string) => {
      // verifyStateTrust succeeds
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      // mission-specific commits fetch fails
      if (path.includes("/commits")) return networkFail;
      throw new Error(`Unexpected ghJson call: ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/verify/push-commit`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verified: boolean;
      githubUnavailable: boolean;
      detail: string;
    };
    expect(body.verified).toBe(false);
    expect(body.githubUnavailable).toBe(true);
    expect(typeof body.detail).toBe("string");
  });

  it("create-branch: signals GitHub unavailable when branches fetch fails", async () => {
    mockCapstoneState = makeCapstoneState();
    const networkFail = { ok: false, status: 0, data: null, errorMessage: "network error" };

    mockGhJson.mockImplementation(async (path: string) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes("/branches")) return networkFail;
      throw new Error(`Unexpected ghJson call: ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/verify/create-branch`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verified: boolean;
      githubUnavailable: boolean;
      detail: string;
    };
    expect(body.verified).toBe(false);
    expect(body.githubUnavailable).toBe(true);
    expect(typeof body.detail).toBe("string");
  });

  it("merge-pr: signals GitHub unavailable when PR fetch fails", async () => {
    mockCapstoneState = makeCapstoneState();
    const networkFail = { ok: false, status: 0, data: null, errorMessage: "network error" };

    mockGhJson.mockImplementation(async (path: string) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes("/pulls/42")) return networkFail;
      throw new Error(`Unexpected ghJson call: ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/verify/merge-pr`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verified: boolean;
      githubUnavailable: boolean;
      detail: string;
    };
    expect(body.verified).toBe(false);
    expect(body.githubUnavailable).toBe(true);
    expect(typeof body.detail).toBe("string");
  });

  it.each([
    ["push-commit", "/commits"],
    ["create-branch", "/branches"],
  ])("%s: resets state when the repo disappears after the trust check", async (missionId, missionPath) => {
    mockCapstoneState = makeCapstoneState();
    mockGhJson.mockImplementation(async (path: string) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes(missionPath)) return ghJsonNotFound();
      throw new Error(`Unexpected ghJson call: ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/verify/${missionId}`, { method: "POST" });

    expect(res.status).toBe(409);
    expect(mockCapstoneState).toBeNull();
  });

  it("merge-pr: treats a missing PR as actionable mission state, not an outage", async () => {
    const state = makeCapstoneState();
    mockCapstoneState = state;
    mockGhJson.mockImplementation(async (path: string) => {
      if (path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (path.includes("/pulls/42")) return ghJsonNotFound();
      throw new Error(`Unexpected ghJson call: ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/verify/merge-pr`, { method: "POST" });
    const body = (await res.json()) as {
      verified: boolean;
      githubUnavailable: boolean;
      detail: string;
    };

    expect(res.status).toBe(200);
    expect(body.verified).toBe(false);
    expect(body.githubUnavailable).toBe(false);
    expect(body.detail).toContain("no longer exists");
    expect(mockCapstoneState).toEqual(state);
  });

  it.each(["push-commit", "merge-pr"])(
    "%s: resets state when a PR 404 is followed by confirmation that the repo is gone",
    async (missionId) => {
      mockCapstoneState = makeCapstoneState();
      let repoChecks = 0;
      mockGhJson.mockImplementation(async (path: string) => {
        if (path === "/repos/testuser/dojo-live-capstone") {
          repoChecks += 1;
          return repoChecks === 1
            ? { ok: true, status: 200, data: makeRepo(), errorMessage: null }
            : ghJsonNotFound();
        }
        if (path.includes("/commits")) {
          return {
            ok: true,
            status: 200,
            data: [{ sha: "seed-sha-1", commit: { message: "Initial commit" } }],
            errorMessage: null,
          };
        }
        if (path.includes("/pulls/42")) return ghJsonNotFound();
        throw new Error(`Unexpected ghJson call: ${path}`);
      });

      const res = await fetch(`${base}/api/capstone/verify/${missionId}`, { method: "POST" });

      expect(res.status).toBe(409);
      expect(repoChecks).toBe(2);
      expect(mockCapstoneState).toBeNull();
    },
  );

  it.each([401, 403])(
    "create-branch: status %s is not mislabeled as an outage and preserves state",
    async (status) => {
      const state = makeCapstoneState();
      mockCapstoneState = state;
      mockGhJson.mockImplementation(async (path: string) => {
        if (path === "/repos/testuser/dojo-live-capstone") {
          return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
        }
        if (path.includes("/branches")) {
          return { ok: false, status, data: null, errorMessage: "Forbidden" };
        }
        throw new Error(`Unexpected ghJson call: ${path}`);
      });

      const res = await fetch(`${base}/api/capstone/verify/create-branch`, { method: "POST" });
      const body = (await res.json()) as {
        verified: boolean;
        githubUnavailable: boolean;
        detail: string;
      };

      expect(res.status).toBe(200);
      expect(body.verified).toBe(false);
      expect(body.githubUnavailable).toBe(false);
      expect(body.detail).toContain("Reconnect GitHub");
      expect(mockCapstoneState).toEqual(state);
    },
  );
});

// ---------------------------------------------------------------------------
// DELETE /api/capstone/repo
// ---------------------------------------------------------------------------

describe("DELETE /api/capstone/repo — response shape", () => {
  it("returns GetCapstoneStatusResponse shape when there is no capstone state", async () => {
    mockCapstoneState = null;
    // DELETE with no state falls through to a plain status response — the
    // route uses GetCapstoneStatusResponse schema for that branch.
    const { GetCapstoneStatusResponse } = await import("@workspace/api-zod");

    const res = await fetch(`${base}/api/capstone/repo`, { method: "DELETE" });
    await assertSchemaMatch(res, GetCapstoneStatusResponse);
  });

  it("returns DeleteCapstoneRepoResponse shape after clearing state (token lacks delete_repo)", async () => {
    const state = makeCapstoneState();
    mockCapstoneState = state;

    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      const method = init?.method?.toUpperCase() ?? "GET";
      // verifyStateTrust: confirm repo id
      if (method === "GET" && path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      // Deletion attempt — 403 (token lacks delete_repo scope)
      if (method === "DELETE" && path === "/repos/testuser/dojo-live-capstone") {
        return {
          ok: false,
          status: 403,
          data: null,
          errorMessage: "Must have admin rights to Repository.",
        };
      }
      throw new Error(`Unexpected ghJson call: ${method} ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/repo`, { method: "DELETE" });
    // The route returns 409 when deletion is refused — validate the error shape
    // rather than the success schema (this is the most common real-world path).
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("returns DeleteCapstoneRepoResponse shape when deletion succeeds", async () => {
    const state = makeCapstoneState();
    mockCapstoneState = state;

    mockGhJson.mockImplementation(async (path: string, init?: { method?: string }) => {
      const method = init?.method?.toUpperCase() ?? "GET";
      if (method === "GET" && path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 200, data: makeRepo(), errorMessage: null };
      }
      if (method === "DELETE" && path === "/repos/testuser/dojo-live-capstone") {
        return { ok: true, status: 204, data: null, errorMessage: null };
      }
      throw new Error(`Unexpected ghJson call: ${method} ${path}`);
    });

    const res = await fetch(`${base}/api/capstone/repo`, { method: "DELETE" });
    await assertSchemaMatch(res, DeleteCapstoneRepoResponse);
  });
});
