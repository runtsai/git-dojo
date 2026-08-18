/**
 * Tests for POST /api/progress/complete — VISUAL_MODULE_IDS tier derivation.
 *
 * `VISUAL_MODULE_IDS` is built from `tiers` at module-load time.  These tests
 * verify that:
 *   (a) a module whose tier has status "active" is accepted (200), and
 *   (b) a module whose tier has status "coming_soon" is rejected (400,
 *       "Unknown module") — *without* a server restart being required.
 *
 * Both assertions derive the module IDs from the mocked tiers definition,
 * not from hardcoded strings, so they stay correct as real content evolves.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { TierDef } from "@workspace/course-content";

// ---------------------------------------------------------------------------
// Controlled tiers — mocked before the router is imported so VISUAL_MODULE_IDS
// is computed from exactly these tiers.
// ---------------------------------------------------------------------------

const ACTIVE_MODULE = { id: "tier-deriv-active-1", title: "Active mod", path: "/learn/td-a1" };
const COMING_SOON_MODULE = { id: "tier-deriv-cs-1", title: "Coming-soon mod", path: "/learn/td-cs1" };

const mockTiers: TierDef[] = [
  {
    id: "td-active",
    title: "Active tier",
    description: "A tier that is live.",
    status: "active" as const,
    modules: [ACTIVE_MODULE],
  },
  {
    id: "td-coming-soon",
    title: "Coming-soon tier",
    description: "A tier that is not yet live.",
    status: "coming_soon" as const,
    modules: [COMING_SOON_MODULE],
  },
];

vi.mock("@workspace/course-content", () => ({
  tiers: mockTiers,
  // No prerequisites for these test modules.
  MODULE_PREREQUISITES: {} as Record<string, string>,
}));

// ---------------------------------------------------------------------------
// Mock the progress-store (no filesystem access during unit tests).
// ---------------------------------------------------------------------------

const mockEntries: Array<{ moduleId: string; track: string; completedAt: string }> = [];

vi.mock("../lib/progress-store.js", () => ({
  loadEntries: vi.fn(() => [...mockEntries]),
  recordCompletion: vi.fn((moduleId: string, track: string) => {
    const already = mockEntries.some(
      (e) => e.moduleId === moduleId && e.track === track,
    );
    if (!already) {
      mockEntries.push({ moduleId, track, completedAt: new Date().toISOString() });
    }
    return [...mockEntries];
  }),
}));

// Import router AFTER mocks are registered so VISUAL_MODULE_IDS is derived
// from the controlled tiers above.
const { default: progressRouter } = await import("./progress.js");

// ---------------------------------------------------------------------------
// Minimal Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use("/api", progressRouter);

let server: Server;
let base: string;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        base = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

beforeEach(() => {
  mockEntries.length = 0;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

interface ApiResponse {
  entries?: Array<{ moduleId: string; track: string; completedAt: string }>;
  error?: string;
}

async function postComplete(moduleId: string, track = "visual") {
  const res = await fetch(`${base}/api/progress/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleId, track }),
  });
  return { status: res.status, body: (await res.json()) as ApiResponse };
}

// ---------------------------------------------------------------------------
// Tests — derive module IDs from the controlled tiers, not from literals
// ---------------------------------------------------------------------------

describe("VISUAL_MODULE_IDS — derived from tiers at load time", () => {
  // Pick IDs dynamically so the test stays correct if the fixture changes.
  const activeModuleId = mockTiers
    .filter((t) => t.status === "active")
    .flatMap((t) => t.modules ?? [])
    .map((m) => m.id)[0];

  const comingSoonModuleId = mockTiers
    .filter((t) => t.status === "coming_soon")
    .flatMap((t) => t.modules ?? [])
    .map((m) => m.id)[0];

  it("accepts a module from an active tier (200)", async () => {
    const { status, body } = await postComplete(activeModuleId);

    expect(status).toBe(200);
    expect(body).toHaveProperty("entries");
    const ids = (body.entries ?? []).map((e) => e.moduleId);
    expect(ids).toContain(activeModuleId);
  });

  it("rejects a module from a coming_soon tier with 400 'Unknown module'", async () => {
    const { status, body } = await postComplete(comingSoonModuleId);

    expect(status).toBe(400);
    expect(body).toMatchObject({
      error: expect.stringContaining("Unknown module"),
    });
  });

  it("the rejected coming_soon module ID is not present in any active tier", () => {
    // Sanity-check that the fixture is correctly constructed: the coming-soon
    // ID must genuinely be absent from every active tier's module list.
    const activeIds = new Set(
      mockTiers
        .filter((t) => t.status === "active")
        .flatMap((t) => t.modules ?? [])
        .map((m) => m.id),
    );

    expect(activeIds.has(comingSoonModuleId)).toBe(false);
  });

  it("activating a coming_soon tier at runtime makes its module completable without restarting the server", async () => {
    // Step 1 — confirm the module is still rejected while the tier is coming_soon.
    const before = await postComplete(comingSoonModuleId);
    expect(before.status).toBe(400);
    expect(before.body).toMatchObject({ error: expect.stringContaining("Unknown module") });

    // Step 2 — flip the tier's status to "active" in the live tiers array.
    //           The router is already imported and the server is already
    //           running; no restart or re-import happens here.
    const comingSoonTier = mockTiers.find((t) => t.status === "coming_soon");
    if (!comingSoonTier) throw new Error("fixture error: no coming_soon tier found");
    comingSoonTier.status = "active";

    try {
      // Step 3 — the same endpoint must now return 200 because getVisualModuleIds()
      //           re-evaluates the tiers array on every request.
      const after = await postComplete(comingSoonModuleId);
      expect(after.status).toBe(200);
      expect(after.body).toHaveProperty("entries");
      const ids = (after.body.entries ?? []).map((e) => e.moduleId);
      expect(ids).toContain(comingSoonModuleId);
    } finally {
      // Restore the fixture for subsequent tests.
      comingSoonTier.status = "coming_soon";
    }
  });
});
