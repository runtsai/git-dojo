/**
 * Returns true when the module should show a lock icon (prerequisite not met).
 *
 * This is the single source of truth used by:
 *   - home.tsx  — Ledger row prereqLocked flag
 *   - learn.tsx — route-level prereqUnmet gate
 *
 * Exporting it as a named pure function lets tests exercise the real logic
 * instead of duplicating the boolean inline.
 */
export function isPrereqLocked(
  prereq: string | undefined,
  completedModuleIds: string[],
): boolean {
  if (!prereq) return false;
  return !completedModuleIds.includes(prereq);
}
