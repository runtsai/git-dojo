// @vitest-environment jsdom
/**
 * Tests that the orientation and mobile-notice banners in Home behave
 * correctly when localStorage is completely unavailable (private browsing /
 * security error / quota error). safeStorage must fall back to its in-memory
 * store so the UI still shows/hides as expected.
 */

import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeStorage } from "@/lib/safe-storage";

// ---------------------------------------------------------------------------
// External module mocks — must be defined before the component import so
// vi.mock hoisting can apply them.
// ---------------------------------------------------------------------------

// API hooks — return loading:false and empty data so the page body renders.
vi.mock("@workspace/api-client-react", () => ({
  useGetProgress: () => ({ data: { entries: [] }, isLoading: false }),
  useListLessons: () => ({ data: [], isLoading: false }),
}));

// wouter — provide minimal <Link> and useLocation stubs.
vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  Link: ({
    href,
    children,
    className,
    onClick,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) =>
    React.createElement("a", { href, className, onClick, ...rest }, children),
}));

// lucide-react — stub every icon used by home.tsx to a simple null renderer.
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    CheckCircle2: s,
    Lock: s,
    Terminal: s,
    Shield: s,
    Award: s,
    Trophy: s,
    Lightbulb: s,
    Play: s,
    Map: s,
    X: s,
    Rocket: s,
    Siren: s,
  };
});

// git-icons — used by the orientation panel.
vi.mock("@/components/git-icons", () => ({
  ComputerIcon: () => null,
  StickerIcon: () => null,
}));

// Content arrays — the exact values don't matter for banner tests.
vi.mock("@/content/tiers", () => ({ tiers: [] }));
vi.mock("@/content/breakthroughs", () => ({ breakthroughs: [] }));
vi.mock("@/content/crises", () => ({ crises: [] }));

// Prereq helper — nothing is locked.
vi.mock("@/lib/prereq", () => ({
  isPrereqLocked: () => false,
}));

// Badge shelf — no badges earned.
vi.mock("@/lib/badge-shelf", () => ({
  computeBadgeShelf: () => ({
    completedTiers: [],
    earnedCliBadges: [],
    earnedCrisisBadges: [],
    hasAnyBadge: false,
  }),
}));

// ---------------------------------------------------------------------------
// Import the component AFTER mocks are registered.
// ---------------------------------------------------------------------------
import { Home } from "./home";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make every localStorage method throw a SecurityError on every call. */
function breakLocalStorage() {
  const err = () => {
    throw new DOMException("SecurityError: storage is blocked", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(err);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(err);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(err);
  vi.spyOn(Storage.prototype, "clear").mockImplementation(err);
}

/**
 * Return the dismiss button that belongs to the orientation panel.
 *
 * Home renders two aria-label="Dismiss" buttons when both banners are visible:
 *   [0] mobile-notice dismiss
 *   [1] orientation-panel dismiss  ← the one we care about
 *
 * The orientation panel is always last because it is rendered after the mobile
 * notice in the JSX tree.
 */
function getOrientationDismissButton() {
  const buttons = screen.getAllByLabelText("Dismiss");
  return buttons[buttons.length - 1];
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset in-memory fallback between tests.
  safeStorage._resetMemStore();
  // Break localStorage to simulate private browsing.
  breakLocalStorage();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Orientation banner — private browsing (localStorage fully broken)
// ---------------------------------------------------------------------------

describe("orientation banner — localStorage unavailable (private browsing)", () => {
  it("shows the orientation banner by default when localStorage is blocked", () => {
    render(<Home />);
    // The "Start here" heading is the orientation panel's title.
    expect(screen.getByText("Start here")).toBeTruthy();
  });

  it("shows the 'Begin Module 1.1' button inside the orientation panel", () => {
    render(<Home />);
    expect(screen.getByText("Begin Module 1.1")).toBeTruthy();
  });

  it("hides the orientation banner after the dismiss button is clicked", () => {
    render(<Home />);
    // Click the orientation-panel dismiss (×) button.
    fireEvent.click(getOrientationDismissButton());
    // The panel title must no longer be in the document.
    expect(screen.queryByText("Start here")).toBeNull();
  });

  it("sets the in-memory fallback so re-reading the key returns 'true' after dismiss", () => {
    render(<Home />);
    fireEvent.click(getOrientationDismissButton());
    // safeStorage must have written "true" to the memory store even though
    // localStorage threw.
    expect(safeStorage.getItem("dojo-orientation-dismissed")).toBe("true");
  });

  it("does not throw when dismissing even though localStorage is broken", () => {
    render(<Home />);
    expect(() => fireEvent.click(getOrientationDismissButton())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Orientation banner — localStorage blocked from the start (getItem throws
// before any write has seeded the in-memory store).
// ---------------------------------------------------------------------------

describe("orientation banner — localStorage blocked before first read", () => {
  it("treats the banner as un-dismissed when getItem throws and memStore is empty", () => {
    // memStore was reset in beforeEach, storage is broken — no prior write.
    render(<Home />);
    expect(screen.getByText("Start here")).toBeTruthy();
  });
});
