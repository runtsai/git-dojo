import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireOwner } from "./require-owner";
import { rateLimit, resetRateLimits } from "./rate-limit";

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function makeReq(headers: Record<string, string | undefined>): Request {
  return { headers } as unknown as Request;
}

describe("requireOwner", () => {
  const OLD_OWNER = process.env.REPL_OWNER;
  const OLD_OWNER_ID = process.env.REPL_OWNER_ID;

  beforeEach(() => {
    process.env.REPL_OWNER = "the-owner";
    process.env.REPL_OWNER_ID = "12345";
  });

  afterEach(() => {
    process.env.REPL_OWNER = OLD_OWNER;
    process.env.REPL_OWNER_ID = OLD_OWNER_ID;
  });

  it("allows workspace-internal requests (no identity headers at all)", () => {
    const next = vi.fn();
    const res = mockRes();
    requireOwner(makeReq({}), res, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it("rejects anonymous visitors (empty identity headers from the edge proxy)", () => {
    const next = vi.fn();
    const res = mockRes();
    requireOwner(
      makeReq({ "x-replit-user-name": "", "x-replit-user-id": "" }),
      res,
      next as NextFunction,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("rejects authenticated non-owners", () => {
    const next = vi.fn();
    const res = mockRes();
    requireOwner(
      makeReq({ "x-replit-user-name": "attacker", "x-replit-user-id": "99999" }),
      res,
      next as NextFunction,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("allows the owner by user name", () => {
    const next = vi.fn();
    const res = mockRes();
    requireOwner(
      makeReq({ "x-replit-user-name": "the-owner", "x-replit-user-id": "99999" }),
      res,
      next as NextFunction,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows the owner by user id", () => {
    const next = vi.fn();
    const res = mockRes();
    requireOwner(
      makeReq({ "x-replit-user-name": "different-name", "x-replit-user-id": "12345" }),
      res,
      next as NextFunction,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects when owner env vars are unset but identity headers are present", () => {
    delete process.env.REPL_OWNER;
    delete process.env.REPL_OWNER_ID;
    const next = vi.fn();
    const res = mockRes();
    requireOwner(
      makeReq({ "x-replit-user-name": "anyone", "x-replit-user-id": "1" }),
      res,
      next as NextFunction,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to max requests, then returns 429", () => {
    const limiter = rateLimit("test-bucket", 3, 60_000);
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const next = vi.fn();
      const res = mockRes();
      limiter(makeReq({}), res, next as NextFunction);
      results.push(next.mock.calls.length === 1 ? 200 : res.statusCode);
    }
    expect(results).toEqual([200, 200, 200, 429, 429]);
  });

  it("separate buckets do not interfere", () => {
    const a = rateLimit("bucket-a", 1, 60_000);
    const b = rateLimit("bucket-b", 1, 60_000);
    const nextA = vi.fn();
    const nextB = vi.fn();
    a(makeReq({}), mockRes(), nextA as NextFunction);
    b(makeReq({}), mockRes(), nextB as NextFunction);
    expect(nextA).toHaveBeenCalledOnce();
    expect(nextB).toHaveBeenCalledOnce();
  });

  it("window expiry frees up the bucket again", () => {
    vi.useFakeTimers();
    try {
      const limiter = rateLimit("expiry-bucket", 1, 1_000);
      const next1 = vi.fn();
      limiter(makeReq({}), mockRes(), next1 as NextFunction);
      const blockedRes = mockRes();
      limiter(makeReq({}), blockedRes, vi.fn() as NextFunction);
      expect(blockedRes.statusCode).toBe(429);
      vi.advanceTimersByTime(1_100);
      const next2 = vi.fn();
      limiter(makeReq({}), mockRes(), next2 as NextFunction);
      expect(next2).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
