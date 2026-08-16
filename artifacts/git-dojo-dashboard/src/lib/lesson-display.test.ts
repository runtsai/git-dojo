import { describe, it, expect } from "vitest";
import { lessonDisplayTitle } from "./lesson-display";

describe("lessonDisplayTitle — title fallback", () => {
  // --- happy path ---
  it("returns the title when it is present", () => {
    expect(lessonDisplayTitle("First Snapshot", "lesson-01")).toBe(
      "First Snapshot",
    );
  });

  it("returns the title when it contains extra spaces (trims before checking)", () => {
    expect(lessonDisplayTitle("  Staging Area  ", "lesson-02")).toBe(
      "Staging Area",
    );
  });

  // --- empty / missing title ---
  it("falls back to the lesson id when title is an empty string", () => {
    expect(lessonDisplayTitle("", "lesson-03")).toBe("lesson-03");
  });

  it("falls back to the lesson id when title is only whitespace", () => {
    expect(lessonDisplayTitle("   ", "lesson-04")).toBe("lesson-04");
  });

  it("falls back to the lesson id when title is null", () => {
    expect(lessonDisplayTitle(null, "lesson-05")).toBe("lesson-05");
  });

  it("falls back to the lesson id when title is undefined", () => {
    expect(lessonDisplayTitle(undefined, "lesson-06")).toBe("lesson-06");
  });
});
