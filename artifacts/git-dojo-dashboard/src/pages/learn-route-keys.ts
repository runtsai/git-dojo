/**
 * The canonical set of route keys that the learn page recognises.
 *
 * Kept in a side-effect-free module so tests can import it without
 * pulling in React components (and their lucide-react dependencies,
 * which are globally mocked in test-setup.ts).
 *
 * `learn.tsx` and `module-2-4-unlock.test.ts` both import from here,
 * so a key change or removal is caught before it ships.
 */
export const LEARN_ROUTE_KEYS = [
  "1-1",
  "1-2",
  "1-3",
  "1-4",
  "1-5",
  "2-1",
  "2-2",
  "2-3",
  "2-4",
] as const;

export type LearnRouteKey = (typeof LEARN_ROUTE_KEYS)[number];
