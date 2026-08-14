import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dojoRouter from "./dojo";
import progressRouter from "./progress";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dojoRouter);
router.use(progressRouter);

export default router;
