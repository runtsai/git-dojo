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
} from "@workspace/api-zod";

const run = promisify(execFile);

const router: IRouter = Router();

/**
 * The active dojo copy lives OUTSIDE the workspace (Replit's checkpoint
 * system strips nested .git dirs inside the workspace). Fall back to the
 * workspace copy only for listing lesson folders.
 */
function dojoRoot(): string | null {
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

/** Run git in a repo dir; returns stdout or null on failure. */
async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run("git", args, {
      cwd,
      timeout: 10_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return stdout;
  } catch {
    return null;
  }
}

function isRepo(dir: string): boolean {
  return existsSync(path.join(dir, ".git"));
}

async function commitCount(dir: string): Promise<number> {
  const out = await git(dir, ["rev-list", "--count", "--all"]);
  return out ? Number(out.trim()) || 0 : 0;
}

type FileStatus =
  | "staged"
  | "modified"
  | "staged_and_modified"
  | "untracked"
  | "deleted"
  | "conflicted";

function mapStatus(xy: string): FileStatus {
  const x = xy[0]!;
  const y = xy[1]!;
  if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D"))
    return "conflicted";
  if (xy === "??") return "untracked";
  if (x === "D" || y === "D") return "deleted";
  const stagedPart = x !== " " && x !== "?";
  const unstagedPart = y !== " " && y !== "?";
  if (stagedPart && unstagedPart) return "staged_and_modified";
  if (stagedPart) return "staged";
  return "modified";
}

function buildSummary(state: {
  hasPlayground: boolean;
  initialized: boolean;
  currentBranch: string | null;
  detachedHead: boolean;
  mergeInProgress: boolean;
  files: { path: string; status: FileStatus }[];
  commits: unknown[];
  branches: unknown[];
}): string {
  if (!state.hasPlayground)
    return "This lesson's practice folder doesn't exist yet. Run the lesson's setup.sh to create it.";
  if (!state.initialized)
    return "The practice folder exists but isn't a repository yet. Run git init inside it to give it a memory.";
  const parts: string[] = [];
  if (state.mergeInProgress)
    parts.push(
      "A merge is in progress with a conflict Git needs you to resolve — Git has failed closed and is waiting for your ruling.",
    );
  if (state.detachedHead)
    parts.push("You're not on any branch right now (detached HEAD) — you're inspecting an old snapshot.");
  else if (state.currentBranch) parts.push(`You're on the ${state.currentBranch} branch.`);
  if (state.commits.length === 0)
    parts.push("No commits yet — nothing has been sealed into the record.");
  else
    parts.push(
      `${state.commits.length} commit${state.commits.length === 1 ? "" : "s"} sealed in the record.`,
    );
  const staged = state.files.filter(
    (f) => f.status === "staged" || f.status === "staged_and_modified",
  ).length;
  const modified = state.files.filter(
    (f) => f.status === "modified" || f.status === "staged_and_modified" || f.status === "deleted",
  ).length;
  const untracked = state.files.filter((f) => f.status === "untracked").length;
  const conflicted = state.files.filter((f) => f.status === "conflicted").length;
  if (conflicted > 0)
    parts.push(`${conflicted} file${conflicted === 1 ? " has" : "s have"} conflicts to resolve.`);
  if (staged > 0)
    parts.push(`${staged} file${staged === 1 ? " is" : "s are"} staged and ready to commit.`);
  if (modified > 0)
    parts.push(`${modified} file${modified === 1 ? " has" : "s have"} changes not yet staged.`);
  if (untracked > 0)
    parts.push(`${untracked} file${untracked === 1 ? " is" : "s are"} untracked — Git sees ${untracked === 1 ? "it" : "them"} but ${untracked === 1 ? "it isn't" : "they aren't"} in the record system yet.`);
  if (staged === 0 && modified === 0 && untracked === 0 && conflicted === 0 && state.commits.length > 0)
    parts.push("Working tree clean — everything in the folder matches the latest snapshot.");
  return parts.join(" ");
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
      if (isRepo(pg)) commits += await commitCount(pg);
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
      const initialized = hasPlayground && isRepo(pg);
      return {
        ...l,
        hasPlayground,
        initialized,
        commitCount: initialized ? await commitCount(pg) : 0,
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
  const pg = playgroundDir(root, lesson.id);
  const hasPlayground = existsSync(pg);
  const initialized = hasPlayground && isRepo(pg);

  let currentBranch: string | null = null;
  let detachedHead = false;
  let mergeInProgress = false;
  let files: { path: string; status: FileStatus }[] = [];
  let commits: {
    hash: string;
    shortHash: string;
    subject: string;
    authorName: string;
    date: string;
    refs: string[];
  }[] = [];
  let branches: { name: string; isCurrent: boolean; headHash: string }[] = [];
  let remotes: string[] = [];

  if (initialized) {
    const head = await git(pg, ["symbolic-ref", "--short", "-q", "HEAD"]);
    if (head && head.trim()) currentBranch = head.trim();
    else {
      const hasHead = await git(pg, ["rev-parse", "-q", "--verify", "HEAD"]);
      detachedHead = !!hasHead; // no symbolic ref but HEAD resolves => detached
      if (!hasHead) {
        // unborn branch (no commits yet): report the branch name from HEAD file
        const unborn = await git(pg, ["symbolic-ref", "--short", "HEAD"]);
        currentBranch = unborn ? unborn.trim() : null;
      }
    }
    mergeInProgress = existsSync(path.join(pg, ".git", "MERGE_HEAD"));

    const status = await git(pg, ["status", "--porcelain"]);
    if (status) {
      files = status
        .split("\n")
        .filter((line) => line.length > 3)
        .map((line) => ({
          status: mapStatus(line.slice(0, 2)),
          path: line.slice(3).replace(/^"|"$/g, ""),
        }));
    }

    const SEP = "\x1f";
    const REC = "\x1e";
    const log = await git(pg, [
      "log",
      "--all",
      "-n",
      "100",
      "--date-order",
      `--format=%H${SEP}%h${SEP}%s${SEP}%an${SEP}%aI${SEP}%D${REC}`,
    ]);
    if (log) {
      commits = log
        .split(REC)
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r) => {
          const [hash = "", shortHash = "", subject = "", authorName = "", date = "", refs = ""] =
            r.split(SEP);
          return {
            hash,
            shortHash,
            subject,
            authorName,
            date,
            refs: refs
              .split(",")
              .map((s) => s.trim().replace(/^HEAD -> /, ""))
              .filter((s) => s && s !== "HEAD"),
          };
        });
    }

    const refOut = await git(pg, [
      "for-each-ref",
      "refs/heads",
      "--format=%(refname:short) %(objectname)",
    ]);
    if (refOut) {
      branches = refOut
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const idx = line.lastIndexOf(" ");
          const name = line.slice(0, idx);
          return { name, isCurrent: name === currentBranch, headHash: line.slice(idx + 1) };
        });
    }

    const remoteOut = await git(pg, ["remote"]);
    if (remoteOut) remotes = remoteOut.split("\n").filter(Boolean);
  }

  const state = {
    lessonId: lesson.id,
    hasPlayground,
    initialized,
    currentBranch,
    detachedHead,
    mergeInProgress,
    files,
    commits,
    branches,
    remotes,
  };
  res.json(GetRepoStateResponse.parse({ ...state, summary: buildSummary(state) }));
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
  res.json(RunLessonCheckResponse.parse({ ran: true, passed, output }));
});

export default router;
