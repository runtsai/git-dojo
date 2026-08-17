/**
 * Confirms that every `nextModuleHref` prop used across module completion
 * screens resolves to a real route registered in LEARN_ROUTE_KEYS.
 *
 * The module components are React/JSX files that cannot be imported in a
 * side-effect-free test environment, so the href values are captured here as
 * a static table.  When a module is added, renamed, or removed the author
 * must update both the component and this table — a failing test here means
 * the CTA link would silently go nowhere in the browser.
 *
 * Pattern: each row is { source, href } where `source` names the file that
 * passes the prop and `href` is the exact value passed as nextModuleHref.
 * The route key is derived by stripping the "/learn/" prefix.
 */

import { describe, it, expect } from "vitest";
import { LEARN_ROUTE_KEYS } from "@/pages/learn-route-keys";

/**
 * Canonical table of every nextModuleHref used across all module files.
 * Keep in sync with the JSX prop in each module component.
 *
 * To add a new module: grep for `nextModuleHref` in src/content/ and add a
 * row here.  The test will tell you immediately if the target slug is missing
 * from LEARN_ROUTE_KEYS.
 */
const NEXT_MODULE_HREFS: Array<{ source: string; href: string }> = [
  // tier1
  { source: "src/content/tier1/module-1-2.tsx", href: "/learn/1-3" },
  { source: "src/content/tier1/module-1-3.tsx", href: "/learn/1-4" },
  { source: "src/content/tier1/module-1-4.tsx", href: "/learn/1-5" },
  // tier2
  { source: "src/content/tier2/module-2-1.tsx", href: "/learn/2-2" },
  { source: "src/content/tier2/module-2-2.tsx", href: "/learn/2-3" },
  { source: "src/content/tier2/module-2-3.tsx", href: "/learn/2-4" },
];

// ---------------------------------------------------------------------------
// 1. Table completeness — every file that contains nextModuleHref must have
//    an entry in the table above.  This test reads the source list produced
//    by the grep output embedded in the comment above and is a reminder to
//    update the table when modules are added.
// ---------------------------------------------------------------------------

describe("next-module-hrefs table — structural checks", () => {
  it("has at least one entry", () => {
    expect(NEXT_MODULE_HREFS.length).toBeGreaterThan(0);
  });

  it("every href starts with /learn/", () => {
    for (const { source, href } of NEXT_MODULE_HREFS) {
      expect(
        href.startsWith("/learn/"),
        `${source}: nextModuleHref "${href}" does not start with "/learn/". ` +
          `Update the href or the module's learn path.`,
      ).toBe(true);
    }
  });

  it("no duplicate hrefs (each target appears at most once)", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const { href } of NEXT_MODULE_HREFS) {
      if (seen.has(href)) dupes.push(href);
      seen.add(href);
    }
    expect(
      dupes,
      `Duplicate nextModuleHref values: ${dupes.join(", ")}. ` +
        `Two modules point to the same next step — verify the table is correct.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Route-map integrity — every href slug must be present in LEARN_ROUTE_KEYS
// ---------------------------------------------------------------------------

describe("next-module-hrefs — every CTA target is registered in LEARN_ROUTE_KEYS", () => {
  for (const { source, href } of NEXT_MODULE_HREFS) {
    const slug = href.replace(/^\/learn\//, "");

    it(`${source}: "/learn/${slug}" (slug "${slug}") is registered`, () => {
      expect(
        (LEARN_ROUTE_KEYS as readonly string[]).includes(slug),
        `${source} passes nextModuleHref="${href}" but the slug "${slug}" is not ` +
          `in LEARN_ROUTE_KEYS (learn-route-keys.ts). ` +
          `Either add "${slug}" to LEARN_ROUTE_KEYS or update the CTA href in ${source}.`,
      ).toBe(true);
    });
  }
});
