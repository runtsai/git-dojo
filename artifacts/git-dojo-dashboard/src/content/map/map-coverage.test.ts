import { describe, it, expect } from "vitest";
import { lessonLocations, mapPlaces, mapFlows } from "./index";
import { breakthroughs } from "../breakthroughs/index";
import { tiers } from "../tiers";

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
