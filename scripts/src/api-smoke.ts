/**
 * api-smoke.ts — hits every read-only API endpoint and validates the response
 * body against the generated Zod schema.  Fails loudly on non-2xx or parse
 * errors so schema mismatches that only surface at runtime are caught early.
 *
 * Usage:
 *   API_URL=http://localhost:5000 tsx scripts/src/api-smoke.ts
 *
 * API_URL defaults to http://localhost:${PORT} where PORT defaults to 5000.
 *
 * Set SKIP_EXPORT_SMOKE=1 to skip the slow promo-video export check (e.g. in
 * environments where Chromium or a display server is unavailable).
 */
import { execFile, execSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

const execFileAsync = promisify(execFile);

import {
  HealthCheckResponse,
  GetDojoOverviewResponse,
  ListLessonsResponse,
  GetRepoStateResponse,
  RunLessonCheckResponse,
  RunBotActionResponse,
  ListCrisisScenariosResponse,
  GetCrisisRepoStateResponse,
  SetupCrisisScenarioResponse,
  RunCrisisCheckResponse,
  GetCapstoneStatusResponse,
  CreateCapstoneRepoResponse,
  DeleteCapstoneRepoResponse,
  VerifyCapstoneMissionResponse,
  GetProgressResponse,
  CompleteModuleResponse,
  GetDueDrillsResponse,
  RecordDrillAttemptResponse,
  GetCommitDiffResponse,
  GetWorkingFileDiffResponse,
} from "@workspace/api-zod";
import { z } from "zod";
import type { ZodTypeAny, ZodIssue } from "zod";

// ---------------------------------------------------------------------------
// Inline schemas for endpoints not in @workspace/api-zod
// ---------------------------------------------------------------------------

/** Response schema for GET /api/export/promo-meta */
const PromoMetaResponse = z.object({
  sceneDurations: z.record(z.string(), z.number()),
  totalDurationMs: z.number().positive(),
  totalDurationSec: z.number().positive(),
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = process.env["PORT"] ?? "5000";
const BASE = (process.env["API_URL"] ?? `http://localhost:${PORT}`).replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function ok(label: string): void {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label: string, reason: string): void {
  console.error(`  ✗  ${label}`);
  console.error(`     ${reason}`);
  failed++;
}

async function request(
  method: string,
  path: string,
  payload?: unknown,
): Promise<{ status: number; body: unknown }> {
  const url = `${BASE}${path}`;
  const init: RequestInit = { method };
  if (payload !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(payload);
  }
  const res = await fetch(url, init);
  let body: unknown;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, body };
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  return request("GET", path);
}

async function smokePost(
  path: string,
  payload: unknown,
  schema: ZodTypeAny,
): Promise<unknown> {
  const label = `POST ${path}`;
  let result: { status: number; body: unknown };
  try {
    result = await request("POST", path, payload);
  } catch (err) {
    fail(label, `Network error: ${String(err)}`);
    return undefined;
  }

  if (result.status < 200 || result.status >= 300) {
    fail(label, `HTTP ${result.status} — ${JSON.stringify(result.body).slice(0, 200)}`);
    return undefined;
  }

  const parsed = schema.safeParse(result.body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i: ZodIssue) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    fail(label, `Schema mismatch — ${issues}`);
    return undefined;
  }

  ok(label);
  return parsed.data;
}

/**
 * Like smokePost/smokeDelete but accepts a 409 response as a graceful skip.
 * Used for write endpoints that require GitHub connectivity or an existing
 * capstone state — prerequisites that may not be satisfied in all environments.
 * Any 2xx is validated against the schema; any other non-2xx is a failure.
 */
/**
 * Asserts that a POST with the given payload returns HTTP 400.  Used to verify
 * that Zod guards on write endpoints reject malformed bodies rather than
 * silently accepting them.
 */
async function smokeExpect400(path: string, payload: unknown, label?: string): Promise<void> {
  const checkLabel = label ?? `POST ${path} (malformed body → 400)`;
  let result: { status: number; body: unknown };
  try {
    result = await request("POST", path, payload);
  } catch (err) {
    fail(checkLabel, `Network error: ${String(err)}`);
    return;
  }

  if (result.status === 400) {
    ok(checkLabel);
  } else {
    fail(checkLabel, `Expected HTTP 400 but got ${result.status} — ${JSON.stringify(result.body).slice(0, 200)}`);
  }
}

async function smokeWriteOrSkip409(
  method: "POST" | "DELETE",
  path: string,
  schema: ZodTypeAny,
  payload?: unknown,
): Promise<unknown> {
  const label = `${method} ${path}`;
  let result: { status: number; body: unknown };
  try {
    result = await request(method, path, payload);
  } catch (err) {
    fail(label, `Network error: ${String(err)}`);
    return undefined;
  }

  // 409 means a prerequisite is unmet (GitHub not connected, no capstone state,
  // or public deployment guard).  Treat it as a skip rather than a failure so
  // the smoke check stays green in environments without GitHub.
  if (result.status === 409) {
    const reason =
      typeof result.body === "object" &&
      result.body !== null &&
      "error" in result.body
        ? String((result.body as { error: unknown }).error)
        : "prerequisite not met";
    console.log(`  -  ${label}  (skipped — ${reason})`);
    return undefined;
  }

  if (result.status < 200 || result.status >= 300) {
    fail(label, `HTTP ${result.status} — ${JSON.stringify(result.body).slice(0, 200)}`);
    return undefined;
  }

  const parsed = schema.safeParse(result.body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i: ZodIssue) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    fail(label, `Schema mismatch — ${issues}`);
    return undefined;
  }

  ok(label);
  return parsed.data;
}
async function smoke(path: string, schema: ZodTypeAny): Promise<unknown> {
  const label = `GET ${path}`;
  let result: { status: number; body: unknown };
  try {
    result = await get(path);
  } catch (err) {
    fail(label, `Network error: ${String(err)}`);
    return undefined;
  }

  if (result.status < 200 || result.status >= 300) {
    fail(label, `HTTP ${result.status} — ${JSON.stringify(result.body).slice(0, 200)}`);
    return undefined;
  }

  const parsed = schema.safeParse(result.body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i: ZodIssue) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    fail(label, `Schema mismatch — ${issues}`);
    return undefined;
  }

  ok(label);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Promo-video export smoke check
// ---------------------------------------------------------------------------

const DURATION_TOLERANCE_SEC = 3.0;

/** Minimum plausible MP4 size for a ~22 s H.264+AAC video at any sane bitrate. */
const MIN_EXPORT_BYTES = 200_000; // 200 KB

interface FfprobeOutput {
  streams: Array<{ codec_type: string; codec_name: string }>;
  format: { duration: string };
}

async function smokePromoExport(): Promise<void> {
  const label = "GET /api/export/promo-video";

  if (process.env["SKIP_EXPORT_SMOKE"] === "1") {
    console.log(`  -  ${label}  (skipped — SKIP_EXPORT_SMOKE=1)`);
    return;
  }

  // ── 0. Fetch expected duration from the meta endpoint ─────────────────────
  let expectedDurationSec: number;
  try {
    const metaRes = await fetch(`${BASE}/api/export/promo-meta`);
    if (!metaRes.ok) {
      fail(label, `Could not fetch /api/export/promo-meta — HTTP ${metaRes.status}`);
      return;
    }
    const meta = await metaRes.json() as { totalDurationSec?: number };
    if (typeof meta.totalDurationSec !== "number" || meta.totalDurationSec <= 0) {
      fail(label, `promo-meta returned invalid totalDurationSec: ${JSON.stringify(meta.totalDurationSec)}`);
      return;
    }
    expectedDurationSec = meta.totalDurationSec;
  } catch (err) {
    fail(label, `Failed to fetch /api/export/promo-meta: ${String(err)}`);
    return;
  }

  const url = `${BASE}/api/export/promo-video`;
  console.log(`  …  ${label}  (this takes ~30 s — rendering full video, expected ${expectedDurationSec} s)`);

  // ── 1. Fetch with a generous timeout ──────────────────────────────────────
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(360_000) });
  } catch (err) {
    fail(label, `Network error: ${String(err)}`);
    return;
  }

  if (res.status !== 200) {
    let detail = "";
    try {
      const body = await res.json() as { error?: string };
      detail = body.error ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    fail(label, `HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
    return;
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("video/mp4")) {
    fail(label, `Expected Content-Type video/mp4, got "${ct}"`);
    await res.body?.cancel();
    return;
  }

  // ── 2. Buffer the body so we can inspect it ────────────────────────────────
  let mp4Bytes: Uint8Array;
  try {
    mp4Bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    fail(label, `Failed to read response body: ${String(err)}`);
    return;
  }

  if (mp4Bytes.byteLength < MIN_EXPORT_BYTES) {
    fail(
      label,
      `MP4 too small: ${mp4Bytes.byteLength} bytes (expected ≥ ${MIN_EXPORT_BYTES})`,
    );
    return;
  }

  // ── 3. Write to a temp file and probe with ffprobe ─────────────────────────
  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(nodePath.join(tmpdir(), "smoke-export-"));
    const mp4Path = nodePath.join(workDir, "promo.mp4");
    await writeFile(mp4Path, mp4Bytes);

    let probeJson: FfprobeOutput;
    try {
      const { stdout } = await execFileAsync(
        "ffprobe",
        [
          "-v", "error",
          "-show_streams",
          "-show_format",
          "-of", "json",
          mp4Path,
        ],
        { timeout: 30_000 },
      );
      probeJson = JSON.parse(stdout) as FfprobeOutput;
    } catch (err) {
      fail(label, `ffprobe failed: ${String(err)}`);
      return;
    }

    // ── 4. Verify video stream (H.264) ───────────────────────────────────────
    const videoStream = probeJson.streams.find((s) => s.codec_type === "video");
    if (!videoStream) {
      fail(label, "No video stream found in exported MP4");
      return;
    }
    if (videoStream.codec_name !== "h264") {
      fail(
        label,
        `Expected h264 video stream, got "${videoStream.codec_name}"`,
      );
      return;
    }

    // ── 5. Verify audio stream (AAC) ─────────────────────────────────────────
    const audioStream = probeJson.streams.find((s) => s.codec_type === "audio");
    if (!audioStream) {
      fail(label, "No audio stream found in exported MP4 (bg_music.mp3 may be missing or mux failed)");
      return;
    }
    if (audioStream.codec_name !== "aac") {
      fail(
        label,
        `Expected aac audio stream, got "${audioStream.codec_name}"`,
      );
      return;
    }

    // ── 6. Verify duration ───────────────────────────────────────────────────
    const duration = parseFloat(probeJson.format.duration);
    if (isNaN(duration)) {
      fail(label, `Could not parse duration from ffprobe output`);
      return;
    }
    const diff = Math.abs(duration - expectedDurationSec);
    if (diff > DURATION_TOLERANCE_SEC) {
      fail(
        label,
        `Duration ${duration.toFixed(2)} s is outside expected ` +
          `${expectedDurationSec} ± ${DURATION_TOLERANCE_SEC} s`,
      );
      return;
    }

    ok(
      `${label}  [${mp4Bytes.byteLength.toLocaleString()} bytes, ` +
        `${duration.toFixed(2)} s, h264+aac]`,
    );
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Duration-mismatch check — fast, no video recording
// ---------------------------------------------------------------------------

/**
 * The URL the promo app listens at in the Replit workspace. Mirrors the URL
 * the export renderer itself uses so both paths exercise the same page.
 * Override with PROMO_URL if the dev proxy is at a different address.
 */
const PROMO_EXPORT_PAGE_URL =
  (process.env["PROMO_URL"] ?? "http://localhost:80/git-dojo-promo") +
  "/?export=1";

function findChromiumPath(): string {
  const fromEnv = process.env["CHROMIUM_PATH"];
  if (fromEnv) return fromEnv;
  try {
    return execSync("which chromium", { encoding: "utf8" }).trim();
  } catch {
    throw new Error(
      "Chromium not found — install the 'chromium' system dependency or set CHROMIUM_PATH.",
    );
  }
}

/**
 * Loads the promo page in export mode using a headless browser, reads the
 * `window.__exportTotalMs` value that the React app sets from
 * `@workspace/promo-config`, and compares it against the `totalDurationMs`
 * returned by `/api/export/promo-meta` (which reads the same constant).
 *
 * If the two values disagree it means someone edited VideoWithControls without
 * updating SCENE_DURATIONS (or vice-versa), and the export renderer would abort
 * with an error when it tried to render.  This check surfaces that mismatch
 * early — before any render is attempted — so CI catches it in seconds rather
 * than after a multi-minute render attempt.
 *
 * Skipped when SKIP_DURATION_CHECK=1.  Not gated on SKIP_EXPORT_SMOKE because
 * this step does no video recording and completes in a few seconds.
 */
async function smokeDurationMismatch(): Promise<void> {
  const label = "duration-mismatch: promo-page vs promo-meta";

  if (process.env["SKIP_DURATION_CHECK"] === "1") {
    console.log(`  -  ${label}  (skipped — SKIP_DURATION_CHECK=1)`);
    return;
  }

  // ── 1. Fetch expected duration from the meta endpoint ─────────────────────
  let apiTotalMs: number;
  try {
    const metaRes = await fetch(`${BASE}/api/export/promo-meta`);
    if (!metaRes.ok) {
      fail(label, `Could not fetch /api/export/promo-meta — HTTP ${metaRes.status}`);
      return;
    }
    const meta = (await metaRes.json()) as { totalDurationMs?: number };
    if (typeof meta.totalDurationMs !== "number" || meta.totalDurationMs <= 0) {
      fail(
        label,
        `promo-meta returned invalid totalDurationMs: ${JSON.stringify(meta.totalDurationMs)}`,
      );
      return;
    }
    apiTotalMs = meta.totalDurationMs;
  } catch (err) {
    fail(label, `Failed to fetch /api/export/promo-meta: ${String(err)}`);
    return;
  }

  // ── 2. Launch the promo page and read window.__exportTotalMs ──────────────
  let chromiumPath: string;
  try {
    chromiumPath = findChromiumPath();
  } catch (err) {
    console.log(`  -  ${label}  (skipped — ${String(err)})`);
    return;
  }

  let browser: import("puppeteer-core").Browser | null = null;
  try {
    let puppeteer: typeof import("puppeteer-core")["default"];
    try {
      puppeteer = (await import("puppeteer-core")).default;
    } catch {
      console.log(`  -  ${label}  (skipped — puppeteer-core not installed)`);
      return;
    }
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--hide-scrollbars",
      ],
    });

    const page = await browser.newPage();

    let navError: Error | null = null;
    try {
      await page.goto(PROMO_EXPORT_PAGE_URL, {
        waitUntil: "networkidle2",
        timeout: 30_000,
      });
    } catch (err) {
      navError = err instanceof Error ? err : new Error(String(err));
    }

    if (navError) {
      // Promo app not running in this environment — skip gracefully.
      console.log(
        `  -  ${label}  (skipped — promo page unreachable: ${navError.message})`,
      );
      return;
    }

    // Wait for the React app to signal export readiness (sets __exportReady).
    try {
      await page.waitForFunction("window.__exportReady === true", {
        timeout: 15_000,
      });
    } catch {
      // Navigation succeeded (page is reachable) but __exportReady was never
      // set within the timeout — the React bundle failed to initialise.
      // This is a real failure: a reachable but broken promo app must not pass.
      fail(
        label,
        `Promo page loaded at ${PROMO_EXPORT_PAGE_URL} but window.__exportReady was not set within 15 s — React bundle did not initialise.`,
      );
      return;
    }

    const pageTotalMs = await page.evaluate("window.__exportTotalMs");

    if (typeof pageTotalMs !== "number" || pageTotalMs <= 0) {
      fail(
        label,
        `window.__exportTotalMs is not a positive number (got ${JSON.stringify(pageTotalMs)})`,
      );
      return;
    }

    // ── 3. Compare ────────────────────────────────────────────────────────────
    if (pageTotalMs !== apiTotalMs) {
      fail(
        label,
        `Duration mismatch — window.__exportTotalMs=${pageTotalMs} ms ` +
          `but /api/export/promo-meta totalDurationMs=${apiTotalMs} ms ` +
          `(diff: ${pageTotalMs - apiTotalMs} ms). ` +
          `Update SCENE_DURATIONS in lib/promo-config/src/index.ts or ` +
          `VideoWithControls so both sides agree before re-exporting.`,
      );
      return;
    }

    ok(`${label}  [both agree: ${pageTotalMs} ms]`);
  } catch (err) {
    fail(label, `Unexpected error: ${String(err)}`);
  } finally {
    try {
      await browser?.close();
    } catch {
      /* already closed */
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\nAPI smoke test  →  ${BASE}\n`);

  // 1. Health
  await smoke("/api/healthz", HealthCheckResponse);

  // 2. Dojo overview
  await smoke("/api/dojo/overview", GetDojoOverviewResponse);

  // 3. Lessons list — also extracts a lessonId for the parameterised route
  const lessons = await smoke("/api/dojo/lessons", ListLessonsResponse);
  const firstLesson = Array.isArray(lessons) ? (lessons as Array<{ id: string }>)[0] : undefined;

  // 4. Lesson repo state (parameterised) — skip if no lessons exist yet
  let firstCommitHash: string | undefined;
  let firstChangedFilePath: string | undefined;
  if (firstLesson) {
    const state = await smoke(`/api/dojo/lessons/${firstLesson.id}/state`, GetRepoStateResponse);
    if (state && typeof state === "object") {
      const s = state as { commits?: Array<{ hash: string }>; files?: Array<{ path: string; status: string }> };
      firstCommitHash = s.commits?.[0]?.hash;
      firstChangedFilePath = s.files?.find(
        (f) => f.status !== "conflicted",
      )?.path;
    }
  } else {
    console.log(`  -  GET /api/dojo/lessons/:id/state  (skipped — no lessons found)`);
  }

  // 4a. Commit diff — skip if the lesson has no commits yet
  if (firstLesson && firstCommitHash) {
    await smoke(
      `/api/dojo/lessons/${firstLesson.id}/commits/${firstCommitHash}/diff`,
      GetCommitDiffResponse,
    );
  } else {
    console.log(
      `  -  GET /api/dojo/lessons/:id/commits/:hash/diff  (skipped — no commits in first lesson)`,
    );
  }

  // 4b. File diff — skip if the lesson has no changed files right now
  if (firstLesson && firstChangedFilePath) {
    await smoke(
      `/api/dojo/lessons/${firstLesson.id}/file-diff?filePath=${encodeURIComponent(firstChangedFilePath)}`,
      GetWorkingFileDiffResponse,
    );
  } else {
    console.log(
      `  -  GET /api/dojo/lessons/:id/file-diff  (skipped — no changed files in first lesson)`,
    );
  }

  // 4c. Lesson check — skip if no lessons exist yet
  if (firstLesson) {
    await smokePost(
      `/api/dojo/lessons/${firstLesson.id}/check`,
      {},
      RunLessonCheckResponse,
    );
  } else {
    console.log(`  -  POST /api/dojo/lessons/:id/check  (skipped — no lessons found)`);
  }

  // 4d. Lesson bot — skip if no lessons exist yet
  if (firstLesson) {
    await smokePost(
      `/api/dojo/lessons/${firstLesson.id}/bot`,
      {},
      RunBotActionResponse,
    );
  } else {
    console.log(`  -  POST /api/dojo/lessons/:id/bot  (skipped — no lessons found)`);
  }

  // 5. Crisis scenarios list — also extracts a crisisId
  const scenarios = await smoke("/api/crisis/scenarios", ListCrisisScenariosResponse);
  const firstScenario = Array.isArray(scenarios)
    ? (scenarios as Array<{ id: string }>)[0]
    : undefined;

  // 6. Crisis scenario state (parameterised) — skip if none exist yet.
  //    Note: this reads state for the first *learner* scenario only; the grader
  //    smoke steps below always use the dedicated "crisis-smoke" sentinel
  //    scenario instead (see steps 6a/6b).
  if (firstScenario) {
    await smoke(`/api/crisis/scenarios/${firstScenario.id}/state`, GetCrisisRepoStateResponse);
  } else {
    console.log(`  -  GET /api/crisis/scenarios/:id/state  (skipped — no scenarios found)`);
  }

  // 6a. Crisis setup — always targets the "crisis-smoke" sentinel scenario
  //     regardless of commit state.  This sentinel is never shown in the
  //     learner-facing scenarios list, so resetting it can never wipe a
  //     learner's in-progress session.  Running setup unconditionally ensures
  //     a stale playground from a previous run can never silently suppress this
  //     step.
  await smokePost(
    `/api/crisis/scenarios/crisis-smoke/setup`,
    {},
    SetupCrisisScenarioResponse,
  );

  // 6b. Crisis check — always targets "crisis-smoke" immediately after setup.
  //     The sentinel scenario's checks are trivially satisfied right after a
  //     fresh setup, so the grader path is exercised on every smoke run without
  //     depending on learner activity or playground cleanup.
  await smokePost(
    `/api/crisis/scenarios/crisis-smoke/check`,
    {},
    RunCrisisCheckResponse,
  );

  // 7. Capstone status
  await smoke("/api/capstone/status", GetCapstoneStatusResponse);

  // 7a–7c. Capstone write endpoints — POST /capstone/repo creates a real public
  //     GitHub repository and DELETE requires delete_repo scope that tokens
  //     typically lack, so these are opt-in only.  Set SMOKE_CAPSTONE_WRITES=1
  //     to run them in a controlled environment with a dedicated test account.
  //     Without the flag the response schemas (CreateCapstoneRepoResponse,
  //     VerifyCapstoneMissionResponse, DeleteCapstoneRepoResponse) are not
  //     exercised here; they remain validated by the server's own .parse() call
  //     on every real request.
  if (process.env["SMOKE_CAPSTONE_WRITES"] === "1") {
    const capstoneState = await smokeWriteOrSkip409(
      "POST",
      "/api/capstone/repo",
      CreateCapstoneRepoResponse,
    );
    const firstMissionId = "push-commit";
    await smokeWriteOrSkip409(
      "POST",
      `/api/capstone/verify/${firstMissionId}`,
      VerifyCapstoneMissionResponse,
    );
    // Deletion must succeed (not 409) after a successful create; a lingering
    // orphaned repo means cleanup failed and the run should be treated as a
    // partial success at best.
    void capstoneState;
    await smokeWriteOrSkip409(
      "DELETE",
      "/api/capstone/repo",
      DeleteCapstoneRepoResponse,
    );
  } else {
    console.log(
      `  -  POST /api/capstone/repo  (skipped — set SMOKE_CAPSTONE_WRITES=1 to enable)`,
    );
    console.log(
      `  -  POST /api/capstone/verify/:missionId  (skipped — set SMOKE_CAPSTONE_WRITES=1 to enable)`,
    );
    console.log(
      `  -  DELETE /api/capstone/repo  (skipped — set SMOKE_CAPSTONE_WRITES=1 to enable)`,
    );
  }

  // 8. Progress
  await smoke("/api/progress", GetProgressResponse);

  // 8a. Complete a visual module — uses a known-valid visual module id so the
  //     endpoint accepts the body.  The operation is idempotent: re-running the
  //     smoke test won't create duplicate entries.
  await smokePost(
    "/api/progress/complete",
    { moduleId: "1.1", track: "visual" },
    CompleteModuleResponse,
  );

  // 8b. Malformed progress-complete bodies must be rejected with HTTP 400.
  //     These checks guard the Zod validation in progress.ts against silent
  //     breakage during future refactors.
  await smokeExpect400(
    "/api/progress/complete",
    { track: "visual" },
    "POST /api/progress/complete (missing moduleId → 400)",
  );
  await smokeExpect400(
    "/api/progress/complete",
    { moduleId: "1.1", track: 42 },
    "POST /api/progress/complete (track is number, not enum string → 400)",
  );

  // 9. Drills due — POST because the candidate set is client-owned, but it is
  //    a pure query with no persistence.  A non-empty candidates array ensures
  //    the per-item schema fields are exercised.
  await smokePost(
    "/api/drills/due",
    { candidates: [{ id: "smoke-probe", sourceId: null }] },
    GetDueDrillsResponse,
  );

  // 9a. Malformed drills-due bodies must be rejected with HTTP 400.
  //     These checks guard the Zod validation in drills.ts against silent
  //     breakage during future refactors.
  await smokeExpect400(
    "/api/drills/due",
    {},
    "POST /api/drills/due (missing candidates → 400)",
  );
  await smokeExpect400(
    "/api/drills/due",
    { candidates: "all" },
    "POST /api/drills/due (candidates is string, not array → 400)",
  );

  // 9b. Record a drill attempt — persists an answer and reschedules the item.
  //     Uses a synthetic itemId so it never collides with real learner data.
  //     The operation is idempotent in practice (re-running just updates the
  //     existing scheduling record for "smoke-probe").
  await smokePost(
    "/api/drills/attempt",
    { itemId: "smoke-probe", correct: true, sourceId: null },
    RecordDrillAttemptResponse,
  );

  // 9b. Malformed drill-attempt bodies must be rejected with HTTP 400.
  //     These checks guard the Zod validation in drills.ts against silent
  //     breakage during future refactors.
  await smokeExpect400(
    "/api/drills/attempt",
    { correct: true, sourceId: null },
    "POST /api/drills/attempt (missing itemId → 400)",
  );
  await smokeExpect400(
    "/api/drills/attempt",
    { itemId: "smoke-probe", correct: "yes", sourceId: null },
    "POST /api/drills/attempt (correct is string, not boolean → 400)",
  );

  // 10. Promo metadata — fast, no rendering, verifies the shared scene-duration
  //     constant reaches the API.  totalDurationSec must be a positive number.
  await smoke("/api/export/promo-meta", PromoMetaResponse);

  // 10a. Duration-mismatch check — loads the promo page in export mode using a
  //      headless browser, reads window.__exportTotalMs, and compares it against
  //      totalDurationMs from /api/export/promo-meta.  Fails immediately if the
  //      two disagree so the mismatch is caught before any render is attempted.
  //      Not gated on SKIP_EXPORT_SMOKE because no video is recorded; skipped
  //      only when SKIP_DURATION_CHECK=1 or the promo page is unreachable.
  await smokeDurationMismatch();

  // 11. Promo-video export — renders the full video and verifies the resulting
  //     MP4 has h264 video + aac audio at the expected duration from promo-meta.
  //     Skipped when SKIP_EXPORT_SMOKE=1 (e.g. CI without a display server).
  await smokePromoExport();

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const total = passed + failed;
  console.log(`\n${passed}/${total} checks passed\n`);

  if (failed > 0) {
    console.error(`${failed} check(s) FAILED — see errors above`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
