import { Router, type IRouter } from "express";
import {
  GetProgressResponse,
  CompleteModuleBody,
  CompleteModuleResponse,
} from "@workspace/api-zod";
import { loadEntries, recordCompletion } from "../lib/progress-store";

const router: IRouter = Router();

/**
 * Only visual-course modules may be completed through this endpoint, and only
 * ones that actually exist. CLI (Track B) badges are recorded server-side by
 * the check route when the lesson's grader genuinely passes — never from the
 * client — so a badge always means the work was done.
 */
const VISUAL_MODULE_IDS = new Set([
  "1.1", "1.2", "1.3", "1.4", "1.5",
  "2.1", "2.2", "2.3", "2.4", "2.5",
  "3.1", "3.2", "3.3", "3.4", "3.5",
  "4.1", "4.2", "4.3", "4.4", "4.5",
  "5.1", "5.2", "5.3", "5.4", "5.5", "5.6",
  "6.1", "6.2", "6.3",
]);

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
  if (!VISUAL_MODULE_IDS.has(moduleId)) {
    res.status(400).json({ error: `Unknown module: ${moduleId}` });
    return;
  }
  res.json(CompleteModuleResponse.parse({ entries: recordCompletion(moduleId, "visual") }));
});

export default router;
