/**
 * Tests for POST /api/progress/complete — prerequisite gate behaviour.
 *
 * We spin up a minimal Express app with the progress router mounted under
 * /api, then hit it with Node's built-in fetch.  The progress-store is mocked
 * so each test controls the on-disk state without touching the filesystem.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";

// ---------------------------------------------------------------------------
// Mock the progress-store BEFORE importing the route so the route picks up
// the mocked versions.
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

// Import router AFTER the mock is set up.
const { default: progressRouter } = await import("./progress.js");

// ---------------------------------------------------------------------------
// Tiny Express app — mirrors how app.ts mounts the router
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

// Reset the in-memory store and mock call counts before every test.
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
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/progress/complete — prerequisite gate", () => {
  it("returns 400 when the prerequisite (2.3) has not been completed", async () => {
    // Store is empty — 2.3 is not done.
    const { status, body } = await postComplete("2.4");

    expect(status).toBe(400);
    expect(body).toMatchObject({
      error: expect.stringContaining("2.3"),
    });
  });

  it("succeeds (200) when the prerequisite (2.3) has already been completed", async () => {
    // Pre-seed the store with a 2.3 visual completion.
    mockEntries.push({
      moduleId: "2.3",
      track: "visual",
      completedAt: new Date().toISOString(),
    });

    const { status, body } = await postComplete("2.4");

    expect(status).toBe(200);
    expect(body).toHaveProperty("entries");
    // The response must include the newly recorded 2.4 entry.
    const ids = (body.entries as Array<{ moduleId: string }>).map(
      (e) => e.moduleId,
    );
    expect(ids).toContain("2.4");
  });

  it("returns 400 when 2.3 is completed on the CLI track but not the visual track", async () => {
    // Seed a CLI-track 2.3 completion — this must NOT satisfy the visual-track gate.
    mockEntries.push({
      moduleId: "2.3",
      track: "cli",
      completedAt: new Date().toISOString(),
    });

    const { status, body } = await postComplete("2.4");

    expect(status).toBe(400);
    expect(body).toMatchObject({
      error: expect.stringContaining("2.3"),
    });
  });

  it("is idempotent — replaying the same completion after prereq returns 200", async () => {
    // Seed both 2.3 and 2.4 as already complete.
    mockEntries.push(
      { moduleId: "2.3", track: "visual", completedAt: new Date().toISOString() },
      { moduleId: "2.4", track: "visual", completedAt: new Date().toISOString() },
    );

    const { status, body } = await postComplete("2.4");

    expect(status).toBe(200);
    // Should still contain both entries (not duplicated).
    const visualEntries = (
      body.entries as Array<{ moduleId: string; track: string }>
    ).filter((e) => e.track === "visual");
    const count24 = visualEntries.filter((e) => e.moduleId === "2.4").length;
    expect(count24).toBe(1); // not duplicated
  });
});

describe("POST /api/progress/complete — basic validation", () => {
  it("returns 400 for an unknown moduleId", async () => {
    const { status, body } = await postComplete("9.9");
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for a cli track request", async () => {
    const { status, body } = await postComplete("1.1", "cli");
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for a missing moduleId", async () => {
    const res = await fetch(`${base}/api/progress/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: "visual" }),
    });
    expect(res.status).toBe(400);
  });

  it("succeeds for a module with no prerequisite (e.g. 1.1)", async () => {
    const { status, body } = await postComplete("1.1");
    expect(status).toBe(200);
    expect(body).toHaveProperty("entries");
  });
});
