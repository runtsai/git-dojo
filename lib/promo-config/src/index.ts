/**
 * Single source of truth for promo video scene durations.
 *
 * Both the promo React app (VideoTemplate.tsx) and the API server
 * (routes/promo-meta.ts) import from here so that adding, removing, or
 * resizing a scene automatically updates every consumer — including the
 * export smoke check, which reads the /api/export/promo-meta endpoint.
 */

/** Duration of each scene in milliseconds, in playback order. */
export const SCENE_DURATIONS: Record<string, number> = {
  s0: 4000,
  s1: 4500,
  s2: 4500,
  s3: 4000,
  s4: 4000,
  s5: 1500,
};

/** Total promo video runtime in milliseconds. */
export const TOTAL_RUNTIME_MS: number = Object.values(SCENE_DURATIONS).reduce(
  (a, b) => a + b,
  0,
);

/** Total promo video runtime in seconds. */
export const TOTAL_RUNTIME_SEC: number = TOTAL_RUNTIME_MS / 1000;
