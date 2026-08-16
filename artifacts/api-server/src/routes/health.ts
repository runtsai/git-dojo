import { readFileSync } from "node:fs";
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const SMOKE_RESULT_FILE = "/tmp/api-smoke-result.json";

interface SmokeResult {
  passed: boolean;
  checkedAt: string;
}

function readSmokeResult(): SmokeResult | null {
  try {
    const raw = readFileSync(SMOKE_RESULT_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "passed" in parsed &&
      typeof (parsed as Record<string, unknown>).passed === "boolean" &&
      "checkedAt" in parsed &&
      typeof (parsed as Record<string, unknown>).checkedAt === "string"
    ) {
      return parsed as SmokeResult;
    }
    return null;
  } catch {
    return null;
  }
}

router.get("/healthz", (_req, res) => {
  const smoke = readSmokeResult();

  const smokeStatus: "passed" | "failed" | "unknown" =
    smoke === null ? "unknown" : smoke.passed ? "passed" : "failed";

  const overallStatus: "ok" | "degraded" =
    smokeStatus === "failed" ? "degraded" : "ok";

  const data = HealthCheckResponse.parse({
    status: overallStatus,
    smokeStatus,
    ...(smoke !== null ? { smokeCheckedAt: smoke.checkedAt } : {}),
  });

  res.json(data);
});

export default router;
