/**
 * Confirms that every non-terminal active visual module has exactly one
 * `nextModuleHref` prop and that it points at its registered next module.
 *
 * The module components are React/JSX files that cannot be imported in a
 * side-effect-free test environment, so the href values are captured in a
 * static table and scanned from source. The active tier registry defines which
 * modules need a CTA; only explicitly documented terminal modules are exempt.
 *
 * Pattern: each row is { source, href } where `source` names the file that
 * passes the prop and `href` is the exact value passed as nextModuleHref.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { tiers, type TierDef } from "@/content/tiers";
import { LEARN_ROUTE_KEYS } from "@/pages/learn-route-keys";

/**
 * Canonical table of every next-module CTA used by a non-terminal active
 * visual module. Keep this in sync with the JSX prop in each module component.
 *
 * Adding an active module creates an expected table row automatically from
 * `tiers`; the coverage test below fails until its CTA is added here and in
 * the component.
 */
const NEXT_MODULE_HREFS: Array<{ source: string; href: string }> = [
  // tier1
  { source: "src/content/tier1/module-1-1.tsx", href: "/learn/1-2" },
  { source: "src/content/tier1/module-1-2.tsx", href: "/learn/1-3" },
  { source: "src/content/tier1/module-1-3.tsx", href: "/learn/1-4" },
  { source: "src/content/tier1/module-1-4.tsx", href: "/learn/1-5" },
  // tier2
  { source: "src/content/tier2/module-2-1.tsx", href: "/learn/2-2" },
  { source: "src/content/tier2/module-2-2.tsx", href: "/learn/2-3" },
  { source: "src/content/tier2/module-2-3.tsx", href: "/learn/2-4" },
];

/**
 * These are the final modules in their active tiers and intentionally return
 * learners to the Ledger rather than linking to another visual module.
 */
const TERMINAL_MODULE_IDS = ["1.5", "2.4"] as const;

const CONTENT_ROOT = fileURLToPath(new URL("../content", import.meta.url));
const NEXT_MODULE_HREF_PROP = /\bnextModuleHref\s*=\s*(?:"([^"]+)"|'([^']+)')/g;

type NextModuleHref = {
  source: string;
  href: string;
};

type ExpectedNextModuleHref = NextModuleHref & {
  moduleId: string;
  title: string;
};

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory()
      ? sourceFilesUnder(path)
      : /\.(?:ts|tsx)$/.test(entry.name)
        ? [path]
        : [];
  });
}

function sourceForModule(moduleId: string): string {
  const [tier] = moduleId.split(".");
  return `src/content/tier${tier}/module-${moduleId.replace(".", "-")}.tsx`;
}

function activeTiersFrom(availableTiers: readonly TierDef[]): TierDef[] {
  return availableTiers.filter((tier) => tier.status === "active");
}

function expectedNextModuleHrefs(
  availableTiers: readonly TierDef[],
  terminalModuleIds: ReadonlySet<string>,
): ExpectedNextModuleHref[] {
  return activeTiersFrom(availableTiers).flatMap((tier) => {
    const modules = tier.modules ?? [];
    return modules.flatMap((module, index) => {
      if (terminalModuleIds.has(module.id)) return [];

      const nextModule = modules[index + 1];
      if (!nextModule) return [];

      return {
        moduleId: module.id,
        title: module.title,
        source: sourceForModule(module.id),
        href: nextModule.path,
      };
    });
  });
}

function nextModuleHrefsIn(source: string): string[] {
  return Array.from(source.matchAll(NEXT_MODULE_HREF_PROP), (match) => match[1] ?? match[2]);
}

function scannedNextModuleHrefs(): NextModuleHref[] {
  return sourceFilesUnder(CONTENT_ROOT).flatMap((path) => {
    const hrefs = nextModuleHrefsIn(readFileSync(path, "utf8"));
    const relativePath = path.slice(CONTENT_ROOT.length + 1).replaceAll("\\", "/");
    return hrefs.map((href) => ({ source: `src/content/${relativePath}`, href }));
  });
}

function coverageIssues(
  expectedHrefs: readonly ExpectedNextModuleHref[],
  scannedHrefs: readonly NextModuleHref[],
): string[] {
  const scannedBySource = new Map<string, string[]>();
  for (const { source, href } of scannedHrefs) {
    scannedBySource.set(source, [...(scannedBySource.get(source) ?? []), href]);
  }

  return expectedHrefs.flatMap(({ moduleId, title, source, href }) => {
    const actualHrefs = scannedBySource.get(source) ?? [];
    if (actualHrefs.length !== 1) {
      return (
        `${source}: active non-terminal module "${moduleId}" (${title}) must declare exactly ` +
        `one nextModuleHref="${href}", but declares ${actualHrefs.length}.`
      );
    }
    if (actualHrefs[0] !== href) {
      return (
        `${source}: active non-terminal module "${moduleId}" (${title}) declares ` +
        `nextModuleHref="${actualHrefs[0]}", but its next registered module requires "${href}".`
      );
    }
    return [];
  });
}

function sortedRows(rows: readonly NextModuleHref[]): NextModuleHref[] {
  return rows.map(({ source, href }) => ({ source, href })).sort((a, b) =>
    `${a.source}\u0000${a.href}`.localeCompare(`${b.source}\u0000${b.href}`),
  );
}

const activeTiers = activeTiersFrom(tiers);
const expectedHrefs = expectedNextModuleHrefs(tiers, new Set(TERMINAL_MODULE_IDS));

// ---------------------------------------------------------------------------
// 1. Expected-module coverage — active modules, not existing CTA props, define
//    the expected set. This catches a newly registered module with no CTA.
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

  it("documents only the final module in each active tier as terminal", () => {
    const finalModuleIds = activeTiers.flatMap((tier) => {
      const finalModule = tier.modules?.at(-1);
      return finalModule ? [finalModule.id] : [];
    });

    expect(
      [...TERMINAL_MODULE_IDS].sort(),
      "TERMINAL_MODULE_IDS must list exactly the final module in each active tier. " +
        "Add a new tier's final module here only when it intentionally returns to the Ledger.",
    ).toEqual(finalModuleIds.sort());
  });

  it("has one table row for every active non-terminal module", () => {
    expect(
      sortedRows(NEXT_MODULE_HREFS),
      "The CTA table must contain the source and next route for every active non-terminal " +
        "module derived from the tiers registry.",
    ).toEqual(sortedRows(expectedHrefs));
  });

  it("matches every literal nextModuleHref scanned from src/content", () => {
    expect(
      sortedRows(scannedNextModuleHrefs()),
      "The static table must exactly match every literal nextModuleHref declared in src/content.",
    ).toEqual(sortedRows(NEXT_MODULE_HREFS));
  });

  it("gives every active non-terminal module its registered next CTA", () => {
    expect(
      coverageIssues(expectedHrefs, scannedNextModuleHrefs()),
      "Every active non-terminal module needs one CTA targeting the next route in tiers.",
    ).toEqual([]);
  });

  it("flags a newly registered non-terminal module that has no CTA", () => {
    const fixtureTiers: TierDef[] = [
      {
        id: "tier-9",
        title: "Fixture tier",
        description: "A registration-only test fixture.",
        status: "active",
        modules: [
          { id: "9.1", title: "First fixture module", path: "/learn/9-1" },
          { id: "9.2", title: "New fixture module", path: "/learn/9-2" },
          { id: "9.3", title: "Terminal fixture module", path: "/learn/9-3" },
        ],
      },
    ];
    const fixtureExpected = expectedNextModuleHrefs(fixtureTiers, new Set(["9.3"]));
    const fixtureScanned = [
      { source: sourceForModule("9.1"), href: "/learn/9-2" },
      // 9.2 is registered and non-terminal, but its source has no CTA.
    ];

    expect(coverageIssues(fixtureExpected, fixtureScanned)).toContain(
      'src/content/tier9/module-9-2.tsx: active non-terminal module "9.2" (New fixture module) ' +
        'must declare exactly one nextModuleHref="/learn/9-3", but declares 0.',
    );
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
