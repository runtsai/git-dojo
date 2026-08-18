import { Router, type IRouter } from "express";
import {
  GetProgressResponse,
  CompleteModuleBody,
  CompleteModuleResponse,
} from "@workspace/api-zod";
import { MODULE_PREREQUISITES, tiers } from "@workspace/course-content";
import { loadEntries, recordCompletion } from "../lib/progress-store";

const router: IRouter = Router();

/**
 * Build the set of completable visual-module IDs from the live `tiers` array.
 *
 * Evaluated on every request (not cached at module load time) so that a tier
 * whose `status` is changed from "coming_soon" to "active" in the running
 * process is recognised immediately — no server restart required.
 *
 * CLI (Track B) badges are recorded server-side by the check route when the
 * lesson's grader genuinely passes — never from the client — so a badge always
 * means the work was done.
 */
function getVisualModuleIds(): Set<string> {
  return new Set(
    tiers
      .filter((tier) => tier.status === "active")
      .flatMap((tier) => tier.modules ?? [])
      .map((m) => m.id),
  );
}


router.get("/progress", (_req, res) => {
  res.json(GetProgressResponse.parse({ entries: loadEntries() }));
});

router.post("/progress/complete", (req, res) => {
  const parsed = CompleteModuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { moduleId, track } = parsed.data;
  if (track !== "visual") {
    res.status(400).json({
      error: "CLI lesson badges are earned by passing the lesson's grader, not by this endpoint.",
    });
    return;
  }
  if (!getVisualModuleIds().has(moduleId)) {
    res.status(400).json({ error: `Unknown module: ${moduleId}` });
    return;
  }
  const prereq = MODULE_PREREQUISITES[moduleId];
  if (prereq) {
    const entries = loadEntries();
    const prereqDone = entries.some(
      (e) => e.moduleId === prereq && e.track === "visual",
    );
    if (!prereqDone) {
      // Give a more specific message when the prereq was completed on the CLI
      // track instead — the learner did the work but on the wrong track.
      const doneOnWrongTrack = entries.some(
        (e) => e.moduleId === prereq && e.track !== "visual",
      );
      const error = doneOnWrongTrack
        ? `Module ${moduleId} requires ${prereq} to be completed on the visual track first (CLI-track completion does not count).`
        : `Module ${moduleId} requires ${prereq} to be completed first.`;
      res.status(400).json({ error });
      return;
    }
  }
  res.json(CompleteModuleResponse.parse({ entries: recordCompletion(moduleId, "visual") }));
});

export default router;
