import { Router, type IRouter } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  GetDojoOverviewResponse,
  ListLessonsResponse,
  GetRepoStateResponse,
  RunLessonCheckResponse,
  RunBotActionResponse,
} from "@workspace/api-zod";
import { recordCompletion } from "../lib/progress-store";
import { recordGraderResult } from "../lib/drill-store";
import { readRepoState, buildSummary, isRepo, commitCount } from "../lib/repo-state";

const run = promisify(execFile);

const router: IRouter = Router();

/**
 * The active dojo copy lives OUTSIDE the workspace (Replit's checkpoint
 * system strips nested .git dirs inside the workspace). Fall back to the
 * workspace copy only for listing lesson folders.
 */
export function dojoRoot(): string | null {
  const home = path.join(os.homedir(), "git-dojo");
  if (existsSync(home)) return home;
  const ws = path.join(process.cwd(), "..", "..", "git-dojo");
  if (existsSync(ws)) return path.resolve(ws);
  const wsAbs = "/home/runner/workspace/git-dojo";
  if (existsSync(wsAbs)) return wsAbs;
  return null;
}

const LESSON_DIR_RE = /^lesson-(\d{2})-(.+)$/;

interface LessonDir {
  id: string; // lesson-01
  number: number;
  title: string;
  folderName: string;
}

function listLessonDirs(root: string): LessonDir[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => LESSON_DIR_RE.exec(d.name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({
      id: `lesson-${m[1]}`,
      number: Number(m[1]),
      title: m[2]!
        .split("-")
        .join(" ")
        .replace(/^./, (c) => c.toUpperCase()),
      folderName: m[0],
    }))
    .sort((a, b) => a.number - b.number);
}

function playgroundDir(root: string, lessonId: string): string {
  return path.join(root, "playground", lessonId);
}

/**
 * Hub-style lessons (fake GitHub) keep the learner's working copy in a
 * `laptop/` subfolder next to the bare remote. Resolve whichever exists.
 */
function resolveRepoDir(pg: string): string | null {
  if (isRepo(pg)) return pg;
  const laptop = path.join(pg, "laptop");
  if (isRepo(laptop)) return laptop;
  return null;
}

router.get("/dojo/overview", async (_req, res) => {
  const root = dojoRoot();
  if (!root) {
    res.json(
      GetDojoOverviewResponse.parse({
        totalLessons: 0,
        startedLessons: 0,
        totalCommits: 0,
        dojoFound: false,
      }),
    );
    return;
  }
  const lessons = listLessonDirs(root);
  let started = 0;
  let commits = 0;
  for (const l of lessons) {
    const pg = playgroundDir(root, l.id);
    if (existsSync(pg)) {
      started += 1;
      const rd = resolveRepoDir(pg);
      if (rd) commits += await commitCount(rd);
    }
  }
  res.json(
    GetDojoOverviewResponse.parse({
      totalLessons: lessons.length,
      startedLessons: started,
      totalCommits: commits,
      dojoFound: true,
    }),
  );
});

router.get("/dojo/lessons", async (_req, res) => {
  const root = dojoRoot();
  if (!root) {
    res.json(ListLessonsResponse.parse([]));
    return;
  }
  const lessons = await Promise.all(
    listLessonDirs(root).map(async (l) => {
      const pg = playgroundDir(root, l.id);
      const hasPlayground = existsSync(pg);
      const rd = hasPlayground ? resolveRepoDir(pg) : null;
      return {
        ...l,
        hasPlayground,
        initialized: rd !== null,
        commitCount: rd ? await commitCount(rd) : 0,
        hasBot: existsSync(path.join(root, l.folderName, "bot.sh")),
      };
    }),
  );
  res.json(ListLessonsResponse.parse(lessons));
});

router.get("/dojo/lessons/:lessonId/state", async (req, res) => {
  const root = dojoRoot();
  const lessonId = req.params.lessonId ?? "";
  const lesson = root ? listLessonDirs(root).find((l) => l.id === lessonId) : undefined;
  if (!root || !lesson) {
    res.status(404).json({ error: `Lesson not found: ${lessonId}` });
    return;
  }
  const pgRoot = playgroundDir(root, lesson.id);
  const repoDir = existsSync(pgRoot) ? resolveRepoDir(pgRoot) : null;
  const state = await readRepoState(repoDir ?? pgRoot);
  res.json(
    GetRepoStateResponse.parse({
      lessonId: lesson.id,
      hasBot: existsSync(path.join(root, lesson.folderName, "bot.sh")),
      ...state,
      repoFolder: repoDir && repoDir !== pgRoot ? path.basename(repoDir) : null,
      summary: buildSummary(state),
    }),
  );
});

router.post("/dojo/lessons/:lessonId/check", async (req, res) => {
  const root = dojoRoot();
  const lessonId = req.params.lessonId ?? "";
  const lesson = root ? listLessonDirs(root).find((l) => l.id === lessonId) : undefined;
  if (!root || !lesson) {
    res.status(404).json({ error: `Lesson not found: ${lessonId}` });
    return;
  }
  const lessonFolder = path.join(root, lesson.folderName);
  const checkScript = path.join(lessonFolder, "check.sh");
  if (!existsSync(checkScript)) {
    res.json(
      RunLessonCheckResponse.parse({
        ran: false,
        passed: null,
        output: "This lesson has no check script.",
      }),
    );
    return;
  }
  let output = "";
  let exitOk = true;
  try {
    const { stdout, stderr } = await run("bash", ["check.sh"], {
      cwd: lessonFolder,
      timeout: 20_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    output = [stdout, stderr].filter(Boolean).join("\n").trim();
  } catch (err) {
    exitOk = false;
    const e = err as { stdout?: string; stderr?: string; message?: string };
    output = [e.stdout, e.stderr].filter(Boolean).join("\n").trim() || (e.message ?? "check.sh failed");
  }
  const hasFail = /\bFAIL\b/.test(output);
  const hasPass = /\bPASS\b/.test(output);
  const passed = hasFail ? false : hasPass ? exitOk : exitOk ? null : false;
  // Every graded run feeds friction metrics so warm-up drills can target
  // the lessons the learner actually struggles with.
  if (passed !== null) recordGraderResult(lesson.id, passed);
  // Track B badge is granted here, server-side, only on a genuine grader pass.
  if (passed === true) recordCompletion(lesson.id, "cli");
  res.json(RunLessonCheckResponse.parse({ ran: true, passed, output }));
});

/**
 * "Time passes" — run the lesson's scripted teammate beat. The bot commits to
 * the lesson's bare remote (never the learner's working copy), so the learner
 * genuinely must fetch/merge before their next push succeeds.
 */
router.post("/dojo/lessons/:lessonId/bot", async (req, res) => {
  const root = dojoRoot();
  const lessonId = req.params.lessonId ?? "";
  const lesson = root ? listLessonDirs(root).find((l) => l.id === lessonId) : undefined;
  if (!root || !lesson) {
    res.status(404).json({ error: `Lesson not found: ${lessonId}` });
    return;
  }
  const lessonFolder = path.join(root, lesson.folderName);
  const botScript = path.join(lessonFolder, "bot.sh");
  if (!existsSync(botScript)) {
    res.json(
      RunBotActionResponse.parse({
        ran: false,
        output: "This lesson has no simulated teammate.",
      }),
    );
    return;
  }
  let output = "";
  let ran = true;
  try {
    const { stdout, stderr } = await run("bash", ["bot.sh"], {
      cwd: lessonFolder,
      timeout: 20_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    output = [stdout, stderr].filter(Boolean).join("\n").trim();
  } catch (err) {
    ran = false;
    const e = err as { stdout?: string; stderr?: string; message?: string };
    output = [e.stdout, e.stderr].filter(Boolean).join("\n").trim() || (e.message ?? "bot.sh failed");
  }
  res.json(RunBotActionResponse.parse({ ran, output }));
});

export default router;
