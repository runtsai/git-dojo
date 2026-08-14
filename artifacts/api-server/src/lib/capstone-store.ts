import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Single-user capstone state, persisted alongside progress.json. Records the
 * real GitHub practice repo Dojo created and which missions have been
 * verified against the live GitHub API. Nothing here is client-attested:
 * verifiedAt timestamps are written only by the server after a live check.
 */
const DATA_DIR = path.resolve(process.cwd(), "..", "..", "data");
const CAPSTONE_FILE = path.join(DATA_DIR, "capstone.json");

export const MISSIONS = [
  { id: "push-commit", title: "Push a real commit" },
  { id: "create-branch", title: "Create and push a branch" },
  { id: "merge-pr", title: "Merge the pull request" },
] as const;

export type MissionId = (typeof MISSIONS)[number]["id"];

export interface CapstoneState {
  owner: string;
  /** GitHub's immutable numeric repository id, captured at creation. */
  repoId: number;
  repoName: string;
  repoFullName: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  prNumber: number | null;
  prUrl: string | null;
  prBranch: string | null;
  /** Commit shas Dojo itself created while seeding — excluded from "your commit" checks. */
  seedShas: string[];
  missionsVerifiedAt: Partial<Record<MissionId, string>>;
  badgeEarnedAt: string | null;
  /** Ownership marker: true only for repos this server itself created. */
  createdByDojo: boolean;
  createdAt: string;
}

export function loadCapstone(): CapstoneState | null {
  try {
    if (!existsSync(CAPSTONE_FILE)) return null;
    return JSON.parse(readFileSync(CAPSTONE_FILE, "utf-8")) as CapstoneState;
  } catch {
    return null;
  }
}

export function saveCapstone(state: CapstoneState): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CAPSTONE_FILE, JSON.stringify(state, null, 2));
}

export function clearCapstone(): void {
  try {
    rmSync(CAPSTONE_FILE, { force: true });
  } catch {
    /* nothing to clear */
  }
}
