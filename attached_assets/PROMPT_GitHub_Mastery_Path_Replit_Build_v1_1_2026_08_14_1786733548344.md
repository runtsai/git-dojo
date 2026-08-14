# BUILD PROMPT — GIT DOJO: THE GITHUB MASTERY PATH (visual course + Command Test Center)

*Copy everything below the line into a fresh Replit Agent session. This can be a new Repl, separate from any existing project. Attach two files alongside this prompt if you have them: `GitHub_Mastery_Path_Curriculum_v1_1_2026_08_14.md` (deeper curriculum reference) and `git-dojo_v1_0_2.zip` (the completed CLI course this app needs to port in as the Command Test Center — see that section below). Everything the Agent needs to start building is already in this prompt either way.*

---

## THE JOB

Build me a complete, polished, interactive web application that teaches a complete beginner everything about using GitHub visually — from "what even is this website" all the way to "I run my company's repositories on it with confidence" — with beautiful, original screens that recreate what GitHub's interface looks like and does, **without copying GitHub's actual logo, wordmark, or trademarked visual design.** This is an educational product, and I want to be able to share it publicly later, so it needs to stand on its own as original work, not a skin on someone else's brand.

I already went through a 7-lesson, terminal-only "Git Dojo" that taught me the actual `git` commands hands-on in a safe sandbox — I completed it, but needed a lot of hand-holding because a terminal never shows you *what anything looks like* or *where you are*. This new app carries that same dojo forward: same name, same "sandbox that can't hurt anything" promise, same owner-in-the-loop philosophy — but now with real visuals, because that's exactly what I was missing.

**Important structural decision, don't build this any other way:** the terminal/command lessons are NOT a prerequisite gate in front of the visual content. Commands are genuinely hard for a total beginner on day one, and forcing that friction first is how people quit before they ever see the payoff. So this app has **two independent tracks living side by side**: the six visual tiers (the main course, open from the moment the app loads, zero terminal experience required) and a standalone, always-optional **Command Test Center** (the original 7 lessons, ported in, reachable from a persistent control on every screen). A learner can finish the entire visual course without ever opening the Command Test Center, or dip into it after any lesson out of curiosity, or ignore the visuals and grind commands first if that's how they learn. Never build a locked door between the two.

Quality bar: this should feel like a genuinely well-designed learning product — the kind of polish you'd expect from a paid course, not a rough prototype. Take the time to make it good. I'm not rushing this.

## WHO I AM / VOICE (use this — do not invent a different persona)

I'm Adam Cornelius. I run a company (RTS.AI) that will eventually keep its actual business files and code in GitHub repositories — not hobby projects, real company records, eventually with contractors and collaborators submitting work I have to review. I came from running a trucking company and now fabricate flight hardware at an aerospace company — I think in terms of exact records, custody trails, and who signed off on what. I'm new to software development as a formal discipline but not new to running serious operations.

**Voice for all lesson copy:** plain, direct, patient, zero condescension. Explain like you're teaching a sharp adult who has simply never done this before — not a child, not a fellow programmer. No jargon without an immediate plain-English translation the first time it's used. Every example should be framed around "your company's repo," "a contractor's pull request," "your own files" — never a generic stranger's open-source project.

## THE PEDAGOGY — THE ONE RULE EVERY LESSON MUST FOLLOW

This is the actual point of the whole app, so don't drift from it: **a terminal strips out context. This app puts it back.** Every single lesson, without exception, follows this five-part shape, in this order:

1. **WHAT** — one or two plain sentences: what is this screen or concept, in the simplest possible terms.
2. **WHERE** — a labeled visual (a recreated, original-design GitHub-style screen) showing exactly where this lives in the interface, with callouts pointing at the specific elements being taught.
3. **WHY** — the real reason this exists — what problem it solves, framed around my company's actual situation (protecting real files, reviewing a contractor's work, keeping one true version of things).
4. **WHEN** — a one-line, concrete "you'd reach for this when…" moment, so the concept has a real trigger, not just an abstract definition.
5. **HOW** — the hands-on part: an interactive task on the simulated screen, PLUS (where relevant) a side-by-side callback to the equivalent terminal command from the CLI dojo, so the two tiers visibly connect ("this button does exactly what `git switch -c` did in Lesson 4").

Only after WHAT/WHERE/WHY/WHEN does the learner ever touch a HOW. Never lead with a command or a click target. This exact ordering is the product's whole reason to exist — treat it as a hard requirement, not a suggestion.

## APP STRUCTURE — TWO TRACKS, ONE APP

**Track A — the six visual tiers (the main course).** Open by default the moment the app loads. No prerequisite, no lock, no "finish this first." Everything below in this section is Track A.

**Track B — the Command Test Center (optional, always reachable).** Covered in its own section further down. Keep it visually and structurally present everywhere (a persistent nav item or button, not a buried menu option) without ever inserting it into the required path through Track A.

The progress ledger (see PROGRESSION section below) shows both tracks side by side, always. Everything in this section is Track A: Tiers 1–6.

**Tier 1 — See the Interface** (repo home screen, file tree, README render, commit graph, repo settings basics, the current global nav pattern: hamburger menu + breadcrumbs + unified search)

**Tier 2 — Collaborate Like a Team** (Issues anatomy, opening a pull request, the Files Changed review screen — resizable file tree + diff + inline comments + review panel, approve/request-changes/comment, merge strategies: merge commit vs. squash vs. rebase)

**Tier 3 — Protect the Trunk** (branch protection rules, CODEOWNERS and automatic review routing, repo roles/permissions from Read to Admin, secrets & security basics incl. a secret-scanning-alert screen, releases & tags)

**Tier 4 — Run Automation** (what a GitHub Action/workflow is conceptually, anatomy of a workflow file — triggers/jobs/steps, watching a check go from running → green pass / red fail directly on a PR, environments & secrets for automation, an honest note on where this could plug into my company's future workflow without overclaiming anything that doesn't exist yet)

**Tier 5 — Run the Organization** (personal account vs. Organization account and why company files belong in an org, teams & permissions at scale, repo templates for consistency, a Projects kanban/table board tying Issues+PRs together, Pages/Wikis/Discussions, and a full capstone case study: replay the CLI dojo's Lesson 7 contractor-delivery scenario — planted bug, planted secret, full review and disposition — entirely on these visual screens instead of the terminal)

**Tier 6 — Publish What You Learned** (preparing a repo for public eyes: README quality, LICENSE, CONTRIBUTING.md, topics, social preview image; a guided walkthrough — informational, not forced — of what it would take to publish the original CLI dojo as a real public repo; a final completion-ledger screen showing every tier, every badge, every score earned)

Write full, real lesson content for every module above yourself, following the WHAT/WHERE/WHY/WHEN/HOW template — do not leave placeholder or lorem ipsum text anywhere. Use the module names as your outline; you have creative room in exactly how each is taught as long as the five-part structure and the "my company's files" framing hold.

## THE SIMULATED GITHUB SCREENS TO BUILD (original design, not copied assets)

Build these as real, functioning, clickable UI components — not static images — so lessons can have the learner actually interact with them:

- **Repo home screen** — file tree, rendered README panel, description/topics/About sidebar, branch picker, commit-count link, a green primary action button (your own color, not GitHub's).
- **Commit graph / history view** — a visual commit timeline, clickable to a commit-detail view showing a diff.
- **Issue list + issue detail** — title, body, labels, assignee, milestone, comment thread.
- **Pull request Files Changed screen** — this is the most important one, model it after the current real GitHub redesign: a resizable file tree on the left with indicators for files that have comments/warnings, a diff view on the right (support both split and unified toggle), an Overview panel for the PR description, and a review panel showing pending draft comments before submission.
- **Branch protection settings screen** — toggles for "require PR before merging," "require approvals," "require status checks," with a plain-English explanation next to every toggle.
- **CODEOWNERS effect visualizer** — show a file path and highlight who gets auto-requested for review.
- **Actions run log** — a workflow run with jobs/steps, live-feeling status icons (queued/running/passed/failed).
- **Organization / Teams screen** — org repo list, a couple of example teams with different permission levels.
- **Projects board** — kanban columns (To do / In progress / Done) populated with cards linked to example Issues/PRs.

Use an original color palette and component design throughout — inspired by real-world Git hosting platforms' information architecture (the tabs, the diff layout, the review workflow) but visually and stylistically your own. Do not use GitHub's Octocat, wordmark, or exact brand colors anywhere.

## THE COMMAND TEST CENTER (Track B — optional, always available)

This is the original 7-lesson CLI dojo, ported into the app so it lives in the same place as everything else instead of requiring a separate zip file and a real terminal.

- **Port the content faithfully.** The zip (`git-dojo_v1_0_2.zip`, attach it if you have it) already contains all 7 lessons' real, tested content: each lesson's README (the taught steps), `setup.sh` (builds that lesson's practice repo), and `check.sh` (grades it, PASS/FAIL with specific remediation text). Use that content as the actual source of truth for what each lesson teaches and checks — don't rewrite the pedagogy, port it.
- **Build a real in-app terminal.** A web-based terminal UI (a library like xterm.js is a reasonable choice) wired to a backend that runs the actual lesson scripts (`setup.sh`/`check.sh`) against a real, per-session sandbox directory scoped only to that lesson's practice files — the same mechanism that already works in the standalone dojo, just reachable from a browser instead of a real terminal app. This is a single-user app on my own Replit account right now, so real server-side command execution scoped to a locked-down sandbox folder is an acceptable v1 approach. Flag clearly in your own code/README if you take this approach: **if this app ever opens up to other learners publicly, real shell execution needs per-session isolation (e.g., ephemeral containers) as a security requirement — not solved in v1, but don't build v1 in a way that makes it impossible to fix later.**
- **Same grading discipline as before.** PASS/FAIL per check, specific remediation text on FAIL, nothing hidden.
- **Its own badge track**, independent of the six visual tiers: one badge per lesson (7 total) plus a bonus badge for finishing all seven — visible on the same progress ledger as Track A, never blocking it.
- **Reachable from anywhere, always.** A persistent control (nav item, floating button, whatever fits the design) that opens the Command Test Center from any screen in the app, including mid-lesson in the visual tiers. Closing it and returning to whatever visual lesson was open should be seamless.
- **Soft cross-links only.** Where a Track A lesson has a natural command-line counterpart (repo home ↔ Lesson 1, commit graph ↔ Lesson 2, branches ↔ Lesson 4, etc.), that lesson can offer a "try this in the Command Test Center" link — an invitation the learner can ignore, never a required step, never a locked door.

## PROGRESSION, BADGES, AND SCORING

- **Two tracks, one ledger, always shown side by side:** Track A (six visual tiers) and Track B (Command Test Center, 7 lessons). Neither blocks the other, in either direction.
- Each module/lesson ends in a real hands-on task; an automatic checker confirms it was actually done (not just "click next") before marking it PASS — tell the learner exactly what's missing on a FAIL, same discipline the original dojo already has.
- A Track A badge unlocks per tier, only when every module in that tier has passed. A Track B badge unlocks per lesson, plus a bonus badge for all seven.
- Progress must persist across sessions (store it server-side or in a lightweight database so closing the browser doesn't lose it — this is a single-user app for me right now, so keep the persistence approach simple, but don't design it in a way that makes adding real user accounts later painful if this ever opens up to other learners).
- A visible "where am I" progress view at all times, covering both tracks — current tier, modules done, modules remaining, badges earned, Command Test Center status. I want to see my own progress, not guess at it.
- Close with a completion-ledger / certificate screen once Track A's Tier 6 is done, summarizing everything earned across both tracks — including an honest "Command Test Center: not attempted / in progress / complete" line, no shame attached to any of those states.

## DESIGN DIRECTION

- **Aesthetic:** same visual family as my company site — dark charcoal base, one confident accent color, clean industrial-modern feel, generous whitespace, crisp typography. This is a distinct product from my company's client-facing site though — it's a teaching tool, not a governed business product, so give it its own personality within that same family (a little more playful/game-like in the progression and badge elements is welcome — this should feel rewarding to use).
- **Fully responsive, phone-first-tested.** I use this from both a laptop and my phone through the Replit app — make sure every screen, including the simulated GitHub mockups, actually works and stays readable on a small screen, not just scaled-down desktop layouts.
- **Motion:** tasteful reveals and transitions between lesson steps, a satisfying moment when a badge unlocks. Nothing gimmicky.
- **Accessibility:** readable contrast, keyboard-navigable where reasonable, no essential information conveyed by color alone (color-blind friendly for the pass/fail and red/green status indicators specifically).

## HARD RULES

1. **No real GitHub account, OAuth, or API calls anywhere in this version.** Everything is simulated/local. Zero risk to any real repository, on purpose — that was an explicit decision, don't quietly add real integration.
2. **No GitHub trademarked assets** — no Octocat, no GitHub wordmark/logo, no verbatim copy of GitHub's exact layouts or copy text. Teach the same concepts and interaction patterns with your own original design.
3. **No fake completion.** A module only shows PASS when its hands-on task was actually completed correctly — no "mark as read" shortcuts.
4. **No overclaiming about my company's products.** Where lessons reference "what this could support at RTS.AI later" (mainly in Tier 4's Actions section), keep it clearly framed as a future possibility, never as an existing feature.
5. **Don't touch or reference any real company file, credential, or production system.** This app and its content stay entirely self-contained.

## TECH + DEPLOYMENT

- Build and host on this Replit account (existing credits). Your call on the stack — favor something you can build cleanly and I can still read/edit later; a simple full-stack setup (a straightforward frontend framework + a lightweight backend for progress persistence) is preferred over anything exotic.
- Set up Replit Deployments so I have a stable link to reach it from any device, including my phone.
- Keep the codebase organized enough that a future Replit Agent session (or me, learning as I go) can find and edit lesson content without spelunking — one clear place per tier/module's content, not content scattered across the codebase.
- Include a short README: how the content is organized, how to add or edit a lesson, how to redeploy.
- If useful, back the repo up to GitHub too (I have the account) — good real-world practice, and a little on-the-nose given what this app teaches.

## PROCESS

1. First show me: the app's overall navigation/progress-ledger concept (both tracks visible), the visual style (colors/typography/badge design), and Tier 1 Module 1.1 fully built end-to-end — before building everything else. I want to see the WHAT/WHERE/WHY/WHEN/HOW pattern actually working once before you build 30 more modules on top of it.
2. Once I approve the pattern, build out the rest of Tier 1, then check in again before moving to Tier 2.
3. Continue tier by tier — I'd rather review in chunks than get a giant wall of content to approve all at once at the very end.
4. Port the Command Test Center (Track B) as its own chunk, whenever it's convenient in the build order — it doesn't need to wait for all six visual tiers to finish, since it's independent. A reasonable point is right after Tier 1, once the persistent nav pattern exists to hang its entry point on.
5. Deploy after each tier is stable so I can actually use it as it grows, not just at the very end.

**Definition of done (for v1):** all of Tiers 1–6 built with real, non-placeholder lesson content following the WHAT/WHERE/WHY/WHEN/HOW pattern throughout, every module has a working hands-on task and automatic grading, the Command Test Center is ported in and fully reachable from anywhere without gating anything, the two-track badge/progress ledger works and persists, it's deployed and usable from my phone, and nothing in it touches a real GitHub account or trademarked asset.
