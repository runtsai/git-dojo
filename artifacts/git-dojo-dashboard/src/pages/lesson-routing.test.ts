/**
 * Lesson routing manifest guard.
 *
 * Ensures that the set of IDs the router can serve is exactly the set
 * declared in CLI_LESSON_IDS.  A lesson folder that has no entry in the
 * manifest cannot slip through: isValidLessonId is the single gate used by
 * LessonView before any data fetching begins.
 */

import { describe, it, expect } from "vitest";
import { CLI_LESSON_IDS, isValidLessonId } from "@/content/lessons";

describe("isValidLessonId — manifest gate", () => {
  it("accepts every id that is in CLI_LESSON_IDS", () => {
    for (const id of CLI_LESSON_IDS) {
      expect(isValidLessonId(id), `${id} should be valid`).toBe(true);
    }
  });

  it("rejects an id that is not in CLI_LESSON_IDS", () => {
    expect(isValidLessonId("lesson-99")).toBe(false);
    expect(isValidLessonId("lesson-00")).toBe(false);
    expect(isValidLessonId("")).toBe(false);
    expect(isValidLessonId("random-path")).toBe(false);
  });

  it("rejects a well-formed but unlisted lesson id", () => {
    // lesson-10 is not in the manifest yet; routing must not serve it
    expect(isValidLessonId("lesson-10")).toBe(false);
  });

  it("CLI_LESSON_IDS has no duplicates", () => {
    const unique = new Set(CLI_LESSON_IDS);
    expect(unique.size).toBe(CLI_LESSON_IDS.length);
  });
});
