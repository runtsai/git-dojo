/**
 * Integration tests for the /export/promo-video route.
 *
 * Verifies that two concurrent requests to the export endpoint:
 *   (a) both receive a 200 response with a non-empty body
 *   (b) trigger the underlying render function exactly once (queue logic)
 *
 * Heavy dependencies (puppeteer-core, ffmpeg via child_process, file-system
 * operations) are mocked so the tests run fast without a real browser or
 * encoder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Mock the shared promo-config so that TOTAL_RUNTIME_MS is a small sentinel
// value (2 ms) rather than the real ~22 s.  This keeps every test that
// inspects the duration-mismatch path fast while still exercising the guard
// logic inside export.ts (which imports from the same mock).
//
// IMPORTANT: vi.mock() factories are hoisted before any const/let/var in this
// file, so the literal 2 must appear directly inside the factory rather than
// referencing a module-level variable.
// ---------------------------------------------------------------------------
vi.mock("@workspace/promo-config", () => ({
  TOTAL_RUNTIME_MS: 2,
  TOTAL_RUNTIME_SEC: 0.002,
  SCENE_DURATIONS: { s0: 2 },
}));
// Constant for use in test assertions — must match the literal above.
const MOCK_TOTAL_RUNTIME_MS = 2;

// ---------------------------------------------------------------------------
// Render-call counter — reset in beforeEach, inspected in tests.
// The mock factory increments this every time puppeteer.launch() is invoked,
// which is a reliable proxy for "renderMp4 was called".
// ---------------------------------------------------------------------------
let renderCallCount = 0;

// ---------------------------------------------------------------------------
// Shared evaluate implementation — swap this per-test to control what
// window.__exportTotalMs the mock page reports back to the renderer.
// ---------------------------------------------------------------------------
let evaluateImpl: (expr: unknown) => Promise<unknown> = (expr) => {
  if (typeof expr === "string" && expr.includes("__exportTotalMs")) {
    // Default: return MOCK_TOTAL_RUNTIME_MS (2 ms) so the renderer's hard
    // assertion passes and sleep is only 2 + 400 TAIL_PADDING ms.
    return Promise.resolve(2);
  }
  return Promise.resolve(undefined);
};

// ---------------------------------------------------------------------------
// Mock heavy dependencies.
// vi.mock() calls are hoisted before imports by vitest, so they apply to the
// router module when it is imported below.
// ---------------------------------------------------------------------------

vi.mock("puppeteer-core", () => {
  const mockRecorder = {
    stop: vi.fn().mockResolvedValue(undefined),
  };

  const mockPage = {
    setViewport: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    // Delegate to the module-level evaluateImpl so individual tests can
    // control what the page reports without re-mocking the whole module.
    evaluate: vi.fn().mockImplementation((expr: unknown) => evaluateImpl(expr)),
    screencast: vi.fn().mockResolvedValue(mockRecorder),
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    default: {
      launch: vi.fn().mockImplementation(async () => {
        renderCallCount++;
        return mockBrowser;
      }),
    },
  };
});

// findChromium() calls execSync; renderMp4 calls execFileAsync (= promisify(execFile)).
vi.mock("node:child_process", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("node:child_process")>();
  return {
    ...original,
    execSync: vi.fn(() => "/usr/bin/chromium"),
    // promisify(execFile) passes a node-style callback as the last argument.
    execFile: vi.fn(
      (
        _cmd: string,
        _args: string[],
        _opts: object,
        callback: (err: null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, "", "");
      },
    ),
  };
});

// Avoid all real disk I/O inside the route module.
vi.mock("node:fs/promises", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...original,
    // hashDir iterates source files; returning [] keeps the hash stable.
    readdir: vi.fn().mockResolvedValue([]),
    mkdtemp: vi.fn().mockResolvedValue("/tmp/fake-promo-work"),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    // stat is called on both the captured .webm and the output .mp4.
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
    // readFile is called at the end of renderMp4 to return the finished buffer.
    readFile: vi.fn().mockResolvedValue(Buffer.from("fake-mp4-content")),
  };
});

// existsSync guards both the BG_MUSIC_PATH check and the disk-cache lookup.
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    existsSync: vi.fn((p: unknown) => {
      const s = String(p);
      // Let the background-music presence check pass (.mp3 path).
      if (s.endsWith(".mp3")) return true;
      // Report the disk cache as absent so loadDiskCache() doesn't pre-load
      // renderCache — that would make requests hit the cache rather than the
      // render queue, defeating the test.
      return false;
    }),
  };
});

// ---------------------------------------------------------------------------
// Static import of the router — mocks above are hoisted and applied before
// this import runs, so the module-level bindings get the mock versions.
// Module state is reset between tests via resetRenderCacheForTest() rather
// than vi.resetModules() (which breaks built-in module mock re-application).
// ---------------------------------------------------------------------------
import exportRouter, { resetRenderCacheForTest, getRenderCacheForTest } from "./export.js";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// HTTP helper — collect status + full body from a GET request.
// ---------------------------------------------------------------------------

function makeRequest(
  port: number,
  path: string,
): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }),
      );
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /export/promo-video", () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    // Reset the render counter, module state, and evaluate behaviour.
    renderCallCount = 0;
    evaluateImpl = (expr) => {
      if (typeof expr === "string" && expr.includes("__exportTotalMs")) {
        // Match MOCK_TOTAL_RUNTIME_MS so the hard assertion in renderMp4 passes.
        return Promise.resolve(2);
      }
      return Promise.resolve(undefined);
    };
    resetRenderCacheForTest(); // clears renderCache + renderPromise

    const app = express();

    // Attach a minimal req.log shim so the route's req.log.* calls don't throw
    // when pino-http middleware is absent in the test harness.
    app.use((req, _res, next) => {
      (req as unknown as Record<string, unknown>)["log"] = {
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      next();
    });

    app.use("/", exportRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("both concurrent requests receive 200 with a non-empty body", async () => {
    const [r1, r2] = await Promise.all([
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.length).toBeGreaterThan(0);
    expect(r2.body.length).toBeGreaterThan(0);
  });

  it("triggers the render function exactly once for two concurrent requests", async () => {
    await Promise.all([
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
    ]);

    // puppeteer.launch is called once per renderMp4 invocation; it must be 1.
    expect(renderCallCount).toBe(1);
  });

  it("both responses carry the same MP4 content", async () => {
    const [r1, r2] = await Promise.all([
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
    ]);

    expect(r1.body.toString()).toBe(r2.body.toString());
  });

  it("serves a subsequent sequential request from the in-memory cache without re-rendering", async () => {
    // First pair of concurrent requests — triggers one render and fills cache.
    await Promise.all([
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
    ]);
    const countAfterFirstRound = renderCallCount;

    // Third request arrives after the render is complete — must hit the cache.
    const r3 = await makeRequest(port, "/export/promo-video");

    expect(r3.status).toBe(200);
    expect(r3.body.length).toBeGreaterThan(0);
    expect(renderCallCount).toBe(countAfterFirstRound); // no additional render
  });
});

// ---------------------------------------------------------------------------
// Duration-mismatch guard
//
// Verifies that renderMp4 emits a logger.warn when window.__exportTotalMs
// (reported by the promo page) differs from TOTAL_RUNTIME_MS (from the
// shared promo-config package), and stays silent when they agree.
// ---------------------------------------------------------------------------

describe("export duration-mismatch guard", () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    renderCallCount = 0;
    resetRenderCacheForTest();

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as Record<string, unknown>)["log"] = {
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      next();
    });
    app.use("/", exportRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("returns 500 and does not populate the cache when the page-reported duration differs from TOTAL_RUNTIME_MS", async () => {
    // Any value that differs from MOCK_TOTAL_RUNTIME_MS (2) triggers the hard
    // assertion.  Use +1 so the value is still small and the throw fires before
    // any sleep or disk-write occurs.
    const mismatchedMs = MOCK_TOTAL_RUNTIME_MS + 1;
    evaluateImpl = (expr) => {
      if (typeof expr === "string" && expr.includes("__exportTotalMs")) {
        return Promise.resolve(mismatchedMs);
      }
      return Promise.resolve(undefined);
    };

    const result = await makeRequest(port, "/export/promo-video");

    // Route must surface the mismatch as a hard error, not a successful MP4.
    expect(result.status).toBe(500);

    // The error body must name both values so the operator knows which side
    // needs updating without having to grep the source.
    const body = JSON.parse(result.body.toString()) as { error: string };
    expect(body.error).toContain(String(mismatchedMs));
    expect(body.error).toContain(String(MOCK_TOTAL_RUNTIME_MS));

    // Nothing must have been written to the in-memory cache; a future request
    // must trigger a fresh render rather than serving a wrong-length video.
    expect(getRenderCacheForTest()).toBeNull();
  });

  it("returns 200 and populates the cache when the page agrees with TOTAL_RUNTIME_MS", async () => {
    // Exact match — assertion passes, render completes, cache is filled.
    // Sleep = MOCK_TOTAL_RUNTIME_MS (2) + 400 TAIL_PADDING ms.
    evaluateImpl = (expr) => {
      if (typeof expr === "string" && expr.includes("__exportTotalMs")) {
        return Promise.resolve(MOCK_TOTAL_RUNTIME_MS);
      }
      return Promise.resolve(undefined);
    };

    const result = await makeRequest(port, "/export/promo-video");

    expect(result.status).toBe(200);
    expect(result.body.length).toBeGreaterThan(0);
    // Cache must be populated so subsequent requests don't re-render.
    expect(getRenderCacheForTest()).not.toBeNull();
  });
});
