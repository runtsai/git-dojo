/**
 * api-smoke.ts — hits every read-only API endpoint and validates the response
 * body against the generated Zod schema.  Fails loudly on non-2xx or parse
 * errors so schema mismatches that only surface at runtime are caught early.
 *
 * Usage:
 *   API_URL=http://localhost:5000 tsx scripts/src/api-smoke.ts
 *
 * API_URL defaults to http://localhost:${PORT} where PORT defaults to 5000.
 */
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
