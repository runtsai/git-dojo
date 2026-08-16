/**
 * Unit/integration tests for the /export/promo-video route.
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
// Render-call counter — reset in beforeEach, inspected in tests.
// The mock factory increments this every time puppeteer.launch() is invoked,
// which is a reliable proxy for "renderMp4 was called".
// ---------------------------------------------------------------------------
let renderCallCount = 0;

// ---------------------------------------------------------------------------
// Mock heavy dependencies.
// vi.mock() calls are hoisted before imports by vitest, so they apply to the
// router module when it is dynamically imported inside beforeEach.
// ---------------------------------------------------------------------------

vi.mock("puppeteer-core", () => {
  const mockRecorder = {
    stop: vi.fn().mockResolvedValue(undefined),
  };

  const mockPage = {
    setViewport: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    // Return a tiny duration so renderMp4's sleep() is only ~401 ms total.
    evaluate: vi.fn().mockImplementation((expr: unknown) => {
      if (typeof expr === "string" && expr.includes("__exportTotalMs")) {
        return Promise.resolve(1); // 1 ms + 400 ms TAIL_PADDING
      }
      return Promise.resolve(undefined);
    }),
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
  const original = await importOriginal<typeof import("node:child_process")>();
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
  const original = await importOriginal<typeof import("node:fs/promises")>();
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
    // Reset the render counter before each test.
    renderCallCount = 0;

    // Reset the module registry so the route's module-level variables
    // (renderCache, renderPromise) start as null for every test.
    vi.resetModules();

    const { default: exportRouter } = await import("./export.js");

    const app = express();

    // Attach a minimal req.log shim so the route's req.log.* calls don't throw
    // when pino-http middleware is absent in the test harness.
    app.use((req, _res, next) => {
      (req as Record<string, unknown>)["log"] = {
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
