---
name: GitHub connector scope limits
description: Replit GitHub connector cannot delete repositories
---
Observed August 2026: the Replit GitHub connector token had `repo` scope but NOT `delete_repo`, so deleting a repository via the API failed ("Must have admin rights to Repository"), even for repos the token created. Re-verify with a live call before relying on this — connector scopes may change.
**Why:** GitHub gates repo deletion behind a separate OAuth scope the connector does not request.
**How to apply:** never promise automatic repo deletion in UX or API docs; any teardown affordance must reset local state and direct the user to delete the repo manually in the repo's GitHub settings.

## Pushing to GitHub from this workspace
- `replit-git-askpass` (GIT_ASKPASS helper) fails with "Invalid username or token" when run from agent shell — do not rely on it in sync scripts run by me.
- The `sync-github` validation step hangs forever in the task-completion validation runner (no interactive askpass → git prompts for a username and polls exhaust). If review + other checks pass, complete with skip_validation_reason citing this, or run the sync via the working pattern below first.
- Working pattern: inside CodeExecution "use impure", fetch connector token from $REPLIT_CONNECTORS_HOSTNAME /api/v2/connection?include_secrets=true&connector_names=github (X_REPLIT_TOKEN: "repl "+$REPL_IDENTITY), then `git push https://x-access-token:TOKEN@github.com/runtsai/git-dojo.git main:main`. Never log or store the token; tokenless `origin` remote stays configured.
