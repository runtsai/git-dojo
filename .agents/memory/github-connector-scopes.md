---
name: GitHub connector scope limits
description: Replit GitHub connector cannot delete repositories
---
Observed August 2026: the Replit GitHub connector token had `repo` scope but NOT `delete_repo`, so deleting a repository via the API failed ("Must have admin rights to Repository"), even for repos the token created. Re-verify with a live call before relying on this — connector scopes may change.
**Why:** GitHub gates repo deletion behind a separate OAuth scope the connector does not request.
**How to apply:** never promise automatic repo deletion in UX or API docs; any teardown affordance must reset local state and direct the user to delete the repo manually in the repo's GitHub settings.

## Pushing to GitHub from this workspace
- `replit-git-askpass` (GIT_ASKPASS helper) fails with "Invalid username or token" when run from agent shell — do not rely on it in sync scripts run by me.
- GitHub sync now runs in `scripts/post-merge.sh` as a hard-failing step (not best-effort). Any auth or divergence error blocks the post-merge and surfaces immediately. `skip_validation_reason` for sync-github is no longer needed at markTaskComplete time.
- Working pattern for ad-hoc pushes in shell: `TOKEN=$(curl -sf "https://${REPLIT_CONNECTORS_HOSTNAME}/api/v2/connection?include_secrets=true&connector_names=github" -H "X-Replit-Token: repl ${REPL_IDENTITY}" | jq -r '.items[0].settings.access_token') && git push "https://x-access-token:${TOKEN}@github.com/runtsai/git-dojo.git" main:main`. Never log or store the token.
