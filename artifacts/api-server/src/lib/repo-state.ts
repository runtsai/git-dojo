import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import path from "node:path";

const run = promisify(execFile);

/** Run git in a repo dir; returns stdout or null on failure. */
export async function git(cwd: string, args: string[]): Promise<string | null> {
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

export function isRepo(dir: string): boolean {
  return existsSync(path.join(dir, ".git"));
}

export async function commitCount(dir: string): Promise<number> {
  const out = await git(dir, ["rev-list", "--count", "--all"]);
  return out ? Number(out.trim()) || 0 : 0;
}

export type FileStatus =
  | "staged"
  | "modified"
  | "staged_and_modified"
  | "untracked"
  | "deleted"
  | "conflicted";

export function mapStatus(xy: string): FileStatus {
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

export interface RepoCommitInfo {
  hash: string;
  shortHash: string;
  subject: string;
  authorName: string;
  date: string;
  refs: string[];
  parents: string[];
}

export interface SyncStatusInfo {
  remoteBranch: string;
  ahead: number;
  behind: number;
}

export interface RepoStateData {
  hasPlayground: boolean;
  initialized: boolean;
  currentBranch: string | null;
  detachedHead: boolean;
  mergeInProgress: boolean;
  files: { path: string; status: FileStatus }[];
  commits: RepoCommitInfo[];
  branches: { name: string; isCurrent: boolean; headHash: string }[];
  remotes: string[];
  remoteBranches: { name: string; headHash: string }[];
  syncStatus: SyncStatusInfo | null;
  repoFolder: string | null;
}

/** Read the full git state of a practice repository directory. */
export async function readRepoState(pg: string): Promise<RepoStateData> {
  const hasPlayground = existsSync(pg);
  const initialized = hasPlayground && isRepo(pg);

  let currentBranch: string | null = null;
  let detachedHead = false;
  let mergeInProgress = false;
  let files: { path: string; status: FileStatus }[] = [];
  let commits: RepoCommitInfo[] = [];
  let branches: { name: string; isCurrent: boolean; headHash: string }[] = [];
  let remotes: string[] = [];
  let remoteBranches: { name: string; headHash: string }[] = [];
  let syncStatus: SyncStatusInfo | null = null;

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
    // --all walks refs only; include HEAD explicitly so a detached commit
    // reachable from nowhere else (e.g. crisis-01) still shows up.
    const headResolves = !!(await git(pg, ["rev-parse", "-q", "--verify", "HEAD"]));
    const log = await git(pg, [
      "log",
      "--all",
      ...(headResolves ? ["HEAD"] : []),
      "-n",
      "100",
      "--date-order",
      `--format=%H${SEP}%h${SEP}%s${SEP}%an${SEP}%aI${SEP}%P${SEP}%D${REC}`,
    ]);
    if (log) {
      commits = log
        .split(REC)
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r) => {
          const [hash = "", shortHash = "", subject = "", authorName = "", date = "", parents = "", refs = ""] =
            r.split(SEP);
          return {
            hash,
            shortHash,
            subject,
            authorName,
            date,
            parents: parents.split(" ").filter(Boolean),
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

    const remoteRefOut = await git(pg, [
      "for-each-ref",
      "refs/remotes",
      "--format=%(refname:short) %(objectname)",
    ]);
    if (remoteRefOut) {
      remoteBranches = remoteRefOut
        .split("\n")
        .filter(Boolean)
        .filter((line) => !line.split(" ")[0]?.endsWith("/HEAD"))
        .map((line) => {
          const idx = line.lastIndexOf(" ");
          return { name: line.slice(0, idx), headHash: line.slice(idx + 1) };
        });
    }

    // Ahead/behind for the current branch vs its remote counterpart:
    // prefer the configured upstream, fall back to <remote>/<branch>.
    if (currentBranch && !detachedHead && remoteBranches.length > 0) {
      let remoteBranch: string | null = null;
      const upstream = await git(pg, [
        "rev-parse",
        "--abbrev-ref",
        "--symbolic-full-name",
        `${currentBranch}@{upstream}`,
      ]);
      if (upstream && upstream.trim()) remoteBranch = upstream.trim();
      else {
        const candidate = remoteBranches.find((rb) => {
          const slash = rb.name.indexOf("/");
          return slash > 0 && rb.name.slice(slash + 1) === currentBranch;
        });
        if (candidate) remoteBranch = candidate.name;
      }
      if (remoteBranch) {
        const counts = await git(pg, [
          "rev-list",
          "--left-right",
          "--count",
          `${currentBranch}...${remoteBranch}`,
        ]);
        if (counts) {
          const [ahead = "0", behind = "0"] = counts.trim().split(/\s+/);
          syncStatus = { remoteBranch, ahead: Number(ahead) || 0, behind: Number(behind) || 0 };
        }
      }
    }
  }

  return {
    hasPlayground,
    initialized,
    currentBranch,
    detachedHead,
    mergeInProgress,
    files,
    commits,
    branches,
    remotes,
    remoteBranches,
    syncStatus,
    repoFolder: null,
  };
}

// ---------------------------------------------------------------------------
// Diff reading: what a commit (or the working copy) actually changed.
// ---------------------------------------------------------------------------

export type DiffLineKind = "added" | "removed" | "context" | "hunk";
export type FileChangeKind = "added" | "modified" | "deleted" | "renamed" | "binary";

export interface DiffLineData {
  kind: DiffLineKind;
  text: string;
}

export interface FileDiffData {
  path: string;
  changeKind: FileChangeKind;
  renamedFrom: string | null;
  added: number;
  removed: number;
  truncated: boolean;
  lines: DiffLineData[];
}

const MAX_LINES_PER_FILE = 400;

function unquoteGitPath(p: string): string {
  if (p.startsWith('"') && p.endsWith('"')) {
    try {
      return JSON.parse(p) as string;
    } catch {
      return p.slice(1, -1);
    }
  }
  return p;
}

/** Parse `git diff` / `git show --patch` unified output into structured file diffs. */
export function parseUnifiedDiff(text: string): FileDiffData[] {
  const files: FileDiffData[] = [];
  let cur: FileDiffData | null = null;
  let inHunk = false;

  const push = () => {
    if (cur) files.push(cur);
    cur = null;
  };

  for (const raw of text.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      push();
      inHunk = false;
      cur = {
        path: "",
        changeKind: "modified",
        renamedFrom: null,
        added: 0,
        removed: 0,
        truncated: false,
        lines: [],
      };
      continue;
    }
    if (!cur) continue;

    if (!inHunk) {
      if (raw.startsWith("new file mode")) cur.changeKind = "added";
      else if (raw.startsWith("deleted file mode")) cur.changeKind = "deleted";
      else if (raw.startsWith("rename from ")) {
        cur.changeKind = "renamed";
        cur.renamedFrom = unquoteGitPath(raw.slice("rename from ".length));
      } else if (raw.startsWith("rename to ")) {
        cur.path = unquoteGitPath(raw.slice("rename to ".length));
      } else if (raw.startsWith("Binary files ")) {
        cur.changeKind = "binary";
        if (!cur.path) {
          const m = /^Binary files (?:a\/)?(.*?) and (?:b\/)?(.*?) differ$/.exec(raw);
          if (m) cur.path = unquoteGitPath(m[2] === "/dev/null" ? m[1]! : m[2]!);
        }
      } else if (raw.startsWith("--- ")) {
        const p = unquoteGitPath(raw.slice(4).trim());
        if (p !== "/dev/null" && !cur.path) cur.path = p.replace(/^a\//, "");
      } else if (raw.startsWith("+++ ")) {
        const p = unquoteGitPath(raw.slice(4).trim());
        if (p !== "/dev/null") cur.path = p.replace(/^b\//, "");
      }
    }

    if (raw.startsWith("@@")) {
      inHunk = true;
      if (cur.lines.length < MAX_LINES_PER_FILE) {
        cur.lines.push({ kind: "hunk", text: raw.replace(/^@@[^@]*@@ ?/, "").trim() });
      } else cur.truncated = true;
      continue;
    }
    if (!inHunk) continue;

    if (raw.startsWith("+")) {
      cur.added += 1;
      if (cur.lines.length < MAX_LINES_PER_FILE) cur.lines.push({ kind: "added", text: raw.slice(1) });
      else cur.truncated = true;
    } else if (raw.startsWith("-")) {
      cur.removed += 1;
      if (cur.lines.length < MAX_LINES_PER_FILE) cur.lines.push({ kind: "removed", text: raw.slice(1) });
      else cur.truncated = true;
    } else if (raw.startsWith(" ")) {
      if (cur.lines.length < MAX_LINES_PER_FILE) cur.lines.push({ kind: "context", text: raw.slice(1) });
      else cur.truncated = true;
    } else if (raw === "\\ No newline at end of file") {
      // skip marker
    } else if (raw.startsWith("diff ") || raw === "") {
      inHunk = false;
    }
  }
  push();
  return files.filter((f) => f.path !== "");
}

export const COMMIT_HASH_RE = /^[0-9a-f]{4,40}$/i;

export interface CommitDiffData {
  hash: string;
  shortHash: string;
  subject: string;
  authorName: string;
  date: string;
  isMerge: boolean;
  summary: string;
  files: FileDiffData[];
}

function plural(n: number, one: string): string {
  return `${n} ${n === 1 ? one : one + "s"}`;
}

/** Read what one sealed snapshot changed. Returns null when the commit doesn't exist. */
export async function readCommitDiff(dir: string, hash: string): Promise<CommitDiffData | null> {
  if (!COMMIT_HASH_RE.test(hash)) return null;
  const SEP = "\x1f";
  const REC = "\x1e";
  const meta = await git(dir, [
    "show",
    "--no-patch",
    `--format=%H${SEP}%h${SEP}%s${SEP}%an${SEP}%aI${SEP}%P`,
    hash,
    "--",
  ]);
  if (!meta) return null;
  const [full = "", shortHash = "", subject = "", authorName = "", date = "", parentsRaw = ""] = meta
    .trim()
    .split(SEP);
  const parents = parentsRaw.split(" ").filter(Boolean);
  const isMerge = parents.length > 1;

  // For merges, diff against the first parent so learners see what the merge
  // brought onto their timeline instead of git's combined-diff shorthand.
  const patch = isMerge
    ? await git(dir, ["diff", "--no-color", `${full}^1`, full, "--"])
    : await git(dir, ["show", "--no-color", "--format=%x1e", "--patch", full, "--"]);
  const files = parseUnifiedDiff((patch ?? "").replace(REC, ""));

  const totalAdded = files.reduce((s, f) => s + f.added, 0);
  const totalRemoved = files.reduce((s, f) => s + f.removed, 0);
  let summary: string;
  if (files.length === 0) {
    summary = isMerge
      ? "This merge joined two timelines without changing any file beyond what its parents already had."
      : "This snapshot sealed no file changes — an empty commit.";
  } else {
    const head = isMerge
      ? `This merge brought changes to ${plural(files.length, "file")} onto your timeline`
      : `This snapshot sealed changes to ${plural(files.length, "file")}`;
    summary = `${head}: ${plural(totalAdded, "line")} added, ${totalRemoved} removed.`;
  }
  return { hash: full, shortHash, subject, authorName, date, isMerge, summary, files };
}

export interface WorkingFileDiffData {
  path: string;
  status: FileStatus;
  summary: string;
  staged: FileDiffData | null;
  unstaged: FileDiffData | null;
}

/**
 * Read how one working-copy file differs from the last snapshot, split by
 * staged vs unstaged. The path must be one the repo status reports — callers
 * pass user input, so this is the safety gate (no shell involved either way;
 * git is always invoked via execFile with an argument array and a `--` guard).
 */
export async function readWorkingFileDiff(
  dir: string,
  filePath: string,
): Promise<WorkingFileDiffData | null> {
  const state = await readRepoState(dir);
  const entry = state.files.find((f) => f.path === filePath);
  if (!entry) return null;

  let staged: FileDiffData | null = null;
  let unstaged: FileDiffData | null = null;

  if (entry.status === "untracked") {
    // Untracked files have no snapshot to compare against; show the whole
    // file as new. --no-index diffs against /dev/null but exits non-zero,
    // so read via git's own machinery with intent-to-add semantics avoided:
    const abs = path.resolve(dir, filePath);
    if (!abs.startsWith(path.resolve(dir) + path.sep)) return null;
    const { readFileSync, lstatSync, realpathSync } = await import("node:fs");
    try {
      // Never follow symlinks: an untracked symlink pointing outside the
      // playground must not leak the target file's contents. Reject links
      // immediately and re-check containment on the canonical (realpath)
      // location for regular files.
      const lst = lstatSync(abs);
      if (lst.isSymbolicLink()) return null;
      const realDir = realpathSync(dir);
      if (
        lst.isFile() &&
        realpathSync(abs).startsWith(realDir + path.sep) &&
        lst.size <= 256 * 1024
      ) {
        const content = readFileSync(abs, "utf8");
        const lines = content.split("\n");
        if (lines[lines.length - 1] === "") lines.pop();
        const truncated = lines.length > MAX_LINES_PER_FILE;
        unstaged = {
          path: filePath,
          changeKind: "added",
          renamedFrom: null,
          added: lines.length,
          removed: 0,
          truncated,
          lines: lines.slice(0, MAX_LINES_PER_FILE).map((text) => ({ kind: "added" as const, text })),
        };
      }
    } catch {
      /* unreadable file: fall through with no diff */
    }
  } else {
    // Same symlink discipline for tracked paths: if the working-tree entry is
    // currently a symlink, refuse to diff it. git itself only diffs the link
    // target *string* (never the pointed-to file's contents), but rejecting
    // links outright keeps the guarantee independent of git's behavior.
    try {
      const { lstatSync } = await import("node:fs");
      if (lstatSync(path.resolve(dir, filePath)).isSymbolicLink()) return null;
    } catch {
      /* deleted file: nothing in the working tree to stat — diff is safe */
    }
    const [stagedOut, unstagedOut] = await Promise.all([
      git(dir, ["diff", "--no-color", "--cached", "--", filePath]),
      git(dir, ["diff", "--no-color", "--", filePath]),
    ]);
    staged = stagedOut ? (parseUnifiedDiff(stagedOut)[0] ?? null) : null;
    unstaged = unstagedOut ? (parseUnifiedDiff(unstagedOut)[0] ?? null) : null;
  }

  const parts: string[] = [];
  if (entry.status === "untracked")
    parts.push(
      unstaged
        ? `${filePath} is brand new on the Workbench — ${plural(unstaged.added, "line")}, none of it in the record system yet.`
        : `${filePath} is untracked and couldn't be read as text.`,
    );
  else {
    if (staged && (staged.added > 0 || staged.removed > 0 || staged.changeKind !== "modified"))
      parts.push(
        `${plural(staged.added, "line")} added and ${staged.removed} removed are boxed on the Loading Dock, ready to seal.`,
      );
    if (unstaged && (unstaged.added > 0 || unstaged.removed > 0 || unstaged.changeKind !== "modified"))
      parts.push(
        `${plural(unstaged.added, "line")} added and ${unstaged.removed} removed are still on the Workbench — not staged yet.`,
      );
    if (parts.length === 0) parts.push(`${filePath} matches the last snapshot line-for-line.`);
  }

  return { path: filePath, status: entry.status, summary: parts.join(" "), staged, unstaged };
}

export function buildSummary(state: RepoStateData): string {
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
