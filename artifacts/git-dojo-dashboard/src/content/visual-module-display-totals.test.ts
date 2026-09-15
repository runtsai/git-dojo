import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { visualModuleSteps } from "./visual-module-steps";

const contentDir = fileURLToPath(new URL(".", import.meta.url));

describe("visual module display totals", () => {
  it.each(Object.keys(visualModuleSteps))(
    "derives module %s progress dots from its registry-backed TOTAL_STEPS",
    (moduleId) => {
      const [tier, module] = moduleId.split(".");
      const source = readFileSync(
        `${contentDir}tier${tier}/module-${tier}-${module}.tsx`,
        "utf8",
      );

      expect(source).toContain(
        `export const TOTAL_STEPS = _steps["${moduleId}"]`,
      );
      expect(source).toMatch(
        /<VisualModuleShell[\s\S]*?\btotalDots=\{TOTAL_STEPS\}/,
      );
    },
  );
});