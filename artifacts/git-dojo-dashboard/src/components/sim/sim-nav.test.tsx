// @vitest-environment jsdom
/**
 * Regression tests for SimGlobalNav responsive layout.
 *
 * The phone-overflow fix changed the outer container height to:
 *   h-[600px] max-h-[50vh] sm:max-h-[70vh]
 *
 * These tests confirm:
 *   - The container carries the correct Tailwind classes so both the
 *     sm:max-h-[70vh] upgrade and the base max-h-[50vh] cap are present.
 *   - The nav bar (h-16) and the content area (flex-1) are both rendered,
 *     so content is always visible beneath the nav bar.
 *   - No forced overflow or hidden content by inspecting the overflow class.
 */

import React from "react";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { SimGlobalNav } from "./sim-nav";

// ---------------------------------------------------------------------------
// lucide-react: stub icons so jsdom doesn't choke on SVG imports.
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    Menu: s,
    Search: s,
    Bell: s,
    Plus: s,
    User: s,
    Inbox: s,
    X: s,
    FileText: s,
    ChevronRight: s,
  };
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Renders SimGlobalNav and returns its outermost DOM element. */
function renderNav(props: Partial<React.ComponentProps<typeof SimGlobalNav>> = {}) {
  const { container } = render(<SimGlobalNav {...props} />);
  // The outermost element is the scrolling container div
  return container.firstElementChild as HTMLElement;
}

// ---------------------------------------------------------------------------
// Responsive height classes
// ---------------------------------------------------------------------------

describe("SimGlobalNav responsive height classes", () => {
  it("has the fixed height class h-[600px]", () => {
    const el = renderNav();
    expect(el.className).toContain("h-[600px]");
  });

  it("has max-h-[50vh] for narrow (phone) viewports", () => {
    const el = renderNav();
    expect(el.className).toContain("max-h-[50vh]");
  });

  it("has sm:max-h-[70vh] so tablets at or above 640 px get more height", () => {
    // At 640px (sm breakpoint) the browser applies sm:max-h-[70vh] = ~448px,
    // which is comfortably above the h-16 nav bar leaving room for content.
    // jsdom cannot evaluate media queries, so we confirm the class is present.
    const el = renderNav();
    expect(el.className).toContain("sm:max-h-[70vh]");
  });

  it("uses overflow-hidden so content never bleeds outside the box", () => {
    const el = renderNav();
    expect(el.className).toContain("overflow-hidden");
  });

  it("is a flex-col container so nav bar and content stack vertically", () => {
    const el = renderNav();
    expect(el.className).toContain("flex-col");
  });
});

// ---------------------------------------------------------------------------
// Internal structure — nav bar and content area
// ---------------------------------------------------------------------------

describe("SimGlobalNav internal structure", () => {
  it("renders the top nav bar with h-16 (64px fixed height)", () => {
    const { container } = render(<SimGlobalNav />);
    // The first child of the outer container is the top nav bar
    const navBar = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(navBar).toBeTruthy();
    expect(navBar.className).toContain("h-16");
  });

  it("renders a flex-1 content area beneath the nav bar", () => {
    const { container } = render(<SimGlobalNav />);
    // The second child of the outer container is the content area
    const outer = container.firstElementChild as HTMLElement;
    const children = Array.from(outer.children) as HTMLElement[];
    expect(children.length).toBeGreaterThanOrEqual(2);
    const contentArea = children[1];
    expect(contentArea.className).toContain("flex-1");
  });

  it("content area has bg-[#0d1117] background (repo content placeholder)", () => {
    const { container } = render(<SimGlobalNav />);
    const outer = container.firstElementChild as HTMLElement;
    const contentArea = Array.from(outer.children)[1] as HTMLElement;
    expect(contentArea.className).toContain("bg-[#0d1117]");
  });
});

// ---------------------------------------------------------------------------
// Tablet breakpoint math verification (documented)
// ---------------------------------------------------------------------------

describe("SimGlobalNav tablet breakpoint geometry", () => {
  /**
   * At 640px wide × 900px tall (smallest tablet / sm breakpoint):
   *   sm:max-h-[70vh] = 0.70 × 900 = 630px
   *   h-[600px] < 630px  →  container is 600px tall
   *   nav bar  = 64px
   *   content  = 536px  (clearly visible)
   *
   * At 768px wide × 1024px tall (standard tablet):
   *   sm:max-h-[70vh] = 0.70 × 1024 = 717px
   *   h-[600px] < 717px  →  container is 600px tall
   *   nav bar  = 64px
   *   content  = 536px  (clearly visible)
   *
   * In both cases h-[600px] wins (it is smaller than max-h), so the container
   * is exactly 600px and the content placeholder is visible beneath the nav bar.
   *
   * This test locks down the class combination so a future change to any of
   * the three values re-runs this geometry check.
   */
  it("carries all three height tokens together (h-[600px] + max-h-[50vh] + sm:max-h-[70vh])", () => {
    const el = renderNav();
    expect(el.className).toContain("h-[600px]");
    expect(el.className).toContain("max-h-[50vh]");
    expect(el.className).toContain("sm:max-h-[70vh]");
  });
});
