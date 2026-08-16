/**
 * Swipe-to-dismiss gesture logic for the MapPeek bottom sheet.
 *
 * Extracted into a dependency-free module so it can be unit-tested without
 * importing the React / Radix component tree.
 */

/** Minimum downward swipe distance (px) that dismisses the sheet. */
export const SWIPE_DISMISS_THRESHOLD = 80;

/**
 * Returns true when a touch gesture should dismiss the bottom sheet.
 *
 * Rules:
 * - The swipe must be downward and >= threshold px.
 * - If the gesture started on the drag handle (`fromHandle: true`), it always
 *   qualifies — the user deliberately grabbed the handle.
 * - If the gesture started on the scrollable content area, it only qualifies
 *   when the scroll container was already at the top (`scrollTop === 0`), so
 *   ordinary downward scrolling inside the sheet is never misinterpreted as a
 *   dismiss gesture.
 */
export function shouldDismissOnSwipe(opts: {
  startY: number;
  endY: number;
  scrollTop: number;
  fromHandle: boolean;
  threshold?: number;
}): boolean {
  const threshold = opts.threshold ?? SWIPE_DISMISS_THRESHOLD;
  const delta = opts.endY - opts.startY;
  if (delta < threshold) return false;   // not far enough, or upward
  if (opts.fromHandle) return true;      // handle drag always qualifies
  return opts.scrollTop === 0;          // content drag only at scroll top
}
