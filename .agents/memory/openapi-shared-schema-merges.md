---
name: OpenAPI shared-schema merges
description: Why merging branches that both touch openapi.yaml needs runtime checks on every endpoint sharing a schema
---

When two branches each add fields to a shared OpenAPI schema (e.g. RepoState), merging the spec and re-running codegen passes typecheck, but any *other* route that `.parse()`s responses with the merged Zod schema can start failing at runtime with new required fields it never sets.

**Why:** Zod response validation is runtime-only; tsc can't see that a route omits a newly-required field when the object is spread from a helper.

**How to apply:** After any openapi.yaml merge + codegen, curl every endpoint that returns a schema either branch touched — not just the endpoints the branches added.
