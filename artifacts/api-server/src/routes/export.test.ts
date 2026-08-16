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
import path from "node:path";
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
import exportRouter, {
  resetRenderCacheForTest,
  loadDiskCache,
  computePromoSourceHash,
  getRenderCacheForTest,
} from "./export.js";

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
    // Reset the render counter and module state before each test.
    renderCallCount = 0;
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

// ---------------------------------------------------------------------------
// Minimal valid MP4 buffer that passes isValidMp4Buffer().
//
// Layout:  [ftyp 16 bytes] [moov 8 bytes] [mdat 8 bytes]  = 32 bytes total
//
// ftyp (size=16): size(4) + "ftyp"(4) + "isom"(4) + version(4)
// moov (size=8):  size(4) + "moov"(4)
// mdat (size=8):  size(4) + "mdat"(4)
// ---------------------------------------------------------------------------
function makeMinimalValidMp4(): Buffer {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(16, 0);  // ftyp box size
  buf.write("ftyp", 4, "ascii");
  buf.write("isom", 8, "ascii");
  // minor version stays 0
  buf.writeUInt32BE(8, 16);  // moov box size
  buf.write("moov", 20, "ascii");
  buf.writeUInt32BE(8, 24);  // mdat box size
  buf.write("mdat", 28, "ascii");
  return buf;
}

// ---------------------------------------------------------------------------
// Cache-sweep unit tests
//
// These tests call loadDiskCache() directly, controlling the file-system mocks
// to verify that:
//   • stale .mp4 files (names ≠ current hash) are removed via rm()
//   • the file whose name matches the current hash is left alone
//   • non-.mp4 files are never touched
//   • a missing cache directory is handled gracefully (no throw)
//   • when the current-hash file is present and valid it is loaded into the
//     in-memory renderCache
// ---------------------------------------------------------------------------

describe("loadDiskCache – cache sweep", () => {
  // Point the module at an isolated, fake cache directory for every test so
  // the real /tmp is never involved.
  const FAKE_CACHE_DIR = "/tmp/test-promo-sweep-cache";

  // Grab references to the mocked fs functions.  Because vi.mock() hoists the
  // factory, these re-imports resolve to the same mock objects the route module
  // sees.
  let readdirMock: ReturnType<typeof vi.fn>;
  let rmMock: ReturnType<typeof vi.fn>;
  let readFileMock: ReturnType<typeof vi.fn>;
  let existsSyncMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Clear all mock call history accumulated by earlier tests before touching
    // anything else, so call-count assertions start from a clean slate.
    vi.clearAllMocks();

    process.env["PROMO_EXPORT_CACHE_DIR"] = FAKE_CACHE_DIR;
    resetRenderCacheForTest();

    // Re-resolve the mocked modules inside the test so we get the live mock
    // objects that vi hoisted into place.
    const fsp = await import("node:fs/promises");
    const fs = await import("node:fs");

    readdirMock   = vi.mocked(fsp.readdir);
    rmMock        = vi.mocked(fsp.rm);
    readFileMock  = vi.mocked(fsp.readFile);
    existsSyncMock = vi.mocked(fs.existsSync);

    // Default: source dirs return [] (keeps hash deterministic), cache dir
    // returns an empty list (no stale files), and no cache file on disk.
    readdirMock.mockResolvedValue([]);
    rmMock.mockResolvedValue(undefined);
    existsSyncMock.mockReturnValue(false);
    readFileMock.mockResolvedValue(Buffer.from("fake"));
  });

  afterEach(() => {
    delete process.env["PROMO_EXPORT_CACHE_DIR"];
    vi.clearAllMocks();
  });

  it("removes every stale .mp4 file and does not touch the current-hash file", async () => {
    // Derive the hash that loadDiskCache will compute under the current mocks
    // (readdir returns [] for all source-dir calls → deterministic empty hash).
    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;

    const staleFiles = ["aabbcc.mp4", "112233.mp4"];

    // Override readdir: source dirs → [], cache dir → stale + current files.
    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return [...staleFiles, currentFile] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    await loadDiskCache();

    // rm() must have been called exactly for each stale file.
    for (const stale of staleFiles) {
      expect(rmMock).toHaveBeenCalledWith(path.join(FAKE_CACHE_DIR, stale));
    }

    // rm() must NOT have been called for the current-hash file.
    expect(rmMock).not.toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, currentFile),
    );

    // Exactly two rm() calls — one per stale file.
    expect(rmMock).toHaveBeenCalledTimes(staleFiles.length);
  });

  it("does not call rm() for non-.mp4 entries in the cache directory", async () => {
    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        // Mix of non-mp4 entries and one stale mp4.
        return ["README.txt", ".gitkeep", "old-render.mp4"] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    await loadDiskCache();

    // Only the .mp4 entry should have been removed.
    expect(rmMock).toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, "old-render.mp4"),
    );
    expect(rmMock).not.toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, "README.txt"),
    );
    expect(rmMock).not.toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, ".gitkeep"),
    );
    expect(rmMock).toHaveBeenCalledTimes(1);
  });

  it("handles a missing cache directory gracefully without throwing", async () => {
    // Simulate the directory not existing yet.
    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        throw err;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    await expect(loadDiskCache()).resolves.toBeUndefined();
    expect(rmMock).not.toHaveBeenCalled();
  });

  it("loads the current-hash file into renderCache when it exists and is valid", async () => {
    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;
    const validMp4 = makeMinimalValidMp4();

    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return [currentFile] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    // The cache file exists on disk and contains a valid MP4.
    existsSyncMock.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true; // BG music check
      if (s === path.join(FAKE_CACHE_DIR, currentFile)) return true;
      return false;
    });
    readFileMock.mockImplementation(async (p: unknown) => {
      if (String(p) === path.join(FAKE_CACHE_DIR, currentFile)) {
        return validMp4 as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
      }
      return Buffer.from("") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
    });

    await loadDiskCache();

    // In-memory cache must be populated with the loaded buffer.
    const cache = getRenderCacheForTest();
    expect(cache).not.toBeNull();
    expect(cache?.sourceHash).toBe(currentHash);
    expect(cache?.buffer).toEqual(validMp4);

    // No stale files to remove — rm() should not have been called.
    expect(rmMock).not.toHaveBeenCalled();
  });

  it("does not populate renderCache when rm() fails for a stale file (non-fatal)", async () => {
    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return ["stale-error.mp4"] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    // rm() throws a permission error — must not propagate.
    rmMock.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));

    await expect(loadDiskCache()).resolves.toBeUndefined();

    // Cache remains empty because the current-hash file was not present.
    expect(getRenderCacheForTest()).toBeNull();
  });
});
