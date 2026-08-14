import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Single-user v1 persistence: a JSON file inside the workspace (survives
 * checkpoints and restarts). If this app ever opens up to multiple learners,
 * replace this with a real database keyed by user — the API shape does not
 * need to change.
 */
const DATA_DIR = path.resolve(process.cwd(), "..", "..", "data");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

export interface ProgressEntry {
  moduleId: string;
  track: "visual" | "cli" | "live";
  completedAt: string;
}

export function loadEntries(): ProgressEntry[] {
  try {
    if (!existsSync(PROGRESS_FILE)) return [];
    const raw = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    return Array.isArray(raw.entries) ? raw.entries : [];
  } catch {
    return [];
  }
}

/** Records a completion (idempotent). Returns the full entry list. */
export function recordCompletion(
  moduleId: string,
  track: "visual" | "cli" | "live",
): ProgressEntry[] {
  const entries = loadEntries();
  if (!entries.some((e) => e.moduleId === moduleId && e.track === track)) {
    entries.push({ moduleId, track, completedAt: new Date().toISOString() });
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(PROGRESS_FILE, JSON.stringify({ entries }, null, 2));
  }
  return entries;
}
