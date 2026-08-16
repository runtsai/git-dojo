import { Router, type IRouter } from "express";
import { execFile } from "node:child_process";
import { execSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
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

// Only one export may run at a time — a headless Chrome + ffmpeg render is
// heavy, and concurrent runs would fight for CPU and produce janky output.
let exportInFlight = false;

router.get("/export/promo-video", async (req, res) => {
  if (exportInFlight) {
    res.status(409).json({
      error: "An export is already in progress. Try again in a minute.",
    });
    return;
  }

  if (!existsSync(BG_MUSIC_PATH)) {
    res.status(500).json({
      error: `Background music not found at ${BG_MUSIC_PATH}`,
    });
    return;
  }

  exportInFlight = true;
  let workDir: string | null = null;
  let browser: import("puppeteer-core").Browser | null = null;

  const cleanup = async () => {
    try {
      await browser?.close();
    } catch {
      /* already closed */
    }
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
    exportInFlight = false;
  };

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

    const totalDurationMs = await page.evaluate(
      "window.__exportTotalMs",
    );
    if (typeof totalDurationMs !== "number" || totalDurationMs <= 0) {
      throw new Error(
        `Export page did not declare a valid total duration (got ${String(totalDurationMs)})`,
      );
    }

    const recorder = await page.screencast({ path: webmPath as `${string}.webm` });

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

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", String(mp4Stat.size));
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="git-dojo-promo.mp4"',
    );

    const stream = createReadStream(mp4Path);
    stream.pipe(res);
    await new Promise<void>((resolve, reject) => {
      stream.on("end", resolve);
      stream.on("error", reject);
      res.on("close", resolve);
    });
    logger.info({ bytes: mp4Stat.size }, "export: mp4 delivered");
  } catch (err) {
    req.log.error({ err }, "promo video export failed");
    if (!res.headersSent) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : "Promo video export failed.",
      });
    } else {
      res.destroy();
    }
  } finally {
    await cleanup();
  }
});

export default router;
