/**
 * Confirms that GET /crisis/scenarios returns a well-shaped list containing
 * only real learner scenarios — never the internal smoke-only sentinel.
 *
 * Coverage:
 *  1. Response validates against ListCrisisScenariosResponse (zod schema).
 *  2. The crisis-smoke sentinel ID is absent from the list.
 *  3. No returned ID matches a smoke-test-only naming pattern
 *     (ids containing "smoke", or a number-part of 0).
 *  4. All IDs present are genuine learner scenarios (crisis-01 … crisis-N)
 *     matching the expected canonical pattern.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ListCrisisScenariosResponse } from "@workspace/api-zod";

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
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          body = Buffer.concat(chunks).toString();
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("GET /crisis/scenarios — scenario list integrity", () => {
  let server: http.Server;
  let port: number;
  let fakeHome: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    // Isolate the filesystem so crisisRoot() resolves to a temp dir, not the
    // real workspace, and playground existence checks are deterministic.
    fakeHome = mkdtempSync(path.join(tmpdir(), "crisis-scenario-list-"));
    mkdirSync(path.join(fakeHome, "git-dojo"), { recursive: true });

    originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

    const { default: crisisRouter } = await import("./crisis.js");

    const app = express();
    app.use(express.json());
    // Minimal logger shim required by some middleware in the router.
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
      /* best-effort */
    }
  });

  // ── Shape validation ───────────────────────────────────────────────────────

  it("returns HTTP 200 and a body that parses against ListCrisisScenariosResponse", async () => {
    const { status, body } = await httpGet(port, "/crisis/scenarios");
    expect(status).toBe(200);
    // zod.parse throws on shape mismatch — the test fails if any item is malformed.
    const parsed = ListCrisisScenariosResponse.parse(body);
    expect(Array.isArray(parsed)).toBe(true);
    // Sanity: at least one real scenario must be present.
    expect(parsed.length).toBeGreaterThan(0);
  });

  // ── Smoke-sentinel exclusion ───────────────────────────────────────────────

  it('does not include an item whose id is "crisis-smoke"', async () => {
    const { body } = await httpGet(port, "/crisis/scenarios");
    const scenarios = ListCrisisScenariosResponse.parse(body);
    const ids = scenarios.map((s) => s.id);
    expect(ids).not.toContain("crisis-smoke");
  });

  it("does not include any item whose id contains the word 'smoke'", async () => {
    const { body } = await httpGet(port, "/crisis/scenarios");
    const scenarios = ListCrisisScenariosResponse.parse(body);
    const smokeIds = scenarios.map((s) => s.id).filter((id) => id.includes("smoke"));
    expect(smokeIds).toHaveLength(0);
  });

  // ── Sentinel-number exclusion (number === 0 is sentinel-only) ─────────────

  it("does not include any scenario whose number is 0 (the sentinel sentinel number)", async () => {
    const { body } = await httpGet(port, "/crisis/scenarios");
    const scenarios = ListCrisisScenariosResponse.parse(body);
    const sentinelNumbered = scenarios.filter((s) => s.number === 0);
    expect(sentinelNumbered).toHaveLength(0);
  });

  // ── Canonical learner-ID pattern ───────────────────────────────────────────

  it("returns only IDs matching the crisis-NN pattern with a positive lesson number", async () => {
    const { body } = await httpGet(port, "/crisis/scenarios");
    const scenarios = ListCrisisScenariosResponse.parse(body);
    // Every real learner scenario has an id of the form "crisis-NN" where NN >= 1.
    const LEARNER_ID_RE = /^crisis-0*[1-9]\d*$/;
    for (const scenario of scenarios) {
      expect(scenario.id).toMatch(LEARNER_ID_RE);
    }
  });

  // ── Required learner scenarios present ────────────────────────────────────

  it("includes crisis-01 through crisis-06 (the known learner scenarios)", async () => {
    const { body } = await httpGet(port, "/crisis/scenarios");
    const scenarios = ListCrisisScenariosResponse.parse(body);
    const ids = scenarios.map((s) => s.id);
    for (const expected of ["crisis-01", "crisis-02", "crisis-03", "crisis-04", "crisis-05", "crisis-06"]) {
      expect(ids).toContain(expected);
    }
  });

  // ── Each item carries mandatory fields with correct types ─────────────────

  it("every item has a non-empty string id and a positive integer number", async () => {
    const { body } = await httpGet(port, "/crisis/scenarios");
    const scenarios = ListCrisisScenariosResponse.parse(body);
    for (const s of scenarios) {
      expect(typeof s.id).toBe("string");
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.number).toBe("number");
      expect(Number.isInteger(s.number)).toBe(true);
      expect(s.number).toBeGreaterThan(0);
    }
  });
});
