// Single source of truth lives in the shared lib so the API server's
// prerequisite gate and the dashboard always stay in sync.
export type { ModuleDef, TierDef } from "@workspace/course-content";
export { tiers } from "@workspace/course-content";
