// @vitest-environment jsdom
/**
 * Regression test: the N/M step badge on the SheetTrigger ("Where am I?")
 * always reflects the current stepIndex prop and never shows a stale count
 * after a hot-reload or prop update.
 *
 * MapPeek reads stepIndex directly from props on every render — there is no
 * local state that could cache a previous value.  These tests confirm that
 * any re-render with a new stepIndex immediately produces the correct badge
 * text (or hides it), with no stale count remaining in the DOM.
 */

import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { MapPeek } from "./map-peek";

// ---------------------------------------------------------------------------
// Mocks — only heavy rendering dependencies; step-chip logic is exercised
// through the real implementation.
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => {
  const s = () => null;
  return { Map: s, MapPin: s, ArrowRight: s };
});

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("@/components/map-diagram", () => ({
  MapDiagram: () => null,
  PLACE_ICONS: {},
}));

vi.mock("@/components/map-peek-gesture", () => ({
  shouldDismissOnSwipe: () => false,
  SWIPE_DISMISS_THRESHOLD: 60,
}));

/**
 * SheetTrigger must render its children so the badge text is query-able.
 * The rest of the Sheet family can safely return null for this test.
 */
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SheetTrigger: ({
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    children?: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) =>
    React.createElement("button", { className, "aria-label": ariaLabel }, children),
  SheetContent: () => null,
  SheetHeader: () => null,
  SheetTitle: () => null,
  SheetDescription: () => null,
}));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fixture — locationId "1.1" has exactly 5 steps in the real content map.
// ---------------------------------------------------------------------------
const LOC = "1.1";
const TOTAL = 5;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MapPeek step badge — freshness on re-render", () => {
  it("shows the correct N/M badge on first render", () => {
    render(<MapPeek locationId={LOC} stepIndex={1} />);
    expect(screen.getByText(`1/${TOTAL}`)).toBeTruthy();
  });

  it("updates the badge when stepIndex prop changes (simulates hot-reload prop update)", () => {
    const { rerender } = render(<MapPeek locationId={LOC} stepIndex={1} />);
    expect(screen.getByText(`1/${TOTAL}`)).toBeTruthy();

    rerender(<MapPeek locationId={LOC} stepIndex={3} />);
    expect(screen.getByText(`3/${TOTAL}`)).toBeTruthy();
    // Stale text from the previous render must be absent.
    expect(screen.queryByText(`1/${TOTAL}`)).toBeNull();
  });

  it("updates the badge across every valid step in sequence", () => {
    const { rerender } = render(<MapPeek locationId={LOC} stepIndex={1} />);
    for (let step = 1; step <= TOTAL; step++) {
      rerender(<MapPeek locationId={LOC} stepIndex={step} />);
      expect(screen.getByText(`${step}/${TOTAL}`)).toBeTruthy();
      // No other N/TOTAL text should be present.
      for (let other = 1; other <= TOTAL; other++) {
        if (other !== step) {
          expect(screen.queryByText(`${other}/${TOTAL}`)).toBeNull();
        }
      }
    }
  });

  it("shows badge on the last valid step", () => {
    render(<MapPeek locationId={LOC} stepIndex={TOTAL} />);
    expect(screen.getByText(`${TOTAL}/${TOTAL}`)).toBeTruthy();
  });

  it("hides the badge when stepIndex overshoots totalSteps (completion-screen edge case)", () => {
    const { rerender } = render(<MapPeek locationId={LOC} stepIndex={3} />);
    expect(screen.getByText(`3/${TOTAL}`)).toBeTruthy();

    rerender(<MapPeek locationId={LOC} stepIndex={TOTAL + 1} />);
    // Overshoot badge must not appear.
    expect(screen.queryByText(`${TOTAL + 1}/${TOTAL}`)).toBeNull();
    // Stale count from the previous render must also be gone.
    expect(screen.queryByText(`3/${TOTAL}`)).toBeNull();
  });

  it("hides the badge when stepIndex becomes undefined after being defined", () => {
    const { rerender } = render(<MapPeek locationId={LOC} stepIndex={2} />);
    expect(screen.getByText(`2/${TOTAL}`)).toBeTruthy();

    rerender(<MapPeek locationId={LOC} stepIndex={undefined} />);
    // Stale badge must disappear when step tracking is removed.
    expect(screen.queryByText(`2/${TOTAL}`)).toBeNull();
  });

  it("hides the badge when a location has no steps array (CLI lessons)", () => {
    // "lesson-01" is a CLI lesson with no per-step overrides.
    render(<MapPeek locationId="lesson-01" stepIndex={1} />);
    // steps?.length is undefined → isValidStepChip returns false → no badge.
    expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull();
  });
});
