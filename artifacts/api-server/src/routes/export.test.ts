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
import { resetRateLimits } from "../middlewares/rate-limit";

// The promo-export endpoint is rate limited in production; tests fire far
// more requests per minute than any real client, so clear the bucket
// before every test.
beforeEach(() => resetRateLimits());
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
    // rename() is the final step of the atomic writeDiskCache: it moves the
    // temp file to the final cache path so the cache path is never partially
    // written.  Default: succeed immediately.
    rename: vi.fn().mockResolvedValue(undefined),
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
  isValidMp4Buffer,
} from "./export.js";
import puppeteer from "puppeteer-core";

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

  it("does not populate renderCache when the disk-cache file is non-empty but contains garbage (truncated write)", async () => {
    // This is the core scenario for task 182: a prior server run died mid-write
    // leaving a file whose size > 0 but whose content is not a valid MP4.
    // loadDiskCache must detect this via isValidMp4Buffer() and refuse to warm
    // the cache, so the next request triggers a fresh render rather than
    // serving a corrupt or partial file to the client.
    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;

    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return [currentFile] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    // The cache file exists and is non-empty, but its content is garbage — it
    // was never a valid MP4 (simulates a partial/interrupted write).
    const garbageBuffer = Buffer.from("THIS IS NOT AN MP4 FILE - PARTIAL WRITE GARBAGE DATA");
    existsSyncMock.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;
      if (s === path.join(FAKE_CACHE_DIR, currentFile)) return true;
      return false;
    });
    readFileMock.mockImplementation(async (p: unknown) => {
      if (String(p) === path.join(FAKE_CACHE_DIR, currentFile)) {
        return garbageBuffer as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
      }
      return Buffer.from("") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
    });

    await loadDiskCache();

    // renderCache must remain null — a garbage file must never be treated as a
    // valid cache hit, regardless of its size.
    expect(getRenderCacheForTest()).toBeNull();
  });

  it("does not populate renderCache when the disk-cache file has a valid ftyp header but is truncated before moov", async () => {
    // A more realistic truncation scenario: the server wrote the beginning of
    // the MP4 (including the ftyp box) but crashed before the moov or mdat
    // boxes were written.  The file is non-empty and even starts like a real
    // MP4, but isValidMp4Buffer() must still reject it.
    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;

    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return [currentFile] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    // Build a buffer that looks like the start of a valid MP4 (ftyp box only)
    // but has no moov or mdat — as if the process was killed after writing 16
    // bytes of a much larger file.
    const truncatedBuf = Buffer.alloc(16);
    truncatedBuf.writeUInt32BE(16, 0); // ftyp box size = 16
    truncatedBuf.write("ftyp", 4, "ascii");
    truncatedBuf.write("isom", 8, "ascii");
    // minor version stays 0; no moov, no mdat

    existsSyncMock.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;
      if (s === path.join(FAKE_CACHE_DIR, currentFile)) return true;
      return false;
    });
    readFileMock.mockImplementation(async (p: unknown) => {
      if (String(p) === path.join(FAKE_CACHE_DIR, currentFile)) {
        return truncatedBuf as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
      }
      return Buffer.from("") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
    });

    await loadDiskCache();

    // A truncated file that only contains ftyp (no moov, no mdat) must be
    // rejected so the client never receives a partial/unplayable video.
    expect(getRenderCacheForTest()).toBeNull();
  });

  it("deletes the corrupt file via rm() so the slot is free for the next successful write", async () => {
    // Core regression guard for the re-validation-on-every-restart bug:
    // loadDiskCache must call rm() on a corrupt cache file (whose name matches
    // the current hash) so that sweepStaleCacheFiles doesn't keep it alive
    // and the next successful render can write a good file in its place.
    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;
    const cachePath = path.join(FAKE_CACHE_DIR, currentFile);

    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return [currentFile] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    // The cache file exists but contains garbage (failed validation).
    const garbageBuffer = Buffer.from("NOT-AN-MP4");
    existsSyncMock.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;
      if (s === cachePath) return true;
      return false;
    });
    readFileMock.mockImplementation(async (p: unknown) => {
      if (String(p) === cachePath) {
        return garbageBuffer as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
      }
      return Buffer.from("") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
    });

    await loadDiskCache();

    // The corrupt file must have been deleted so the slot is free.
    expect(rmMock).toHaveBeenCalledWith(cachePath);

    // renderCache must still be null — a garbage file is never a valid cache hit.
    expect(getRenderCacheForTest()).toBeNull();
  });

  it("continues and leaves renderCache null when rm() fails on the corrupt file (non-fatal)", async () => {
    // Even if deleting the corrupt file fails (e.g. read-only filesystem),
    // loadDiskCache must not throw — the failure is logged but non-fatal.
    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;
    const cachePath = path.join(FAKE_CACHE_DIR, currentFile);

    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return [currentFile] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    existsSyncMock.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;
      if (s === cachePath) return true;
      return false;
    });
    readFileMock.mockImplementation(async (p: unknown) => {
      if (String(p) === cachePath) {
        return Buffer.from("NOT-AN-MP4") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
      }
      return Buffer.from("") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
    });

    // rm() throws a permission error when trying to delete the corrupt file.
    rmMock.mockRejectedValueOnce(
      Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }),
    );

    // Must resolve (not throw) despite the rm() failure.
    await expect(loadDiskCache()).resolves.toBeUndefined();

    // renderCache stays null — the corrupt file content was never accepted.
    expect(getRenderCacheForTest()).toBeNull();
  });

  it("skips the cache and leaves renderCache null when PROMO_EXPORT_CACHE_DIR changes between restarts", async () => {
    // Two-phase test that mirrors a real env-var change between server restarts.
    //
    // PHASE 1 — old server instance: OLD_CACHE_DIR has a valid MP4; loadDiskCache
    //   loads it into renderCache.  This proves the mock wiring is correct and
    //   that the old dir was actually observed.
    //
    // PHASE 2 — new server instance: PROMO_EXPORT_CACHE_DIR is changed to
    //   NEW_CACHE_DIR (empty).  loadDiskCache is called again after a state
    //   reset.  It must use the new env-var value (lazy getCacheDir()), leave
    //   renderCache null, and never touch files in OLD_CACHE_DIR.

    const OLD_CACHE_DIR = "/tmp/test-old-cache-dir";
    const NEW_CACHE_DIR = "/tmp/test-new-cache-dir";

    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;
    const validMp4 = makeMinimalValidMp4();

    // ------------------------------------------------------------------
    // PHASE 1: load the old cache so we know it was valid and present.
    // ------------------------------------------------------------------
    process.env["PROMO_EXPORT_CACHE_DIR"] = OLD_CACHE_DIR;

    readdirMock.mockImplementation(async (dir: unknown) => {
      const d = String(dir);
      if (d === OLD_CACHE_DIR) {
        return [currentFile] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    existsSyncMock.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;
      if (s === path.join(OLD_CACHE_DIR, currentFile)) return true;
      return false;
    });

    readFileMock.mockImplementation(async (p: unknown) => {
      if (String(p) === path.join(OLD_CACHE_DIR, currentFile)) {
        return validMp4 as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
      }
      return Buffer.from("") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>;
    });

    await loadDiskCache();

    // Phase 1 sanity-check: the old cache was loaded successfully.
    const cacheAfterPhase1 = getRenderCacheForTest();
    expect(cacheAfterPhase1).not.toBeNull();
    expect(cacheAfterPhase1?.sourceHash).toBe(currentHash);

    // ------------------------------------------------------------------
    // PHASE 2: simulate a restart with a different PROMO_EXPORT_CACHE_DIR.
    // ------------------------------------------------------------------

    // Reset in-memory state as a server restart would.
    resetRenderCacheForTest();

    // Clear mock call history so assertions below refer only to Phase 2 calls.
    vi.clearAllMocks();

    // Switch to the new, empty directory.
    process.env["PROMO_EXPORT_CACHE_DIR"] = NEW_CACHE_DIR;

    // Phase 2 mocks: NEW_CACHE_DIR is empty; OLD_CACHE_DIR still has the file
    // (it was never cleaned up by the new instance — that's the whole point).
    readdirMock.mockImplementation(async (dir: unknown) => {
      const d = String(dir);
      if (d === NEW_CACHE_DIR) {
        // New dir is empty — no stale files, no matching cache file.
        return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      if (d === OLD_CACHE_DIR) {
        // Old dir still has the file, but loadDiskCache must not touch it.
        return [currentFile] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
      }
      return [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>;
    });

    // existsSync: new cache path does not exist; old one does (but must not be read).
    existsSyncMock.mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;
      if (s === path.join(OLD_CACHE_DIR, currentFile)) return true;
      return false; // nothing under NEW_CACHE_DIR
    });

    await loadDiskCache();

    // The new directory has no matching file → renderCache must be null.
    expect(getRenderCacheForTest()).toBeNull();

    // readdir must have been called with NEW_CACHE_DIR (not OLD_CACHE_DIR)
    // during Phase 2, proving getCacheDir() re-evaluated the env var.
    const readdirCalls = (readdirMock.mock.calls as unknown[][]).map(
      (args) => String(args[0]),
    );
    expect(readdirCalls).toContain(NEW_CACHE_DIR);
    expect(readdirCalls).not.toContain(OLD_CACHE_DIR);

    // rm() must NOT have been called for any file in the old directory.
    const oldDirRmCalls = (rmMock.mock.calls as unknown[][]).filter(
      (args) => typeof args[0] === "string" && (args[0] as string).startsWith(OLD_CACHE_DIR),
    );
    expect(oldDirRmCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// writeDiskCache — atomic write behaviour
//
// Verifies that writeDiskCache uses a write-then-rename pattern so the final
// cache path is never partially written:
//
//   1. writeFile is called with a sibling `.tmp` path, NOT the final path.
//   2. rename() is then called from the `.tmp` path to the final path.
//   3. When rename() fails (simulating a crash between write and rename), rm()
//      is called on the `.tmp` path so the orphaned temp file is cleaned up.
//
// These tests drive writeDiskCache indirectly via a successful render request,
// because the function is intentionally unexported.
// ---------------------------------------------------------------------------

describe("writeDiskCache – atomic write", () => {
  const FAKE_CACHE_DIR = "/tmp/test-atomic-write-cache";

  let readdirMock: ReturnType<typeof vi.fn>;
  let writeFileMock: ReturnType<typeof vi.fn>;
  let renameMock: ReturnType<typeof vi.fn>;
  let rmMock: ReturnType<typeof vi.fn>;

  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env["PROMO_EXPORT_CACHE_DIR"] = FAKE_CACHE_DIR;
    renderCallCount = 0;
    evaluateImpl = (expr) => {
      if (typeof expr === "string" && expr.includes("__exportTotalMs")) {
        return Promise.resolve(MOCK_TOTAL_RUNTIME_MS);
      }
      return Promise.resolve(undefined);
    };
    resetRenderCacheForTest();

    const fsp = await import("node:fs/promises");
    const fs = await import("node:fs");

    readdirMock  = vi.mocked(fsp.readdir);
    writeFileMock = vi.mocked(fsp.writeFile);
    renameMock   = vi.mocked(fsp.rename);
    rmMock       = vi.mocked(fsp.rm);

    // Source dirs return []; cache dir is empty (no stale files).
    readdirMock.mockResolvedValue([]);
    // readFile at the end of renderMp4 returns a fake MP4 buffer.
    vi.mocked(fsp.readFile).mockResolvedValue(
      Buffer.from("fake-mp4-content") as unknown as Awaited<ReturnType<typeof fsp.readFile>>,
    );
    // existsSync: BG music present, disk cache absent.
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;
      return false;
    });

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
    delete process.env["PROMO_EXPORT_CACHE_DIR"];
    vi.clearAllMocks();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("writes to a UUID-named .tmp sibling file before renaming to the final cache path", async () => {
    const currentHash = await computePromoSourceHash();
    const finalPath = path.join(FAKE_CACHE_DIR, `${currentHash}.mp4`);
    // The temp path is <finalPath>.<uuid>.tmp — unique per invocation.
    const tmpPattern = new RegExp(
      `^${finalPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[0-9a-f-]+\\.tmp$`,
    );

    const result = await makeRequest(port, "/export/promo-video");
    expect(result.status).toBe(200);

    // writeFile must have been called with the UUID-named .tmp path, not the
    // final path directly.
    const writeFileCalls = writeFileMock.mock.calls as unknown[][];
    const cacheWriteCall = writeFileCalls.find(
      (args) => typeof args[0] === "string" && (args[0] as string).startsWith(FAKE_CACHE_DIR),
    );
    expect(cacheWriteCall).toBeDefined();
    expect(cacheWriteCall![0] as string).toMatch(tmpPattern);
    expect(cacheWriteCall![0]).not.toBe(finalPath);

    // rename must have been called moving the same .tmp path to the final path.
    const renameCalls = renameMock.mock.calls as unknown[][];
    const renameCall = renameCalls.find(
      (args) =>
        typeof args[0] === "string" &&
        tmpPattern.test(args[0] as string) &&
        args[1] === finalPath,
    );
    expect(renameCall).toBeDefined();
  });

  it("cleans up the per-invocation .tmp file when rename fails so the orphan does not linger", async () => {
    const currentHash = await computePromoSourceHash();
    const finalPath = path.join(FAKE_CACHE_DIR, `${currentHash}.mp4`);
    const tmpPattern = new RegExp(
      `^${finalPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[0-9a-f-]+\\.tmp$`,
    );

    // Simulate a crash / permission error between write and rename.
    renameMock.mockRejectedValueOnce(
      Object.assign(new Error("ENOSPC: no space left on device"), { code: "ENOSPC" }),
    );

    // The route must still return 200 — writeDiskCache failures are non-fatal.
    const result = await makeRequest(port, "/export/promo-video");
    expect(result.status).toBe(200);

    // rename was attempted with the UUID .tmp path.
    const renameCalls = renameMock.mock.calls as unknown[][];
    const renameCall = renameCalls.find(
      (args) =>
        typeof args[0] === "string" &&
        tmpPattern.test(args[0] as string) &&
        args[1] === finalPath,
    );
    expect(renameCall).toBeDefined();

    // Extract the exact tmp path that was used so we can assert rm cleaned it up.
    const usedTmpPath = renameCall![0] as string;

    // rm must have been called with that exact .tmp path so the orphan is removed.
    const rmCalls = rmMock.mock.calls as unknown[][];
    const tmpCleanup = rmCalls.find(
      (args) => typeof args[0] === "string" && args[0] === usedTmpPath,
    );
    expect(tmpCleanup).toBeDefined();
  });

  it("uses a different .tmp path for each write invocation so concurrent writers never clobber each other", async () => {
    const currentHash = await computePromoSourceHash();
    const finalPath = path.join(FAKE_CACHE_DIR, `${currentHash}.mp4`);
    const tmpPattern = new RegExp(
      `^${finalPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[0-9a-f-]+\\.tmp$`,
    );

    // First render cycle.
    const r1 = await makeRequest(port, "/export/promo-video");
    expect(r1.status).toBe(200);

    // Collect the .tmp path used in the first write.
    const writeFileCalls1 = (writeFileMock.mock.calls as unknown[][]).filter(
      (args) => typeof args[0] === "string" && tmpPattern.test(args[0] as string),
    );
    expect(writeFileCalls1).toHaveLength(1);
    const tmpPath1 = writeFileCalls1[0]![0] as string;

    // Reset so a second render is triggered (bypass the in-memory cache).
    resetRenderCacheForTest();
    writeFileMock.mockClear();

    // Second render cycle.
    const r2 = await makeRequest(port, "/export/promo-video");
    expect(r2.status).toBe(200);

    const writeFileCalls2 = (writeFileMock.mock.calls as unknown[][]).filter(
      (args) => typeof args[0] === "string" && tmpPattern.test(args[0] as string),
    );
    expect(writeFileCalls2).toHaveLength(1);
    const tmpPath2 = writeFileCalls2[0]![0] as string;

    // The two invocations must have used distinct temp paths.
    expect(tmpPath1).not.toBe(tmpPath2);
  });
});

// ---------------------------------------------------------------------------
// writeDiskCache – post-write cache sweep
//
// Verifies that writeDiskCache calls sweepStaleCacheFiles after a successful
// rename so that stale .mp4 files from previous renders are removed while the
// newly written file (keyed by the current source hash) is preserved.
//
// writeDiskCache is intentionally unexported, so these tests drive it via a
// successful render request (same pattern as the atomic-write suite above).
//
// Scenarios covered:
//   1. Stale .mp4 files are removed; the current-hash file is not touched.
//   2. Non-.mp4 entries in the cache directory are never passed to rm().
//   3. A failed rm() for a stale file (EACCES) does not propagate — the route
//      still returns 200 and the render result is still served to the caller.
//   4. When the cache directory is empty after the write, rm() is never called.
// ---------------------------------------------------------------------------

describe("writeDiskCache – post-write cache sweep", () => {
  const FAKE_CACHE_DIR = "/tmp/test-sweep-after-write-cache";

  let readdirMock: ReturnType<typeof vi.fn>;
  let rmMock: ReturnType<typeof vi.fn>;

  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env["PROMO_EXPORT_CACHE_DIR"] = FAKE_CACHE_DIR;
    renderCallCount = 0;
    evaluateImpl = (expr) => {
      if (typeof expr === "string" && expr.includes("__exportTotalMs")) {
        return Promise.resolve(MOCK_TOTAL_RUNTIME_MS);
      }
      return Promise.resolve(undefined);
    };
    resetRenderCacheForTest();

    const fsp = await import("node:fs/promises");
    const fs = await import("node:fs");

    readdirMock = vi.mocked(fsp.readdir);
    rmMock = vi.mocked(fsp.rm);

    // Default: readFile returns a fake MP4 buffer; source dirs return [].
    vi.mocked(fsp.readFile).mockResolvedValue(
      Buffer.from("fake-mp4-content") as unknown as Awaited<ReturnType<typeof fsp.readFile>>,
    );
    vi.mocked(fsp.writeFile).mockResolvedValue(undefined);
    vi.mocked(fsp.rename).mockResolvedValue(undefined);
    vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);

    // Default readdir: source dirs → [], cache dir → empty (no stale files).
    readdirMock.mockResolvedValue([]);

    // existsSync: BG music present, disk cache absent so no pre-warm.
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;
      return false;
    });

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
    delete process.env["PROMO_EXPORT_CACHE_DIR"];
    vi.clearAllMocks();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("removes stale .mp4 files and preserves the newly written current-hash file", async () => {
    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;
    const staleFiles = ["aabbcc112233.mp4", "deadbeef.mp4"];

    // readdir returns stale files plus the current file for the cache dir;
    // source dirs return [] to keep the hash deterministic.
    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return [...staleFiles, currentFile] as unknown as Awaited<
          ReturnType<typeof import("node:fs/promises").readdir>
        >;
      }
      return [] as unknown as Awaited<
        ReturnType<typeof import("node:fs/promises").readdir>
      >;
    });

    const result = await makeRequest(port, "/export/promo-video");
    expect(result.status).toBe(200);

    // rm() must have been called for each stale file.
    for (const stale of staleFiles) {
      expect(rmMock).toHaveBeenCalledWith(path.join(FAKE_CACHE_DIR, stale));
    }

    // rm() must NOT have been called for the current-hash file.
    expect(rmMock).not.toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, currentFile),
    );

    // Exactly two rm() calls — one per stale file (the tmp-cleanup rm call
    // for a successful rename does not fire because rename succeeds).
    const cacheRmCalls = (rmMock.mock.calls as unknown[][]).filter(
      (args) =>
        typeof args[0] === "string" &&
        (args[0] as string).startsWith(FAKE_CACHE_DIR) &&
        (args[0] as string).endsWith(".mp4"),
    );
    expect(cacheRmCalls).toHaveLength(staleFiles.length);
  });

  it("does not call rm() for non-.mp4 entries in the cache directory", async () => {
    const currentHash = await computePromoSourceHash();

    // Cache dir contains non-mp4 files and one stale mp4.
    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return ["README.txt", ".gitkeep", "stale-render.mp4"] as unknown as Awaited<
          ReturnType<typeof import("node:fs/promises").readdir>
        >;
      }
      return [] as unknown as Awaited<
        ReturnType<typeof import("node:fs/promises").readdir>
      >;
    });

    const result = await makeRequest(port, "/export/promo-video");
    expect(result.status).toBe(200);

    // Only the stale .mp4 should trigger rm().
    expect(rmMock).toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, "stale-render.mp4"),
    );
    expect(rmMock).not.toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, "README.txt"),
    );
    expect(rmMock).not.toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, ".gitkeep"),
    );

    // Exactly one mp4 rm() call.
    const mp4RmCalls = (rmMock.mock.calls as unknown[][]).filter(
      (args) =>
        typeof args[0] === "string" &&
        (args[0] as string).endsWith(".mp4"),
    );
    expect(mp4RmCalls).toHaveLength(1);
  });

  it("returns 200 and serves the render when rm() fails for a stale file (non-fatal)", async () => {
    // Cache dir contains a stale file whose deletion will fail.
    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return ["stale-readonly.mp4"] as unknown as Awaited<
          ReturnType<typeof import("node:fs/promises").readdir>
        >;
      }
      return [] as unknown as Awaited<
        ReturnType<typeof import("node:fs/promises").readdir>
      >;
    });

    // rm() rejects with a permission error for the stale file.
    rmMock.mockRejectedValue(
      Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }),
    );

    // The route must still return 200 — sweep failures are non-fatal.
    const result = await makeRequest(port, "/export/promo-video");
    expect(result.status).toBe(200);
    expect(result.body.length).toBeGreaterThan(0);

    // rm() was attempted (the error was swallowed, not skipped).
    expect(rmMock).toHaveBeenCalledWith(
      path.join(FAKE_CACHE_DIR, "stale-readonly.mp4"),
    );
  });

  it("does not call rm() when the cache directory has no other .mp4 files after the write", async () => {
    const currentHash = await computePromoSourceHash();
    const currentFile = `${currentHash}.mp4`;

    // Cache dir contains only the current-hash file — nothing to sweep.
    readdirMock.mockImplementation(async (dir: unknown) => {
      if (String(dir) === FAKE_CACHE_DIR) {
        return [currentFile] as unknown as Awaited<
          ReturnType<typeof import("node:fs/promises").readdir>
        >;
      }
      return [] as unknown as Awaited<
        ReturnType<typeof import("node:fs/promises").readdir>
      >;
    });

    const result = await makeRequest(port, "/export/promo-video");
    expect(result.status).toBe(200);

    // No stale files — rm() must not be called at all (not even for the
    // current file).
    const mp4RmCalls = (rmMock.mock.calls as unknown[][]).filter(
      (args) =>
        typeof args[0] === "string" &&
        (args[0] as string).endsWith(".mp4"),
    );
    expect(mp4RmCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isValidMp4Buffer — unit tests
//
// Tests every structural case the validator must handle:
//   • buffers too short to contain even a minimal ftyp box
//   • buffers that do not start with an ftyp box
//   • ftyp size that exceeds the buffer length (truncated inside header)
//   • ftyp present but no moov (most common crash scenario mid-write)
//   • ftyp + moov but no mdat (media data never written)
//   • moov box whose declared size extends past the buffer end (truncated body)
//   • a well-formed minimal MP4 with ftyp + moov + mdat → must accept
// ---------------------------------------------------------------------------

describe("isValidMp4Buffer", () => {
  it("rejects an empty buffer", () => {
    expect(isValidMp4Buffer(Buffer.alloc(0))).toBe(false);
  });

  it("rejects a buffer shorter than the minimum ftyp box (< 16 bytes)", () => {
    expect(isValidMp4Buffer(Buffer.alloc(8))).toBe(false);
    expect(isValidMp4Buffer(Buffer.alloc(15))).toBe(false);
  });

  it("rejects a non-empty buffer filled with random garbage bytes", () => {
    const garbage = Buffer.from("THIS IS NOT AN MP4 FILE - PARTIAL WRITE GARBAGE DATA");
    expect(isValidMp4Buffer(garbage)).toBe(false);
  });

  it("rejects a buffer whose first box type is not 'ftyp'", () => {
    const buf = Buffer.alloc(32);
    buf.writeUInt32BE(16, 0);
    buf.write("moov", 4, "ascii"); // wrong first box type
    buf.write("isom", 8, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects a buffer where the ftyp box size exceeds the buffer length (header truncated)", () => {
    // Declare ftyp size = 1000 but only allocate 16 bytes.
    const buf = Buffer.alloc(16);
    buf.writeUInt32BE(1000, 0); // size claims 1000 bytes but buffer is only 16
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects a buffer with only a valid ftyp box — no moov or mdat", () => {
    const buf = Buffer.alloc(16);
    buf.writeUInt32BE(16, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects a buffer with ftyp + moov but no mdat (media data never written)", () => {
    const buf = Buffer.alloc(24);
    buf.writeUInt32BE(16, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    buf.writeUInt32BE(8, 16);
    buf.write("moov", 20, "ascii");
    // No mdat box follows.
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("rejects a buffer where moov's declared size extends past the buffer end (moov truncated)", () => {
    const buf = Buffer.alloc(24);
    buf.writeUInt32BE(16, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("isom", 8, "ascii");
    buf.writeUInt32BE(9999, 16); // moov claims 9999 bytes but buffer is only 24
    buf.write("moov", 20, "ascii");
    expect(isValidMp4Buffer(buf)).toBe(false);
  });

  it("accepts a minimal valid MP4 buffer containing ftyp + moov + mdat", () => {
    expect(isValidMp4Buffer(makeMinimalValidMp4())).toBe(true);
  });

  it("accepts the minimal valid MP4 regardless of the brand string in the ftyp box", () => {
    // Vary the major-brand to confirm the validator does not gate on brand name.
    const buf = makeMinimalValidMp4();
    buf.write("mp42", 8, "ascii"); // overwrite "isom" major-brand with "mp42"
    expect(isValidMp4Buffer(buf)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Render crash — both concurrent callers get a clear 500
//
// Verifies that when renderMp4 rejects mid-flight (puppeteer throws), every
// caller that joined the shared renderPromise receives a 500 response with
// an error body — not a hang or an empty response — and that renderPromise is
// cleared so a subsequent request can start a fresh render.
// ---------------------------------------------------------------------------

describe("export render crash — both concurrent callers get a 500", () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    renderCallCount = 0;
    evaluateImpl = (expr) => {
      if (typeof expr === "string" && expr.includes("__exportTotalMs")) {
        return Promise.resolve(MOCK_TOTAL_RUNTIME_MS);
      }
      return Promise.resolve(undefined);
    };
    resetRenderCacheForTest();

    // The cache-sweep describe overrides existsSync and readFile with specific
    // implementations that persist across describe blocks (vi.clearAllMocks()
    // clears call history, not implementations).  Restore both to their default
    // render-path behaviour so the route passes the BG_MUSIC_PATH check,
    // reaches renderMp4, and returns the fake MP4 buffer on success.
    const { existsSync } = await import("node:fs");
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const s = String(p);
      if (s.endsWith(".mp3")) return true;  // BG music present
      return false;                          // disk cache absent
    });

    const fsp = await import("node:fs/promises");
    vi.mocked(fsp.readFile).mockResolvedValue(
      Buffer.from("fake-mp4-content") as unknown as Awaited<
        ReturnType<typeof import("node:fs/promises").readFile>
      >,
    );

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
    // Restore the launch mock to the default success path so subsequent test
    // suites (or retries within this suite) are not poisoned by any leftover
    // mockImplementationOnce queued here.
    vi.mocked(puppeteer.launch).mockImplementation(async () => {
      renderCallCount++;
      const mockPage = {
        setViewport: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(undefined),
        waitForFunction: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockImplementation((expr: unknown) => evaluateImpl(expr)),
        screencast: vi.fn().mockResolvedValue({ stop: vi.fn().mockResolvedValue(undefined) }),
      };
      return {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as import("puppeteer-core").Browser;
    });

    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  // Helper: return a rejection that is delayed by `ms` milliseconds.
  // This matters because an immediately-rejected Promise resolves in the
  // microtask queue BEFORE the server's I/O callback for R2's connection
  // fires, so R2 would see renderPromise === null and start a fresh render.
  // A genuine timer delay lets the event loop accept R2's connection and
  // run its handler up to "await renderPromise" before the rejection lands.
  function delayedReject(err: Error, ms = 30): Promise<never> {
    return new Promise((_, reject) => setTimeout(() => reject(err), ms));
  }

  it("both concurrent requests receive status 500 when renderMp4 crashes", async () => {
    const crashError = new Error("puppeteer crashed mid-flight");
    vi.mocked(puppeteer.launch).mockImplementationOnce(() =>
      delayedReject(crashError),
    );

    const [r1, r2] = await Promise.all([
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
    ]);

    expect(r1.status).toBe(500);
    expect(r2.status).toBe(500);
  });

  it("both error responses carry a non-empty error body when renderMp4 crashes", async () => {
    const crashMessage = "puppeteer crashed mid-flight";
    vi.mocked(puppeteer.launch).mockImplementationOnce(() =>
      delayedReject(new Error(crashMessage)),
    );

    const [r1, r2] = await Promise.all([
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
    ]);

    const body1 = JSON.parse(r1.body.toString()) as { error: string };
    const body2 = JSON.parse(r2.body.toString()) as { error: string };

    // Both bodies must name the crash reason so the caller knows what failed.
    expect(body1.error).toContain(crashMessage);
    expect(body2.error).toContain(crashMessage);
  });

  it("renderPromise is cleared after a crash so a subsequent request retries successfully", async () => {
    const crashError = new Error("puppeteer crashed mid-flight");
    vi.mocked(puppeteer.launch).mockImplementationOnce(() =>
      delayedReject(crashError),
    );

    // Fire two concurrent requests — both should fail.
    const [r1, r2] = await Promise.all([
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
    ]);

    expect(r1.status).toBe(500);
    expect(r2.status).toBe(500);

    // In-memory cache must still be null — no successful render occurred.
    expect(getRenderCacheForTest()).toBeNull();

    // A subsequent request must succeed now that the mock is back to normal
    // (mockImplementationOnce is consumed; the default success path applies).
    const r3 = await makeRequest(port, "/export/promo-video");
    expect(r3.status).toBe(200);
    expect(r3.body.length).toBeGreaterThan(0);
    // Cache must be populated by the successful retry.
    expect(getRenderCacheForTest()).not.toBeNull();
  });

  it("four concurrent requests all receive status 500 and a non-empty error body when renderMp4 crashes", async () => {
    // Use a longer delay so all four callers reach "await renderPromise"
    // before the rejection lands.  The first caller starts the render and
    // sets renderPromise; callers 2–4 arrive while it is still in flight and
    // join via the queue path (step 2 of the route).  When the rejection
    // fires, all four awaiters should receive it simultaneously.
    const crashMessage = "puppeteer crashed — four callers";
    vi.mocked(puppeteer.launch).mockImplementationOnce(() =>
      delayedReject(new Error(crashMessage), 60),
    );

    const results = await Promise.all([
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
      makeRequest(port, "/export/promo-video"),
    ]);

    // Every caller must receive 500.
    for (const r of results) {
      expect(r.status).toBe(500);
    }

    // Every error body must be non-empty and name the crash reason.
    for (const r of results) {
      const body = JSON.parse(r.body.toString()) as { error: string };
      expect(body.error).toContain(crashMessage);
    }

    // No successful render occurred — cache must remain null.
    expect(getRenderCacheForTest()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computePromoSourceHash — hash-sensitivity unit tests
//
// Verifies that `computePromoSourceHash` (and the `hashDir` helper it uses)
// behaves correctly when the source tree changes:
//
//   1. Stability       — identical content produces the same digest on every call.
//   2. File added      — adding a file changes the digest.
//   3. File removed    — removing a file changes the digest.
//   4. Content changed — editing a file's content changes the digest.
//                        This is the key property that causes a scene-duration
//                        change in promo-config to bust the render cache.
//
// `computePromoSourceHash` is driven entirely by `readdir` (to enumerate source
// files) and `readFile` (to read their contents).  Both are already mocked at
// the module level; each test controls them to simulate a specific file-tree
// state.
// ---------------------------------------------------------------------------

describe("computePromoSourceHash – hash sensitivity", () => {
  // Helper: create a minimal Dirent-like object that satisfies the interface
  // `hashDir` relies on (`name` and `isDirectory()`).
  function makeDirent(name: string, isDir = false) {
    return {
      name,
      isDirectory: () => isDir,
      isFile: () => !isDir,
    };
  }

  let readdirMock: ReturnType<typeof vi.fn>;
  let readFileMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetRenderCacheForTest();

    const fsp = await import("node:fs/promises");
    readdirMock = vi.mocked(fsp.readdir);
    readFileMock = vi.mocked(fsp.readFile);

    // Default: source dirs return [] → deterministic empty-tree hash.
    readdirMock.mockResolvedValue(
      [] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>,
    );
    readFileMock.mockResolvedValue(
      Buffer.from("") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same hash when called twice with identical file content (stability)", async () => {
    readdirMock.mockResolvedValue(
      [makeDirent("index.ts")] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>,
    );
    readFileMock.mockResolvedValue(
      Buffer.from("const x = 1;") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>,
    );

    const hash1 = await computePromoSourceHash();
    const hash2 = await computePromoSourceHash();

    expect(typeof hash1).toBe("string");
    expect(hash1.length).toBeGreaterThan(0);
    expect(hash1).toBe(hash2);
  });

  it("produces a different hash when a file is added to the source tree", async () => {
    // Baseline: one source file.
    readdirMock.mockResolvedValue(
      [makeDirent("index.ts")] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>,
    );
    readFileMock.mockResolvedValue(
      Buffer.from("const x = 1;") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>,
    );
    const hashBefore = await computePromoSourceHash();

    // After: a second file appears in the tree.
    readdirMock.mockResolvedValue(
      [makeDirent("index.ts"), makeDirent("config.json")] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>,
    );
    const hashAfter = await computePromoSourceHash();

    expect(hashBefore).not.toBe(hashAfter);
  });

  it("produces a different hash when a file is removed from the source tree", async () => {
    // Baseline: two source files.
    readdirMock.mockResolvedValue(
      [makeDirent("index.ts"), makeDirent("styles.css")] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>,
    );
    readFileMock.mockResolvedValue(
      Buffer.from("body { margin: 0; }") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>,
    );
    const hashBefore = await computePromoSourceHash();

    // After: one file is removed.
    readdirMock.mockResolvedValue(
      [makeDirent("index.ts")] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>,
    );
    const hashAfter = await computePromoSourceHash();

    expect(hashBefore).not.toBe(hashAfter);
  });

  it("produces a different hash when file content changes (scene-duration change busts the cache)", async () => {
    // Both calls enumerate the same single file; only its content differs,
    // which simulates an author editing SCENE_DURATIONS in promo-config.
    readdirMock.mockResolvedValue(
      [makeDirent("index.ts")] as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readdir>>,
    );

    // Original scene duration.
    readFileMock.mockResolvedValue(
      Buffer.from("export const SCENE_DURATION = 5000;") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>,
    );
    const hashBefore = await computePromoSourceHash();

    // Updated scene duration — the cache must be busted.
    readFileMock.mockResolvedValue(
      Buffer.from("export const SCENE_DURATION = 8000;") as unknown as Awaited<ReturnType<typeof import("node:fs/promises").readFile>>,
    );
    const hashAfter = await computePromoSourceHash();

    expect(hashBefore).not.toBe(hashAfter);
  });
});
