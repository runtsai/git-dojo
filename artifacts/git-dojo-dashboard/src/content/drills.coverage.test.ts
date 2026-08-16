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
