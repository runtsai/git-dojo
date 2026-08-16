import { Router, type IRouter } from "express";
import { execFile } from "node:child_process";
import { execSync } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, stat, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { logger } from "../lib/logger";
import { TOTAL_RUNTIME_MS } from "@workspace/promo-config";

const execFileAsync = promisify(execFile);

const router: IRouter = Router();

// The promo video is served through the local path-routed proxy on port 80.
const PROMO_EXPORT_URL = "http://localhost:80/git-dojo-promo/?export=1";

// Background music lives in the promo artifact's public assets. The API
// server's cwd is artifacts/api-server (workflow runs via pnpm --filter).
const BG_MUSIC_PATH = path.resolve(
  process.cwd(),
  "..",
  "git-dojo-promo",
  "public",
  "audio",
  "bg_music.mp3",
);

// Promo source directory — any change here busts the cache.
const PROMO_SRC_DIR = path.resolve(
  process.cwd(),
  "..",
  "git-dojo-promo",
  "src",
);

// Shared promo config package — scene durations live here and are the
// authoritative input for the expected video length reported by promo-meta.
// Changes to this directory must also bust the render cache.
const PROMO_CONFIG_SRC_DIR = path.resolve(
  process.cwd(),
  "..",
  "..",
  "lib",
  "promo-config",
  "src",
);
// Directory where the rendered MP4 is persisted across server restarts.
// Filename encodes the source hash so stale files are ignored automatically.
// Evaluated lazily so tests can override PROMO_EXPORT_CACHE_DIR at runtime.
function getCacheDir(): string {
  return process.env["PROMO_EXPORT_CACHE_DIR"] ?? "/tmp/promo-export-cache";
}

// Extra wall-clock padding after the declared video duration so the last
// scene's final frames are captured before the recorder stops.
const TAIL_PADDING_MS = 400;

const VIEWPORT = { width: 1280, height: 720 };

function findChromium(): string {
  const fromEnv = process.env["CHROMIUM_PATH"];
  if (fromEnv) return fromEnv;
  try {
    return execSync("which chromium", { encoding: "utf8" }).trim();
  } catch {
    throw new Error(
      "Chromium executable not found. Install the 'chromium' system dependency.",
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Source-hash helper
// ---------------------------------------------------------------------------

/**
 * Walk a directory and feed the content of every .ts/.tsx/.css/.json file
 * into the running hash.  Called for both the promo source tree and the
 * shared promo-config package so that a scene-duration change in either
 * location busts the render cache.
 */
async function hashDir(
  hash: ReturnType<typeof createHash>,
  dir: string,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // directory may not exist in all environments
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await hashDir(hash, full);
    } else if (/\.(ts|tsx|css|json)$/i.test(entry.name)) {
      hash.update(entry.name);
      hash.update(await readFile(full));
    }
  }
}

/**
 * Hash the promo source tree plus the shared promo-config package.
 * The resulting hex digest changes whenever either the promo video code
 * or the scene-duration config changes, which is the signal to bust the
 * render cache.
 *
 * Exported so integration tests can derive the same hash that loadDiskCache
 * will look up on disk.
 */
export async function computePromoSourceHash(): Promise<string> {
  const hash = createHash("sha256");
  await hashDir(hash, PROMO_SRC_DIR);
  await hashDir(hash, PROMO_CONFIG_SRC_DIR);
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------
// Cache + in-flight queue
// ---------------------------------------------------------------------------

interface RenderCache {
  /** SHA-256 of the promo source tree when this render was produced. */
  sourceHash: string;
  /** The finished MP4 file contents held in memory. */
  buffer: Buffer;
}

/** Last successfully rendered MP4, or null if not yet produced / invalidated. */
let renderCache: RenderCache | null = null;

/**
 * Promise representing an in-flight render.  Any concurrent request that
 * arrives while a render is running awaits this promise instead of starting a
 * new one, so they all share the same result without fighting for CPU.
 */
let renderPromise: Promise<Buffer> | null = null;

// ---------------------------------------------------------------------------
// Disk-cache helpers
// ---------------------------------------------------------------------------

/** Absolute path where the MP4 for the given source hash is stored on disk. */
function diskCachePath(sourceHash: string): string {
  return path.join(getCacheDir(), `${sourceHash}.mp4`);
}

/**
 * Remove any `.mp4` files in CACHE_DIR whose name does not match `keepHash`.
 * Used both at startup (inside `loadDiskCache`) and after a successful render
 * (inside `writeDiskCache`) so that orphaned files don't accumulate on
 * long-lived servers.  Deletion failures are logged but never fatal.
 */
async function sweepStaleCacheFiles(keepHash: string): Promise<void> {
  try {
    const entries = await readdir(getCacheDir());
    for (const entry of entries) {
      if (!entry.endsWith(".mp4")) continue;
      if (entry === `${keepHash}.mp4`) continue; // keep the current one
      const stalePath = path.join(getCacheDir(), entry);
      try {
        await rm(stalePath);
        logger.info({ path: stalePath }, "export: removed stale disk-cache file");
      } catch (rmErr) {
        logger.warn({ err: rmErr, path: stalePath }, "export: failed to remove stale cache file (non-fatal)");
      }
    }
  } catch (sweepErr) {
    // Cache dir may not exist yet on a fresh instance — that's fine.
    logger.debug({ err: sweepErr }, "export: cache sweep skipped (directory may not exist yet)");
  }
}

/**
 * Persist the rendered MP4 to disk so it survives server restarts.
 * After a successful write, sweeps any stale `.mp4` files left over from
 * previous renders so they don't accumulate on long-lived servers.
 * Failures are logged but never propagated — a write error must not break
 * an already-successful render.
 */
async function writeDiskCache(sourceHash: string, buffer: Buffer): Promise<void> {
  try {
    await mkdir(getCacheDir(), { recursive: true });
    await writeFile(diskCachePath(sourceHash), buffer);
    logger.info({ path: diskCachePath(sourceHash) }, "export: disk cache written");
    await sweepStaleCacheFiles(sourceHash);
  } catch (err) {
    logger.warn({ err }, "export: failed to write disk cache (non-fatal)");
  }
}

/**
 * Return true if `buf` is a structurally plausible MP4 container.
 *
 * Two conditions must hold:
 *
 * 1. **Complete ftyp box** — The first ISO-BMFF box must have type `ftyp`
 *    (bytes 4–7) and a declared size that is at least 16 bytes (minimum for
 *    size + type + major-brand + minor-version) and no larger than the buffer
 *    itself.  A size exceeding the buffer means the ftyp box was never fully
 *    written, i.e. the file is truncated inside its own header.
 *
 * 2. **moov box present and complete** — A valid, playable MP4 must contain a
 *    `moov` box whose declared size fits entirely within the buffer.  With
 *    `-movflags +faststart` (used by the ffmpeg transcode step) `moov` is
 *    placed immediately after `ftyp`, so this walk terminates quickly.  A file
 *    truncated after `ftyp` but before a complete `moov` — the most likely
 *    crash scenario mid-write — fails this check.
 *
 * Exported so it can be unit-tested independently.
 */
export function isValidMp4Buffer(buf: Buffer): boolean {
  // Need at least 16 bytes for a minimal ftyp box:
  //   [4 size][4 "ftyp"][4 major-brand][4 minor-version]
  if (buf.length < 16) return false;

  // Bytes 4–7 must spell "ftyp" (0x66 0x74 0x79 0x70).
  if (
    buf[4] !== 0x66 ||
    buf[5] !== 0x74 ||
    buf[6] !== 0x79 ||
    buf[7] !== 0x70
  ) {
    return false;
  }

  // The ftyp box size must be plausible and fit entirely within the buffer.
  const ftypBoxSize = buf.readUInt32BE(0);
  if (ftypBoxSize < 16 || ftypBoxSize > buf.length) return false;

  // Walk top-level boxes after ftyp, verifying:
  //   - every box's declared size fits within the buffer (no truncation)
  //   - both a moov box and an mdat box are present
  //
  // A crash mid-write can produce a file where:
  //   - moov is complete but mdat was never started or is truncated
  //   - any box's declared size extends past the actual file end
  //
  // This renderer always uses +faststart, so the layout is always:
  //   ftyp | moov (metadata, a few KB) | mdat (media data, potentially large)
  // The 1 MiB scan cap is therefore a safe optimisation: moov and the start of
  // mdat will always begin well within the first megabyte.  The guard is NOT
  // intended for arbitrary MP4 files without +faststart.
  const MAX_SCAN_OFFSET = 1024 * 1024;
  let offset = ftypBoxSize;
  let foundMoov = false;
  let foundMdat = false;

  while (offset + 8 <= buf.length && offset < MAX_SCAN_OFFSET) {
    const boxSize = buf.readUInt32BE(offset);

    // A size of 0 means "this box extends to EOF" — valid sentinel; stop.
    if (boxSize === 0) break;
    // A box smaller than its own 8-byte header is malformed.
    if (boxSize < 8) return false;

    // Every box's declared extent must fit inside the buffer.
    // If it doesn't, the file was truncated while writing this box.
    if (offset + boxSize > buf.length) return false;

    const t0 = buf[offset + 4];
    const t1 = buf[offset + 5];
    const t2 = buf[offset + 6];
    const t3 = buf[offset + 7];

    // moov = 0x6d 0x6f 0x6f 0x76
    if (t0 === 0x6d && t1 === 0x6f && t2 === 0x6f && t3 === 0x76) {
      foundMoov = true;
    }
    // mdat = 0x6d 0x64 0x61 0x74
    else if (t0 === 0x6d && t1 === 0x64 && t2 === 0x61 && t3 === 0x74) {
      foundMdat = true;
    }

    // Extended-size boxes (size == 1) use the next 8 bytes as the real size.
    // They are unusual at top level; treat as end of parseable region.
    if (boxSize === 1) break;

    offset += boxSize;
  }

  // A valid MP4 with media content must have both structural metadata (moov)
  // and media data (mdat).  A file with only moov has no watchable content —
  // typically the result of a crash before the bulk mdat write completed.
  return foundMoov && foundMdat;
}

/**
 * On startup, check whether a cached MP4 whose filename matches the current
 * source hash already exists on disk.  If so, load it into the in-memory
 * cache so the first request is served immediately without a re-render.
 *
 * Also sweeps any stale `.mp4` files whose name does not match the current
 * source hash so that orphaned renders don't accumulate and fill /tmp.
 * Deletion failures are logged but never fatal.
 *
 * Exported for integration testing (tests control PROMO_EXPORT_CACHE_DIR and
 * call resetRenderCacheForTest() to clear state between cases).
 */
export async function loadDiskCache(): Promise<void> {
  try {
    const sourceHash = await computePromoSourceHash();
    if (!sourceHash) return;

    // ------------------------------------------------------------------
    // Sweep stale MP4 files from previous renders.
    // ------------------------------------------------------------------
    await sweepStaleCacheFiles(sourceHash);

    // ------------------------------------------------------------------
    // Load the matching cache file if present.
    // ------------------------------------------------------------------
    const cachePath = diskCachePath(sourceHash);
    if (!existsSync(cachePath)) return;

    const buffer = await readFile(cachePath);
    if (!isValidMp4Buffer(buffer)) {
      logger.warn(
        { path: cachePath, bytes: buffer.length },
        "export: disk cache skipped — file is empty or not a valid MP4 (likely an incomplete prior write)",
      );
      return;
    }

    renderCache = { sourceHash, buffer };
    logger.info(
      { bytes: buffer.length, path: cachePath },
      "export: disk cache loaded on startup",
    );
  } catch (err) {
    logger.warn({ err }, "export: startup disk-cache load failed (non-fatal)");
  }
}

/** @internal For tests only: read the current in-memory render cache. */
export function getRenderCacheForTest(): RenderCache | null {
  return renderCache;
}

/** @internal For tests only: reset the in-memory render cache between cases. */
export function resetRenderCacheForTest(): void {
  renderCache = null;
  renderPromise = null;
}

// Kick off cache warming immediately when this module is first imported.
loadDiskCache().catch(() => {});

// ---------------------------------------------------------------------------
// Core render logic (runs at most once at a time)
// ---------------------------------------------------------------------------

async function renderMp4(): Promise<Buffer> {
  let workDir: string | null = null;
  let browser: import("puppeteer-core").Browser | null = null;

  try {
    const puppeteer = (await import("puppeteer-core")).default;
    workDir = await mkdtemp(path.join(tmpdir(), "promo-export-"));
    const webmPath = path.join(workDir, "capture.webm");
    const mp4Path = path.join(workDir, "promo.mp4");

    browser = await puppeteer.launch({
      executablePath: findChromium(),
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });

    logger.info({ url: PROMO_EXPORT_URL }, "export: navigating");
    await page.goto(PROMO_EXPORT_URL, {
      waitUntil: "networkidle2",
      timeout: 60_000,
    });

    // The export page signals readiness and exposes a playback trigger plus
    // the total video duration (see VideoWithControls export mode).
    await page.waitForFunction("window.__exportReady === true", {
      timeout: 30_000,
    });

    const totalDurationMs = await page.evaluate("window.__exportTotalMs");
    if (typeof totalDurationMs !== "number" || totalDurationMs <= 0) {
      throw new Error(
        `Export page did not declare a valid total duration (got ${String(totalDurationMs)})`,
      );
    }

    // Hard assertion: the page and the shared config must agree on total
    // duration before a single frame is recorded.  If they diverge (e.g.
    // someone edits VideoWithControls without updating SCENE_DURATIONS in
    // promo-config, or vice-versa) we throw immediately so that:
    //   • no wrong-length WebM is captured
    //   • no wrong-length MP4 is transcoded or written to the disk cache
    //   • the route returns a 500 that is immediately visible to the caller
    // A warning that lets the render proceed would silently cache and serve
    // a video trimmed at the wrong point until someone noticed the log entry.
    if (totalDurationMs !== TOTAL_RUNTIME_MS) {
      throw new Error(
        `Export aborted: window.__exportTotalMs (${totalDurationMs} ms) does not ` +
          `match TOTAL_RUNTIME_MS from @workspace/promo-config (${TOTAL_RUNTIME_MS} ms). ` +
          `Update SCENE_DURATIONS in lib/promo-config/src/index.ts or VideoWithControls ` +
          `so both sides agree before re-exporting.`,
      );
    }

    const recorder = await page.screencast({
      path: webmPath as `${string}.webm`,
    });

    await page.evaluate("window.__startExportPlayback()");
    logger.info({ totalDurationMs }, "export: recording started");
    await sleep(totalDurationMs + TAIL_PADDING_MS);

    await recorder.stop();
    await browser.close();
    browser = null;

    const webmStat = await stat(webmPath);
    if (webmStat.size === 0) {
      throw new Error("Screen recording produced an empty file.");
    }

    // Mux the captured video with the background music and transcode to a
    // universally playable H.264/AAC MP4, trimmed to the exact video length.
    logger.info("export: transcoding to mp4");
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i", webmPath,
        "-i", BG_MUSIC_PATH,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-t", String(totalDurationMs / 1000),
        "-movflags", "+faststart",
        mp4Path,
      ],
      { timeout: 180_000, maxBuffer: 16 * 1024 * 1024 },
    );

    const mp4Stat = await stat(mp4Path);
    if (mp4Stat.size === 0) {
      throw new Error("Transcoding produced an empty MP4.");
    }

    const buffer = await readFile(mp4Path);
    logger.info({ bytes: buffer.length }, "export: mp4 ready");
    return buffer;
  } finally {
    try {
      await browser?.close();
    } catch {
      /* already closed */
    }
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

function sendMp4(res: import("express").Response, buffer: Buffer): void {
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="git-dojo-promo.mp4"',
  );
  res.end(buffer);
}

router.get("/export/promo-video", async (req, res) => {
  if (!existsSync(BG_MUSIC_PATH)) {
    res.status(500).json({
      error: `Background music not found at ${BG_MUSIC_PATH}`,
    });
    return;
  }

  // ------------------------------------------------------------------
  // 1. Check whether the cached render is still valid.
  // ------------------------------------------------------------------
  let currentHash: string;
  try {
    currentHash = await computePromoSourceHash();
  } catch (err) {
    req.log.warn({ err }, "export: could not compute source hash; skipping cache");
    currentHash = "";
  }

  if (renderCache && currentHash && renderCache.sourceHash === currentHash) {
    logger.info(
      { bytes: renderCache.buffer.length },
      "export: serving cached mp4",
    );
    sendMp4(res, renderCache.buffer);
    return;
  }

  // ------------------------------------------------------------------
  // 2. If a render is already in flight, queue onto it.
  // ------------------------------------------------------------------
  if (renderPromise !== null) {
    logger.info("export: render in flight — queuing request");
    try {
      const buffer = await renderPromise;
      sendMp4(res, buffer);
    } catch (err) {
      req.log.error({ err }, "export: queued render failed");
      if (!res.headersSent) {
        res.status(500).json({
          error:
            err instanceof Error ? err.message : "Promo video export failed.",
        });
      }
    }
    return;
  }

  // ------------------------------------------------------------------
  // 3. Start a fresh render.  Store the promise so concurrent arrivals
  //    join the queue (step 2) rather than launching another render.
  // ------------------------------------------------------------------
  renderPromise = renderMp4();

  let buffer: Buffer;
  try {
    buffer = await renderPromise;
  } catch (err) {
    req.log.error({ err }, "promo video export failed");
    renderPromise = null; // allow future requests to retry
    if (!res.headersSent) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : "Promo video export failed.",
      });
    } else {
      res.destroy();
    }
    return;
  }

  // Render succeeded — update in-memory cache, persist to disk, clear promise.
  renderCache = { sourceHash: currentHash, buffer };
  renderPromise = null;
  void writeDiskCache(currentHash, buffer);

  sendMp4(res, buffer);
});

export default router;
