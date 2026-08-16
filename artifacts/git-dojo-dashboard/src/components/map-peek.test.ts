import { describe, it, expect } from "vitest";
import { shouldDismissOnSwipe, SWIPE_DISMISS_THRESHOLD } from "./map-peek-gesture";

// ---------------------------------------------------------------------------
// shouldDismissOnSwipe
// ---------------------------------------------------------------------------

describe("shouldDismissOnSwipe — qualifying swipes (handle)", () => {
  it("dismisses when handle drag exceeds threshold", () => {
    expect(
      shouldDismissOnSwipe({ startY: 100, endY: 100 + SWIPE_DISMISS_THRESHOLD, scrollTop: 0, fromHandle: true }),
    ).toBe(true);
  });

  it("dismisses when handle drag exceeds threshold even with scroll offset", () => {
    expect(
      shouldDismissOnSwipe({ startY: 100, endY: 100 + SWIPE_DISMISS_THRESHOLD, scrollTop: 200, fromHandle: true }),
    ).toBe(true);
  });

  it("dismisses when handle drag far exceeds threshold", () => {
    expect(
      shouldDismissOnSwipe({ startY: 50, endY: 300, scrollTop: 999, fromHandle: true }),
    ).toBe(true);
  });
});

describe("shouldDismissOnSwipe — qualifying swipes (content at scroll-top)", () => {
  it("dismisses when content swipe exceeds threshold at scrollTop 0", () => {
    expect(
      shouldDismissOnSwipe({ startY: 100, endY: 100 + SWIPE_DISMISS_THRESHOLD, scrollTop: 0, fromHandle: false }),
    ).toBe(true);
  });

  it("dismisses when content swipe greatly exceeds threshold at scrollTop 0", () => {
    expect(
      shouldDismissOnSwipe({ startY: 0, endY: 500, scrollTop: 0, fromHandle: false }),
    ).toBe(true);
  });
});

describe("shouldDismissOnSwipe — blocked by scroll position", () => {
  it("does NOT dismiss when content swipe occurs with scrollTop > 0", () => {
    expect(
      shouldDismissOnSwipe({ startY: 100, endY: 100 + SWIPE_DISMISS_THRESHOLD, scrollTop: 1, fromHandle: false }),
    ).toBe(false);
  });

  it("does NOT dismiss mid-scroll even with a very large downward delta", () => {
    expect(
      shouldDismissOnSwipe({ startY: 0, endY: 600, scrollTop: 50, fromHandle: false }),
    ).toBe(false);
  });
});

describe("shouldDismissOnSwipe — threshold boundary", () => {
  it("does NOT dismiss when delta is exactly one pixel below threshold (content, scrollTop 0)", () => {
    expect(
      shouldDismissOnSwipe({ startY: 100, endY: 100 + SWIPE_DISMISS_THRESHOLD - 1, scrollTop: 0, fromHandle: false }),
    ).toBe(false);
  });

  it("does NOT dismiss when delta is exactly one pixel below threshold (handle)", () => {
    expect(
      shouldDismissOnSwipe({ startY: 100, endY: 100 + SWIPE_DISMISS_THRESHOLD - 1, scrollTop: 0, fromHandle: true }),
    ).toBe(false);
  });

  it("dismisses when delta is exactly at threshold", () => {
    expect(
      shouldDismissOnSwipe({ startY: 100, endY: 100 + SWIPE_DISMISS_THRESHOLD, scrollTop: 0, fromHandle: false }),
    ).toBe(true);
  });

  it("respects a custom threshold override", () => {
    expect(
      shouldDismissOnSwipe({ startY: 0, endY: 40, scrollTop: 0, fromHandle: false, threshold: 40 }),
    ).toBe(true);
    expect(
      shouldDismissOnSwipe({ startY: 0, endY: 39, scrollTop: 0, fromHandle: false, threshold: 40 }),
    ).toBe(false);
  });
});

describe("shouldDismissOnSwipe — upward / horizontal swipes never dismiss", () => {
  it("does NOT dismiss on an upward swipe (handle)", () => {
    expect(
      shouldDismissOnSwipe({ startY: 300, endY: 100, scrollTop: 0, fromHandle: true }),
    ).toBe(false);
  });

  it("does NOT dismiss on an upward swipe (content)", () => {
    expect(
      shouldDismissOnSwipe({ startY: 300, endY: 100, scrollTop: 0, fromHandle: false }),
    ).toBe(false);
  });

  it("does NOT dismiss when startY equals endY", () => {
    expect(
      shouldDismissOnSwipe({ startY: 200, endY: 200, scrollTop: 0, fromHandle: true }),
    ).toBe(false);
  });
});
