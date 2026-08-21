# Contributing to Git Dojo

Thank you for helping make Git less intimidating.

Git Dojo teaches people how to protect real work. Contributions should make the product clearer, safer, more accessible, or easier to maintain.

## Good ways to help

- Report a confusing explanation or an inaccurate Git/GitHub claim.
- Improve lesson wording, accessibility, or keyboard support.
- Add a focused test for a real regression.
- Improve the command-practice course without changing its safe sandbox boundary.
- Fix a bug with a small, well-explained pull request.

Please open an issue before starting large changes so the work does not overlap or drift from the learning approach.

## Before you begin

1. Read the repository’s [README](./README.md).
2. Search existing issues and pull requests for related work.
3. Keep one pull request focused on one user-visible improvement.
4. Do not include secrets, personal data, generated build output, or practice-repository data.

## Local checks

Install dependencies and run the checks that cover your change:

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

For dashboard changes:

```bash
pnpm --filter @workspace/git-dojo-dashboard run test
```

For command-course changes:

```bash
bash git-dojo/selftest.sh
```

## Teaching standards

Git Dojo lessons should:

- Explain **what**, **where**, **why**, **when**, then **how**.
- Teach technically correct Git behavior. A simple explanation is welcome; a misleading one is not.
- Show consequences rather than asking learners to memorize commands.
- Keep visual learning and terminal practice independently available.
- Preserve the safe sandbox: lessons must never touch a learner’s real project files.

## Pull request checklist

Before requesting review:

- [ ] The change has a clear purpose and stays focused.
- [ ] Relevant checks pass locally.
- [ ] Lesson text is accurate and understandable to a beginner.
- [ ] New controls work with a keyboard and have accessible labels.
- [ ] No secret, private, or generated data is included.
- [ ] The pull request explains what changed and how it was checked.

## Community expectations

Be constructive, patient, and specific. Git can feel high-stakes to new learners; help us keep this project welcoming to questions. See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for the full policy.
