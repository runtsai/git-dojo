---
name: Owner-gating verification
description: How to correctly test requireOwner-gated api-server endpoints from the shell
---
The api-server's owner gate treats *absent* identity headers as workspace-internal (allow) and *present-but-empty* headers as an anonymous edge-proxy visitor (403).

**Why:** Replit's edge proxy always injects `X-Replit-User-*` headers (empty string for anonymous visitors) and overrides client-supplied values; requests without the headers can only originate inside the workspace.

**How to apply:** When curl-testing anonymous access, `-H "X-Replit-User-Name: "` silently DROPS the header (curl discards empty-value headers), so the request looks workspace-internal and returns 200 — a false negative. Use `-H "X-Replit-User-Name;"` (semicolon syntax) to actually send an empty header. Also: any endpoint that spawns child processes (graders, bots, exports) should carry `requireOwner` and/or the shared `rateLimit` middleware; tests that hammer a rate-limited endpoint must call `resetRateLimits()` in `beforeEach`.
