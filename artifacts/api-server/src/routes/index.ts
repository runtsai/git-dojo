import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dojoRouter from "./dojo";
import progressRouter from "./progress";
import capstoneRouter from "./capstone";
import crisisRouter from "./crisis";
import drillsRouter from "./drills";
import exportRouter from "./export";
import promoMetaRouter from "./promo-meta";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dojoRouter);
router.use(crisisRouter);
router.use(progressRouter);
router.use(drillsRouter);
router.use(capstoneRouter);
router.use(exportRouter);
router.use(promoMetaRouter);

export default router;
