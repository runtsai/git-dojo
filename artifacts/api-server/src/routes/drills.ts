import { Router, type IRouter } from "express";
import {
  GetDueDrillsBody,
  GetDueDrillsResponse,
  RecordDrillAttemptBody,
  RecordDrillAttemptResponse,
} from "@workspace/api-zod";
import { queryDue, recordAttempt } from "../lib/drill-store";
import { requireOwner } from "../middlewares/require-owner";
import { rateLimit } from "../middlewares/rate-limit";

const router: IRouter = Router();

/**
 * The drill bank itself lives client-side (it is authored course content).
 * The server owns the truth about practice: attempt history, scheduling,
 * and grader friction. The client sends the candidate items the learner
 * has unlocked; the server answers with what is due.
 */
router.post("/drills/due", requireOwner, rateLimit("drills-due", 20, 60_000), (req, res) => {
  const parsed = GetDueDrillsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  res.json(GetDueDrillsResponse.parse(queryDue(parsed.data.candidates)));
});

router.post(
  "/drills/attempt",
  requireOwner,
  rateLimit("drills-attempt", 20, 60_000),
  (req, res) => {
    const parsed = RecordDrillAttemptBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { itemId, correct, sourceId } = parsed.data;
    res.json(RecordDrillAttemptResponse.parse(recordAttempt(itemId, correct, sourceId)));
  },
);

export default router;
