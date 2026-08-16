/**
 * Trend detection helpers for the weak-spots panel.
 *
 * `computeTrend` is pure and exported so it can be unit-tested independently
 * of the React component that renders it.
 */
import type { DrillFrictionEntry } from "@workspace/api-client-react";

/**
 * - `"improving"`  — recent pass rate is higher than older pass rate
 * - `"regressing"` — recent pass rate is lower than older pass rate
 * - `"stable"`     — rates are equal (or only one half has data, near 50 %)
 * - `"unknown"`    — no rolling-window data at all (legacy record with only
 *                    aggregate counts); the indicator should show a neutral
 *                    "no recent data" label rather than implying mixed results.
 */
export type Trend = "improving" | "regressing" | "stable" | "unknown";

export function computeTrend(entry: DrillFrictionEntry): Trend {
  const { recentPasses, recentFailures, olderPasses, olderFailures } = entry;
  const newerTotal = recentPasses + recentFailures;
  const olderTotal = olderPasses + olderFailures;

  // No rolling-window data at all — legacy record.
  if (newerTotal === 0 && olderTotal === 0) return "unknown";

  if (newerTotal === 0) return "stable";

  const newerRate = recentPasses / newerTotal;

  if (olderTotal === 0) {
    // Only newer-half data available — compare against 50 % baseline.
    if (newerRate > 0.5) return "improving";
    if (newerRate < 0.5) return "regressing";
    return "stable";
  }

  const olderRate = olderPasses / olderTotal;
  if (newerRate > olderRate) return "improving";
  if (newerRate < olderRate) return "regressing";
  return "stable";
}
