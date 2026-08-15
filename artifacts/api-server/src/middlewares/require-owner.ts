import type { Request, Response, NextFunction } from "express";

/**
 * Restrict an endpoint to the workspace owner.
 *
 * Replit's edge proxy injects `X-Replit-User-Id` / `X-Replit-User-Name` on
 * every request that traverses it — set to the authenticated Replit user, or
 * to an EMPTY string for anonymous visitors — and it overrides any
 * client-supplied values, so the headers cannot be spoofed from outside.
 *
 * Rules:
 * - Headers absent entirely: the request never crossed the edge proxy, i.e.
 *   it came from inside the workspace (shell curl, tests, local tooling) —
 *   allow.
 * - Headers present: allow only when the injected identity matches the
 *   workspace owner (REPL_OWNER / REPL_OWNER_ID). Anonymous or non-owner
 *   callers are rejected.
 *
 * This guards mutation endpoints (crisis playground setup/check, Go Live
 * GitHub operations) that act on the owner's machine and GitHub account.
 */
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const userName = req.headers["x-replit-user-name"];
  const userId = req.headers["x-replit-user-id"];

  if (userName === undefined && userId === undefined) {
    // Workspace-internal request (never crossed Replit's edge proxy).
    next();
    return;
  }

  const owner = process.env.REPL_OWNER;
  const ownerId = process.env.REPL_OWNER_ID;
  if (
    (owner && typeof userName === "string" && userName !== "" && userName === owner) ||
    (ownerId && typeof userId === "string" && userId !== "" && userId === ownerId)
  ) {
    next();
    return;
  }

  res.status(403).json({ error: "This action is limited to the workspace owner." });
}
