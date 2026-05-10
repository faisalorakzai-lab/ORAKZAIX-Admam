import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trademindRouter from "./trademind";
import trademindAdvancedRouter from "./trademind-advanced";
import forexRouter from "./forex";
import exchangeConnectionsRouter from "./exchange-connections";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trademindRouter);
router.use(trademindAdvancedRouter);
router.use(forexRouter);
router.use(exchangeConnectionsRouter);

export default router;
