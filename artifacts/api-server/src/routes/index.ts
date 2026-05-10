import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trademindRouter from "./trademind";
import trademindAdvancedRouter from "./trademind-advanced";
import forexRouter from "./forex";
import exchangeConnectionsRouter from "./exchange-connections";
import riskEngineRouter from "./risk-engine";
import tradeJournalRouter from "./trade-journal";
import portfolioRouter from "./portfolio";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trademindRouter);
router.use(trademindAdvancedRouter);
router.use(forexRouter);
router.use(exchangeConnectionsRouter);
router.use(riskEngineRouter);
router.use(tradeJournalRouter);
router.use(portfolioRouter);

export default router;
