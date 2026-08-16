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
import { breakthroughs } from "./breakthroughs/index";
import { crises } from "./crises";
import { lessonLocations } from "./map/index";
import { CLI_LESSON_IDS } from "./lessons";
import { drillBank } from "./drills";

// ── Derived content sets ─────────────────────────────────────────────────────

/** Module ids from active tiers only (coming_soon tiers are skipped). */
const activeModuleIds: string[] = tiers
  .filter((t) => t.status === "active")
  .flatMap((t) => (t.modules ?? []).map((m) => m.id));

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
