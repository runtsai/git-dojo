# Adding Warm-Up Drills

Every piece of content in Git Dojo — modules, CLI lessons, crises, and breakthroughs — must be backed by at least one warm-up drill in `drills.ts`. The test in `drills.coverage.test.ts` fails loudly when that contract is broken.

## When do you need to add drills?

| You added… | What to do |
|---|---|
| A new module to `tiers.ts` (with `status: "active"`) | Add ≥1 drill with the module id (e.g. `"3.1"`) in `unlockedBy` |
| A new lesson to `map/index.ts` `lessonLocations` (key matches `lesson-XX`) | Add ≥1 drill with the lesson id in `unlockedBy` |
| A new crisis to `crises.ts` | Add ≥1 drill with the crisis id in `unlockedBy` |
| A new breakthrough to `breakthroughs/index.ts` | Add ≥1 drill with `breakthroughId` set to the breakthrough id |

Run `pnpm --filter @workspace/git-dojo-dashboard run test` to confirm coverage before merging.

---

## Drill formats

### `concept` — tap-to-answer recall card

```ts
{
  id: "t3-unique-id",          // kebab-case, globally unique
  type: "concept",
  prompt: "Question shown to the learner?",
  options: [                    // exactly 4 choices
    "Wrong answer A",
    "Correct answer",
    "Wrong answer C",
    "Wrong answer D",
  ],
  answerIndex: 1,               // 0-based index of the correct choice
  explain:
    "One-sentence explanation shown after the attempt.",
  sourceLabel: "Module 3.1 — Title of the module",
  sourceId: "lesson-10",        // optional: boosts priority when grader shows friction here
  breakthroughId: "my-bt-id",  // set this when the drill reinforces a breakthrough
  unlockedBy: ["3.1"],          // the content ids that unlock this drill
},
```

### `command` — type the Git command

```ts
{
  id: "cmd-unique-id",
  type: "command",
  prompt: "Plain-English description of what the command should do.",
  answers: [
    "git the-command <placeholder>",  // first entry = canonical answer shown after attempt
    "git alternate-form",             // additional accepted forms
  ],
  explain: "One-sentence explanation of what the command does.",
  sourceLabel: "Lesson 10 — Title",
  sourceId: "lesson-10",             // optional
  breakthroughId: "my-bt-id",        // optional
  unlockedBy: ["lesson-10"],
},
```

> **Placeholders**: wrap any argument the learner can choose freely in `<angle-brackets>`, e.g. `git switch -c <branch>`. The checker accepts any single non-whitespace token in that position.

---

## Placement in `drills.ts`

The file is organised into sections with comments. Place your new drills in the appropriate section:

| Section | Comment header |
|---|---|
| Tier 1 modules | `// ── Tier 1 — The Ground Truth` |
| Tier 2 modules | `// ── Tier 2 — Reviewing a Contractor's Work` |
| Future tiers | Add a new section comment, e.g. `// ── Tier 3 — Protect the Trunk` |
| Breakthrough recall | `// ── Breakthroughs` |
| CLI lesson commands | `// ── Test Center command recall` |
| Crisis commands | `// ── Crisis Room command recall` |

---

## Coverage check internals

`drills.coverage.test.ts` builds four content sets at runtime:

- **Active module ids** — from `tiers.ts`, active tiers only
- **Lesson ids** — keys matching `/^lesson-\d+$/` in `lessonLocations` (`map/index.ts`)
- **Crisis ids** — from `crises.ts`
- **Breakthrough ids** — from `breakthroughs/index.ts`

It then checks:
- Each module/lesson/crisis id appears in at least one drill's `unlockedBy` array
- Each breakthrough id appears in at least one drill's `breakthroughId` field

The check automatically picks up any new content registered in those four files — no edits to the test itself are needed.
