# Git Dojo: The GitHub Mastery Path

An open-source educational web app (by RUN Trading Systems / RTS.AI LLC) teaching GitHub visually, from beginner to expert. Two independent tracks, zero gating:
- **Track A — six visual tiers** (`/learn/...`): interactive lessons following a strict WHAT/WHERE/WHY/WHEN/HOW structure on original, simulated GitHub-style screens (no GitHub trademarks). Lesson content lives in `artifacts/git-dojo-dashboard/src/content/` — one clear place per tier/module.
- **Track B — Command Test Center** (`/test-center`): the original 7-lesson CLI dojo, with live repo-state visualization and check.sh graders.

Build spec: `attached_assets/PROMPT_GitHub_Mastery_Path_Replit_Build_v1_1_*.md` (process: build tier by tier, owner reviews each chunk). Phase 1 (shell + ledger + Module 1.1 + Test Center) is done; Tiers 1.2–6 pending.

Progress persistence: single-user JSON file at `data/progress.json` via `/api/progress`. **No fake completion:** CLI badges are recorded server-side only when a lesson's grader passes; the completion endpoint only accepts allowlisted visual module ids.

## Design doctrine (hard rules — every tier and feature is built to these)

Our three structural advantages. Never dilute them; every new module must express all three:
1. **Context before command.** Every lesson follows WHAT → WHERE → WHY → WHEN → HOW, in that exact order. The learner understands the screen and the business reason before any command appears. No exceptions, no "quick" lessons that skip ahead.
2. **The operator persona.** The learner is never a student passing a quiz — they are an owner protecting their company's records, reviewing a contractor's work, keeping the custody trail intact. Every scenario, example file, and grader message is framed with those real stakes.
3. **The unlocked dual track.** Track A (visual), Track B (terminal), Breakthroughs, and future sections are never gated on each other. Learners self-regulate; persistent nav keeps every track one tap away.

Simulator standards (raise the bar as Tiers 2–6 are built):
4. **Dynamic consequence visualization.** Never explain an operation's effect in text alone — let the learner preview it. E.g. the merge-strategy choice (merge/squash/rebase) must live-redraw the commit graph before they commit to it.
5. **Visceral danger feedback.** When the learner does something dangerous in a simulation (commits a planted secret, force-pushes over history), the simulator halts them with the same severity real GitHub would — high-contrast alert treatments, not a gentle toast. The simulator must feel as strict as the real platform.
6. **Living automation.** Simulated CI/automation must run *live on screen* — queue, run, then stamp pass/fail onto the PR — never a static "the check passed" caption.

Simulator state model: Track B and the Crisis Room are backed by real Git repos (`~/git-dojo`) graded server-side; Track A / Breakthroughs sims are front-end state machines — rich enough to react, never pretending to be graded.

## Important

- The active Git Dojo course lives at `~/git-dojo` (OUTSIDE the workspace) because Replit's checkpoint system strips nested `.git` dirs inside the workspace. The API server reads from there (see `artifacts/api-server/src/routes/dojo.ts`, `dojoRoot()`); `workspace/git-dojo` is only a fallback for listing lessons.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
