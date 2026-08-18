import type { Request, Response, NextFunction } from "express";

/**
 * Minimal in-process rate limiter for endpoints that spawn child processes
 * (lesson graders, teammate bots). These are single-user endpoints, so a
 * simple shared token window is enough — the goal is to stop a runaway
 * client (or a scripted abuser who somehow passes the owner check) from
 * fork-bombing the machine with grader shells, not to do per-IP fairness.
 *
 * Each named bucket allows `max` requests per sliding `windowMs` window.
 * Excess requests get HTTP 429 without spawning anything.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(name: string, max = 20, windowMs = 60_000) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const recent = (buckets.get(name) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.status(429).json({ error: "Too many runs in a row — wait a moment and try again." });
      return;
    }
    recent.push(now);
    buckets.set(name, recent);
    next();
  };
}

/** Test hook: clear all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
