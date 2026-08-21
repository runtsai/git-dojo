import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { lessonLocations, mapPlaces, mapFlows, mapJourneys } from "./index";
import { breakthroughs } from "../breakthroughs/index";
import { tiers } from "../tiers";
import { CLI_LESSON_IDS } from "../lessons";
import { crises } from "../crises";
import { HINT_STEPS } from "../hint-steps";
import { visualModuleSteps } from "../visual-module-steps";

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
// Every active visual-track module must have a visualModuleSteps entry
// ---------------------------------------------------------------------------

describe("active visual-track modules are registered in visualModuleSteps", () => {
  const activeTiers = tiers.filter((t) => t.status === "active");

  for (const tier of activeTiers) {
    for (const mod of tier.modules ?? []) {
      it(`module "${mod.id}" (tier "${tier.id}") has a step-count registry entry`, () => {
        expect(
          Object.prototype.hasOwnProperty.call(visualModuleSteps, mod.id),
          `visualModuleSteps is missing an entry for module id "${mod.id}" (tier "${tier.id}", title "${mod.title}"). ` +
            `Add the module's step cap to src/content/visual-module-steps.ts.`,
        ).toBe(true);
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
  // Each module imports TOTAL_STEPS from the central registry
  // (visual-module-steps.ts) — the highest *interactive* step number shown to
  // the learner.  Note: the completion callback fires TOTAL_STEPS+1 (e.g. 6
  // for a 5-step module); isValidStepChip() rejects that value, so the chip is
  // hidden on the success screen.  This test only cares about TOTAL_STEPS —
  // the map-chip total the learner sees.
  //
  // If a steps array in lessonLocations is shorter than TOTAL_STEPS the chip
  // displays a WRONG TOTAL: e.g. "Step 4 of 4" on a 5-step module, because
  // the chip renders `Step {stepIndex} of {location.steps.length}`.

  // Visual module ids follow the pattern "N.M" (e.g. "1.1", "2.3").
  const visualModuleEntries = Object.entries(lessonLocations).filter(([id]) =>
    /^\d+\.\d+$/.test(id),
  );

  for (const [id, location] of visualModuleEntries) {
    if (!location.steps) continue; // no per-step overrides → chip stays hidden; fine.

    const expectedSteps = visualModuleSteps[id];

    it(`lessonLocations["${id}"].steps covers all ${expectedSteps ?? "?"} reachable steps`, () => {
      expect(
        expectedSteps,
        `Module "${id}" is not listed in src/content/visual-module-steps.ts. ` +
          `Export TOTAL_STEPS from the module file and add an entry to the registry ` +
          `so the map-coverage test knows the correct step cap.`,
      ).toBeDefined();

      expect(
        location.steps!.length,
        `lessonLocations["${id}"].steps has only ${location.steps!.length} ` +
          `entr${location.steps!.length === 1 ? "y" : "ies"}, but module "${id}" ` +
          `fires onStepChange() up to step ${expectedSteps}. ` +
          `The chip would show "Step ${location.steps!.length} of ${location.steps!.length}" ` +
          `on a ${expectedSteps}-step module — a wrong total. ` +
          `Add back the missing step entries in src/content/map/index.ts.`,
      ).toBeGreaterThanOrEqual(expectedSteps!);
    });
  }
});

// ---------------------------------------------------------------------------
// Registry must record the correct cap for modules with non-default step counts
// ---------------------------------------------------------------------------

describe("visualModuleSteps registry records the correct cap for non-standard modules", () => {
  // Regression test: module "2.4" has 3 interactive steps, not 5.
  // If someone edits the registry to 5 (the majority default) this test
  // catches it before the map chip starts showing "Step 3 of 5".
  it('visualModuleSteps["2.4"] is 3 (not the default 5)', () => {
    expect(
      visualModuleSteps["2.4"],
      'visualModuleSteps["2.4"] should be 3 — module 2.4 only has 3 interactive ' +
        "steps. If you changed it, update src/content/visual-module-steps.ts and " +
        "the Math.min clamp in src/content/tier2/module-2-4.tsx to match.",
    ).toBe(3);
  });
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
// mapPlaces must have no duplicate ids
// ---------------------------------------------------------------------------

describe("mapPlaces has no duplicate ids", () => {
  it("every place id is unique", () => {
    const ids = mapPlaces.map((p) => p.id);
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
      `mapPlaces contains duplicate id(s): ${duplicates.map((id) => `"${id}"`).join(", ")}. ` +
        `Each place must have a unique id in src/content/map/index.ts.`,
    ).toHaveLength(0);
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

// ---------------------------------------------------------------------------
// lessonLocations must have no duplicate keys
// ---------------------------------------------------------------------------
//
// JavaScript silently overwrites a duplicate object key at parse time, so the
// exported lessonLocations value never shows the duplication — the second entry
// just wins.  The coverage tests above would still pass because the key exists,
// but the discarded entry's placeIds/flowIds are silently dropped.
//
// This test reads the raw source file and extracts every top-level quoted key
// inside the lessonLocations literal, then checks for repeats.  Top-level
// entries always appear as exactly two leading spaces followed by a quoted
// key and a colon-brace (e.g. `  "lesson-01": {`).

describe("lessonLocations has no duplicate keys", () => {
  it("no two lessonLocations entries share the same key", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const source = readFileSync(resolve(__dirname, "index.ts"), "utf-8");

    // Isolate the lessonLocations block (everything from its declaration to the
    // closing `};` that terminates it, before mapJourneys starts).
    const blockStart = source.indexOf("export const lessonLocations");
    const blockEnd = source.indexOf("\nexport const mapJourneys", blockStart);
    const block = blockStart === -1 ? source : source.slice(blockStart, blockEnd === -1 ? undefined : blockEnd);

    // Match lines of the form:  "some-key": {
    // (exactly two leading spaces — the indentation of a top-level entry)
    const keyPattern = /^  "([^"]+)":\s*\{/gm;
    const keys: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = keyPattern.exec(block)) !== null) {
      keys.push(match[1]);
    }

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of keys) {
      if (seen.has(key)) {
        duplicates.push(key);
      } else {
        seen.add(key);
      }
    }

    expect(
      duplicates,
      `lessonLocations has duplicate key(s): ${duplicates.map((k) => `"${k}"`).join(", ")}. ` +
        `JavaScript silently discards the earlier entry — only the last one survives at runtime. ` +
        `Remove or rename the duplicate in src/content/map/index.ts.`,
    ).toHaveLength(0);
  });
});
