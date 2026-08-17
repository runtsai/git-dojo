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

/**
 * Number of recent grader runs to use for trend detection.
 * The last RECENT_WINDOW entries of `runs` are split into two halves so the
 * client can compare older vs newer pass rates.
 */
const RECENT_WINDOW = 10;

interface FrictionEntry {
  at: string; // ISO 8601
  passed: boolean;
}

interface FrictionRecord {
  failures: number;
  passes: number;
  /** Rolling window of the last FRICTION_WINDOW runs (newest last). */
  runs: FrictionEntry[];
  /**
   * ISO 8601 timestamp set the first time queryDue returns this source as
   * recovered. While non-null and the source remains recovered, subsequent
   * queryDue calls omit the entry so the badge is shown exactly once per
   * recovery cycle. Cleared whenever a new failure is recorded.
   */
  recoveredSince: string | null;
}

interface DrillData {
  items: Record<string, DrillItemRecord>;
  friction: Record<string, FrictionRecord>;
}

/** Rolling window size for grader-run history per source. */
const FRICTION_WINDOW = 30;

/**
 * Exponential decay half-life for friction failures.
 * Failures 14 days old count half as much as fresh ones; at 28 days they
 * count one quarter, etc.  This keeps priority honest for learners who have
 * since mastered the material.
 */
const FRICTION_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
const FRICTION_DECAY_K = Math.LN2 / FRICTION_HALF_LIFE_MS;

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

function normaliseFriction(raw: Record<string, unknown>): Record<string, FrictionRecord> {
  const out: Record<string, FrictionRecord> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === "object") {
      const r = v as Record<string, unknown>;
      out[k] = {
        failures: typeof r.failures === "number" ? r.failures : 0,
        passes: typeof r.passes === "number" ? r.passes : 0,
        // Legacy records have no runs array; start fresh so decay applies
        // going forward while raw totals are preserved for display.
        runs: Array.isArray(r.runs) ? (r.runs as FrictionEntry[]) : [],
        recoveredSince: typeof r.recoveredSince === "string" ? r.recoveredSince : null,
      };
    }
  }
  return out;
}

function load(): DrillData {
  try {
    if (!existsSync(DRILLS_FILE)) return { items: {}, friction: {} };
    const raw = JSON.parse(readFileSync(DRILLS_FILE, "utf-8"));
    return {
      items: raw.items && typeof raw.items === "object" ? raw.items : {},
      friction:
        raw.friction && typeof raw.friction === "object"
          ? normaliseFriction(raw.friction as Record<string, unknown>)
          : {},
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

/**
 * Compute a recency-weighted failure score for a friction record.
 *
 * Each failure in the rolling window contributes exp(-k * age), so failures
 * decay exponentially with a 14-day half-life.  The result is in the range
 * [0, FRICTION_WINDOW] (all-recent-failures → FRICTION_WINDOW, all-passes →
 * 0) and is capped at 10 for priority arithmetic.
 *
 * For legacy records that have no `runs` array yet, the score is 0 (decay
 * takes effect as new runs arrive); the raw `failures` total is preserved for
 * display purposes but is intentionally not used for priority.
 */
function decayedFailureScore(friction: FrictionRecord, now: number): number {
  if (friction.runs.length === 0) return 0;
  let score = 0;
  for (const run of friction.runs) {
    if (!run.passed) {
      const age = now - Date.parse(run.at);
      score += Math.exp(-FRICTION_DECAY_K * age);
    }
  }
  return score;
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
  // - grader friction on the source is the strongest signal (recency-weighted)
  // - items answered wrong last time come before comfortable ones
  // - never-seen items rank above long-settled ones
  // - overdue time breaks ties
  let priority = 0;
  if (friction) {
    const score = decayedFailureScore(friction, now);
    priority += Math.min(score, 10) * 10;
  }
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
  /** Raw cumulative failure count (preserved for display). */
  failures: number;
  passes: number;
  /**
   * Recency-weighted failure score (0–10 range). Use this for ranking
   * weak-spot lists instead of the raw count so old failures don't dominate.
   */
  effectiveFailures: number;
  /** Passes in the newer half of the last RECENT_WINDOW runs. */
  recentPasses: number;
  /** Failures in the newer half of the last RECENT_WINDOW runs. */
  recentFailures: number;
  /** Passes in the older half of the last RECENT_WINDOW runs. */
  olderPasses: number;
  /** Failures in the older half of the last RECENT_WINDOW runs. */
  olderFailures: number;
  /**
   * Failures within the rolling window (last FRICTION_WINDOW runs). Use this
   * for display instead of the raw cumulative `failures` counter so the UI
   * stays consistent with current struggle level.
   */
  windowFailures: number;
  /**
   * True when the learner has fully recovered: recentFailures === 0 and
   * recentPasses > 0. Recovered entries are included so the UI can celebrate
   * the improvement before hiding the row on the next refresh.
   */
  recovered: boolean;
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
  // have at least one failure, sorted by effective (decayed) failures descending.
  const seenSourceIds = new Set<string>();
  for (const c of candidates) {
    if (c.sourceId) seenSourceIds.add(c.sourceId);
  }
  const friction: DrillFrictionEntry[] = [];
  let needsSave = false;
  for (const sourceId of seenSourceIds) {
    const rec = data.friction[sourceId];
    if (rec && rec.failures > 0) {
      const effectiveFailures = Math.round(decayedFailureScore(rec, now) * 10) / 10;
      // Split the last RECENT_WINDOW runs into two halves for trend detection.
      const trendRuns = rec.runs.slice(-RECENT_WINDOW);
      const half = Math.floor(RECENT_WINDOW / 2);
      const olderHalf = trendRuns.slice(0, Math.max(0, trendRuns.length - half));
      const newerHalf = trendRuns.slice(Math.max(0, trendRuns.length - half));
      const recentPasses = newerHalf.filter((r) => r.passed).length;
      const recentFailures = newerHalf.length - recentPasses;
      const olderPasses = olderHalf.filter((r) => r.passed).length;
      const olderFailures = olderHalf.length - olderPasses;

      const isRecovered = recentFailures === 0 && recentPasses > 0;

      if (isRecovered) {
        if (rec.recoveredSince !== null) {
          // Already shown the badge on a previous refresh — hide the entry.
          continue;
        }
        // First time we see this source as recovered: stamp the timestamp so
        // the next refresh omits it, then include it once with recovered: true.
        rec.recoveredSince = new Date(now).toISOString();
        needsSave = true;
      } else {
        // Active weak spot: clear any stale recoveredSince stamp so the badge
        // can reappear if the learner recovers again in a future cycle.
        if (rec.recoveredSince !== null) {
          rec.recoveredSince = null;
          needsSave = true;
        }
      }

      const windowFailures = rec.runs.filter((r) => !r.passed).length;
      friction.push({
        sourceId,
        failures: rec.failures,
        passes: rec.passes,
        effectiveFailures,
        recentPasses,
        recentFailures,
        olderPasses,
        olderFailures,
        windowFailures,
        recovered: isRecovered,
      });
    }
  }
  if (needsSave) save(data);
  // Sort by effective (decayed) failures so the list reflects current weak spots.
  // Recovered entries always appear after active ones so the panel stays
  // focused on current gaps. Tie-break on raw failure count (descending) then
  // sourceId (ascending) so two sources whose decayed scores converge to the
  // same rounded value never swap positions arbitrarily mid-session.
  friction.sort((a, b) => {
    if (a.recovered !== b.recovered) return a.recovered ? 1 : -1;
    const diff = b.effectiveFailures - a.effectiveFailures;
    if (diff !== 0) return diff;
    if (b.failures !== a.failures) return b.failures - a.failures;
    return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
  });

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
  const rec: FrictionRecord = data.friction[sourceId] ?? {
    failures: 0,
    passes: 0,
    runs: [],
    recoveredSince: null,
  };

  // ── Legacy record seeding ─────────────────────────────────────────────────
  // When a record has aggregate totals but no runs history (written before the
  // rolling window was introduced), reconstruct a plausible runs window from
  // the counts so trend detection is useful immediately — rather than waiting
  // for RECENT_WINDOW new grader runs to accumulate.
  if (rec.runs.length === 0 && rec.failures + rec.passes > 0) {
    const total = rec.failures + rec.passes;
    // Leave room for the new entry we are about to append.
    const seedCount = Math.min(total, FRICTION_WINDOW - 1);
    const seededFailures = Math.round((rec.failures / total) * seedCount);
    const syntheticAt = new Date().toISOString();
    const syntheticRuns: FrictionEntry[] = [];
    let failuresEmitted = 0;
    for (let i = 0; i < seedCount; i++) {
      // Bresenham-style distribution: spread failures evenly across slots.
      const target = Math.round(((i + 1) / seedCount) * seededFailures);
      const entryPassed = target <= failuresEmitted;
      if (!entryPassed) failuresEmitted++;
      syntheticRuns.push({ at: syntheticAt, passed: entryPassed });
    }
    rec.runs = syntheticRuns;
  }

  if (passed) {
    rec.passes += 1;
  } else {
    rec.failures = Math.min(rec.failures + 1, 999);
    // A new failure ends the recovery cycle so the badge can appear again
    // if the learner recovers in a future window.
    rec.recoveredSince = null;
  }
  // Append to rolling window; trim to the most recent FRICTION_WINDOW entries.
  rec.runs.push({ at: new Date().toISOString(), passed });
  if (rec.runs.length > FRICTION_WINDOW) {
    rec.runs = rec.runs.slice(-FRICTION_WINDOW);
  }
  data.friction[sourceId] = rec;
  save(data);
}
