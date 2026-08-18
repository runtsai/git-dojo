// Direct persistence tests for capstone-store: round-trip, fail-closed load
// on malformed content, and clear behavior. The route-level tests mock this
// module entirely, so this file covers the real file handling.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Point the store's data dir at a temp directory by faking process.cwd():
// the store resolves DATA_DIR as <cwd>/../../data at import time, so we set
// cwd before importing the module fresh in each test run.
let tempRoot: string;
let dataDir: string;
let store: typeof import("./capstone-store");

beforeEach(async () => {
  tempRoot = mkdtempSync(path.join(tmpdir(), "capstone-store-test-"));
  const fakeCwd = path.join(tempRoot, "a", "b");
  dataDir = path.join(tempRoot, "data");
  vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);
  vi.resetModules();
  store = await import("./capstone-store");
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tempRoot, { recursive: true, force: true });
});

function sampleState(): import("./capstone-store").CapstoneState {
  return {
    owner: "someone",
    repoId: 12345,
    repoName: "git-dojo-practice",
    repoFullName: "someone/git-dojo-practice",
    htmlUrl: "https://github.com/someone/git-dojo-practice",
    cloneUrl: "https://github.com/someone/git-dojo-practice.git",
    defaultBranch: "main",
    prNumber: null,
    prUrl: null,
    prBranch: null,
    seedShas: ["abc123"],
    missionsVerifiedAt: {},
    badgeEarnedAt: null,
    createdByDojo: true,
    createdAt: new Date().toISOString(),
  };
}

describe("capstone-store persistence", () => {
  it("returns null when no file exists", () => {
    expect(store.loadCapstone()).toBeNull();
  });

  it("round-trips a saved state", () => {
    const state = sampleState();
    store.saveCapstone(state);
    expect(store.loadCapstone()).toEqual(state);
  });

  it("overwrites previous state on save", () => {
    store.saveCapstone(sampleState());
    const updated = { ...sampleState(), prNumber: 7, prUrl: "https://x", prBranch: "feature" };
    store.saveCapstone(updated);
    expect(store.loadCapstone()?.prNumber).toBe(7);
  });

  it("fails closed (null) on malformed JSON", () => {
    store.saveCapstone(sampleState());
    writeFileSync(path.join(dataDir, "capstone.json"), "{ not json !!");
    expect(store.loadCapstone()).toBeNull();
  });

  it("leaves no temp files behind after a save", () => {
    store.saveCapstone(sampleState());
    const leftovers = readdirSync(dataDir).filter((f) => f.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("writes the file atomically (final content is complete JSON)", () => {
    store.saveCapstone(sampleState());
    const raw = readFileSync(path.join(dataDir, "capstone.json"), "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("preserves the previous state when the temp write fails mid-save", async () => {
    const original = sampleState();
    store.saveCapstone(original);

    // Make the next temp-file write blow up before the rename can happen by
    // removing write permission from the data directory.
    const { chmodSync } = await import("node:fs");
    chmodSync(dataDir, 0o555);
    try {
      expect(() =>
        store.saveCapstone({ ...original, repoId: 424242 }),
      ).toThrow();
    } finally {
      chmodSync(dataDir, 0o755);
    }

    // The store file must still hold the complete previous state.
    expect(store.loadCapstone()).toEqual(original);
    // And no half-written temp files may shadow it.
    const leftovers = readdirSync(dataDir).filter((f) => f.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("clearCapstone removes the file and is safe to call twice", () => {
    store.saveCapstone(sampleState());
    store.clearCapstone();
    expect(store.loadCapstone()).toBeNull();
    expect(() => store.clearCapstone()).not.toThrow();
  });

  it("save after clear resurrects a fresh state (clear-vs-save ordering)", () => {
    store.saveCapstone(sampleState());
    store.clearCapstone();
    const fresh = { ...sampleState(), repoId: 999 };
    store.saveCapstone(fresh);
    expect(store.loadCapstone()?.repoId).toBe(999);
  });
});
