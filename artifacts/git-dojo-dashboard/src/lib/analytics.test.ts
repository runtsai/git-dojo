import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./analytics";

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
});

afterEach(() => {
  delete (globalThis as { window?: Window }).window;
});

describe("trackEvent", () => {
  it("is a safe no-op when the published analytics tracker is absent", () => {
    expect(() => trackEvent("lesson_check_completed", { passed: true })).not.toThrow();
  });

  it("forwards an event and its privacy-safe dimensions to Umami", () => {
    const track = vi.fn();
    window.umami = { track };

    trackEvent("lesson_check_completed", {
      lesson_id: "lesson-01",
      result: "passed",
    });

    expect(track).toHaveBeenCalledWith("lesson_check_completed", {
      lesson_id: "lesson-01",
      result: "passed",
    });
  });

  it("never lets a tracker failure break the app", () => {
    window.umami = {
      track: vi.fn(() => {
        throw new Error("tracker unavailable");
      }),
    };

    expect(() => trackEvent("warm_up_started")).not.toThrow();
  });
});