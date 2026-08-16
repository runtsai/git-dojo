import { describe, it, expect } from "vitest";
import { lessonLocations, mapPlaces, mapFlows } from "./index";
import { breakthroughs } from "../breakthroughs/index";
import { tiers } from "../tiers";
import { CLI_LESSON_IDS } from "../lessons";
import { crises } from "../crises";
import { HINT_STEPS } from "../hint-steps";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const placeIds = new Set(mapPlaces.map((p) => p.id));
const flowIds = new Set(mapFlows.map((f) => f.id));

// ---------------------------------------------------------------------------
// Every breakthrough must have a lessonLocations entry
// ---------------------------------------------------------------------------

describe("breakthroughs are covered by lessonLocations", () => {
  for (const bt of breakthroughs) {
    it(`breakthrough "${bt.id}" has a lessonLocations entry`, () => {
      expect(
        lessonLocations,
        `lessonLocations is missing an entry for breakthrough id "${bt.id}". ` +
          `Add one to src/content/map/index.ts so MapPeek works for this breakthrough.`,
      ).toHaveProperty(bt.id);
    });
  }
});

// ---------------------------------------------------------------------------
// Every active module must have a lessonLocations entry
// ---------------------------------------------------------------------------

describe("active visual-track modules are covered by lessonLocations", () => {
  const activeTiers = tiers.filter((t) => t.status === "active");

  for (const tier of activeTiers) {
    for (const mod of tier.modules ?? []) {
      it(`module "${mod.id}" (tier "${tier.id}") has a lessonLocations entry`, () => {
        expect(
          lessonLocations,
          `lessonLocations is missing an entry for module id "${mod.id}" (tier "${tier.id}", title "${mod.title}"). ` +
            `Add one to src/content/map/index.ts so MapPeek works for this module.`,
        ).toHaveProperty(mod.id);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Every CLI lesson must have a lessonLocations entry
// ---------------------------------------------------------------------------

describe("CLI lessons are covered by lessonLocations", () => {
  for (const id of CLI_LESSON_IDS) {
    it(`CLI lesson "${id}" has a lessonLocations entry`, () => {
      expect(
        lessonLocations,
        `lessonLocations is missing an entry for CLI lesson id "${id}". ` +
          `Add one to src/content/map/index.ts so MapPeek works for this lesson.`,
      ).toHaveProperty(id);
    });
  }
});

// ---------------------------------------------------------------------------
// Every crisis scenario must have a lessonLocations entry
// ---------------------------------------------------------------------------

describe("crisis scenarios are covered by lessonLocations", () => {
  for (const crisis of crises) {
    it(`crisis "${crisis.id}" has a lessonLocations entry`, () => {
      expect(
        lessonLocations,
        `lessonLocations is missing an entry for crisis id "${crisis.id}". ` +
          `Add one to src/content/map/index.ts so MapPeek works for this scenario.`,
      ).toHaveProperty(crisis.id);
    });
  }
});

// ---------------------------------------------------------------------------
// Every crisis lessonLocations entry must have steps.length === HINT_STEPS.length
// ---------------------------------------------------------------------------

describe("crisis lessonLocations step count matches HINT_STEPS", () => {
  const expectedCount = HINT_STEPS.length;

  for (const crisis of crises) {
    it(`crisis "${crisis.id}" has exactly ${expectedCount} map steps (one per hint level)`, () => {
      const location = lessonLocations[crisis.id];
      const actualCount = location?.steps?.length ?? 0;
      expect(
        actualCount,
        `lessonLocations["${crisis.id}"].steps has ${actualCount} step(s) but HINT_STEPS has ${expectedCount}. ` +
          `Add or remove steps in src/content/map/index.ts to match the hint ladder in src/pages/crisis.tsx.`,
      ).toBe(expectedCount);
    });
  }
});

// ---------------------------------------------------------------------------
// Every lessonLocations entry references valid placeIds and flowIds
// ---------------------------------------------------------------------------

describe("lessonLocations only references valid mapPlace/mapFlow ids", () => {
  for (const [lessonId, location] of Object.entries(lessonLocations)) {
    for (const placeId of location.placeIds) {
      it(`lessonLocations["${lessonId}"].placeIds includes valid place "${placeId}"`, () => {
        expect(
          placeIds.has(placeId),
          `lessonLocations["${lessonId}"] references placeId "${placeId}" which does not exist in mapPlaces. ` +
            `Either add the place to mapPlaces or fix the typo.`,
        ).toBe(true);
      });
    }

    for (const flowId of location.flowIds) {
      it(`lessonLocations["${lessonId}"].flowIds includes valid flow "${flowId}"`, () => {
        expect(
          flowIds.has(flowId),
          `lessonLocations["${lessonId}"] references flowId "${flowId}" which does not exist in mapFlows. ` +
            `Either add the flow to mapFlows or fix the typo.`,
        ).toBe(true);
      });
    }
  }
});
