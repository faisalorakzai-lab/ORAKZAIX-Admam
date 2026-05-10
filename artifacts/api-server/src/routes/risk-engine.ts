import { Router, type IRouter } from "express";
import { riskEngine } from "../lib/risk-engine";
import { calculatePositionSize, calculateOptimalLeverage, getVolatilityAdjustedSize } from "../lib/position-sizing";
import { db } from "@workspace/db";
import { riskLogsTable, userRiskSettingsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

// ─── FULL RISK STATUS ─────────────────────────────────────────────────────────
router.get("/risk-engine/status", async (req, res): Promise<void> => {
  const rawBalance = Array.isArray(req.query.balance) ? req.query.balance[0] : req.query.balance;
  const balance = parseFloat(typeof rawBalance === "string" ? rawBalance : "10000");
  res.json(riskEngine.getStatus(balance));
});

// ─── UPDATE RISK CONFIG ────────────────────────────────────────────────────────
router.post("/risk-engine/config", async (req, res): Promise<void> => {
  const {
    userId,
    maxDailyLossPercent,
    maxDrawdownPercent,
    maxLeverage,
    maxPositionSizePercent,
    maxOpenPositions,
    maxDailyTrades,
    cooldownMinutes,
    consecutiveLossesForCooldown,
    volatilityPauseAtrMultiple,
    riskRewardMinRatio,
  } = req.body as Record<string, any>;

  const updated = riskEngine.updateConfig({
    ...(maxDailyLossPercent !== undefined && { maxDailyLossPercent }),
    ...(maxDrawdownPercent !== undefined && { maxDrawdownPercent }),
    ...(maxLeverage !== undefined && { maxLeverage }),
    ...(maxPositionSizePercent !== undefined && { maxPositionSizePercent }),
    ...(maxOpenPositions !== undefined && { maxOpenPositions }),
    ...(maxDailyTrades !== undefined && { maxDailyTrades }),
    ...(cooldownMinutes !== undefined && { cooldownMinutes }),
    ...(consecutiveLossesForCooldown !== undefined && { consecutiveLossesForCooldown }),
    ...(volatilityPauseAtrMultiple !== undefined && { volatilityPauseAtrMultiple }),
    ...(riskRewardMinRatio !== undefined && { riskRewardMinRatio }),
  });

  if (userId) {
    await riskEngine.logRiskEvent(userId, "CONFIG_UPDATED", "info",
      "Risk Engine Config Updated", "Risk parameters have been updated by user", { updated });
  }

  res.json({ success: true, config: updated, timestamp: new Date().toISOString() });
});

// ─── KILL SWITCH ──────────────────────────────────────────────────────────────
router.post("/risk-engine/kill-switch", async (req, res): Promise<void> => {
  const { active, reason, userId } = req.body as { active: boolean; reason?: string; userId?: string };

  if (active) {
    riskEngine.activateKillSwitch(reason ?? "Manual activation", userId);
  } else {
    riskEngine.deactivateKillSwitch(userId);
  }

  res.json({
    success: true,
    killSwitchActive: riskEngine.isKillSwitchActive(),
    reason: riskEngine.getKillSwitchReason(),
    message: active
      ? "KILL SWITCH ACTIVATED — all trading halted immediately"
      : "Kill switch deactivated — trading resumed",
    timestamp: new Date().toISOString(),
  });
});

// ─── UPDATE EQUITY (DRAWDOWN TRACKING) ────────────────────────────────────────
router.post("/risk-engine/equity", async (req, res): Promise<void> => {
  const { userId, balance, unrealizedPnl = 0 } = req.body as { userId: string; balance: number; unrealizedPnl?: number };

  if (!balance) {
    res.status(400).json({ error: "balance is required" });
    return;
  }

  const drawdown = riskEngine.updateEquity(balance, unrealizedPnl, userId);
  const status = riskEngine.getStatus(balance);

  if (drawdown.currentDrawdownPct > 10 && userId) {
    await riskEngine.logRiskEvent(userId, "DRAWDOWN_WARNING", "warning",
      "Drawdown Warning",
      `Current drawdown: ${drawdown.currentDrawdownPct.toFixed(2)}%`,
      { drawdownPct: drawdown.currentDrawdownPct, peakBalance: drawdown.peakBalance });
  }

  res.json({ drawdown, canTrade: status.canTrade, killSwitch: status.killSwitch, timestamp: new Date().toISOString() });
});

// ─── VOLATILITY UPDATE ─────────────────────────────────────────────────────────
router.post("/risk-engine/volatility", async (req, res): Promise<void> => {
  const { atr, price, spreadExpansion = false, userId } = req.body as {
    atr: number; price: number; spreadExpansion?: boolean; userId?: string;
  };

  if (!atr || !price) {
    res.status(400).json({ error: "atr and price are required" });
    return;
  }

  const volatility = riskEngine.updateVolatility(atr, price, spreadExpansion);

  if ((volatility.volatilityLevel === "HIGH" || volatility.volatilityLevel === "EXTREME") && userId) {
    await riskEngine.logRiskEvent(userId, "VOLATILITY_SPIKE", "warning",
      `${volatility.volatilityLevel} Volatility Detected`,
      `ATR ${volatility.atrPercent.toFixed(2)}% — position sizes reduced to ${(volatility.positionSizeMultiplier * 100).toFixed(0)}%`,
      { atrPercent: volatility.atrPercent, level: volatility.volatilityLevel });
  }

  res.json({ volatility, aiPaused: volatility.aiPaused, timestamp: new Date().toISOString() });
});

// ─── TRADE VALIDATION + RISK SCORE ────────────────────────────────────────────
router.post("/risk-engine/validate", async (req, res): Promise<void> => {
  const {
    userId,
    balance = 10000,
    entryPrice,
    stopLoss,
    takeProfit,
    quantity,
    leverage = 1,
    symbol = "UNKNOWN",
    openPositionsCount = 0,
    existingExposure = 0,
  } = req.body as {
    userId?: string;
    balance?: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    quantity: number;
    leverage?: number;
    symbol?: string;
    openPositionsCount?: number;
    existingExposure?: number;
  };

  if (!entryPrice || !quantity) {
    res.status(400).json({ error: "entryPrice and quantity are required" });
    return;
  }

  const tradeValue = entryPrice * quantity * leverage;
  const canTrade = riskEngine.canTrade(balance, tradeValue, openPositionsCount);

  const riskScore = riskEngine.scoreRisk({
    balance, tradeValue, entryPrice, stopLoss, takeProfit, leverage, symbol,
    openPositionsCount, existingExposure,
  });

  if (userId && !canTrade.allowed) {
    await riskEngine.logRiskEvent(userId, "TRADE_BLOCKED", "warning",
      "Trade Blocked by Risk Engine",
      canTrade.reason ?? "Risk check failed",
      { symbol, tradeValue, riskScore: riskScore.overall });
  }

  res.json({
    allowed: canTrade.allowed,
    reason: canTrade.reason,
    riskScore,
    drawdown: riskEngine.getDrawdown(),
    volatility: riskEngine.getVolatility(),
    timestamp: new Date().toISOString(),
  });
});

// ─── POSITION SIZING ──────────────────────────────────────────────────────────
router.post("/risk-engine/position-size", async (req, res): Promise<void> => {
  const {
    balance = 10000,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    leverage = 1,
    riskPercent,
    riskProfile = "moderate",
    atr,
    maxPositionPct = 10,
    market = "crypto",
    userId,
  } = req.body as {
    balance?: number;
    entryPrice: number;
    stopLossPrice: number;
    takeProfitPrice?: number;
    leverage?: number;
    riskPercent?: number;
    riskProfile?: "conservative" | "moderate" | "aggressive";
    atr?: number;
    maxPositionPct?: number;
    market?: "crypto" | "forex" | "stock";
    userId?: string;
  };

  if (!entryPrice || !stopLossPrice) {
    res.status(400).json({ error: "entryPrice and stopLossPrice are required" });
    return;
  }

  const volatility = riskEngine.getVolatility();
  const volatilityMultiplier = 1 / volatility.positionSizeMultiplier;

  const result = calculatePositionSize({
    balance, entryPrice, stopLossPrice, takeProfitPrice,
    leverage, riskPercent, riskProfile, atr,
    volatilityMultiplier, maxPositionPct, market,
  });

  const optimalLeverage = stopLossPrice
    ? calculateOptimalLeverage({
        balance,
        riskPercent: riskPercent ?? 1,
        stopLossPercent: (Math.abs(entryPrice - stopLossPrice) / entryPrice) * 100,
        maxLeverage: riskEngine.getConfig().maxLeverage,
        riskProfile,
      })
    : null;

  const riskScore = riskEngine.scoreRisk({
    balance,
    tradeValue: result.notionalValue,
    entryPrice,
    stopLoss: stopLossPrice,
    takeProfit: takeProfitPrice,
    leverage,
    symbol: "CALC",
    openPositionsCount: 0,
  });

  res.json({
    positionSizing: result,
    optimalLeverage,
    riskScore,
    volatilityAdjustment: {
      level: volatility.volatilityLevel,
      multiplier: volatility.positionSizeMultiplier,
      aiPaused: volatility.aiPaused,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── RISK AUDIT LOGS ──────────────────────────────────────────────────────────
router.get("/risk-engine/logs/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.min(100, parseInt(typeof rawLimit === "string" ? rawLimit : "50", 10) || 50);

  const logs = await db.select().from(riskLogsTable)
    .where(eq(riskLogsTable.userId, userId))
    .orderBy(desc(riskLogsTable.createdAt))
    .limit(limit);

  res.json({ logs, count: logs.length, userId, timestamp: new Date().toISOString() });
});

// ─── USER-SPECIFIC RISK ENGINE STATUS ─────────────────────────────────────────
router.get("/risk-engine/user/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const rawBalance = Array.isArray(req.query.balance) ? req.query.balance[0] : req.query.balance;
  const balance = parseFloat(typeof rawBalance === "string" ? rawBalance : "10000");

  const [settings] = await db.select().from(userRiskSettingsTable).where(eq(userRiskSettingsTable.userId, userId));

  if (settings) {
    riskEngine.updateConfig({
      maxDailyLossPercent: settings.maxDailyLossPercent,
      maxLeverage: settings.maxLeverage,
      maxPositionSizePercent: settings.maxTradeSizePercent,
      maxOpenPositions: settings.maxOpenPositions,
      maxDailyTrades: settings.maxDailyTrades,
      cooldownMinutes: settings.cooldownMinutes,
      consecutiveLossesForCooldown: settings.consecutiveLossesForCooldown,
    });
  }

  const status = riskEngine.getStatus(balance);

  const recentLogs = await db.select().from(riskLogsTable)
    .where(and(eq(riskLogsTable.userId, userId), eq(riskLogsTable.resolved, "false")))
    .orderBy(desc(riskLogsTable.createdAt))
    .limit(10);

  res.json({ ...status, userSettings: settings ?? null, activeAlerts: recentLogs, userId });
});

export default router;
