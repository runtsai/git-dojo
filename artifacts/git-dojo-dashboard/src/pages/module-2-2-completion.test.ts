/**
 * Confirms that module 2.2's completion handler always fires
 * invalidateQueries with the progress key so the Ledger refreshes
 * without a page reload.
 *
 * The mechanism:
 *   Module2_2 fires completeModule.mutate(…)
 *     → onSuccess calls handleModule22Success(queryClient, setStep, onStepChange)
 *       → queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() })
 *       → useGetProgress() refetches automatically
 *       → completedVisualModules now includes "2.2"
 *
 * Removing or changing the invalidateQueries call in module-2-2.tsx
 * will break the relevant group below.
 */

import { describe, it, expect, vi } from "vitest";
import { getGetProgressQueryKey } from "@workspace/api-client-react";
import { handleModule22Success } from "@/content/tier2/module-2-2";

// ---------------------------------------------------------------------------
// 1. Completion handler — handleModule22Success (the real onSuccess code)
//    Removing or altering the invalidateQueries call in module-2-2.tsx
//    will break this group.
// ---------------------------------------------------------------------------

describe("handleModule22Success — invalidates the progress query", () => {
  it("calls queryClient.invalidateQueries exactly once", () => {
    const invalidateSpy = vi.fn();
    handleModule22Success({ invalidateQueries: invalidateSpy }, vi.fn());
    expect(invalidateSpy).toHaveBeenCalledOnce();
  });

  it("passes the progress query key to invalidateQueries", () => {
    const invalidateSpy = vi.fn();
    handleModule22Success({ invalidateQueries: invalidateSpy }, vi.fn());
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetProgressQueryKey(),
    });
  });

  it("advances to step 6 (the completion screen)", () => {
    const setStep = vi.fn();
    handleModule22Success({ invalidateQueries: vi.fn() }, setStep);
    expect(setStep).toHaveBeenCalledWith(6);
  });

  it("notifies onStepChange with 6 when provided", () => {
    const onStepChange = vi.fn();
    handleModule22Success({ invalidateQueries: vi.fn() }, vi.fn(), onStepChange);
    expect(onStepChange).toHaveBeenCalledWith(6);
  });

  it("does not throw when onStepChange is omitted", () => {
    expect(() =>
      handleModule22Success({ invalidateQueries: vi.fn() }, vi.fn()),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Query key stability — invalidation and subscription must match
// ---------------------------------------------------------------------------

describe("getGetProgressQueryKey — invalidation key stability (module 2.2)", () => {
  it("returns a non-empty array", () => {
    const key = getGetProgressQueryKey();
    expect(Array.isArray(key)).toBe(true);
    expect(key.length).toBeGreaterThan(0);
  });

  it("is stable across two calls (same key shape triggers the refetch)", () => {
    expect(getGetProgressQueryKey()).toEqual(getGetProgressQueryKey());
  });

  it("contains the progress endpoint identifier", () => {
    const keyStr = JSON.stringify(getGetProgressQueryKey());
    expect(
      keyStr,
      "The progress query key no longer contains 'progress'. " +
        "Update the invalidateQueries call in module-2-2.tsx and this test together.",
    ).toContain("progress");
  });
});
