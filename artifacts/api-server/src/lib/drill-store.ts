import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Single-user JSON persistence for the warm-up drill system, alongside
 * progress.json. Two concerns live here:
 *
 * 1. Per-item attempt history + a light spaced-repetition schedule
 *    (correct -> longer interval, wrong -> due again soon).
 * 2. Grader friction: how often the learner fails/retries each lesson or
 *    crisis grader. Friction on an item's source raises its drill priority,
 *    so review targets genuine weak spots instead of random items.
 */
const DATA_DIR = path.resolve(process.cwd(), "..", "..", "data");
const DRILLS_FILE = path.join(DATA_DIR, "drills.json");

interface DrillAttempt {
  at: string; // ISO 8601
  correct: boolean;
}

interface DrillItemRecord {
  attempts: DrillAttempt[];
  /** Index into INTERVALS_MS; grows on correct answers, resets when wrong. */
  intervalIndex: number;
  dueAt: string | null;
}

interface FrictionRecord {
  failures: number;
  passes: number;
}

interface DrillData {
  items: Record<string, DrillItemRecord>;
  friction: Record<string, FrictionRecord>;
}

/** Correct answers walk up this ladder: 1d, 3d, 7d, 14d, 30d. */
const INTERVALS_MS = [
  1 * 24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000,
];

/** A wrong answer brings the item back after ten minutes. */
const WRONG_RETRY_MS = 10 * 60 * 1000;

function load(): DrillData {
  try {
    if (!existsSync(DRILLS_FILE)) return { items: {}, friction: {} };
    const raw = JSON.parse(readFileSync(DRILLS_FILE, "utf-8"));
    return {
      items: raw.items && typeof raw.items === "object" ? raw.items : {},
      friction: raw.friction && typeof raw.friction === "object" ? raw.friction : {},
    };
  } catch {
    return { items: {}, friction: {} };
  }
}

function save(data: DrillData): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DRILLS_FILE, JSON.stringify(data, null, 2));
}

export interface DrillItemStats {
  id: string;
  seenCount: number;
  correctCount: number;
  lastCorrect: boolean | null;
  lastSeenAt: string | null;
  dueAt: string | null;
  dueNow: boolean;
  priority: number;
}

function statsFor(
  id: string,
  record: DrillItemRecord | undefined,
  friction: FrictionRecord | undefined,
  now: number,
): DrillItemStats {
  const attempts = record?.attempts ?? [];
  const last = attempts[attempts.length - 1];
  const dueAt = record?.dueAt ?? null;
  const dueNow = dueAt === null || Date.parse(dueAt) <= now;

  // Priority (only meaningful among due items):
  // - grader friction on the source is the strongest signal
  // - items answered wrong last time come before comfortable ones
  // - never-seen items rank above long-settled ones
  // - overdue time breaks ties
  let priority = 0;
  if (friction && friction.failures > 0) priority += Math.min(friction.failures, 10) * 10;
  if (last && !last.correct) priority += 25;
  if (attempts.length === 0) priority += 5;
  if (dueAt !== null && dueNow) {
    const overdueDays = (now - Date.parse(dueAt)) / (24 * 60 * 60 * 1000);
    priority += Math.min(Math.max(overdueDays, 0), 14);
  }

  return {
    id,
    seenCount: attempts.length,
    correctCount: attempts.filter((a) => a.correct).length,
    lastCorrect: last ? last.correct : null,
    lastSeenAt: last ? last.at : null,
    dueAt,
    dueNow,
    priority: Math.round(priority * 10) / 10,
  };
}

export interface DueQueryCandidate {
  id: string;
  sourceId?: string | null;
}

export interface DrillFrictionEntry {
  sourceId: string;
  failures: number;
  passes: number;
}

/** Stats for every candidate, due items first (highest priority first). */
export function queryDue(candidates: DueQueryCandidate[]): {
  items: DrillItemStats[];
  dueCount: number;
  friction: DrillFrictionEntry[];
} {
  const data = load();
  const now = Date.now();
  const items = candidates.map((c) =>
    statsFor(c.id, data.items[c.id], c.sourceId ? data.friction[c.sourceId] : undefined, now),
  );
  items.sort((a, b) => {
    if (a.dueNow !== b.dueNow) return a.dueNow ? -1 : 1;
    if (a.dueNow) return b.priority - a.priority;
    return (Date.parse(a.dueAt ?? "") || 0) - (Date.parse(b.dueAt ?? "") || 0);
  });

  // Collect unique sourceIds from candidates and return friction for any that
  // have at least one failure, sorted by failures descending.
  const seenSourceIds = new Set<string>();
  for (const c of candidates) {
    if (c.sourceId) seenSourceIds.add(c.sourceId);
  }
  const friction: DrillFrictionEntry[] = [];
  for (const sourceId of seenSourceIds) {
    const rec = data.friction[sourceId];
    if (rec && rec.failures > 0) {
      friction.push({ sourceId, failures: rec.failures, passes: rec.passes });
    }
  }
  friction.sort((a, b) => b.failures - a.failures);

  return { items, dueCount: items.filter((i) => i.dueNow).length, friction };
}

/** Records one attempt and reschedules the item. */
export function recordAttempt(
  itemId: string,
  correct: boolean,
  sourceId?: string | null,
): DrillItemStats {
  const data = load();
  const record: DrillItemRecord = data.items[itemId] ?? {
    attempts: [],
    intervalIndex: 0,
    dueAt: null,
  };
  const now = Date.now();
  record.attempts.push({ at: new Date(now).toISOString(), correct });
  // Keep history bounded — the honest stats only need recency + counts.
  if (record.attempts.length > 50) record.attempts = record.attempts.slice(-50);

  if (correct) {
    const interval = INTERVALS_MS[Math.min(record.intervalIndex, INTERVALS_MS.length - 1)]!;
    record.dueAt = new Date(now + interval).toISOString();
    record.intervalIndex = Math.min(record.intervalIndex + 1, INTERVALS_MS.length - 1);
  } else {
    record.dueAt = new Date(now + WRONG_RETRY_MS).toISOString();
    record.intervalIndex = 0;
  }

  data.items[itemId] = record;
  save(data);
  return statsFor(itemId, record, sourceId ? data.friction[sourceId] : undefined, now);
}

/**
 * Called by the dojo/crisis check routes on every grader run. Failures and
 * retries accumulate as friction that boosts related drill items.
 */
export function recordGraderResult(sourceId: string, passed: boolean): void {
  const data = load();
  const rec = data.friction[sourceId] ?? { failures: 0, passes: 0 };
  if (passed) rec.passes += 1;
  else rec.failures += 1;
  data.friction[sourceId] = rec;
  save(data);
}
