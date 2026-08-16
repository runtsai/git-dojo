/**
 * Props injected by the learn page into every visual module.
 * Defined here (not in learn.tsx) to avoid circular imports.
 */
export type VisualModuleProps = {
  /** Called each time the learner moves to a new step (1-based). */
  onStepChange?: (step: number) => void;
};
