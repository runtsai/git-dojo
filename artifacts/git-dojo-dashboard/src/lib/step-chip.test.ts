import { describe, it, expect } from "vitest";
import { isValidStepChip } from "./step-chip";

describe("isValidStepChip", () => {
  // --- happy path ---
  it("shows for step 1 of 5", () => {
    expect(isValidStepChip(1, 5)).toBe(true);
  });

  it("shows for step 3 of 5 (mid-module)", () => {
    expect(isValidStepChip(3, 5)).toBe(true);
  });

  it("shows for step 5 of 5 (last step, still valid)", () => {
    expect(isValidStepChip(5, 5)).toBe(true);
  });

  // --- out-of-range: completion screen overshoot ---
  it("hides for step 6 of 5 (completion-screen overshoot)", () => {
    expect(isValidStepChip(6, 5)).toBe(false);
  });

  it("hides for any stepIndex > totalSteps", () => {
    expect(isValidStepChip(10, 5)).toBe(false);
  });

  // --- out-of-range: zero (crisis initial state) ---
  it("hides for step 0 (crisis hintsOpen initial value)", () => {
    expect(isValidStepChip(0, 5)).toBe(false);
  });

  it("hides for negative stepIndex", () => {
    expect(isValidStepChip(-1, 5)).toBe(false);
  });

  // --- undefined (CLI lessons, breakthroughs, crises without step tracking) ---
  it("hides when stepIndex is undefined", () => {
    expect(isValidStepChip(undefined, 5)).toBe(false);
  });

  // --- edge: single-step location ---
  it("shows for step 1 of 1", () => {
    expect(isValidStepChip(1, 1)).toBe(true);
  });

  it("hides for step 2 of 1", () => {
    expect(isValidStepChip(2, 1)).toBe(false);
  });
});
