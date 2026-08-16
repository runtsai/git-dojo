/**
 * Confirms that module 2.4 unlocks the moment module 2.3 is marked complete,
 * without a page reload.
 *
 * The mechanism:
 *   Module2_3 component fires completeModule.mutate(…)
 *     → onSuccess calls handleModule23Success(queryClient, setStep, onStepChange)
 *       → queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() })
 *       → useGetProgress() (home.tsx + learn.tsx) refetches automatically
 *       → completedVisualModules now includes "2.3"
 *       → isPrereqLocked("2.3", completedVisualModules) returns false
 *       → lock icon disappears in both the Ledger and /learn/2-4
 *
 * Every link in that chain is exercised by these tests.  Removing or changing
 * any one of them (the invalidateQueries call, the query key, the prerequisite
 * declaration, the lock predicate) will break the relevant group below.
 */

import { describe, it, expect, vi } from "vitest";
import { tiers } from "@/content/tiers";
import { getGetProgressQueryKey } from "@workspace/api-client-react";
import { isPrereqLocked } from "@/lib/prereq";
import { handleModule23Success } from "@/content/tier2/module-2-3";
import { LEARN_ROUTE_KEYS } from "@/pages/learn-route-keys";

// ---------------------------------------------------------------------------
// Locate 2.3 and 2.4 in the tiers config
// ---------------------------------------------------------------------------

const allModules = tiers.flatMap((t) => t.modules ?? []);
const mod2_3 = allModules.find((m) => m.id === "2.3");
const mod2_4 = allModules.find((m) => m.id === "2.4");

// ---------------------------------------------------------------------------
// 1. Tier config contract — 2.4 must declare 2.3 as its prerequisite
// ---------------------------------------------------------------------------

describe("tiers config — 2.4 prerequisite declaration", () => {
  it("module 2.4 exists in the tiers config", () => {
    expect(mod2_4, "Module 2.4 is missing from src/content/tiers.ts").toBeDefined();
  });

  it("module 2.3 exists in the tiers config", () => {
    expect(mod2_3, "Module 2.3 is missing from src/content/tiers.ts").toBeDefined();
  });

  it('module 2.4 declares prerequisite "2.3"', () => {
    expect(
      mod2_4?.prerequisite,
      'Module 2.4 must have prerequisite: "2.3" so the gate fires on completion of 2.3.',
    ).toBe("2.3");
  });

  it("module 2.3 has no prerequisite (it is not itself gated)", () => {
    expect(
      mod2_3?.prerequisite,
      "Module 2.3 unexpectedly has a prerequisite — check tiers.ts.",
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Completion handler — handleModule23Success (the real onSuccess code)
//    Removing or altering the invalidateQueries call in module-2-3.tsx
//    will break this group.
// ---------------------------------------------------------------------------

describe("handleModule23Success — invalidates the progress query", () => {
  it("calls queryClient.invalidateQueries exactly once", () => {
    const invalidateSpy = vi.fn();
    handleModule23Success({ invalidateQueries: invalidateSpy }, vi.fn());
    expect(invalidateSpy).toHaveBeenCalledOnce();
  });

  it("passes the progress query key to invalidateQueries", () => {
    const invalidateSpy = vi.fn();
    handleModule23Success({ invalidateQueries: invalidateSpy }, vi.fn());
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getGetProgressQueryKey(),
    });
  });

  it("advances to step 6 (the completion screen)", () => {
    const setStep = vi.fn();
    handleModule23Success({ invalidateQueries: vi.fn() }, setStep);
    expect(setStep).toHaveBeenCalledWith(6);
  });

  it("notifies onStepChange with 6 when provided", () => {
    const onStepChange = vi.fn();
    handleModule23Success({ invalidateQueries: vi.fn() }, vi.fn(), onStepChange);
    expect(onStepChange).toHaveBeenCalledWith(6);
  });

  it("does not throw when onStepChange is omitted", () => {
    expect(() =>
      handleModule23Success({ invalidateQueries: vi.fn() }, vi.fn()),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. isPrereqLocked — the shared lock predicate used by home.tsx + learn.tsx
//    Both pages import this function; these tests exercise the real function.
// ---------------------------------------------------------------------------

describe("isPrereqLocked — Ledger and route gate (home.tsx + learn.tsx)", () => {
  const prereq = mod2_4?.prerequisite; // "2.3"

  it("2.4 is locked when progress is empty", () => {
    expect(isPrereqLocked(prereq, [])).toBe(true);
  });

  it("2.4 is locked when only unrelated modules are complete", () => {
    expect(isPrereqLocked(prereq, ["1.1", "1.2", "2.1", "2.2"])).toBe(true);
  });

  it("2.4 unlocks the moment '2.3' appears in completedVisualModules", () => {
    expect(isPrereqLocked(prereq, ["2.3"])).toBe(false);
  });

  it("2.4 stays unlocked when 2.3 is among other completed modules", () => {
    expect(isPrereqLocked(prereq, ["1.1", "2.1", "2.2", "2.3"])).toBe(false);
  });

  it("a module with no prerequisite is never locked", () => {
    expect(isPrereqLocked(undefined, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Route-map integrity — the hard-coded CTA href "/learn/2-4" must resolve
//    LEARN_ROUTE_KEYS (learn-route-keys.ts) is the side-effect-free source of
//    truth; learn.tsx is typed against it so both stay in sync.
//    If 2.4's slug ever changes or the module is removed, this test catches it.
// ---------------------------------------------------------------------------

describe("LEARN_ROUTE_KEYS — 2-4 CTA target is registered", () => {
  it('route key "2-4" is present in LEARN_ROUTE_KEYS', () => {
    expect(
      (LEARN_ROUTE_KEYS as readonly string[]).includes("2-4"),
      '"2-4" is missing from LEARN_ROUTE_KEYS in learn-route-keys.ts. ' +
        'The CTA link nextModuleHref="/learn/2-4" in module-2-3.tsx would silently ' +
        "point nowhere. Either restore the key or update the CTA href to match the new slug.",
    ).toBe(true);
  });

  it("LEARN_ROUTE_KEYS is a non-empty array", () => {
    expect(Array.isArray(LEARN_ROUTE_KEYS)).toBe(true);
    expect(LEARN_ROUTE_KEYS.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Query key stability — invalidation and subscription must match
//    Both module-2-3.tsx (writer) and useGetProgress (reader) derive their
//    key from getGetProgressQueryKey().  If the shape changes, refetch breaks.
// ---------------------------------------------------------------------------

describe("getGetProgressQueryKey — invalidation key stability", () => {
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
        "Update the invalidateQueries call in module-2-3.tsx and this test together.",
    ).toContain("progress");
  });
});
