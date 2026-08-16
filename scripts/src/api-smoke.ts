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
import { execFile } from "node:child_process";
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
  ListCrisisScenariosResponse,
  GetCrisisRepoStateResponse,
  GetCapstoneStatusResponse,
  GetProgressResponse,
  CompleteModuleResponse,
  GetDueDrillsResponse,
  GetCommitDiffResponse,
  GetWorkingFileDiffResponse,
  RecordDrillAttemptResponse,
} from "@workspace/api-zod";
import type { ZodTypeAny, ZodIssue } from "zod";

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

/**
 * Expected total video duration from VideoTemplate.tsx SCENE_DURATIONS.
 * s0:4000 + s1:4500 + s2:4500 + s3:4000 + s4:4000 + s5:1500 = 22500 ms
 */
const EXPECTED_DURATION_SEC = 22.5;
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

  const url = `${BASE}/api/export/promo-video`;
  console.log(`  …  ${label}  (this takes ~30 s — rendering full video)`);

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
    const diff = Math.abs(duration - EXPECTED_DURATION_SEC);
    if (diff > DURATION_TOLERANCE_SEC) {
      fail(
        label,
        `Duration ${duration.toFixed(2)} s is outside expected ` +
          `${EXPECTED_DURATION_SEC} ± ${DURATION_TOLERANCE_SEC} s`,
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

  // 5. Crisis scenarios list — also extracts a crisisId
  const scenarios = await smoke("/api/crisis/scenarios", ListCrisisScenariosResponse);
  const firstScenario = Array.isArray(scenarios)
    ? (scenarios as Array<{ id: string }>)[0]
    : undefined;

  // 6. Crisis scenario state (parameterised) — skip if none exist yet
  if (firstScenario) {
    await smoke(`/api/crisis/scenarios/${firstScenario.id}/state`, GetCrisisRepoStateResponse);
  } else {
    console.log(`  -  GET /api/crisis/scenarios/:id/state  (skipped — no scenarios found)`);
  }

  // 7. Capstone status
  await smoke("/api/capstone/status", GetCapstoneStatusResponse);

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

  // 9. Drills due — POST because the candidate set is client-owned, but it is
  //    a pure query with no persistence.  A non-empty candidates array ensures
  //    the per-item schema fields are exercised.
  await smokePost(
    "/api/drills/due",
    { candidates: [{ id: "smoke-probe", sourceId: null }] },
    GetDueDrillsResponse,
  );

  // 9a. Record a drill attempt — persists an answer and reschedules the item.
  //     Uses a synthetic itemId so it never collides with real learner data.
  //     The operation is idempotent in practice (re-running just updates the
  //     existing scheduling record for "smoke-probe").
  await smokePost(
    "/api/drills/attempt",
    { itemId: "smoke-probe", correct: true, sourceId: null },
    RecordDrillAttemptResponse,
  );

  // 10. Promo-video export — renders the full video and verifies the resulting
  //     MP4 has h264 video + aac audio at the expected ~22.5 s duration.
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
