---
name: Validation workflow updates
description: Choosing the supported API for existing validation workflows.
---

Use the validation skill's `setValidationCommand` to update an existing validation workflow.

**Why:** Direct .replit edits are blocked, and the general workflow configurator rejects updates to validation workflows as an attempted conversion to a non-validation workflow.

**How to apply:** When modifying a workflow marked as validation, read the validation skill and update it by its existing name; use its validation runner to inspect the combined output and exit status.