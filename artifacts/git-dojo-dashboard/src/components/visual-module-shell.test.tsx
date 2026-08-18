// @vitest-environment jsdom
/**
 * Unit tests for VisualModuleShell.
 *
 * Covers the highest-risk combinations:
 *   - Completion screen appears at the right step (standard + custom slot)
 *   - Back-only / Back+Next / Back+Submit nav rows
 *   - isSubmitDisabled gates the submit button
 *   - isPending shows "Grading…" and disables the button
 *   - Error banner renders when the error prop is set
 *   - Progress dots reflect the current step
 */

import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { VisualModuleShell } from "./visual-module-shell";

// ---------------------------------------------------------------------------
// lucide-react: override the node-env stub so jsdom renders icons as null.
// All stubs defined inline — vi.mock factories are hoisted before top-level
// variable initialisation, so references to outer variables would fail.
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => {
  const s = () => null;
  return {
    ArrowLeft: s,
    CheckCircle2: s,
    ChevronRight: s,
    AlertCircle: s,
  };
});

// ---------------------------------------------------------------------------
// wouter: VisualModuleShell uses <Link> for the "Back to Ledger" anchor and
// the completion-screen links.
// ---------------------------------------------------------------------------
vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    className,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) =>
    React.createElement("a", { href, className, ...rest }, children),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal required props for a mid-module step. */
function base(overrides: Partial<React.ComponentProps<typeof VisualModuleShell>> = {}) {
  return {
    title: "Test Module",
    step: 1,
    children: <span data-testid="child">content</span>,
    ...overrides,
  } as React.ComponentProps<typeof VisualModuleShell>;
}

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Completion screen
// ---------------------------------------------------------------------------

describe("completion screen", () => {
  it("does NOT render at a non-completion step", () => {
    render(<VisualModuleShell {...base({ step: 1, completionStep: 6 })} />);
    expect(screen.queryByText("Module Complete")).toBeNull();
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("renders the standard completion screen when step === completionStep", () => {
    render(
      <VisualModuleShell
        {...base({
          step: 6,
          completionStep: 6,
          completionTitle: "Well Done",
          completionText: "You finished.",
        })}
      />,
    );
    expect(screen.getByText("Well Done")).toBeTruthy();
    expect(screen.getByText("You finished.")).toBeTruthy();
    // Step content must be absent on the completion screen
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("uses completionStep = 6 as default", () => {
    render(<VisualModuleShell {...base({ step: 6 })} />);
    expect(screen.getByText("Module Complete")).toBeTruthy();
  });

  it("renders a custom completionSlot instead of the standard screen", () => {
    render(
      <VisualModuleShell
        {...base({
          step: 6,
          completionStep: 6,
          completionSlot: <div data-testid="custom-slot">custom</div>,
        })}
      />,
    );
    expect(screen.getByTestId("custom-slot")).toBeTruthy();
    // Standard completion title must be absent
    expect(screen.queryByText("Module Complete")).toBeNull();
  });

  it("renders the Next Module link when nextModuleHref is provided on completion", () => {
    render(
      <VisualModuleShell
        {...base({
          step: 6,
          completionStep: 6,
          nextModuleHref: "/module-2",
          nextModuleLabel: "Go to Module 2",
        })}
      />,
    );
    const link = screen.getByText("Go to Module 2");
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("/module-2");
  });

  it("does NOT render at a custom completionStep before that step", () => {
    render(
      <VisualModuleShell
        {...base({ step: 3, completionStep: 4 })}
      />,
    );
    expect(screen.queryByText("Module Complete")).toBeNull();
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("renders at a custom completionStep", () => {
    render(
      <VisualModuleShell
        {...base({ step: 4, completionStep: 4 })}
      />,
    );
    expect(screen.getByText("Module Complete")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Nav row — button presence
// ---------------------------------------------------------------------------

describe("nav row", () => {
  it("shows no nav row when onPrev, onNext, and onSubmit are all absent", () => {
    render(<VisualModuleShell {...base()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows only Back when only onPrev is provided", () => {
    render(<VisualModuleShell {...base({ onPrev: vi.fn() })} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain("Back");
  });

  it("shows Back and Continue when onPrev + onNext are provided", () => {
    render(<VisualModuleShell {...base({ onPrev: vi.fn(), onNext: vi.fn() })} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    const labels = buttons.map((b) => b.textContent ?? "");
    expect(labels.some((l) => l.includes("Back"))).toBe(true);
    expect(labels.some((l) => l.includes("Continue"))).toBe(true);
  });

  it("prefers onSubmit over onNext when both are provided", () => {
    render(
      <VisualModuleShell
        {...base({
          onNext: vi.fn(),
          onSubmit: vi.fn(),
          submitLabel: "Submit",
        })}
      />,
    );
    // Submit button must be present; Continue must not be
    const buttons = screen.getAllByRole("button");
    const labels = buttons.map((b) => b.textContent ?? "");
    expect(labels.some((l) => l.includes("Submit"))).toBe(true);
    expect(labels.some((l) => l.includes("Continue"))).toBe(false);
  });

  it("fires onPrev when Back is clicked", () => {
    const onPrev = vi.fn();
    render(<VisualModuleShell {...base({ onPrev })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("fires onNext when Continue is clicked", () => {
    const onNext = vi.fn();
    render(<VisualModuleShell {...base({ onNext })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("fires onSubmit when Submit is clicked", () => {
    const onSubmit = vi.fn();
    render(<VisualModuleShell {...base({ onSubmit })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Submit disabled states
// ---------------------------------------------------------------------------

describe("isSubmitDisabled", () => {
  it("enables the submit button by default", () => {
    render(<VisualModuleShell {...base({ onSubmit: vi.fn() })} />);
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables the submit button when isSubmitDisabled is true", () => {
    render(
      <VisualModuleShell {...base({ onSubmit: vi.fn(), isSubmitDisabled: true })} />,
    );
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("does NOT disable the Back button when isSubmitDisabled is true", () => {
    render(
      <VisualModuleShell
        {...base({ onPrev: vi.fn(), onSubmit: vi.fn(), isSubmitDisabled: true })}
      />,
    );
    const buttons = screen.getAllByRole("button");
    const backBtn = buttons.find((b) => b.textContent?.includes("Back"))!;
    expect((backBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps the submit button disabled when error is set alongside isSubmitDisabled=true", () => {
    render(
      <VisualModuleShell
        {...base({
          onSubmit: vi.fn(),
          isSubmitDisabled: true,
          error: "Grading failed — please wait",
        })}
      />,
    );
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // Error banner must also be visible
    expect(screen.getByRole("alert").textContent).toContain("Grading failed — please wait");
  });

  it("re-enables the submit button when error is cleared and isSubmitDisabled returns to false", () => {
    const { rerender } = render(
      <VisualModuleShell
        {...base({
          onSubmit: vi.fn(),
          isSubmitDisabled: true,
          error: "Grading failed — please wait",
        })}
      />,
    );
    // Confirm disabled during error state
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);

    // Simulate recovery: error cleared, isSubmitDisabled back to false
    rerender(
      <VisualModuleShell
        {...base({
          onSubmit: vi.fn(),
          isSubmitDisabled: false,
          error: null,
        })}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isPending
// ---------------------------------------------------------------------------

describe("isPending", () => {
  it("shows the submit label when isPending is false", () => {
    render(
      <VisualModuleShell
        {...base({ onSubmit: vi.fn(), submitLabel: "Complete Task", isPending: false })}
      />,
    );
    expect(screen.getByRole("button").textContent).toContain("Complete Task");
  });

  it("shows 'Grading…' when isPending is true", () => {
    render(
      <VisualModuleShell
        {...base({ onSubmit: vi.fn(), isPending: true })}
      />,
    );
    expect(screen.getByRole("button").textContent).toContain("Grading");
  });

  it("disables the submit button when isPending is true", () => {
    render(
      <VisualModuleShell {...base({ onSubmit: vi.fn(), isPending: true })} />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables the submit button when both isPending and isSubmitDisabled are true", () => {
    render(
      <VisualModuleShell
        {...base({ onSubmit: vi.fn(), isPending: true, isSubmitDisabled: true })}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

describe("error banner", () => {
  it("does not render an error banner when error is null", () => {
    render(<VisualModuleShell {...base({ error: null })} />);
    expect(screen.queryByRole("alert")).toBeNull();
    // Also verify no error text is visible
    expect(document.querySelector(".bg-destructive\\/10")).toBeNull();
  });

  it("does not render an error banner when error is undefined", () => {
    render(<VisualModuleShell {...base()} />);
    expect(document.querySelector(".bg-destructive\\/10")).toBeNull();
  });

  it("renders the error banner with the provided message", () => {
    render(<VisualModuleShell {...base({ error: "Something went wrong" })} />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("renders different error messages correctly", () => {
    render(
      <VisualModuleShell {...base({ error: "Network timeout. Please retry." })} />,
    );
    expect(screen.getByText("Network timeout. Please retry.")).toBeTruthy();
  });

  it("has role='alert' on the error banner so screen readers announce it", () => {
    render(<VisualModuleShell {...base({ error: "Something went wrong" })} />);
    const banner = screen.getByRole("alert");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain("Something went wrong");
  });

  it("does not render a role='alert' element when error is null", () => {
    render(<VisualModuleShell {...base({ error: null })} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not render a role='alert' element when error is undefined", () => {
    render(<VisualModuleShell {...base()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Progress dots
// ---------------------------------------------------------------------------

describe("progress dots", () => {
  it("renders the configured number of dots", () => {
    const { container } = render(
      <VisualModuleShell {...base({ step: 3, totalDots: 3 })} />,
    );
    const dots = Array.from(container.querySelectorAll(".w-2.h-2.rounded-full"));
    expect(dots).toHaveLength(3);
  });

  it("marks the current dot as active (bg-primary scale-150)", () => {
    const { container } = render(
      <VisualModuleShell {...base({ step: 2, totalDots: 3 })} />,
    );
    const dots = Array.from(container.querySelectorAll(".w-2.h-2.rounded-full"));
    // dot index 1 = step 2 = current
    expect(dots[1].className).toContain("bg-primary");
    expect(dots[1].className).toContain("scale-150");
  });

  it("marks past dots with a dimmer active class (bg-primary/50)", () => {
    const { container } = render(
      <VisualModuleShell {...base({ step: 3, totalDots: 3 })} />,
    );
    const dots = Array.from(container.querySelectorAll(".w-2.h-2.rounded-full"));
    // dots 0 and 1 (i=1 and i=2) are before current step 3
    expect(dots[0].className).toContain("bg-primary/50");
    expect(dots[1].className).toContain("bg-primary/50");
  });

  it("marks future dots with the inactive class (bg-white/10)", () => {
    const { container } = render(
      <VisualModuleShell {...base({ step: 1, totalDots: 3 })} />,
    );
    const dots = Array.from(container.querySelectorAll(".w-2.h-2.rounded-full"));
    // dots 1 and 2 (i=2 and i=3) are after current step 1
    expect(dots[1].className).toContain("bg-white/10");
    expect(dots[2].className).toContain("bg-white/10");
  });
});
