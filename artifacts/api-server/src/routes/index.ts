import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trademindRouter from "./trademind";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trademindRouter);

export default router;
