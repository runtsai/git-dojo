# Git Dojo

**Learn Git and GitHub by doing the work — safely.**

[Try Git Dojo](https://git-dojo.com) · [Open the command practice course](./git-dojo) · [Read the contribution guide](./CONTRIBUTING.md)

Git Dojo is a free, open-source learning environment for people who want to understand Git and GitHub as working tools, not memorized commands. It gives learners a visual path through Git concepts and a separate terminal-based practice course with real repositories, safe mistakes, and clear checks.

> Git Dojo is an independent educational project. It is not affiliated with, endorsed by, or sponsored by GitHub.

## What you can do

- **Learn visually** — explore Git concepts through interactive, simulated repository screens that explain what is happening, where to look, why it matters, when to use it, and how to act.
- **Practice in a safe terminal sandbox** — complete hands-on lessons against real local Git repositories. Every lesson builds a disposable playground; it never changes a learner’s real work.
- **Work through realistic scenarios** — handle branches, merge conflicts, remote collaboration, review, recovery, and repository history with the same care real teams need.
- **Warm up what you learned** — optional recall drills help concepts stick without blocking progress.

## Start here

### Use the web app

Open [git-dojo.com](https://git-dojo.com), then choose the path that suits you:

- **Learn** for visual, interactive explanations.
- **Test Center** for command-line lessons with a built-in grader.
- **Crisis Room** for realistic Git recovery scenarios.

### Run the command practice course locally

The hands-on course lives in [`git-dojo/`](./git-dojo). It contains nine guided lessons, each with:

| File | Purpose |
| --- | --- |
| `README.md` | The lesson and commands to try |
| `setup.sh` | Creates a disposable practice repository |
| `check.sh` | Reports what passed and what still needs work |

Read the [course guide](./git-dojo/README.md) for Windows, macOS, Linux, Replit Shell, and GitHub Codespaces setup instructions.

## Local development

Git Dojo is a pnpm workspace built with TypeScript. You will need a current Node.js release and pnpm.

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

Useful commands:

```bash
# Run the dashboard locally
pnpm --filter @workspace/git-dojo-dashboard run dev

# Run the API server locally
pnpm --filter @workspace/api-server run dev

# Run dashboard tests
pnpm --filter @workspace/git-dojo-dashboard run test

# Run the hands-on lesson self-check
bash git-dojo/selftest.sh
```

## Project structure

```text
artifacts/git-dojo-dashboard/  Interactive learning web app
artifacts/api-server/          API, lesson state, graders, and progress storage
git-dojo/                      Standalone command-line practice course
lib/                           Shared course content, API contracts, and utilities
scripts/                       Build, smoke-check, and GitHub sync tooling
```

## Contributing

Contributions are welcome — especially clearer explanations, accessibility improvements, lesson fixes, and beginner-friendly issue reports.

Before opening a pull request, please read [CONTRIBUTING.md](./CONTRIBUTING.md). For behavior expectations, see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). For security reports, use [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## License

Git Dojo is released under the [MIT License](./LICENSE).