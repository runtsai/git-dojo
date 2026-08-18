/**
 * Unit / integration tests for the /api/healthz route.
 *
 * Covers the four meaningful states of /tmp/api-smoke-result.json:
 *   1. File missing        → smokeStatus: "unknown",  status: "ok"
 *   2. passed: true        → smokeStatus: "passed",   status: "ok"
 *   3. passed: false       → smokeStatus: "failed",   status: "degraded"
 *   4. Malformed JSON      → smokeStatus: "unknown",  status: "ok"  (no crash)
 *
 * node:fs is mocked so the test never touches the real filesystem.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Mock node:fs — readFileSync is the only function health.ts calls.
// vi.mock() is hoisted before imports, so healthRouter below sees the mock.
// ---------------------------------------------------------------------------
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    readFileSync: vi.fn(),
  };
});

import healthRouter from "./health.js";
import { readFileSync } from "node:fs";

const readFileSyncMock = vi.mocked(readFileSync);

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
function makeRequest(
  port: number,
  path: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        resolve({
          status: res.statusCode ?? 0,
          body: JSON.parse(text) as unknown,
        });
      });
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle helpers
// ---------------------------------------------------------------------------
function startServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const app = express();
    app.use("/", healthRouter);
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /healthz", () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ server, port } = await startServer());
  });

  afterEach(async () => {
    await stopServer(server);
  });

  // 1. Missing file --------------------------------------------------------
  it("returns status ok and smokeStatus unknown when the result file is missing", async () => {
    // Simulate ENOENT — readFileSync throws when the file does not exist.
    readFileSyncMock.mockImplementation(() => {
      const err = Object.assign(new Error("ENOENT: no such file"), {
        code: "ENOENT",
      });
      throw err;
    });

    const { status, body } = await makeRequest(port, "/healthz");
    const data = body as Record<string, unknown>;

    expect(status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.smokeStatus).toBe("unknown");
    expect(data).not.toHaveProperty("smokeCheckedAt");
  });

  // 2. passed: true --------------------------------------------------------
  it("returns status ok and smokeStatus passed when the file records passed: true", async () => {
    const checkedAt = "2026-08-17T10:00:00.000Z";
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ passed: true, checkedAt }),
    );

    const { status, body } = await makeRequest(port, "/healthz");
    const data = body as Record<string, unknown>;

    expect(status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.smokeStatus).toBe("passed");
    expect(data.smokeCheckedAt).toBe(checkedAt);
  });

  // 3. passed: false -------------------------------------------------------
  it("returns HTTP 503, status degraded and smokeStatus failed when the file records passed: false", async () => {
    const checkedAt = "2026-08-17T09:55:00.000Z";
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ passed: false, checkedAt }),
    );

    const { status, body } = await makeRequest(port, "/healthz");
    const data = body as Record<string, unknown>;

    expect(status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.smokeStatus).toBe("failed");
    expect(data.smokeCheckedAt).toBe(checkedAt);
  });

  // 4. Malformed JSON ------------------------------------------------------
  it("returns status ok and smokeStatus unknown when the file contains malformed JSON", async () => {
    readFileSyncMock.mockReturnValue("{ this is not valid json %%%");

    const { status, body } = await makeRequest(port, "/healthz");
    const data = body as Record<string, unknown>;

    expect(status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.smokeStatus).toBe("unknown");
    expect(data).not.toHaveProperty("smokeCheckedAt");
  });

  // 5. Valid JSON but missing required fields ------------------------------
  it("returns status ok and smokeStatus unknown when the file is valid JSON but lacks the expected shape", async () => {
    // Object with no 'passed' or 'checkedAt' fields.
    readFileSyncMock.mockReturnValue(JSON.stringify({ something: "else" }));

    const { status, body } = await makeRequest(port, "/healthz");
    const data = body as Record<string, unknown>;

    expect(status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.smokeStatus).toBe("unknown");
  });

  // 6. passed is a non-boolean type ----------------------------------------
  it("returns status ok and smokeStatus unknown when passed is not a boolean", async () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ passed: "yes", checkedAt: "2026-08-17T10:00:00.000Z" }),
    );

    const { status, body } = await makeRequest(port, "/healthz");
    const data = body as Record<string, unknown>;

    expect(status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.smokeStatus).toBe("unknown");
  });
});
