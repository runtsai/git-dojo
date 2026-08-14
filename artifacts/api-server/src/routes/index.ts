import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dojoRouter from "./dojo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dojoRouter);

export default router;
