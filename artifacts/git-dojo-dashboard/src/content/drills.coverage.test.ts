/**
 * Drill-bank coverage check.
 *
 * Every piece of content in Git Dojo must be backed by at least one warm-up
 * drill.  This test cross-references four authoritative content registries
 * against the drillBank and fails loudly when a content item has no drills.
 *
 * When you add new content, read ADDING_DRILLS.md for the authoring guide.
 */

import { describe, it, expect } from "vitest";
import { tiers } from "./tiers";
import type { TierDef } from "./tiers";
import { breakthroughs } from "./breakthroughs/index";
import { crises } from "./crises";
import { lessonLocations } from "./map/index";
import { CLI_LESSON_IDS } from "./lessons";
import { drillBank } from "./drills";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the module IDs that belong to tiers whose status is "active".
 * coming_soon tiers are explicitly excluded so their module IDs never appear
 * in coverage or integrity sets.
 *
 * This helper is used by both the production derived sets below AND the
 * fixture-based regression test, ensuring that any weakening of the status
 * filter is caught by the fixture test even when the real tier data has no
 * modules on coming_soon tiers.
 */
export function activeModuleIdsFrom(tierList: TierDef[]): string[] {
  return tierList
    .filter((t) => t.status === "active")
    .flatMap((t) => (t.modules ?? []).map((m) => m.id));
}

// ── Derived content sets ─────────────────────────────────────────────────────

/** Module ids from active tiers only (coming_soon tiers are skipped). */
const activeModuleIds: string[] = activeModuleIdsFrom(tiers);

/** Breakthrough ids from the breakthroughs registry. */
const breakthroughIds: string[] = breakthroughs.map((b) => b.id);

/** Crisis ids from the crisis registry. */
const crisisIds: string[] = crises.map((c) => c.id);

/**
 * CLI lesson ids come from the map lessonLocations keys that match the
 * "lesson-XX" pattern.  Adding a new lesson to the Map automatically
 * subjects it to this coverage check.
 */
const lessonIds: string[] = Object.keys(lessonLocations).filter((k) =>
  /^lesson-\d+$/.test(k),
);

// ── Pre-built lookup sets ────────────────────────────────────────────────────

/** All IDs that appear in any drill's unlockedBy array. */
const coveredByUnlockedBy = new Set(drillBank.flatMap((d) => d.unlockedBy));

/** All breakthrough IDs that appear in any drill's breakthroughId field. */
const coveredByBreakthroughId = new Set(
  drillBank.flatMap((d) => (d.breakthroughId ? [d.breakthroughId] : [])),
);

// ── Tests ────────────────────────────────────────────────────────────────────

describe("drills coverage — active modules", () => {
  it.each(activeModuleIds)(
    "module %s has at least one drill (unlockedBy)",
    (moduleId) => {
      expect(
        coveredByUnlockedBy.has(moduleId),
        `Module "${moduleId}" has no drills. ` +
          `Add a drill to drills.ts with "${moduleId}" in its unlockedBy array. ` +
          `See src/content/ADDING_DRILLS.md for the authoring guide.`,
      ).toBe(true);
    },
  );
});

describe("drills coverage — CLI lessons", () => {
  it.each(lessonIds)(
    "lesson %s has at least one drill (unlockedBy)",
    (lessonId) => {
      expect(
        coveredByUnlockedBy.has(lessonId),
        `Lesson "${lessonId}" has no drills. ` +
          `Add a drill to drills.ts with "${lessonId}" in its unlockedBy array. ` +
          `See src/content/ADDING_DRILLS.md for the authoring guide.`,
      ).toBe(true);
    },
  );
});

describe("drills coverage — crises", () => {
  it.each(crisisIds)(
    "%s has at least one drill (unlockedBy)",
    (crisisId) => {
      expect(
        coveredByUnlockedBy.has(crisisId),
        `Crisis "${crisisId}" has no drills. ` +
          `Add a drill to drills.ts with "${crisisId}" in its unlockedBy array. ` +
          `See src/content/ADDING_DRILLS.md for the authoring guide.`,
      ).toBe(true);
    },
  );
});

describe("drills coverage — breakthroughs", () => {
  it.each(breakthroughIds)(
    'breakthrough "%s" has at least one drill (breakthroughId)',
    (btId) => {
      expect(
        coveredByBreakthroughId.has(btId),
        `Breakthrough "${btId}" has no drills. ` +
          `Add a drill to drills.ts with breakthroughId: "${btId}". ` +
          `See src/content/ADDING_DRILLS.md for the authoring guide.`,
      ).toBe(true);
    },
  );
});

describe("drills integrity — sourceId-free drills still contribute unlockedBy coverage", () => {
  /**
   * Regression guard: the coveredByUnlockedBy derivation must include drills
   * that omit sourceId.  This test uses the real coveredByUnlockedBy Set
   * (produced at the top of this file) and cross-checks it against what you
   * would get if the derivation erroneously skipped sourceId-free drills —
   * so a `.filter(d => d.sourceId)` regression in the derivation would be
   * caught here.
   */

  /** IDs that would be covered if the derivation only used drills with a sourceId. */
  const coveredBySourceIdDrillsOnly = new Set(
    drillBank
      .filter((d) => d.sourceId !== undefined)
      .flatMap((d) => d.unlockedBy),
  );

  /** Drills that have no sourceId. */
  const sourceIdFreeDrills = drillBank.filter((d) => d.sourceId === undefined);

  /**
   * IDs that only a sourceId-free drill contributes — these would disappear
   * from the covered set if someone added `.filter(d => d.sourceId)` to the
   * coveredByUnlockedBy derivation above.
   */
  const idsExclusiveToSourceIdFreeDrills = [
    ...new Set(
      sourceIdFreeDrills
        .flatMap((d) => d.unlockedBy)
        .filter((id) => !coveredBySourceIdDrillsOnly.has(id)),
    ),
  ];

  it("the drill bank has sourceId-free drills whose unlockedBy entries are not redundantly covered by sourceId drills", () => {
    expect(
      sourceIdFreeDrills.length,
      "No sourceId-free drills exist in drillBank — nothing to guard against a sourceId-filter regression.",
    ).toBeGreaterThan(0);

    expect(
      idsExclusiveToSourceIdFreeDrills.length,
      "Every unlockedBy id contributed by sourceId-free drills is already covered by a drill that has a sourceId " +
        "— a sourceId-filter regression would be undetectable. " +
        "Add at least one sourceId-free drill whose unlockedBy value is not shared by any sourceId drill.",
    ).toBeGreaterThan(0);
  });

  it("coveredByUnlockedBy includes ids that would be lost if sourceId-free drills were filtered out", () => {
    /**
     * If the coveredByUnlockedBy derivation at the top of this file is ever
     * changed to `.filter(d => d.sourceId).flatMap(d => d.unlockedBy)`, these
     * ids will vanish from the Set and this test will fail — which is the
     * regression we are guarding against.
     */
    const missing = idsExclusiveToSourceIdFreeDrills.filter(
      (id) => !coveredByUnlockedBy.has(id),
    );
    expect(
      missing,
      `coveredByUnlockedBy is missing ids that only sourceId-free drills contribute:\n` +
        missing.map((id) => `  "${id}"`).join("\n") + "\n" +
        "This means the coverage derivation is silently dropping sourceId-free drills.",
    ).toEqual([]);
  });
});

describe("drills integrity — unique IDs", () => {
  it("all drill ids are globally unique", () => {
    const seen = new Map<string, number>();
    for (const drill of drillBank) {
      seen.set(drill.id, (seen.get(drill.id) ?? 0) + 1);
    }
    const duplicates = [...seen.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
    expect(
      duplicates,
      `Duplicate drill id(s) found: ${duplicates.map((id) => `"${id}"`).join(", ")}. ` +
        `Each drill must have a unique id so learner progress is never confused.`,
    ).toEqual([]);
  });
});

describe("drills integrity — unlockedBy validity", () => {
  /**
   * Every value in a drill's unlockedBy array must resolve to a real active
   * module id, CLI lesson id, or crisis id.  A renamed or deleted content id
   * in unlockedBy silently orphans the drill — it can never be unlocked.
   *
   * This is the reverse of the coverage tests above: those check that every
   * content item has at least one drill; this checks that every drill's
   * unlockedBy values name real content.
   */
  const validUnlockedByIds = new Set<string>([
    ...activeModuleIds,
    ...lessonIds,
    ...crisisIds,
  ]);

  it("all drill unlockedBy values point to a real module, lesson, or crisis", () => {
    const broken: { drillId: string; unknownId: string }[] = [];
    for (const drill of drillBank) {
      for (const id of drill.unlockedBy) {
        if (!validUnlockedByIds.has(id)) {
          broken.push({ drillId: drill.id, unknownId: id });
        }
      }
    }
    const message =
      broken.length > 0
        ? `Drill(s) with unknown unlockedBy value(s):\n${broken
            .map(
              ({ drillId, unknownId }) =>
                `  drill "${drillId}" → unlockedBy entry "${unknownId}" does not match any active module id, lesson id, or crisis id`,
            )
            .join("\n")}\n` +
          `Valid ids are: ${[...validUnlockedByIds].sort().map((id) => `"${id}"`).join(", ")}`
        : "";
    expect(broken, message).toEqual([]);
  });
});

describe("drills integrity — sourceId validity", () => {
  /**
   * Every drill sourceId must resolve to a real active module, CLI lesson,
   * or crisis.  A typo or a deleted lesson leaves the priority-boost logic
   * pointing at a ghost ID and silently doing nothing.
   *
   * CLI lessons are sourced from CLI_LESSON_IDS (the canonical lesson
   * manifest) rather than from lessonLocations, so this test fails when a
   * lesson is removed from the manifest even if its Map entry is left behind.
   */
  const validSourceIds = new Set<string>([
    ...activeModuleIds,
    ...CLI_LESSON_IDS,
    ...crisisIds,
  ]);

  it("all drill sourceIds point to a real lesson, module, or crisis", () => {
    const broken: { drillId: string; sourceId: string }[] = [];
    for (const drill of drillBank) {
      if (drill.sourceId !== undefined && !validSourceIds.has(drill.sourceId)) {
        broken.push({ drillId: drill.id, sourceId: drill.sourceId });
      }
    }
    const message =
      broken.length > 0
        ? `Drill(s) with unknown sourceId:\n${broken
            .map(
              ({ drillId, sourceId }) =>
                `  "${drillId}" → sourceId "${sourceId}" does not match any active module id, lesson id, or crisis id`,
            )
            .join("\n")}\n` +
          `Valid ids are: ${[...validSourceIds].sort().map((id) => `"${id}"`).join(", ")}`
        : "";
    expect(broken, message).toEqual([]);
  });
});

describe("drills integrity — unlockedBy is never empty", () => {
  /**
   * Every drill must declare at least one unlockedBy entry.  An empty array
   * means the drill can never surface (the unlock logic has nothing to match
   * against) and the corresponding content loses coverage silently.
   *
   * This is especially important for drills that omit sourceId: their only
   * link to content is unlockedBy, so an empty array severs that link
   * completely.
   */
  it("all drills have at least one unlockedBy entry", () => {
    const empty = drillBank.filter((d) => d.unlockedBy.length === 0);
    const message =
      empty.length > 0
        ? `Drill(s) with an empty unlockedBy array:\n${empty
            .map((d) => `  "${d.id}" (${d.sourceLabel})`)
            .join("\n")}\n` +
          `Add at least one module, lesson, or crisis id to each drill's unlockedBy array.`
        : "";
    expect(empty, message).toEqual([]);
  });
});

describe("drills integrity — no-sourceId drills wired via unlockedBy", () => {
  /**
   * Drills that omit sourceId rely entirely on unlockedBy for content
   * linkage.  This test confirms each such drill has at least one unlockedBy
   * entry that resolves to a known active module, CLI lesson, or crisis — so
   * a future refactor that accidentally strips unlockedBy entries is caught
   * immediately rather than silently breaking coverage.
   *
   * Note: lessonIds here are keyed from lessonLocations (the Map), which
   * matches the set the coverage tests above use for the lesson coverage
   * check, keeping the two views consistent.
   */
  const validUnlockedByIds = new Set<string>([
    ...activeModuleIds,
    ...lessonIds,
    ...crisisIds,
  ]);

  it("every no-sourceId drill has at least one unlockedBy entry matching a known content id", () => {
    const broken: { drillId: string; unlockedBy: string[] }[] = [];
    for (const drill of drillBank) {
      if (drill.sourceId !== undefined) continue; // sourceId drills are checked elsewhere
      const hasValidEntry = drill.unlockedBy.some((id) =>
        validUnlockedByIds.has(id),
      );
      if (!hasValidEntry) {
        broken.push({ drillId: drill.id, unlockedBy: drill.unlockedBy });
      }
    }
    const message =
      broken.length > 0
        ? `Drill(s) without sourceId that have no valid unlockedBy entry:\n${broken
            .map(
              ({ drillId, unlockedBy }) =>
                `  "${drillId}" → unlockedBy [${unlockedBy.map((id) => `"${id}"`).join(", ")}] does not contain any known module, lesson, or crisis id`,
            )
            .join("\n")}\n` +
          `Valid ids are: ${[...validUnlockedByIds].sort().map((id) => `"${id}"`).join(", ")}\n` +
          `Add the correct module/lesson/crisis id to unlockedBy, or add a sourceId if this drill belongs to a specific graded piece of content.`
        : "";
    expect(broken, message).toEqual([]);
  });
});

describe("drills integrity — coming-soon tier IDs excluded from validUnlockedByIds", () => {
  /**
   * activeModuleIds is built by filtering tiers on status === "active".
   * validUnlockedByIds then includes activeModuleIds alongside lessons and
   * crises.  If the status === "active" filter is removed or weakened, module
   * IDs from coming_soon tiers would flow into validUnlockedByIds, silently
   * satisfying the unlockedBy integrity checks for drills that should not yet
   * be reachable.
   *
   * Because the real tier data has no modules on coming_soon tiers today, this
   * suite uses a local fixture that deliberately includes a coming_soon tier
   * with modules.  The fixture exercises the filter logic in isolation so the
   * tests are non-vacuous and will catch a weakened or missing status filter.
   */
  const fixtureTiers: TierDef[] = [
    {
      id: "fix-active",
      title: "Active Tier",
      description: "In production",
      status: "active",
      modules: [
        { id: "fix-active-1", title: "Active module 1", path: "/a/1" },
        { id: "fix-active-2", title: "Active module 2", path: "/a/2" },
      ],
    },
    {
      id: "fix-coming-soon",
      title: "Coming Soon Tier",
      description: "Not yet live",
      status: "coming_soon",
      modules: [
        { id: "fix-cs-1", title: "Coming-soon module 1", path: "/cs/1" },
        { id: "fix-cs-2", title: "Coming-soon module 2", path: "/cs/2" },
      ],
    },
  ];

  /**
   * Active module IDs produced by the shared production helper.
   * If the status === "active" filter inside activeModuleIdsFrom is removed,
   * this will include fix-cs-1 and fix-cs-2, causing the test below to fail.
   */
  const fixtureActiveIds = activeModuleIdsFrom(fixtureTiers);

  /** The valid set as built by the integrity checks (active IDs only). */
  const fixtureValidIds = new Set<string>(fixtureActiveIds);

  /** Module IDs from coming_soon tiers in the fixture. */
  const fixtureComingSoonModuleIds = fixtureTiers
    .filter((t) => t.status !== "active")
    .flatMap((t) => (t.modules ?? []).map((m) => m.id));

  it("fixture has coming-soon modules so the filter test is non-vacuous", () => {
    expect(
      fixtureComingSoonModuleIds.length,
      "The fixture must include at least one coming_soon tier with modules; " +
        "otherwise the assertion below is trivially vacuous.",
    ).toBeGreaterThan(0);
  });

  it("activeModuleIdsFrom excludes coming-soon module IDs from the valid set", () => {
    /**
     * fixtureValidIds is built via the shared activeModuleIdsFrom helper —
     * the same function that produces the production activeModuleIds.
     * Removing or weakening the status === "active" filter inside
     * activeModuleIdsFrom causes fix-cs-1 / fix-cs-2 to appear in
     * fixtureValidIds, which makes this assertion fail.
     */
    const leaked = fixtureComingSoonModuleIds.filter((id) =>
      fixtureValidIds.has(id),
    );
    const message =
      leaked.length > 0
        ? `Coming-soon module ID(s) found in the valid set produced by activeModuleIdsFrom:\n` +
          leaked.map((id) => `  "${id}"`).join("\n") + "\n" +
          `These IDs come from tiers with status !== "active" in the fixture. ` +
          `The status === "active" filter inside activeModuleIdsFrom has been ` +
          `removed or weakened — restore it so coming-soon modules cannot satisfy ` +
          `coverage or integrity checks for the active curriculum.`
        : "";
    expect(leaked, message).toEqual([]);
  });
});

describe("drills integrity — unlockedBy entries resolve to known content", () => {
  /**
   * Every individual id inside a drill's unlockedBy array must match a real
   * active module, CLI lesson, or crisis.  A stale or mistyped entry means
   * the drill never unlocks for a learner who completed that content — the
   * coverage check passes but the drill is unreachable in practice.
   */
  const validUnlockedByIds = new Set<string>([
    ...activeModuleIds,
    ...lessonIds,
    ...crisisIds,
  ]);

  it("all unlockedBy entries reference a known module, lesson, or crisis id", () => {
    const broken: { drillId: string; badEntry: string }[] = [];
    for (const drill of drillBank) {
      for (const entry of drill.unlockedBy) {
        if (!validUnlockedByIds.has(entry)) {
          broken.push({ drillId: drill.id, badEntry: entry });
        }
      }
    }
    const message =
      broken.length > 0
        ? `Drill(s) with unknown unlockedBy entries:\n${broken
            .map(
              ({ drillId, badEntry }) =>
                `  "${drillId}" → "${badEntry}" does not match any active module id, lesson id, or crisis id`,
            )
            .join("\n")}\n` +
          `Valid ids are: ${[...validUnlockedByIds].sort().map((id) => `"${id}"`).join(", ")}`
        : "";
    expect(broken, message).toEqual([]);
  });
});
