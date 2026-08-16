/**
 * Canonical list of all CLI (Test Center) lesson IDs.
 *
 * These ids drive lesson routing, lessonLocations map coverage, and progress
 * tracking.  When you add a new lesson folder, add its id here so the
 * map-coverage test catches any missing lessonLocations entry immediately.
 */
export const CLI_LESSON_IDS = [
  "lesson-01",
  "lesson-02",
  "lesson-03",
  "lesson-04",
  "lesson-05",
  "lesson-06",
  "lesson-07",
  "lesson-08",
  "lesson-09",
] as const;

export type CliLessonId = (typeof CLI_LESSON_IDS)[number];
