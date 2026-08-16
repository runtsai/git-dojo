// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { safeStorage } from "./safe-storage";

beforeEach(() => {
  localStorage.clear();
  safeStorage._resetMemStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Normal operation
// ---------------------------------------------------------------------------

describe("normal operation", () => {
  it("reads a value that was written", () => {
    safeStorage.setItem("k", "42");
    expect(safeStorage.getItem("k")).toBe("42");
  });

  it("returns null for a key that was never set", () => {
    expect(safeStorage.getItem("missing")).toBeNull();
  });

  it("removeItem makes the key return null", () => {
    safeStorage.setItem("k", "hello");
    safeStorage.removeItem("k");
    expect(safeStorage.getItem("k")).toBeNull();
  });

  it("overwrites a value with setItem", () => {
    safeStorage.setItem("k", "first");
    safeStorage.setItem("k", "second");
    expect(safeStorage.getItem("k")).toBe("second");
  });
});

// ---------------------------------------------------------------------------
// Storage cleared mid-session (localStorage.clear() returns null, not throws)
// ---------------------------------------------------------------------------

describe("localStorage.clear() mid-session", () => {
  it("retains the value after localStorage is cleared", () => {
    safeStorage.setItem("crisis-hints-merge-conflict", "2");
    // Simulate the browser clearing storage (private mode quota, user clearing data, etc.)
    localStorage.clear();
    // safeStorage must return the in-memory value, not null
    expect(safeStorage.getItem("crisis-hints-merge-conflict")).toBe("2");
  });

  it("retains the latest value when storage is cleared after multiple writes", () => {
    safeStorage.setItem("k", "1");
    safeStorage.setItem("k", "3");
    localStorage.clear();
    expect(safeStorage.getItem("k")).toBe("3");
  });

  it("does NOT retain a value that was explicitly removed before the clear", () => {
    safeStorage.setItem("k", "5");
    safeStorage.removeItem("k");
    localStorage.clear();
    expect(safeStorage.getItem("k")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// localStorage throws (quota exceeded, security error)
// ---------------------------------------------------------------------------

describe("localStorage throws on setItem", () => {
  it("still makes the value readable via getItem after a setItem failure", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    safeStorage.setItem("k", "7");
    // getItem will also throw — patch it to simulate fully broken storage
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(safeStorage.getItem("k")).toBe("7");
  });
});

describe("localStorage throws on getItem", () => {
  it("falls back to in-memory value when getItem throws", () => {
    // Write successfully first (storage not yet broken)
    safeStorage.setItem("k", "9");
    // Now break getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(safeStorage.getItem("k")).toBe("9");
  });

  it("returns null when getItem throws and key was never written", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(safeStorage.getItem("never-set")).toBeNull();
  });
});

describe("localStorage throws on removeItem", () => {
  it("still clears the in-memory value when removeItem throws", () => {
    safeStorage.setItem("k", "42");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    safeStorage.removeItem("k");
    // In-memory mirror must be cleared too
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(safeStorage.getItem("k")).toBeNull();
  });
});
