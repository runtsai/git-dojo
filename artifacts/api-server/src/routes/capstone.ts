import { Router, type IRouter } from "express";
import {
  GetCapstoneStatusResponse,
  CreateCapstoneRepoResponse,
  VerifyCapstoneMissionResponse,
} from "@workspace/api-zod";
import { ghJson, getConnectedLogin } from "../lib/github";
import {
  MISSIONS,
  type MissionId,
  type CapstoneState,
  loadCapstone,
  saveCapstone,
  clearCapstone,
} from "../lib/capstone-store";
import { recordCompletion } from "../lib/progress-store";
import { requireOwner } from "../middlewares/require-owner";

const router: IRouter = Router();

/**
 * Access-control gate: the capstone acts through the workspace owner's GitHub
 * connector, and this app has no per-user auth (single-user by design). In a
 * published deployment these endpoints would let ANY visitor create/delete
 * repos and rewrite capstone state under the owner's GitHub identity, so all
 * live GitHub operations are restricted to the owner's private development
 * workspace and disabled in production.
 */
function isPublicDeployment(): boolean {
  return process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT;
}

const REPO_NAME = "dojo-live-capstone";
const PR_BRANCH_PREFIX = "dojo/practice-pr";

interface GhRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  owner: { login: string };
}

/**
 * Trust check for any existing-state GitHub operation. The persisted state is
 * trusted only when (a) it carries the created-by-Dojo marker with GitHub's
 * immutable repo id, (b) the currently connected login is the recorded owner,
 * and (c) the live repo at that name still has the same immutable id (a repo
 * deleted and recreated under the same name is NOT ours).
 */
async function verifyStateTrust(
  login: string,
  state: CapstoneState,
): Promise<{ trusted: true } | { trusted: false; reason: string; repoGone: boolean }> {
  if (!state.createdByDojo || typeof state.repoId !== "number") {
    return { trusted: false, reason: "no durable record that Dojo created this repo", repoGone: false };
  }
  if (state.owner !== login) {
    return {
      trusted: false,
      reason: `the capstone state belongs to @${state.owner}, but @${login} is connected`,
      repoGone: false,
    };
  }
  const check = await ghJson<GhRepo>(`/repos/${state.repoFullName}`);
  if (!check.ok) {
    if (check.status === 404) {
      return { trusted: false, reason: "the practice repo no longer exists on GitHub", repoGone: true };
    }
    return { trusted: false, reason: `GitHub could not confirm the repo: ${check.errorMessage}`, repoGone: false };
  }
  if (check.data!.id !== state.repoId) {
    return {
      trusted: false,
      reason: "a different repository now exists under that name (the original was deleted and recreated)",
      repoGone: false,
    };
  }
  return { trusted: true };
}

function statusPayload(login: string | null, state: CapstoneState | null) {
  return {
    githubConnected: login !== null,
    githubLogin: login,
    repo: state
      ? {
          name: state.repoName,
          fullName: state.repoFullName,
          htmlUrl: state.htmlUrl,
          cloneUrl: state.cloneUrl,
          defaultBranch: state.defaultBranch,
        }
      : null,
    prNumber: state?.prNumber ?? null,
    prUrl: state?.prUrl ?? null,
    prBranch: state?.prBranch ?? null,
    missions: MISSIONS.map((m) => ({
      id: m.id,
      title: m.title,
      verified: !!state?.missionsVerifiedAt[m.id],
      verifiedAt: state?.missionsVerifiedAt[m.id] ?? null,
    })),
    badgeEarnedAt: state?.badgeEarnedAt ?? null,
  };
}

router.get("/capstone/status", requireOwner, async (req, res): Promise<void> => {
  if (isPublicDeployment()) {
    // Never expose the owner's GitHub identity or repo state to public
    // visitors; the UI renders its graceful "not connected" state.
    res.json(GetCapstoneStatusResponse.parse(statusPayload(null, null)));
    return;
  }
  const login = await getConnectedLogin();
  let state = loadCapstone();
  // Only present state we can still prove is ours: owner matches the
  // connected login and the live repo carries our recorded immutable id.
  if (login && state) {
    const trust = await verifyStateTrust(login, state);
    if (!trust.trusted) {
      req.log.warn({ repo: state.repoFullName, reason: trust.reason }, "Capstone state no longer trusted; clearing");
      clearCapstone();
      state = null;
    }
  }
  res.json(GetCapstoneStatusResponse.parse(statusPayload(login, state)));
});

router.post("/capstone/repo", requireOwner, async (req, res): Promise<void> => {
  if (isPublicDeployment()) {
    res.status(409).json({ error: "The Go Live capstone only runs in the owner's private workspace." });
    return;
  }
  const login = await getConnectedLogin();
  if (!login) {
    res.status(409).json({ error: "GitHub is not connected. Connect your account first." });
    return;
  }

  // Idempotent: reuse recorded state when the repo we created still exists.
  // If seeding previously failed midway (no PR yet), continue seeding into
  // the repo we own instead of creating another one.
  const existing = loadCapstone();
  let repo: GhRepo | null = null;
  if (existing) {
    const trust = await verifyStateTrust(login, existing);
    if (trust.trusted) {
      if (existing.prNumber != null) {
        res.json(CreateCapstoneRepoResponse.parse(statusPayload(login, existing)));
        return;
      }
      // finish seeding the repo Dojo created earlier (id re-verified above)
      const check = await ghJson<GhRepo>(`/repos/${existing.repoFullName}`);
      repo = check.ok ? check.data : null;
    } else {
      req.log.warn({ reason: trust.reason }, "Existing capstone state not trusted; clearing before create");
      clearCapstone();
    }
  }

  if (!repo) {
    // NEVER adopt a pre-existing repository: a name collision is not proof
    // that Dojo created it, and mutating (or later deleting) a user's
    // unrelated repo is unacceptable. On collision, pick a unique name.
    let repoName = REPO_NAME;
    const collision = await ghJson<GhRepo>(`/repos/${login}/${repoName}`);
    if (collision.ok) {
      repoName = `${REPO_NAME}-${Date.now().toString(36)}`;
      const second = await ghJson<GhRepo>(`/repos/${login}/${repoName}`);
      if (second.ok) {
        res.status(409).json({
          error: `A repo named ${REPO_NAME} already exists on your account and a unique name could not be chosen. Rename or remove it, then try again.`,
        });
        return;
      }
    }
    const created = await ghJson<GhRepo>("/user/repos", {
      method: "POST",
      body: {
        name: repoName,
        description: "Git Dojo — Go Live capstone practice repository (safe to delete)",
        private: false,
        auto_init: true,
      },
    });
    if (!created.ok || !created.data) {
      req.log.error({ error: created.errorMessage }, "Failed to create capstone repo");
      res.status(409).json({ error: `Could not create the repo: ${created.errorMessage}` });
      return;
    }
    repo = created.data;
    // auto_init commit can take a moment to land
    await new Promise((r) => setTimeout(r, 1500));

    // Persist ownership evidence immediately, before any seeding, so every
    // later mutation and the teardown act only on a repo Dojo itself created.
    saveCapstone({
      owner: login,
      repoId: repo.id,
      repoName: repo.name,
      repoFullName: repo.full_name,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch || "main",
      prNumber: null,
      prUrl: null,
      prBranch: null,
      seedShas: [],
      missionsVerifiedAt: {},
      badgeEarnedAt: null,
      createdByDojo: true,
      createdAt: new Date().toISOString(),
    });
  }

  const fullName = repo.full_name;
  const defaultBranch = repo.default_branch || "main";
  const seedShas: string[] = [];

  // Record the seed commit(s) so learner commits can be told apart later.
  const commits = await ghJson<{ sha: string }[]>(
    `/repos/${fullName}/commits?sha=${defaultBranch}&per_page=100`,
  );
  if (commits.ok && commits.data) seedShas.push(...commits.data.map((c) => c.sha));

  // Seed the practice PR: branch off default, add a file, open the PR.
  // Reuse an OPEN dojo PR if one exists; a merged/closed one means we seed a
  // fresh branch (unique suffix) so the mission is genuinely completable.
  let prNumber: number | null = null;
  let prUrl: string | null = null;
  let prBranch: string | null = null;
  const openPrs = await ghJson<{ number: number; html_url: string; head: { ref: string } }[]>(
    `/repos/${fullName}/pulls?state=open&per_page=100`,
  );
  const existingDojoPr = openPrs.ok
    ? openPrs.data?.find((p) => p.head.ref.startsWith(PR_BRANCH_PREFIX))
    : undefined;
  if (existingDojoPr) {
    prNumber = existingDojoPr.number;
    prUrl = existingDojoPr.html_url;
    prBranch = existingDojoPr.head.ref;
  } else {
    prBranch = `${PR_BRANCH_PREFIX}-${Date.now().toString(36)}`;
    const headRef = await ghJson<{ object: { sha: string } }>(
      `/repos/${fullName}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
    );
    if (!headRef.ok || !headRef.data) {
      res.status(409).json({ error: `Repo created but could not read its history: ${headRef.errorMessage}` });
      return;
    }
    const branchRes = await ghJson(`/repos/${fullName}/git/refs`, {
      method: "POST",
      body: { ref: `refs/heads/${prBranch}`, sha: headRef.data.object.sha },
    });
    if (!branchRes.ok && branchRes.status !== 422) {
      // 422 = branch already exists, which is fine
      res.status(409).json({ error: `Could not create the PR branch: ${branchRes.errorMessage}` });
      return;
    }
    // Unique file per seeded PR: a previously merged practice PR leaves its
    // mission file on the default branch, and re-seeding the same path would
    // produce an empty diff (PR creation then fails with "Validation Failed").
    const missionFile = `DOJO_MISSION-${prBranch.slice(PR_BRANCH_PREFIX.length + 1) || "1"}.md`;
    const fileRes = await ghJson<{ commit: { sha: string } }>(
      `/repos/${fullName}/contents/${missionFile}`,
      {
        method: "PUT",
        body: {
          message: "Dojo: open the practice pull request",
          content: Buffer.from(
            [
              "# Your mission\n",
              "This pull request was opened by Git Dojo. Your final mission is to review and **merge it** on GitHub.\n",
              "Merging a PR is the last step of the real-world loop: branch → commit → push → pull request → merge.\n",
            ].join("\n"),
            "utf-8",
          ).toString("base64"),
          branch: prBranch,
        },
      },
    );
    if (!fileRes.ok) {
      res.status(409).json({ error: `Could not seed the practice PR's change: ${fileRes.errorMessage}` });
      return;
    }
    if (fileRes.data?.commit?.sha) seedShas.push(fileRes.data.commit.sha);
    const pr = await ghJson<{ number: number; html_url: string }>(`/repos/${fullName}/pulls`, {
      method: "POST",
      body: {
        title: "Dojo practice PR — merge me when you're ready",
        head: prBranch,
        base: defaultBranch,
        body: "Opened automatically by Git Dojo for the Go Live capstone. Read the changed file, then merge this PR to complete your final mission.",
      },
    });
    if (!pr.ok || !pr.data) {
      req.log.error({ error: pr.errorMessage }, "Failed to open practice PR");
      res.status(409).json({ error: `Repo is ready but the practice PR failed: ${pr.errorMessage}` });
      return;
    }
    prNumber = pr.data.number;
    prUrl = pr.data.html_url;
  }

  const state: CapstoneState = {
    owner: login,
    repoId: repo.id,
    repoName: repo.name,
    repoFullName: fullName,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    defaultBranch,
    prNumber,
    prUrl,
    prBranch,
    seedShas,
    missionsVerifiedAt: {},
    badgeEarnedAt: null,
    createdByDojo: true,
    createdAt: new Date().toISOString(),
  };
  saveCapstone(state);
  res.json(CreateCapstoneRepoResponse.parse(statusPayload(login, state)));
});

router.delete("/capstone/repo", requireOwner, async (req, res): Promise<void> => {
  if (isPublicDeployment()) {
    res.status(409).json({ error: "The Go Live capstone only runs in the owner's private workspace." });
    return;
  }
  const login = await getConnectedLogin();
  const state = loadCapstone();
  if (!state) {
    res.json(GetCapstoneStatusResponse.parse(statusPayload(login, null)));
    return;
  }
  // Safety rails: only ever delete a dojo-prefixed repo that this server
  // itself created, verified against GitHub's immutable repo id and the
  // currently connected login before any destructive call.
  if (!login) {
    res.status(409).json({ error: "GitHub is not connected." });
    return;
  }
  const trust = await verifyStateTrust(login, state);
  if (!trust.trusted) {
    req.log.warn({ reason: trust.reason }, "Refusing deletion: capstone state not trusted");
    clearCapstone();
    if (trust.repoGone) {
      res.json(GetCapstoneStatusResponse.parse(statusPayload(login, null)));
      return;
    }
    res.status(409).json({
      error: `Refusing to touch the repo: ${trust.reason}. The capstone state was reset; nothing on GitHub was changed.`,
    });
    return;
  }
  if (!state.repoName.startsWith("dojo-")) {
    res.status(409).json({ error: "Refusing to delete a repo that is not dojo-prefixed." });
    return;
  }
  const del = await ghJson(`/repos/${state.repoFullName}`, { method: "DELETE" });
  if (!del.ok && del.status !== 404) {
    // Common case: OAuth token lacks the delete_repo scope. Don't leave the
    // learner stuck — reset the capstone here, but be honest that the repo
    // itself still exists and must be deleted manually on GitHub.
    req.log.warn({ error: del.errorMessage }, "Could not delete capstone repo via API; clearing local state");
    clearCapstone();
    res.status(409).json({
      error: `GitHub refused the automatic deletion (${del.errorMessage}). The capstone has been reset here, but the repo still exists — delete it manually at ${state.htmlUrl}/settings (bottom of the page).`,
    });
    return;
  }
  clearCapstone();
  res.json(GetCapstoneStatusResponse.parse(statusPayload(login, null)));
});

router.post("/capstone/verify/:missionId", requireOwner, async (req, res): Promise<void> => {
  const raw = req.params.missionId;
  const missionId = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  if (!MISSIONS.some((m) => m.id === missionId)) {
    res.status(404).json({ error: `Unknown mission: ${missionId}` });
    return;
  }
  if (isPublicDeployment()) {
    res.status(409).json({ error: "The Go Live capstone only runs in the owner's private workspace." });
    return;
  }
  const login = await getConnectedLogin();
  if (!login) {
    res.status(409).json({ error: "GitHub is not connected." });
    return;
  }
  const state = loadCapstone();
  if (!state) {
    res.status(409).json({ error: "No practice repo yet. Create it first." });
    return;
  }
  const trust = await verifyStateTrust(login, state);
  if (!trust.trusted) {
    req.log.warn({ reason: trust.reason }, "Refusing verification: capstone state not trusted");
    clearCapstone();
    res.status(409).json({ error: `Cannot verify against GitHub: ${trust.reason}. The capstone was reset.` });
    return;
  }

  let verified = false;
  let detail = "";
  const fullName = state.repoFullName;

  if (missionId === "push-commit") {
    const commits = await ghJson<{ sha: string; commit: { message: string } }[]>(
      `/repos/${fullName}/commits?sha=${state.defaultBranch}&per_page=100`,
    );
    if (!commits.ok || !commits.data) {
      detail = `Could not read commits from GitHub: ${commits.errorMessage}`;
    } else {
      // Merging the Dojo-seeded PR lands a merge/squash/rebase commit on the
      // default branch that the learner did not author locally — exclude it
      // so mission 1 genuinely requires a local commit + push.
      const excluded = new Set(state.seedShas);
      const excludedMessages: string[] = [];
      if (state.prNumber != null) {
        excludedMessages.push(`Merge pull request #${state.prNumber}`);
        const pr = await ghJson<{ merge_commit_sha: string | null; title: string }>(
          `/repos/${fullName}/pulls/${state.prNumber}`,
        );
        if (pr.ok && pr.data) {
          if (pr.data.merge_commit_sha) excluded.add(pr.data.merge_commit_sha);
          excludedMessages.push(pr.data.title); // squash-merge commit subject
        }
      }
      excludedMessages.push("Dojo: open the practice pull request"); // rebase-merge replays this
      const yours = commits.data.filter(
        (c) =>
          !excluded.has(c.sha) &&
          !excludedMessages.some((m) => c.commit.message.split("\n")[0]!.startsWith(m)),
      );
      if (yours.length > 0) {
        verified = true;
        detail = `Verified: found ${yours.length} commit${yours.length === 1 ? "" : "s"} on ${state.defaultBranch} that Dojo did not create — most recent: “${yours[0]!.commit.message.split("\n")[0]}”.`;
      } else {
        detail = `Not yet: every commit on ${state.defaultBranch} was seeded by Dojo or produced by merging the practice PR. Commit locally, then run git push.`;
      }
    }
  } else if (missionId === "create-branch") {
    const branches = await ghJson<{ name: string }[]>(`/repos/${fullName}/branches?per_page=100`);
    if (!branches.ok || !branches.data) {
      detail = `Could not read branches from GitHub: ${branches.errorMessage}`;
    } else {
      const yours = branches.data.filter(
        (b) => b.name !== state.defaultBranch && !b.name.startsWith("dojo/"),
      );
      if (yours.length > 0) {
        verified = true;
        detail = `Verified: found your branch “${yours[0]!.name}” on GitHub.`;
      } else {
        detail = `Not yet: GitHub only shows ${state.defaultBranch}${state.prBranch ? ` and ${state.prBranch}` : ""}. Create a branch locally and push it with git push -u origin <branch-name>.`;
      }
    }
  } else if (missionId === "merge-pr") {
    if (state.prNumber == null) {
      detail = "No practice PR is recorded for this repo. Recreate the repo to seed one.";
    } else {
      const pr = await ghJson<{ merged: boolean; state: string }>(
        `/repos/${fullName}/pulls/${state.prNumber}`,
      );
      if (!pr.ok || !pr.data) {
        detail = `Could not read PR #${state.prNumber} from GitHub: ${pr.errorMessage}`;
      } else if (pr.data.merged) {
        verified = true;
        detail = `Verified: PR #${state.prNumber} is merged on GitHub.`;
      } else if (pr.data.state === "closed") {
        detail = `Not quite: PR #${state.prNumber} was closed without merging. Reopen it on GitHub and use the Merge button instead.`;
      } else {
        detail = `Not yet: PR #${state.prNumber} is still open. Open it on GitHub and press “Merge pull request”.`;
      }
    }
  }

  if (verified && !state.missionsVerifiedAt[missionId as MissionId]) {
    // Reload the latest persisted state before writing. Two concurrent verify
    // requests can both race through the async GitHub checks above while each
    // holds a snapshot that pre-dates the other's badge write. Reloading here
    // — with no await between this point and saveCapstone — makes the
    // check-then-write block effectively atomic in Node.js's single-threaded
    // event loop, so the badge and recordCompletion are issued at most once.
    const latestState = loadCapstone() ?? state;
    if (!latestState.missionsVerifiedAt[missionId as MissionId]) {
      latestState.missionsVerifiedAt[missionId as MissionId] = new Date().toISOString();
      const allDone = MISSIONS.every((m) => !!latestState.missionsVerifiedAt[m.id]);
      if (allDone && !latestState.badgeEarnedAt) {
        latestState.badgeEarnedAt = new Date().toISOString();
        recordCompletion("go-live-capstone", "live");
        req.log.info("Go Live capstone badge earned (all missions verified against GitHub)");
      }
      saveCapstone(latestState);
      // Patch the snapshot used by the status payload below.
      state.missionsVerifiedAt = latestState.missionsVerifiedAt;
      state.badgeEarnedAt = latestState.badgeEarnedAt;
    }
  }

  res.json(
    VerifyCapstoneMissionResponse.parse({
      missionId,
      verified,
      detail,
      status: statusPayload(login, loadCapstone()),
    }),
  );
});

export default router;
