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

// Directory where the rendered MP4 is persisted across server restarts.
// Filename encodes the source hash so stale files are ignored automatically.
const CACHE_DIR =
  process.env["PROMO_EXPORT_CACHE_DIR"] ?? "/tmp/promo-export-cache";

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
 * Walk the promo source directory and hash the content of every .ts/.tsx/.css/.json file.
 * The resulting hex digest changes whenever the promo video code changes, which
 * is the signal to bust the render cache.
 */
async function computePromoSourceHash(): Promise<string> {
  const hash = createHash("sha256");

  async function hashDir(dir: string): Promise<void> {
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
        await hashDir(full);
      } else if (/\.(ts|tsx|css|json)$/i.test(entry.name)) {
        hash.update(entry.name);
        hash.update(await readFile(full));
      }
    }
  }

  await hashDir(PROMO_SRC_DIR);
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
  return path.join(CACHE_DIR, `${sourceHash}.mp4`);
}

/**
 * Persist the rendered MP4 to disk so it survives server restarts.
 * Failures are logged but never propagated — a write error must not break
 * an already-successful render.
 */
async function writeDiskCache(sourceHash: string, buffer: Buffer): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(diskCachePath(sourceHash), buffer);
    logger.info({ path: diskCachePath(sourceHash) }, "export: disk cache written");
  } catch (err) {
    logger.warn({ err }, "export: failed to write disk cache (non-fatal)");
  }
}

/**
 * On startup, check whether a cached MP4 whose filename matches the current
 * source hash already exists on disk.  If so, load it into the in-memory
 * cache so the first request is served immediately without a re-render.
 */
async function loadDiskCache(): Promise<void> {
  try {
    const sourceHash = await computePromoSourceHash();
    if (!sourceHash) return;

    const cachePath = diskCachePath(sourceHash);
    if (!existsSync(cachePath)) return;

    const buffer = await readFile(cachePath);
    if (buffer.length === 0) return;

    renderCache = { sourceHash, buffer };
    logger.info(
      { bytes: buffer.length, path: cachePath },
      "export: disk cache loaded on startup",
    );
  } catch (err) {
    logger.warn({ err }, "export: startup disk-cache load failed (non-fatal)");
  }
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
