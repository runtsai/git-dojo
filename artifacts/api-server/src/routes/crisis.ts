import { Router, type IRouter } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ListCrisisScenariosResponse,
  SetupCrisisScenarioResponse,
  GetCrisisRepoStateResponse,
  RunCrisisCheckResponse,
} from "@workspace/api-zod";
import { recordCompletion, loadEntries } from "../lib/progress-store";
import { readRepoState, buildSummary, isRepo, git } from "../lib/repo-state";

const run = promisify(execFile);

const router: IRouter = Router();

/**
 * Crisis playgrounds live under the same dojo root the lessons use. That
 * root must be OUTSIDE the workspace when possible (Replit's checkpoint
 * system strips nested .git dirs inside the workspace).
 */
function crisisRoot(): string {
  const home = path.join(os.homedir(), "git-dojo");
  if (existsSync(home)) return home;
  const ws = path.resolve(process.cwd(), "..", "..", "git-dojo");
  if (existsSync(ws)) return ws;
  return home; // will be created on first setup
}

function playground(id: string): string {
  return path.join(crisisRoot(), "playground", id);
}

/** Run git, throwing on failure (setup must be deterministic). */
async function mustGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, {
    cwd,
    timeout: 15_000,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME: "Previous Operator",
      GIT_AUTHOR_EMAIL: "ops@example.com",
      GIT_COMMITTER_NAME: "Previous Operator",
      GIT_COMMITTER_EMAIL: "ops@example.com",
    },
  });
  return stdout;
}

async function freshRepo(id: string): Promise<string> {
  const pg = playground(id);
  rmSync(pg, { recursive: true, force: true });
  mkdirSync(pg, { recursive: true });
  await mustGit(pg, ["init", "-q", "-b", "main"]);
  await mustGit(pg, ["config", "user.name", "Previous Operator"]);
  await mustGit(pg, ["config", "user.email", "ops@example.com"]);
  return pg;
}

function write(pg: string, file: string, content: string) {
  writeFileSync(path.join(pg, file), content);
}

async function commitAll(pg: string, message: string) {
  await mustGit(pg, ["add", "-A"]);
  await mustGit(pg, ["commit", "-q", "-m", message]);
}

function fileHas(pg: string, file: string, needle: string): boolean {
  try {
    return readFileSync(path.join(pg, file), "utf-8").includes(needle);
  } catch {
    return false;
  }
}

function noConflictMarkers(pg: string, file: string): boolean {
  try {
    return !/^(<{7}|={7}|>{7})/m.test(readFileSync(path.join(pg, file), "utf-8"));
  } catch {
    return false;
  }
}

async function isClean(pg: string): Promise<boolean> {
  const out = await git(pg, ["status", "--porcelain"]);
  return out !== null && out.trim() === "";
}

async function onABranch(pg: string): Promise<string | null> {
  const out = await git(pg, ["branch", "--show-current"]);
  return out && out.trim() ? out.trim() : null;
}

/** Is a commit with this exact subject reachable from any local branch? */
async function subjectOnBranches(pg: string, subject: string): Promise<boolean> {
  const out = await git(pg, ["log", "--branches", "--format=%s"]);
  return !!out && out.split("\n").includes(subject);
}

async function subjectOnHead(pg: string, subject: string): Promise<boolean> {
  const out = await git(pg, ["log", "--format=%s"]);
  return !!out && out.split("\n").includes(subject);
}

interface CheckItem {
  label: string;
  hint: string;
  test: (pg: string) => Promise<boolean>;
}

interface CrisisDef {
  id: string;
  number: number;
  setup: (pg: string) => Promise<void>;
  checks: CheckItem[];
  passLine: string;
}

const RATES = "RTS Freight rates\nStandard load: $500\nRush load: $750\nFuel surcharge: $40\n";
const DRIVERS = "Active drivers\nM. Alvarez\nJ. Okafor\n";
const CLIENTS = "Client ledger\nHarbor Mills — net 30\nGrange Supply — net 15\n";

const SCENARIOS: CrisisDef[] = [
  {
    id: "crisis-01",
    number: 1,
    // Detached HEAD with a commit sealed while detached.
    setup: async (pg) => {
      write(pg, "rates.txt", RATES);
      await commitAll(pg, "Open the rate book");
      write(pg, "drivers.txt", DRIVERS);
      await commitAll(pg, "Add driver roster");
      write(pg, "clients.txt", CLIENTS);
      await commitAll(pg, "Add client ledger");
      const oldHash = (await mustGit(pg, ["rev-parse", "HEAD~2"])).trim();
      await mustGit(pg, ["checkout", "-q", oldHash]);
      write(pg, "rates.txt", RATES.replace("Rush load: $750", "Rush load: $825"));
      await commitAll(pg, "Emergency rush rate correction");
    },
    checks: [
      {
        label: "Back on a branch (HEAD reattached)",
        hint: "git switch -c rescue  — or get back to main",
        test: async (pg) => (await onABranch(pg)) !== null,
      },
      {
        label: "The emergency correction is reachable from a branch",
        hint: "put a branch name on the commit you sealed while detached, or cherry-pick it onto main",
        test: (pg) => subjectOnBranches(pg, "Emergency rush rate correction"),
      },
      {
        label: "Working tree clean",
        hint: "commit or discard any leftover edits",
        test: isClean,
      },
    ],
    passLine: "HEAD reattached and the stranded commit is safe on a branch. Detached HEAD is a place, not an error.",
  },
  {
    id: "crisis-02",
    number: 2,
    // Multi-file merge conflict, dropped mid-merge.
    setup: async (pg) => {
      write(pg, "rates.txt", RATES);
      write(pg, "drivers.txt", DRIVERS);
      await commitAll(pg, "Open the books");
      await mustGit(pg, ["switch", "-q", "-c", "rate-overhaul"]);
      write(pg, "rates.txt", RATES.replace("Fuel surcharge: $40", "Fuel surcharge: $80"));
      write(pg, "drivers.txt", DRIVERS + "T. Brandt\n");
      await commitAll(pg, "Overhaul: raise fuel surcharge, add Brandt");
      await mustGit(pg, ["switch", "-q", "main"]);
      write(pg, "rates.txt", RATES.replace("Fuel surcharge: $40", "Fuel surcharge: $65"));
      write(pg, "drivers.txt", DRIVERS + "R. Chen\n");
      await commitAll(pg, "Mainline: raise fuel surcharge, add Chen");
      // Leave the learner mid-merge with conflicts in both files.
      try {
        await mustGit(pg, ["merge", "rate-overhaul"]);
      } catch {
        /* expected: conflict */
      }
    },
    checks: [
      {
        label: "Merge fully completed (no conflict left open)",
        hint: "edit both files, git add them, then git commit",
        test: async (pg) => !existsSync(path.join(pg, ".git", "MERGE_HEAD")) && (await isClean(pg)),
      },
      {
        label: "Fuel surcharge resolved to $80 (the overhaul ruling)",
        hint: "the ruling was $80 — keep the overhaul number in rates.txt",
        test: async (pg) => fileHas(pg, "rates.txt", "Fuel surcharge: $80"),
      },
      {
        label: "Both new drivers kept",
        hint: "drivers.txt must list both T. Brandt and R. Chen",
        test: async (pg) => fileHas(pg, "drivers.txt", "T. Brandt") && fileHas(pg, "drivers.txt", "R. Chen"),
      },
      {
        label: "No conflict markers left in either file",
        hint: "delete every <<<<<<< ======= >>>>>>> line",
        test: async (pg) => noConflictMarkers(pg, "rates.txt") && noConflictMarkers(pg, "drivers.txt"),
      },
      {
        label: "Both branch histories present in the record",
        hint: "finish the merge — do not throw either branch away",
        test: async (pg) =>
          (await subjectOnHead(pg, "Overhaul: raise fuel surcharge, add Brandt")) &&
          (await subjectOnHead(pg, "Mainline: raise fuel surcharge, add Chen")),
      },
    ],
    passLine: "Two-file pileup cleared by hand. Git never guessed — you made every ruling.",
  },
  {
    id: "crisis-03",
    number: 3,
    // A bad commit that is already "shared" — must revert, not reset.
    setup: async (pg) => {
      write(pg, "rates.txt", RATES);
      await commitAll(pg, "Open the rate book");
      write(pg, "clients.txt", CLIENTS);
      await commitAll(pg, "Add client ledger");
      rmSync(path.join(pg, "clients.txt"));
      await commitAll(pg, "Remove client ledger");
    },
    checks: [
      {
        label: "Client ledger restored",
        hint: "the file must exist again with its contents",
        test: async (pg) => fileHas(pg, "clients.txt", "Harbor Mills"),
      },
      {
        label: "The mistake is still in the history (not erased)",
        hint: "revert writes a correction on top — it never tears out the page",
        test: (pg) => subjectOnHead(pg, "Remove client ledger"),
      },
      {
        label: "A revert commit sits on top",
        hint: "git revert HEAD",
        test: async (pg) => {
          const out = await git(pg, ["log", "-1", "--format=%s"]);
          return !!out && /revert/i.test(out);
        },
      },
      {
        label: "Working tree clean",
        hint: "finish the revert commit",
        test: isClean,
      },
    ],
    passLine: "Corrected on the record, in public, without rewriting history. That is the shared-history rule.",
  },
  {
    id: "crisis-04",
    number: 4,
    // One jumbled commit that must be split — reset --soft territory.
    setup: async (pg) => {
      write(pg, "rates.txt", RATES);
      write(pg, "drivers.txt", DRIVERS);
      await commitAll(pg, "Open the books");
      write(pg, "rates.txt", RATES.replace("Standard load: $500", "Standard load: $550"));
      write(pg, "drivers.txt", DRIVERS + "S. Petrov\n");
      await commitAll(pg, "Update everything");
    },
    checks: [
      {
        label: "The jumbled 'Update everything' commit is gone",
        hint: "git reset --soft HEAD~1 pulls the seal off but keeps the work staged",
        test: async (pg) => !(await subjectOnHead(pg, "Update everything")),
      },
      {
        label: "Rate change still in the record",
        hint: "Standard load: $550 must survive the split",
        test: async (pg) => fileHas(pg, "rates.txt", "Standard load: $550"),
      },
      {
        label: "New driver still in the record",
        hint: "S. Petrov must survive the split",
        test: async (pg) => fileHas(pg, "drivers.txt", "S. Petrov"),
      },
      {
        label: "The two changes are sealed in two separate commits",
        hint: "stage and commit rates.txt alone, then drivers.txt alone",
        test: async (pg) => {
          const a = await git(pg, ["log", "-1", "--format=%H", "--", "rates.txt"]);
          const b = await git(pg, ["log", "-1", "--format=%H", "--", "drivers.txt"]);
          return !!a && !!b && a.trim() !== b.trim();
        },
      },
      {
        label: "Working tree clean",
        hint: "everything staged must end up committed",
        test: isClean,
      },
    ],
    passLine: "Seal pulled, work preserved, record re-sealed properly. reset --soft never touches your files.",
  },
  {
    id: "crisis-05",
    number: 5,
    // A trashed working tree — reset --hard back to the last good seal.
    setup: async (pg) => {
      write(pg, "rates.txt", RATES);
      write(pg, "drivers.txt", DRIVERS);
      await commitAll(pg, "Open the books");
      write(pg, "clients.txt", CLIENTS);
      await commitAll(pg, "Add client ledger");
      // Trash the desk: overwrite two tracked files, stage one of them.
      write(pg, "rates.txt", "ALL RATES 90% OFF???\nasdf asdf asdf\n");
      write(pg, "drivers.txt", "fired everyone lol\n");
      await mustGit(pg, ["add", "rates.txt"]);
    },
    checks: [
      {
        label: "Working tree and staging area clean",
        hint: "git reset --hard throws away every unsealed change",
        test: isClean,
      },
      {
        label: "Rate book back to the last sealed version",
        hint: "Standard load: $500 must be back",
        test: async (pg) => fileHas(pg, "rates.txt", "Standard load: $500") && !fileHas(pg, "rates.txt", "90% OFF"),
      },
      {
        label: "Driver roster back to the last sealed version",
        hint: "the roster must match the last commit",
        test: async (pg) => fileHas(pg, "drivers.txt", "M. Alvarez") && !fileHas(pg, "drivers.txt", "fired"),
      },
      {
        label: "No sealed history was harmed",
        hint: "both commits must still be there — hard reset only burns UNSEALED work",
        test: async (pg) =>
          (await subjectOnHead(pg, "Open the books")) && (await subjectOnHead(pg, "Add client ledger")),
      },
    ],
    passLine: "Desk cleared back to the last sealed snapshot. reset --hard is a flamethrower — but only for unsealed work.",
  },
  {
    id: "crisis-06",
    number: 6,
    // Two commits "vanished" by a hard reset — reflog rescue.
    setup: async (pg) => {
      write(pg, "rates.txt", RATES);
      await commitAll(pg, "Open the rate book");
      write(pg, "drivers.txt", DRIVERS);
      await commitAll(pg, "Add driver roster");
      write(pg, "clients.txt", CLIENTS);
      await commitAll(pg, "Add client ledger");
      write(pg, "rates.txt", RATES.replace("Fuel surcharge: $40", "Fuel surcharge: $55"));
      await commitAll(pg, "Adjust fuel surcharge for Q3");
      // The disaster: someone hard-reset two commits into the void.
      await mustGit(pg, ["reset", "--hard", "-q", "HEAD~2"]);
    },
    checks: [
      {
        label: "The client ledger commit is back on the branch",
        hint: "git reflog shows every place HEAD has been — nothing sealed is lost",
        test: (pg) => subjectOnHead(pg, "Add client ledger"),
      },
      {
        label: "The fuel surcharge commit is back on the branch",
        hint: "reset --hard to the reflog entry from before the disaster",
        test: (pg) => subjectOnHead(pg, "Adjust fuel surcharge for Q3"),
      },
      {
        label: "Standing on a branch",
        hint: "finish on main (or another branch), not detached",
        test: async (pg) => (await onABranch(pg)) !== null,
      },
      {
        label: "Working tree clean",
        hint: "the rescue should end with a clean desk",
        test: isClean,
      },
    ],
    passLine: "A week of work pulled back out of the void. Sealed commits survive ~90 days — the reflog remembers.",
  },
];

function findScenario(id: string): CrisisDef | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

router.get("/crisis/scenarios", async (_req, res) => {
  const solvedIds = new Set(
    loadEntries()
      .filter((e) => e.track === "cli")
      .map((e) => e.moduleId),
  );
  res.json(
    ListCrisisScenariosResponse.parse(
      SCENARIOS.map((s) => {
        const pg = playground(s.id);
        const hasPlayground = existsSync(pg);
        return {
          id: s.id,
          number: s.number,
          hasPlayground,
          initialized: hasPlayground && isRepo(pg),
          solved: solvedIds.has(s.id),
          path: pg,
        };
      }),
    ),
  );
});

router.post("/crisis/scenarios/:crisisId/setup", async (req, res) => {
  const scenario = findScenario(req.params.crisisId ?? "");
  if (!scenario) {
    res.status(404).json({ error: `Scenario not found: ${req.params.crisisId}` });
    return;
  }
  try {
    const pg = await freshRepo(scenario.id);
    await scenario.setup(pg);
    res.json(
      SetupCrisisScenarioResponse.parse({
        ok: true,
        message: "The disaster is live. Open your terminal and go take a look.",
        path: pg,
      }),
    );
  } catch (err) {
    res.json(
      SetupCrisisScenarioResponse.parse({
        ok: false,
        message: err instanceof Error ? err.message : "Setup failed",
        path: playground(scenario.id),
      }),
    );
  }
});

router.get("/crisis/scenarios/:crisisId/state", async (req, res) => {
  const scenario = findScenario(req.params.crisisId ?? "");
  if (!scenario) {
    res.status(404).json({ error: `Scenario not found: ${req.params.crisisId}` });
    return;
  }
  const state = await readRepoState(playground(scenario.id));
  res.json(
    GetCrisisRepoStateResponse.parse({
      lessonId: scenario.id,
      ...state,
      summary: buildSummary(state),
    }),
  );
});

router.post("/crisis/scenarios/:crisisId/check", async (req, res) => {
  const scenario = findScenario(req.params.crisisId ?? "");
  if (!scenario) {
    res.status(404).json({ error: `Scenario not found: ${req.params.crisisId}` });
    return;
  }
  const pg = playground(scenario.id);
  if (!existsSync(pg) || !isRepo(pg)) {
    res.json(
      RunCrisisCheckResponse.parse({
        ran: false,
        passed: null,
        output: "This scenario hasn't been set up yet. Press Trigger the Disaster first.",
      }),
    );
    return;
  }
  const lines: string[] = [];
  let fails = 0;
  for (const check of scenario.checks) {
    let ok = false;
    try {
      ok = await check.test(pg);
    } catch {
      ok = false;
    }
    if (ok) lines.push(`PASS: ${check.label}`);
    else {
      fails += 1;
      lines.push(`FAIL: ${check.label} — ${check.hint}`);
    }
  }
  const passed = fails === 0;
  lines.push("", `Score: ${scenario.checks.length - fails} PASS / ${fails} FAIL`);
  if (passed) lines.push(scenario.passLine);
  // Crisis badge is granted here, server-side, only on a genuine grader pass.
  if (passed) recordCompletion(scenario.id, "cli");
  res.json(RunCrisisCheckResponse.parse({ ran: true, passed, output: lines.join("\n") }));
});

export default router;
