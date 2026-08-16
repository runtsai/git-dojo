import { describe, it, expect } from "vitest";
import { lessonLocations, mapPlaces, mapFlows, mapJourneys } from "./index";
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

    for (const [stepIndex, step] of (location.steps ?? []).entries()) {
      for (const placeId of step.placeIds ?? []) {
        it(`lessonLocations["${lessonId}"].steps[${stepIndex}].placeIds includes valid place "${placeId}"`, () => {
          expect(
            placeIds.has(placeId),
            `lessonLocations["${lessonId}"] step ${stepIndex} references placeId "${placeId}" which does not exist in mapPlaces. ` +
              `Either add the place to mapPlaces or fix the typo.`,
          ).toBe(true);
        });
      }

      for (const flowId of step.flowIds ?? []) {
        it(`lessonLocations["${lessonId}"].steps[${stepIndex}].flowIds includes valid flow "${flowId}"`, () => {
          expect(
            flowIds.has(flowId),
            `lessonLocations["${lessonId}"] step ${stepIndex} references flowId "${flowId}" which does not exist in mapFlows. ` +
              `Either add the flow to mapFlows or fix the typo.`,
          ).toBe(true);
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Visual module step arrays must not be shorter than the module step count
// ---------------------------------------------------------------------------

describe("visual module step arrays are not shorter than the module's step count", () => {
  // All current visual modules clamp onStepChange() at step 5 (completion fires 6,
  // which isValidStepChip() already rejects as an overshoot).
  // If a steps array is accidentally trimmed below 5 the chip displays a WRONG
  // TOTAL even on valid steps — e.g. "Step 4 of 4" on a 5-step module — because
  // the chip renders `Step {stepIndex} of {location.steps.length}`.
  const VISUAL_MODULE_MAX_STEP = 5;

  // Visual module ids follow the pattern "N.M" (e.g. "1.1", "2.3").
  const visualModuleEntries = Object.entries(lessonLocations).filter(([id]) =>
    /^\d+\.\d+$/.test(id),
  );

  for (const [id, location] of visualModuleEntries) {
    if (!location.steps) continue; // no per-step overrides → chip stays hidden; fine.

    it(`lessonLocations["${id}"].steps covers all ${VISUAL_MODULE_MAX_STEP} reachable steps`, () => {
      expect(
        location.steps!.length,
        `lessonLocations["${id}"].steps has only ${location.steps!.length} ` +
          `entr${location.steps!.length === 1 ? "y" : "ies"}, but visual modules ` +
          `fire onStepChange() up to step ${VISUAL_MODULE_MAX_STEP}. ` +
          `The chip would show "Step ${location.steps!.length} of ${location.steps!.length}" on a ` +
          `${VISUAL_MODULE_MAX_STEP}-step module — a wrong total. ` +
          `Add back the missing step entries in src/content/map/index.ts.`,
      ).toBeGreaterThanOrEqual(VISUAL_MODULE_MAX_STEP);
    });
  }
});

// ---------------------------------------------------------------------------
// Every Journey id must be unique
// ---------------------------------------------------------------------------

describe("journey ids are unique", () => {
  it("no two journeys share the same id", () => {
    const ids = mapJourneys.map((j) => j.id);
    const uniqueIds = new Set(ids);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(
      uniqueIds.size,
      `Found duplicate journey id(s): ${[...new Set(duplicates)].join(", ")}. ` +
        `Each journey must have a unique id in src/content/map/index.ts.`,
    ).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// mapFlows must have no duplicate ids
// ---------------------------------------------------------------------------

describe("mapFlows has no duplicate ids", () => {
  it("every flow id is unique", () => {
    const ids = mapFlows.map((f) => f.id);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) {
        duplicates.push(id);
      } else {
        seen.add(id);
      }
    }
    expect(
      duplicates,
      `mapFlows contains duplicate id(s): ${duplicates.map((id) => `"${id}"`).join(", ")}. ` +
        `Each flow must have a unique id in src/content/map/index.ts.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Every Journey step must reference a valid flowId
// ---------------------------------------------------------------------------

describe("journey steps only reference valid mapFlow ids", () => {
  for (const journey of mapJourneys) {
    for (const [stepIndex, step] of journey.steps.entries()) {
      it(`journey "${journey.id}" step ${stepIndex} flowId "${step.flowId}" exists in mapFlows`, () => {
        expect(
          flowIds.has(step.flowId),
          `journey "${journey.id}" step ${stepIndex} references flowId "${step.flowId}" which does not exist in mapFlows. ` +
            `Either add the flow to mapFlows or fix the typo in src/content/map/index.ts.`,
        ).toBe(true);
      });
    }
  }
});
