/**
 * Tests for api-smoke.ts — verifies that the smoke result file is written
 * correctly based on endpoint outcomes.
 *
 * Three scenarios:
 *   1. All endpoints return valid 2xx responses  → passed:true written
 *   2. One endpoint returns a non-200 status     → passed:false written
 *   3. All fetch calls throw a network error     → passed:false still written
 *      (the finally block in run() guarantees the file is never omitted)
 *
 * Strategy: stub global.fetch so no real server is needed, then call run()
 * which exercises runChecks() + writeSmokeResult() end-to-end.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./api-smoke.js";

// ---------------------------------------------------------------------------
// Minimal valid response bodies — satisfy the Zod schemas used in each check.
// Lessons and crisis scenarios lists are empty so parameterised routes are
// skipped, keeping the mock surface small.
// ---------------------------------------------------------------------------

type Body = Record<string, unknown> | unknown[];

/** Build a minimal fetch Response from a status code and JSON body. */
function jsonResponse(status: number, body: Body): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Route table for the "all pass" scenario.
 *
 * POST routes: the mock inspects the parsed body to distinguish valid from
 * invalid payloads so that smokeExpect400 checks (which expect HTTP 400 for
 * malformed bodies) still pass when the valid-body path returns 200.
 */
function makeFetch(
  overrides: Partial<Record<string, number>> = {},
): typeof fetch {
  return async (input: string | URL, init?: RequestInit) => {
    const urlStr = String(input);
    const url = new URL(urlStr);
    const path = url.pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    const rawBody = init?.body
      ? JSON.parse(init.body as string)
      : undefined;

    // Allow per-path status overrides (used by the "one endpoint fails" test).
    const forcedStatus = overrides[path];

    // ── POST routes ──────────────────────────────────────────────────────────
    if (method === "POST") {
      if (forcedStatus !== undefined) {
        return jsonResponse(forcedStatus, { error: "forced failure" });
      }

      if (path === "/api/crisis/scenarios/crisis-smoke/setup") {
        return jsonResponse(200, { ok: true, message: "ok", path: "/tmp/crisis-smoke" });
      }
      if (path === "/api/crisis/scenarios/crisis-smoke/check") {
        return jsonResponse(200, { ran: true, passed: true, output: "" });
      }

      if (path === "/api/progress/complete") {
        const b = rawBody as Record<string, unknown> | undefined;
        if (!b?.moduleId || typeof b?.track !== "string") {
          return jsonResponse(400, { error: "invalid body" });
        }
        if (b.moduleId === "99.99") {
          return jsonResponse(400, { error: "Unknown module: 99.99" });
        }
        return jsonResponse(200, { entries: [] });
      }

      if (path === "/api/drills/due") {
        const b = rawBody as Record<string, unknown> | undefined;
        if (!Array.isArray(b?.candidates)) {
          return jsonResponse(400, { error: "invalid body" });
        }
        return jsonResponse(200, { items: [], dueCount: 0, friction: [] });
      }

      if (path === "/api/drills/attempt") {
        const b = rawBody as Record<string, unknown> | undefined;
        if (!b?.itemId || typeof b?.correct !== "boolean") {
          return jsonResponse(400, { error: "invalid body" });
        }
        return jsonResponse(200, {
          id: "smoke-probe",
          seenCount: 1,
          correctCount: 1,
          lastCorrect: true,
          lastSeenAt: null,
          dueAt: null,
          dueNow: false,
          priority: 0,
        });
      }

      // Unknown POST → 404
      return jsonResponse(404, { error: "not found" });
    }

    // ── GET routes ───────────────────────────────────────────────────────────
    if (forcedStatus !== undefined) {
      return jsonResponse(forcedStatus, { error: "forced failure" });
    }

    const getResponses: Record<string, Body> = {
      "/api/healthz": { status: "ok", smokeStatus: "unknown" },
      "/api/dojo/overview": {
        totalLessons: 0,
        startedLessons: 0,
        totalCommits: 0,
        dojoFound: false,
      },
      // Empty arrays cause all parameterised lesson / scenario routes to be skipped.
      "/api/dojo/lessons": [],
      "/api/crisis/scenarios": [],
      "/api/capstone/status": {
        githubConnected: false,
        githubLogin: null,
        repo: null,
        prNumber: null,
        prUrl: null,
        prBranch: null,
        missions: [],
        badgeEarnedAt: null,
      },
      "/api/progress": { entries: [] },
      "/api/export/promo-meta": {
        sceneDurations: {},
        totalDurationMs: 1000,
        totalDurationSec: 1,
      },
    };

    if (path in getResponses) {
      return jsonResponse(200, getResponses[path]!);
    }

    return jsonResponse(404, { error: "not found" });
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("api-smoke result file", () => {
  let resultFile: string;

  beforeEach(() => {
    resultFile = join(tmpdir(), `api-smoke-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    // Skip the slow promo checks in all tests.
    process.env["SKIP_EXPORT_SMOKE"] = "1";
    process.env["SKIP_DURATION_CHECK"] = "1";
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(resultFile, { force: true });
    await rm(`${resultFile}.tmp`, { force: true });
    delete process.env["SKIP_EXPORT_SMOKE"];
    delete process.env["SKIP_DURATION_CHECK"];
  });

  // ── 1. All endpoints pass ─────────────────────────────────────────────────
  it("writes passed:true when all endpoints return valid 2xx responses", async () => {
    vi.stubGlobal("fetch", makeFetch());

    const failCount = await run({ base: "http://localhost:9999", resultFile });

    expect(failCount).toBe(0);

    const raw = await readFile(resultFile, "utf8");
    const result = JSON.parse(raw) as { passed: boolean; checkedAt: string };
    expect(result.passed).toBe(true);
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ── 2. One endpoint fails ─────────────────────────────────────────────────
  it("writes passed:false when one endpoint returns a non-200 status", async () => {
    // Force GET /api/healthz to return 503; all other routes still pass.
    vi.stubGlobal("fetch", makeFetch({ "/api/healthz": 503 }));

    const failCount = await run({ base: "http://localhost:9999", resultFile });

    expect(failCount).toBeGreaterThan(0);

    const raw = await readFile(resultFile, "utf8");
    const result = JSON.parse(raw) as { passed: boolean; checkedAt: string };
    expect(result.passed).toBe(false);
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ── 3. File always written (even when all fetches throw) ──────────────────
  it("always writes the result file even when every fetch call throws", async () => {
    vi.stubGlobal("fetch", () => {
      throw new Error("simulated network failure");
    });

    const failCount = await run({ base: "http://localhost:9999", resultFile });

    // Every smoke() / smokePost() catches the throw and increments failed.
    expect(failCount).toBeGreaterThan(0);

    // The finally block in run() must have written the file regardless.
    const raw = await readFile(resultFile, "utf8");
    const result = JSON.parse(raw) as { passed: boolean; checkedAt: string };
    expect(result.passed).toBe(false);
  });
});
