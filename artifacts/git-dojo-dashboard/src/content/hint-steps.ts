/**
 * Hint ladder levels used in the Crisis Room.
 * This is the single source of truth for how many hint steps exist.
 * Both crisis.tsx and map-coverage tests import from here.
 */
export const HINT_STEPS = [
  { key: "nudge", label: "Hint 1 — A nudge" },
  { key: "concept", label: "Hint 2 — The concept" },
  { key: "command", label: "Hint 3 — The exact command" },
] as const;

export type HintKey = (typeof HINT_STEPS)[number]["key"];
