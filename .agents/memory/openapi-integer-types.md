---
name: OpenAPI integer types break codegen
description: Why `type: integer` must not be used in lib/api-spec/openapi.yaml
---
Rule: use `type: number` (never `type: integer`) in the OpenAPI spec.

**Why:** Orval emits `zod.int()` for `type: integer`, but the workspace pins zod 3.25 which has no `z.int()`; `typecheck:libs` then fails inside the codegen chain, looking like a codegen error.

**How to apply:** any time a count/quantity field is added to the spec, declare it `type: number` and rely on runtime semantics.
