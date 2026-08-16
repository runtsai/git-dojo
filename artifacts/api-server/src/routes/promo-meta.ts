import { Router, type IRouter } from "express";
import { SCENE_DURATIONS, TOTAL_RUNTIME_MS, TOTAL_RUNTIME_SEC } from "@workspace/promo-config";

const router: IRouter = Router();

/**
 * GET /api/export/promo-meta
 *
 * Returns the promo video's scene durations and total runtime so that
 * callers (e.g. the export smoke check) can derive the expected duration
 * from the actual source of truth rather than a hardcoded constant.
 */
router.get("/export/promo-meta", (_req, res) => {
  res.json({
    sceneDurations: SCENE_DURATIONS,
    totalDurationMs: TOTAL_RUNTIME_MS,
    totalDurationSec: TOTAL_RUNTIME_SEC,
  });
});

export default router;
