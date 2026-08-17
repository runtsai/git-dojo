/**
 * Authoritative step-count registry for all visual modules.
 *
 * This is intentionally a pure-data file (no React imports) so it can be
 * imported safely from both component files and Vitest unit tests.
 *
 * ## What "step count" means here
 *
 * `TOTAL_STEPS` is the highest *interactive* step number a module exposes to
 * the learner — the number shown in the map chip ("Step N of TOTAL_STEPS").
 * It is the ceiling used in `Math.min(step + 1, TOTAL_STEPS)` inside
 * `handleNext`, and the guard in `step < TOTAL_STEPS` / `step === TOTAL_STEPS`.
 *
 * When a learner completes the final step the module fires `onStepChange` with
 * `TOTAL_STEPS + 1` (e.g. 6 for a 5-step module) as a completion signal.
 * `isValidStepChip()` intentionally rejects that value as an overshoot, so the
 * chip is hidden on the completion screen. The registry does NOT track the
 * completion-signal value — only the last interactive step.
 *
 * ## Adding a new module
 *   1. Add an entry here: `"<tier>.<module>": <step count>`.
 *   2. In the module file, import from this registry and re-export:
 *        import { visualModuleSteps as _steps } from "../visual-module-steps";
 *        export const TOTAL_STEPS = _steps["<tier>.<module>"];
 *   3. Use `TOTAL_STEPS` in `handleNext`, `onNext`, and `onSubmit` — never a
 *      raw literal — so the registry remains the single source of truth.
 *   4. Add the module's lessonLocations entry to src/content/map/index.ts with
 *      `TOTAL_STEPS` map-step entries so the map-coverage test passes.
 */

/** Maps visual module id (e.g. "1.1") to its last interactive step number. */
export const visualModuleSteps: Record<string, number> = {
  "1.1": 5,
  "1.2": 5,
  "1.3": 5,
  "1.4": 5,
  "1.5": 5,
  "2.1": 5,
  "2.2": 5,
  "2.3": 5,
  "2.4": 3,
};
