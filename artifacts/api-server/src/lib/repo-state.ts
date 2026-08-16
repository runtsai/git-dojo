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
