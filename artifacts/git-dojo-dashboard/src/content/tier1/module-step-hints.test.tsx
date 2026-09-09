import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({ Map: () => null }));

import {
  MODULE_1_4_STEP_HINTS,
  TOTAL_STEPS as MODULE_1_4_TOTAL_STEPS,
} from "./module-1-4";
import {
  MODULE_1_5_STEP_HINTS,
  TOTAL_STEPS as MODULE_1_5_TOTAL_STEPS,
} from "./module-1-5";

const REQUIRED_STEPS = [1, 2, 3, 4, 5];

function hintText(hint: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(hint);
}

describe("module 1-4 step hints", () => {
  it("provides a non-null hint for every interactive step", () => {
    expect(MODULE_1_4_TOTAL_STEPS).toBe(5);

    for (const step of REQUIRED_STEPS) {
      expect(MODULE_1_4_STEP_HINTS[step], `missing hint for step ${step}`).not.toBeNull();
      expect(MODULE_1_4_STEP_HINTS[step], `missing hint for step ${step}`).toBeTruthy();
    }
  });

  it("keeps the settings interface location in the relevant hints", () => {
    expect(hintText(MODULE_1_4_STEP_HINTS[2])).toContain("repo home");
    expect(hintText(MODULE_1_4_STEP_HINTS[2])).toContain("Settings");
    expect(hintText(MODULE_1_4_STEP_HINTS[5])).toContain("Settings");
    expect(hintText(MODULE_1_4_STEP_HINTS[5])).toContain("General");
  });
});

describe("module 1-5 step hints", () => {
  it("provides a non-null hint for every interactive step", () => {
    expect(MODULE_1_5_TOTAL_STEPS).toBe(5);

    for (const step of REQUIRED_STEPS) {
      expect(MODULE_1_5_STEP_HINTS[step], `missing hint for step ${step}`).not.toBeNull();
      expect(MODULE_1_5_STEP_HINTS[step], `missing hint for step ${step}`).toBeTruthy();
    }
  });

  it("keeps the global navigation location in the relevant hints", () => {
    expect(hintText(MODULE_1_5_STEP_HINTS[2])).toContain("top navigation bar");
    expect(hintText(MODULE_1_5_STEP_HINTS[5])).toContain("Search box");
    expect(hintText(MODULE_1_5_STEP_HINTS[5])).toContain("Bell");
  });
});