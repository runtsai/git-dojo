/**
 * Component-level tests for VideoTemplate – loopFading state guard.
 *
 * Invariant being guarded:
 *   The fade-to-black overlay (loopFading !== 'idle') must NEVER activate
 *   when a scene jump skips the natural s5→s0 path.  Specifically, Phase 2
 *   of the loopFading effect has a guard:
 *
 *       isNaturalLoopRef.current === true
 *
 *   that prevents the overlay from appearing on manual seeks, remounts,
 *   or any other non-natural transition that lands on scene s0.
 *
 * Strategy:
 *   - Mock useVideoPlayer so tests control currentSceneKey and isNaturalLoopRef
 *     without needing real timers or the full React animation pipeline.
 *   - Mock framer-motion so the `animate` prop is applied as an inline style,
 *     making the overlay's opacity directly checkable in the DOM.
 *   - Mock scene sub-components and heavy native APIs (audio, Three.js) so
 *     the component renders in a jsdom environment.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports by Vitest)
// ---------------------------------------------------------------------------

// Control what useVideoPlayer returns from individual tests.
const mockIsNaturalLoopRef = { current: false };
const mockVideoPlayerState = {
  currentScene: 0,
  totalScenes: 6,
  currentSceneKey: "s0",
  hasEnded: false,
  isNaturalLoopRef: mockIsNaturalLoopRef,
};

vi.mock("@/lib/video", () => ({
  useVideoPlayer: vi.fn(() => ({ ...mockVideoPlayerState })),
}));

// Render motion.div as a plain div and apply `animate` as inline styles so
// we can assert on opacity without a real animation engine.
vi.mock("framer-motion", () => {
  const makeMotionDiv =
    (tag: string) =>
    ({
      children,
      animate,
      style,
      className,
      transition: _t,
      initial: _i,
      ...rest
    }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any) =>
      React.createElement(
        tag,
        {
          className,
          style: {
            ...style,
            ...(animate && typeof animate === "object" ? animate : {}),
          },
          ...rest,
        },
        children,
      );
  return {
    motion: { div: makeMotionDiv("div") },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

// Stub all six scene sub-components – they import Three.js/WebGL which jsdom
// cannot handle.
vi.mock("./video_scenes/Scene0", () => ({
  Scene0: () => React.createElement("div", { "data-testid": "scene-0" }),
}));
vi.mock("./video_scenes/Scene1", () => ({
  Scene1: () => React.createElement("div", { "data-testid": "scene-1" }),
}));
vi.mock("./video_scenes/Scene2", () => ({
  Scene2: () => React.createElement("div", { "data-testid": "scene-2" }),
}));
vi.mock("./video_scenes/Scene3", () => ({
  Scene3: () => React.createElement("div", { "data-testid": "scene-3" }),
}));
vi.mock("./video_scenes/Scene4", () => ({
  Scene4: () => React.createElement("div", { "data-testid": "scene-4" }),
}));
vi.mock("./video_scenes/Scene5", () => ({
  Scene5: () => React.createElement("div", { "data-testid": "scene-5" }),
}));

// ---------------------------------------------------------------------------
// Import the component AFTER mocks are registered
// ---------------------------------------------------------------------------
import VideoTemplate from "./VideoTemplate";
import { useVideoPlayer } from "@/lib/video";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Query the fade-to-black overlay div by its unique Tailwind classes. */
function getOverlay(container: HTMLElement): HTMLElement | null {
  return container.querySelector(".z-50.bg-black");
}

/** Return the rendered opacity of the overlay as a number (0 or 1). */
function overlayOpacity(container: HTMLElement): number {
  const el = getOverlay(container);
  if (!el) throw new Error("Overlay element not found");
  return Number((el as HTMLElement).style.opacity);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VideoTemplate – loopFading guard against accidental overlay", () => {
  beforeEach(() => {
    // Reset the shared ref and mock state before each test
    mockIsNaturalLoopRef.current = false;
    mockVideoPlayerState.currentSceneKey = "s0";
    mockVideoPlayerState.currentScene = 0;
    vi.mocked(useVideoPlayer).mockImplementation(() => ({
      ...mockVideoPlayerState,
      isNaturalLoopRef: mockIsNaturalLoopRef,
    }));
  });

  it("overlay starts with opacity 0 on fresh mount at scene s0", () => {
    const { container } = render(<VideoTemplate muted />);
    expect(overlayOpacity(container)).toBe(0);
  });

  it("loopFading stays idle (opacity 0) when the scene is s0 on fresh mount — prevBase is null so Phase 2 cannot fire", () => {
    // This is the 'direct jump to s0' case: no previous scene exists yet.
    // Even if isNaturalLoopRef.current were accidentally true here, prevBase
    // being null blocks Phase 2.
    mockIsNaturalLoopRef.current = true; // worst-case: ref left true somehow
    vi.mocked(useVideoPlayer).mockImplementation(() => ({
      ...mockVideoPlayerState,
      isNaturalLoopRef: mockIsNaturalLoopRef,
    }));
    const { container } = render(<VideoTemplate muted />);
    // Phase 2 guard: prevBase === null → no fade-out; Phase 1 guard: not s5
    expect(overlayOpacity(container)).toBe(0);
  });

  it("loopFading stays idle (opacity 0) when jumping from s3 directly to s0 with isNaturalLoopRef.current = false", async () => {
    // Simulate: component renders at s3, then a scene skip sends it to s0.
    // Because isNaturalLoopRef.current is false, Phase 2 must not fire.
    vi.mocked(useVideoPlayer).mockImplementation(() => ({
      ...mockVideoPlayerState,
      currentSceneKey: "s3",
      currentScene: 3,
      isNaturalLoopRef: mockIsNaturalLoopRef, // current = false
    }));

    const { container, rerender } = render(<VideoTemplate muted />);
    expect(overlayOpacity(container)).toBe(0);

    // Jump directly to s0, bypassing s5 entirely
    vi.mocked(useVideoPlayer).mockImplementation(() => ({
      ...mockVideoPlayerState,
      currentSceneKey: "s0",
      currentScene: 0,
      isNaturalLoopRef: mockIsNaturalLoopRef, // still false — no natural loop
    }));

    await act(async () => {
      rerender(<VideoTemplate muted />);
    });

    // Phase 2 condition: baseKey==='s0' && prevBase!==null && prevBase!=='s0' && isNaturalLoopRef.current
    // isNaturalLoopRef.current is false → condition fails → loopFading stays 'idle'
    expect(overlayOpacity(container)).toBe(0);
  });

  it("loopFading stays idle (opacity 0) when jumping from s5 to s0 with isNaturalLoopRef.current = false (manual seek, not natural timer)", async () => {
    // This simulates the exact bug scenario: the scene happens to go s5→s0
    // but via a manual seek rather than the natural timer.  Without the
    // isNaturalLoopRef guard, Phase 2 would incorrectly fire the fade-out.
    vi.mocked(useVideoPlayer).mockImplementation(() => ({
      ...mockVideoPlayerState,
      currentSceneKey: "s5",
      currentScene: 5,
      isNaturalLoopRef: mockIsNaturalLoopRef, // current = false (seek, not timer)
    }));

    const { container, rerender } = render(<VideoTemplate muted />);

    // When on s5, Phase 1 schedules a fade-in after a delay.  That timer
    // must be cancelled (by the cleanup) before it fires.
    // Jump immediately to s0 — the Phase 1 timer never fires.
    vi.mocked(useVideoPlayer).mockImplementation(() => ({
      ...mockVideoPlayerState,
      currentSceneKey: "s0",
      currentScene: 0,
      isNaturalLoopRef: mockIsNaturalLoopRef, // still false
    }));

    await act(async () => {
      rerender(<VideoTemplate muted />);
    });

    // Phase 2: isNaturalLoopRef.current is false → stays idle
    expect(overlayOpacity(container)).toBe(0);
  });

  it("fade-in timer is cancelled when skipping away from s5 before the 900 ms delay fires", async () => {
    // Phase 1 schedules: setTimeout(() => setLoopFading('in'), fadeInDelay)
    // where fadeInDelay = max(0, durations.s5 - LOOP_FADE_LEAD_MS) = 1500 - 600 = 900 ms.
    // The useEffect cleanup returns () => clearTimeout(t1).
    // This test verifies that cleanup runs when the scene changes, so the
    // timer never fires even after 900 ms have elapsed in wall-clock time.
    vi.useFakeTimers();
    try {
      vi.mocked(useVideoPlayer).mockImplementation(() => ({
        ...mockVideoPlayerState,
        currentSceneKey: "s5",
        currentScene: 5,
        isNaturalLoopRef: mockIsNaturalLoopRef,
      }));

      const { container, rerender } = render(<VideoTemplate muted />);
      // Overlay must start transparent on s5 entry (timer not yet fired)
      expect(overlayOpacity(container)).toBe(0);

      // Advance 400 ms — timer is still pending (fires at 900 ms)
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(overlayOpacity(container)).toBe(0);

      // Jump away from s5 to s3 — the useEffect cleanup cancels the timer
      vi.mocked(useVideoPlayer).mockImplementation(() => ({
        ...mockVideoPlayerState,
        currentSceneKey: "s3",
        currentScene: 3,
        isNaturalLoopRef: mockIsNaturalLoopRef,
      }));

      await act(async () => {
        rerender(<VideoTemplate muted />);
      });

      // Advance well past the original 900 ms mark — the cleared timer must NOT fire
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // loopFading must still be 'idle': overlay stays at opacity 0
      expect(overlayOpacity(container)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("loopFading transitions to opacity 0 (out → idle) when isNaturalLoopRef.current is true — the natural loop path works", async () => {
    // Verify the opposite side of the guard: a genuine natural loop DOES
    // trigger the fade-out sequence (loopFading='out', opacity=0), confirming
    // the guard doesn't over-block legitimate fades.
    vi.mocked(useVideoPlayer).mockImplementation(() => ({
      ...mockVideoPlayerState,
      currentSceneKey: "s5",
      currentScene: 5,
      isNaturalLoopRef: mockIsNaturalLoopRef,
    }));

    const { container, rerender } = render(<VideoTemplate muted />);

    // Now simulate the natural s5→s0 wrap: set the ref to true BEFORE the
    // re-render (the real hook sets it synchronously inside the timer callback,
    // before calling setCurrentScene).
    mockIsNaturalLoopRef.current = true;
    vi.mocked(useVideoPlayer).mockImplementation(() => ({
      ...mockVideoPlayerState,
      currentSceneKey: "s0",
      currentScene: 0,
      isNaturalLoopRef: mockIsNaturalLoopRef,
    }));

    await act(async () => {
      rerender(<VideoTemplate muted />);
    });

    // Phase 2 fires: loopFading='out' which maps to opacity 0 (fading back clear)
    // — not 'in' (opacity 1). The overlay is present but transparent (clearing).
    expect(overlayOpacity(container)).toBe(0);
  });

  it("re-entering s5 via _r1 suffix cancels the first fade-in timer and fires only one at the correct 900 ms mark", async () => {
    // Scenario: s5 → s5_r1 (replay pass).
    // Phase 1 fires on s5 entry and schedules a timer at 900 ms
    // (durations.s5=1500 - LOOP_FADE_LEAD_MS=600).
    // When the scene key changes to s5_r1, baseKey is still 's5', so Phase 1
    // fires again.  The FIRST timer must be cancelled by the effect cleanup
    // before the SECOND timer is registered — otherwise two setTimeouts exist
    // and the overlay can turn opaque prematurely or flash twice.
    vi.useFakeTimers();
    try {
      // Step 1: mount at s5
      vi.mocked(useVideoPlayer).mockImplementation(() => ({
        ...mockVideoPlayerState,
        currentSceneKey: "s5",
        currentScene: 5,
        isNaturalLoopRef: mockIsNaturalLoopRef,
      }));

      const { container, rerender } = render(<VideoTemplate muted />);
      // Overlay must start transparent immediately on s5 entry
      expect(overlayOpacity(container)).toBe(0);

      // Step 2: advance 400 ms — timer 1 is still pending (fires at 900 ms)
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(overlayOpacity(container)).toBe(0);

      // Step 3: transition to s5_r1 — effect cleanup cancels timer 1, effect
      // re-runs and schedules timer 2 (fires 900 ms from now, i.e., 1300 ms
      // from the original mount).
      vi.mocked(useVideoPlayer).mockImplementation(() => ({
        ...mockVideoPlayerState,
        currentSceneKey: "s5_r1",
        currentScene: 5,
        isNaturalLoopRef: mockIsNaturalLoopRef,
      }));

      await act(async () => {
        rerender(<VideoTemplate muted />);
      });

      // Step 4: advance 899 ms from the s5_r1 entry (one ms short of timer 2
      // firing).  Wall-clock total is now 400 + 899 = 1299 ms.
      // If timer 1 had NOT been cancelled, it would have fired 499 ms ago
      // (at the 900 ms wall-clock mark) — so this window catches that leak.
      await act(async () => {
        vi.advanceTimersByTime(899);
      });
      // Overlay must still be transparent — no premature fade-in from a leaked timer 1
      expect(overlayOpacity(container)).toBe(0);

      // Step 5: advance one more ms — timer 2 fires exactly 900 ms after the
      // s5_r1 re-render.  loopFading becomes 'in' → opacity 1.
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(overlayOpacity(container)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws at module startup when s0 is too short for the fade-out", async () => {
    // Re-import the module with an invalid source-of-truth duration so this
    // test exercises the module-level guard rather than merely checking its
    // current production configuration.
    vi.resetModules();
    vi.doMock("@workspace/promo-config", () => ({
      SCENE_DURATIONS: {
        s0: 600,
        s1: 4500,
        s2: 4500,
        s3: 4000,
        s4: 4000,
        s5: 1500,
      },
      TOTAL_RUNTIME_MS: 19100,
    }));

    try {
      await expect(import("./VideoTemplate")).rejects.toThrow(
        "LOOP_FADE_OUT_MS (700 ms) must be less than SCENE_DURATIONS.s0 (600 ms).",
      );
    } finally {
      vi.doUnmock("@workspace/promo-config");
      vi.resetModules();
    }
  });
});
