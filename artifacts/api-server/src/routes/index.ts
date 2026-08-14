import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dojoRouter from "./dojo";
import progressRouter from "./progress";
import capstoneRouter from "./capstone";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dojoRouter);
router.use(progressRouter);
router.use(capstoneRouter);

export default router;
