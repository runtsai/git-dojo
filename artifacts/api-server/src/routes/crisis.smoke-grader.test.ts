/**
 * Unit test: crisis-smoke grader always passes after a fresh setup.
 *
 * The SMOKE_SCENARIO_ID sentinel ("crisis-smoke") is exercised on every smoke
 * run so that grader regressions cannot hide behind a stale learner playground.
 * Its setup is intentionally trivial (one commit), so its grader must return
 * `passed: true` immediately after setup completes.
 *
 * If the check logic ever drifts — e.g. the log-check regex changes — this
 * test catches the regression before it can silently mask a broken grader.
 *
 * Strategy
 * --------
 * 1. Redirect os.homedir() to an isolated temp dir so crisisRoot() never
 *    touches the real workspace (no nested .git risk).
 * 2. Start a real Express server with the crisis router (no mocks).
 * 3. POST /crisis/scenarios/crisis-smoke/setup  — must return { ok: true }.
 * 4. POST /crisis/scenarios/crisis-smoke/check  — must return { ran: true,
 *    passed: true } with no FAIL lines in the output.
 *
 * The requireOwner middleware passes workspace-internal requests (those that
 * lack the X-Replit-User-* headers injected by Replit's edge proxy), so plain
 * http.request calls from within the test process are always admitted.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function httpPost(port: number, urlPath: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: urlPath, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": "0" } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          let body: unknown;
          try { body = JSON.parse(Buffer.concat(chunks).toString()); }
          catch { body = Buffer.concat(chunks).toString(); }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("crisis-smoke grader — passes immediately after fresh setup", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    // Redirect os.homedir() so crisisRoot() resolves to our temp dir and never
    // touches the workspace (avoids nested-.git issues noted in MEMORY).
    fakeHome = mkdtempSync(path.join(tmpdir(), "crisis-smoke-grader-"));
    mkdirSync(path.join(fakeHome, "git-dojo"), { recursive: true });

    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

    // Mount the real crisis router — no mocks.
    const { default: crisisRouter } = await import("./crisis.js");

    const app = express();
    app.use(express.json());
    // Satisfy the log property that some route helpers may call via req.log.
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
  }, 30_000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    if (originalHome !== undefined) process.env.HOME = originalHome;
    else delete process.env.HOME;
    try { rmSync(fakeHome, { recursive: true, force: true }); } catch { /* best-effort */ }
  });

  // ── Setup ─────────────────────────────────────────────────────────────────

  it("POST /crisis/scenarios/crisis-smoke/setup returns ok:true", async () => {
    const { status, body } = await httpPost(port, "/crisis/scenarios/crisis-smoke/setup");
    expect(status).toBe(200);
    const b = body as { ok?: boolean; message?: string };
    expect(b.ok).toBe(true);
  }, 20_000);

  // ── Grader ────────────────────────────────────────────────────────────────

  it("POST /crisis/scenarios/crisis-smoke/check returns ran:true and passed:true", async () => {
    const { status, body } = await httpPost(port, "/crisis/scenarios/crisis-smoke/check");
    expect(status).toBe(200);
    const b = body as { ran?: boolean; passed?: boolean; output?: string };
    expect(b.ran).toBe(true);
    expect(b.passed).toBe(true);
  }, 20_000);

  it("check output contains no FAIL lines", async () => {
    const { body } = await httpPost(port, "/crisis/scenarios/crisis-smoke/check");
    const b = body as { output?: string };
    const failLines = (b.output ?? "")
      .split("\n")
      .filter((line) => line.startsWith("FAIL:"));
    expect(failLines).toHaveLength(0);
  }, 20_000);

  it("check output contains at least one PASS line", async () => {
    const { body } = await httpPost(port, "/crisis/scenarios/crisis-smoke/check");
    const b = body as { output?: string };
    const passLines = (b.output ?? "")
      .split("\n")
      .filter((line) => line.startsWith("PASS:"));
    expect(passLines.length).toBeGreaterThan(0);
  }, 20_000);

  it("every individual check in the smoke scenario returns true after setup", async () => {
    // Re-run check a second time (idempotent) to confirm the grader is stable
    // and not relying on side-effects from the first run.
    const { status, body } = await httpPost(port, "/crisis/scenarios/crisis-smoke/check");
    expect(status).toBe(200);
    const b = body as { ran?: boolean; passed?: boolean; output?: string };
    expect(b.ran).toBe(true);
    expect(b.passed).toBe(true);
    // Score line must report zero failures.
    const scoreLine = (b.output ?? "")
      .split("\n")
      .find((line) => line.startsWith("Score:"));
    expect(scoreLine).toBeDefined();
    expect(scoreLine).toMatch(/0 FAIL/);
  }, 20_000);
});
