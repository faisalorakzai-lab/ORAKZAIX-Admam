import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trademindRouter from "./trademind";
import forexRouter from "./forex";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trademindRouter);
router.use(forexRouter);

export default router;
