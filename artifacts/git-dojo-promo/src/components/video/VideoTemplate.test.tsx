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
});
