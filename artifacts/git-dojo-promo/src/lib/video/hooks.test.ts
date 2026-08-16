/**
 * Unit tests for useVideoPlayer – specifically the isNaturalLoopRef flag.
 *
 * Invariant being guarded:
 *   isNaturalLoopRef.current must be TRUE only when the final scene's own
 *   timer fires and the video loops back to scene 0 with loop:true.
 *   It must be FALSE for every other transition (initial mount, mid-sequence
 *   advances, and the case where loop:false prevents a wrap-around).
 *
 * VideoTemplate reads this flag synchronously in a useEffect to decide
 * whether to play the fade-to-black overlay.  Incorrect true values would
 * cause the overlay to flash whenever any non-natural advance lands on s0.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVideoPlayer } from "./hooks";

// Scene durations used for the main test suite.
const DURATIONS = { s0: 100, s1: 150, s2: 200, s3: 100, s4: 100, s5: 80 };

describe("useVideoPlayer – isNaturalLoopRef", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts false on initial mount", () => {
    const { result } = renderHook(() =>
      useVideoPlayer({ durations: DURATIONS, loop: true }),
    );
    expect(result.current.isNaturalLoopRef.current).toBe(false);
    expect(result.current.currentScene).toBe(0);
  });

  it("stays false after a mid-sequence advance (s0 → s1)", async () => {
    const { result } = renderHook(() =>
      useVideoPlayer({ durations: DURATIONS, loop: true }),
    );

    await act(async () => {
      vi.advanceTimersByTime(DURATIONS.s0);
    });

    expect(result.current.currentScene).toBe(1);
    expect(result.current.currentSceneKey).toBe("s1");
    expect(result.current.isNaturalLoopRef.current).toBe(false);
  });

  it("stays false after every non-final advance through multiple scenes", async () => {
    const { result } = renderHook(() =>
      useVideoPlayer({ durations: DURATIONS, loop: true }),
    );

    // Advance through s0, s1, s2, s3, s4 — each step must keep the flag false
    for (const key of ["s0", "s1", "s2", "s3", "s4"] as const) {
      await act(async () => {
        vi.advanceTimersByTime(DURATIONS[key]);
      });
      expect(result.current.isNaturalLoopRef.current).toBe(
        false,
        `expected false after ${key} advanced`,
      );
    }

    // We should now be on s5 (the final scene), ref still false until *its* timer fires
    expect(result.current.currentSceneKey).toBe("s5");
    expect(result.current.isNaturalLoopRef.current).toBe(false);
  });

  it("becomes true when the s5 timer fires and loop:true wraps to s0", async () => {
    const { result } = renderHook(() =>
      useVideoPlayer({ durations: DURATIONS, loop: true }),
    );

    // Each scene's timer is set up inside a useEffect that runs AFTER the
    // previous render.  Advancing all time at once skips those renders, so
    // we must fire each scene's timer one-at-a-time with an act() between
    // each step to let React flush the effect that queues the next timer.
    for (const key of Object.keys(DURATIONS) as Array<keyof typeof DURATIONS>) {
      await act(async () => {
        vi.advanceTimersByTime(DURATIONS[key]);
      });
    }

    // Should have looped back to scene 0
    expect(result.current.currentScene).toBe(0);
    expect(result.current.currentSceneKey).toBe("s0");
    // The flag must be true – this is the natural s5→s0 loop
    expect(result.current.isNaturalLoopRef.current).toBe(true);
  });

  it("stays false when the last scene fires with loop:false (no wrap occurs)", async () => {
    const { result } = renderHook(() =>
      useVideoPlayer({ durations: DURATIONS, loop: false }),
    );

    // Advance scene-by-scene (see note above about useEffect + fake timers)
    for (const key of Object.keys(DURATIONS) as Array<keyof typeof DURATIONS>) {
      await act(async () => {
        vi.advanceTimersByTime(DURATIONS[key]);
      });
    }

    // Video ended but did not loop, so the hook explicitly clears the flag
    expect(result.current.hasEnded).toBe(true);
    expect(result.current.isNaturalLoopRef.current).toBe(false);
  });

  it("becomes true after the last scene fires regardless of the final key name", async () => {
    // Use a completely different key name for the last scene to confirm the
    // guard no longer depends on the literal string 's5'.
    const RENAMED_DURATIONS = { intro: 100, middle: 150, finale: 80 };

    const { result } = renderHook(() =>
      useVideoPlayer({ durations: RENAMED_DURATIONS, loop: true }),
    );

    for (const key of Object.keys(RENAMED_DURATIONS) as Array<keyof typeof RENAMED_DURATIONS>) {
      await act(async () => {
        vi.advanceTimersByTime(RENAMED_DURATIONS[key]);
      });
    }

    // Should have looped back to scene 0
    expect(result.current.currentScene).toBe(0);
    // The flag must be true – 'finale' is the last scene, not 's5'
    expect(result.current.isNaturalLoopRef.current).toBe(true);
  });

  it("resets to false on the advance immediately after the natural loop", async () => {
    const { result } = renderHook(() =>
      useVideoPlayer({ durations: DURATIONS, loop: true }),
    );

    // Complete first loop scene-by-scene (see note above)
    for (const key of Object.keys(DURATIONS) as Array<keyof typeof DURATIONS>) {
      await act(async () => {
        vi.advanceTimersByTime(DURATIONS[key]);
      });
    }
    expect(result.current.isNaturalLoopRef.current).toBe(true);

    // Advance s0 → s1 in the second loop; the flag must return to false
    await act(async () => {
      vi.advanceTimersByTime(DURATIONS.s0);
    });
    expect(result.current.currentSceneKey).toBe("s1");
    expect(result.current.isNaturalLoopRef.current).toBe(false);
  });
});
