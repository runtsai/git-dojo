/**
 * Tests for VideoWithControls – ExportModal duration display.
 *
 * Invariant being guarded:
 *   The ExportModal's displayed duration ("~Xs") must be derived exclusively
 *   from TOTAL_RUNTIME_MS in @workspace/promo-config, with no local constant
 *   that could diverge when scenes are added or removed from SCENE_DURATIONS.
 *
 * Strategy:
 *   - ExportModal is exported as a named export so it can be rendered in
 *     isolation without VideoTemplate / useSceneControls / useExportRecorder.
 *   - @workspace/promo-config is mocked with a getter so individual tests
 *     control mockTotalRuntimeMs and observe the effect on the modal text.
 *   - Each test sets mockTotalRuntimeMs, renders ExportModal in 'idle' state,
 *     then asserts the "~Xs" text matches Math.round(mockTotalRuntimeMs / 1000).
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// `mock`-prefixed variables are hoisted by Vitest alongside vi.mock factories.
let mockTotalRuntimeMs = 22500; // 22.5 s → rounds to 23

vi.mock("@workspace/promo-config", () => ({
  get TOTAL_RUNTIME_MS() {
    return mockTotalRuntimeMs;
  },
  get TOTAL_RUNTIME_SEC() {
    return mockTotalRuntimeMs / 1000;
  },
  SCENE_DURATIONS: { s0: 4000, s1: 4500, s2: 4500, s3: 4000, s4: 4000, s5: 1500 },
}));

// Stub VideoTemplate to avoid Three.js / WebGL / audio imports.
vi.mock("./VideoTemplate", () => ({
  default: () => React.createElement("div", { "data-testid": "video-template" }),
  SCENE_DURATIONS: { s0: 4000, s1: 4500, s2: 4500, s3: 4000, s4: 4000, s5: 1500 },
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks are registered
// ---------------------------------------------------------------------------
import { ExportModal } from "./VideoWithControls";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = () => {};

/** Render ExportModal in idle state and return the rendered container. */
function renderIdleModal() {
  return render(
    <ExportModal
      state="idle"
      errorMessage=""
      onStart={noop}
      onCancel={noop}
      onClose={noop}
    />,
  );
}

/** Return the seconds value shown in the export modal description paragraph. */
function getDisplayedSec(): number {
  // The idle-state paragraph reads: "The video (~Xs) is rendered on the server…"
  const para = screen.getByText(/The video \(~\d+s\)/i);
  const match = para.textContent?.match(/~(\d+)s/);
  if (!match) throw new Error(`Duration text not found in: ${para.textContent}`);
  return Number(match[1]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExportModal – duration reflects TOTAL_RUNTIME_MS from promo-config", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    // Reset to the current real total before each test.
    mockTotalRuntimeMs = 22500;
  });

  it("shows the correct seconds for the default scene set (22 500 ms → 23 s)", () => {
    mockTotalRuntimeMs = 22500; // Math.round(22500 / 1000) === 23
    renderIdleModal();
    expect(getDisplayedSec()).toBe(23);
  });

  it("reflects the new total when a scene is added (22 500 + 4 000 ms = 26 500 ms → 27 s)", () => {
    // Simulates inserting a new 4 000 ms scene into SCENE_DURATIONS.
    mockTotalRuntimeMs = 26500;
    renderIdleModal();
    expect(getDisplayedSec()).toBe(Math.round(26500 / 1000)); // 27
  });

  it("reflects the new total when a scene is removed (22 500 − 4 500 ms = 18 000 ms → 18 s)", () => {
    // Simulates removing the 4 500 ms s1 scene from SCENE_DURATIONS.
    mockTotalRuntimeMs = 18000;
    renderIdleModal();
    expect(getDisplayedSec()).toBe(Math.round(18000 / 1000)); // 18
  });

  it("rounds a fractional total correctly (7 250 ms → 7 s, not 8)", () => {
    // Confirms Math.round is applied (not Math.ceil which would give 8).
    mockTotalRuntimeMs = 7250;
    renderIdleModal();
    expect(getDisplayedSec()).toBe(Math.round(7250 / 1000)); // 7
  });

  it("displayed seconds always equal Math.round(TOTAL_RUNTIME_MS / 1000) for any value", () => {
    // Parametric sanity: an arbitrary total confirms the formula is live,
    // not a cached or hard-coded constant.
    const arbitrary = 15750; // 15.75 s → rounds to 16
    mockTotalRuntimeMs = arbitrary;
    renderIdleModal();
    expect(getDisplayedSec()).toBe(Math.round(arbitrary / 1000)); // 16
  });
});
