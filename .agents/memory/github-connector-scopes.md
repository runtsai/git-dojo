---
name: GitHub connector scope limits
description: Replit GitHub connector cannot delete repositories
---
Observed August 2026: the Replit GitHub connector token had `repo` scope but NOT `delete_repo`, so deleting a repository via the API failed ("Must have admin rights to Repository"), even for repos the token created. Re-verify with a live call before relying on this — connector scopes may change.
**Why:** GitHub gates repo deletion behind a separate OAuth scope the connector does not request.
**How to apply:** never promise automatic repo deletion in UX or API docs; any teardown affordance must reset local state and direct the user to delete the repo manually in the repo's GitHub settings.

## Pushing to GitHub from this workspace
- `replit-git-askpass` fails in agent/automated shell — use the connector token path instead (`REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY`).
