/**
 * Determines whether the "Step N of M" chip should be visible in MapPeek.
 *
 * Rules:
 * - stepIndex must be a valid 1-based index (>= 1).
 * - stepIndex must not exceed totalSteps (guards against completion-screen
 *   overshoot where a module fires onStepChange(totalSteps + 1)).
 * - When stepIndex is undefined the chip is always hidden (CLI lessons,
 *   breakthroughs, crises that don't track per-step progress).
 */
export function isValidStepChip(
  stepIndex: number | undefined,
  totalSteps: number,
): boolean {
  if (stepIndex == null) return false;
  return stepIndex >= 1 && stepIndex <= totalSteps;
}
