import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { portfoliosTable, portfolioSnapshotsTable, tradesTable, aiAnalysisTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  getOrCreatePortfolio,
  updatePortfolioFromTrades,
  takePortfolioSnapshot,
  getPortfolioHistory,
} from "../lib/portfolio-intelligence";
import { getPerformanceMetrics } from "../lib/performance-analytics";
import { riskEngine } from "../lib/risk-engine";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

// ─── GET FULL PORTFOLIO SUMMARY ────────────────────────────────────────────────
router.get("/portfolio/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const rawBalance = Array.isArray(req.query.balance) ? req.query.balance[0] : req.query.balance;
  const balance = parseFloat(typeof rawBalance === "string" ? rawBalance : "10000");

  const portfolio = await updatePortfolioFromTrades(userId, balance);
  const riskStatus = riskEngine.getStatus(balance);

  res.json({
    portfolio,
    riskStatus: {
      killSwitch: riskStatus.killSwitch,
      canTrade: riskStatus.canTrade,
      drawdown: riskStatus.drawdown,
      volatility: riskStatus.volatility,
      dailyLossPct: riskStatus.daily.dailyLossPct,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── INITIALIZE / SEED PORTFOLIO ──────────────────────────────────────────────
router.post("/portfolio/init", async (req, res): Promise<void> => {
  const { userId, startBalance } = req.body as { userId: string; startBalance: number };

  if (!userId || !startBalance) {
    res.status(400).json({ error: "userId and startBalance are required" });
    return;
  }

  const [existing] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.userId, userId));

  if (existing) {
    res.json({ success: true, portfolio: existing, alreadyExists: true });
    return;
  }

  const [portfolio] = await db.insert(portfoliosTable).values({
    userId,
    totalBalance: startBalance,
    availableBalance: startBalance,
    peakBalance: startBalance,
    startBalance,
  }).returning();

  await takePortfolioSnapshot(userId, startBalance);
  riskEngine.updateEquity(startBalance, 0, userId);

  res.status(201).json({ success: true, portfolio, timestamp: new Date().toISOString() });
});

// ─── PORTFOLIO HISTORY (equity curve) ─────────────────────────────────────────
router.get("/portfolio/:userId/history", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
  const days = parseInt(typeof rawDays === "string" ? rawDays : "30", 10) || 30;

  const history = await getPortfolioHistory(userId, days);
  const metrics = await getPerformanceMetrics(userId, days);

  res.json({
    userId,
    history,
    performance: {
      winRate: metrics.winRate,
      totalPnl: metrics.totalPnl,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      profitFactor: metrics.profitFactor,
    },
    equityCurve: metrics.equityCurve,
    timestamp: new Date().toISOString(),
  });
});

// ─── TAKE MANUAL SNAPSHOT ─────────────────────────────────────────────────────
router.post("/portfolio/:userId/snapshot", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { balance } = req.body as { balance: number };

  if (!balance) {
    res.status(400).json({ error: "balance is required" });
    return;
  }

  await takePortfolioSnapshot(userId, balance);
  res.json({ success: true, message: "Snapshot recorded", timestamp: new Date().toISOString() });
});

// ─── AI PORTFOLIO INTELLIGENCE ────────────────────────────────────────────────
router.post("/portfolio/:userId/ai-advice", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { balance = 10000 } = req.body as { balance?: number };

  const portfolio = await updatePortfolioFromTrades(userId, balance);
  const metrics = await getPerformanceMetrics(userId, 30);
  const riskStatus = riskEngine.getStatus(balance);

  const prompt = `You are an institutional portfolio manager. Analyze this portfolio and provide actionable advice.

PORTFOLIO STATUS:
- Balance: $${portfolio.totalBalance.toLocaleString()}
- Unrealized P&L: $${portfolio.unrealizedPnl.toFixed(2)}
- Realized P&L Today: $${portfolio.realizedPnlToday.toFixed(2)}
- Drawdown: ${portfolio.drawdownPct.toFixed(2)}%
- Open Positions: ${portfolio.openPositionCount}
- Allocation: ${JSON.stringify(portfolio.allocation, null, 2)}
- Concentration Risk: ${portfolio.riskMetrics.concentrationRisk}
- Liquidation Risk: ${portfolio.riskMetrics.liquidationRisk}

30-DAY PERFORMANCE:
- Win Rate: ${metrics.winRate}%
- Total Trades: ${metrics.totalTrades}
- Profit Factor: ${metrics.profitFactor}
- Sharpe Ratio: ${metrics.sharpeRatio}
- Max Drawdown: ${metrics.maxDrawdown}%
- Avg R:R: ${metrics.avgRR}

RISK ENGINE STATUS:
- Kill Switch: ${riskStatus.killSwitch.active ? "ACTIVE" : "OFF"}
- Daily Loss Used: ${riskStatus.daily.dailyLossPct}%
- Volatility: ${riskStatus.volatility.volatilityLevel}

Provide a structured institutional analysis with:
1. Portfolio Health Score (0-100)
2. Top 3 immediate actions required
3. Rebalancing recommendations
4. Hedging opportunities
5. Risk reduction steps
6. Market exposure assessment
7. Performance summary and outlook

Be direct, data-driven, and institutional in tone. Focus on capital preservation first.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const advice = message.content[0]?.type === "text" ? message.content[0].text : "Unable to generate advice";

  await db.insert(aiAnalysisTable).values({
    userId,
    symbol: "PORTFOLIO",
    analysisType: "PORTFOLIO_INTELLIGENCE",
    reasoning: advice,
    confidenceScore: portfolio.riskMetrics.concentrationRisk === "HIGH" ? 60 : 80,
    riskScore: portfolio.drawdownPct,
    marketConditions: { allocation: portfolio.allocation, drawdown: portfolio.drawdownPct },
    indicators: { winRate: metrics.winRate, sharpe: metrics.sharpeRatio, profitFactor: metrics.profitFactor },
  });

  res.json({
    userId,
    advice,
    portfolio,
    metrics: {
      winRate: metrics.winRate,
      sharpeRatio: metrics.sharpeRatio,
      profitFactor: metrics.profitFactor,
      maxDrawdown: metrics.maxDrawdown,
      totalPnl: metrics.totalPnl,
    },
    suggestions: portfolio.suggestions,
    generatedAt: new Date().toISOString(),
  });
});

// ─── FULL PERFORMANCE DASHBOARD ────────────────────────────────────────────────
router.get("/portfolio/:userId/performance", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
  const days = rawDays && typeof rawDays === "string" ? parseInt(rawDays, 10) : undefined;

  const [metrics, portfolio] = await Promise.all([
    getPerformanceMetrics(userId, days),
    getOrCreatePortfolio(userId),
  ]);

  const riskLevel =
    metrics.sharpeRatio > 1.5 && metrics.maxDrawdown < 10 ? "EXCELLENT" :
    metrics.sharpeRatio > 0.5 && metrics.maxDrawdown < 20 ? "GOOD" :
    metrics.maxDrawdown < 30 ? "FAIR" : "POOR";

  res.json({
    userId,
    metrics,
    portfolio: {
      totalBalance: portfolio.totalBalance,
      startBalance: portfolio.startBalance,
      peakBalance: portfolio.peakBalance,
      drawdownPercent: portfolio.drawdownPercent,
    },
    ratings: {
      overall: riskLevel,
      sharpe: metrics.sharpeRatio >= 2 ? "EXCELLENT" : metrics.sharpeRatio >= 1 ? "GOOD" : metrics.sharpeRatio >= 0 ? "AVERAGE" : "POOR",
      consistency: metrics.profitFactor >= 2 ? "EXCELLENT" : metrics.profitFactor >= 1.5 ? "GOOD" : "NEEDS WORK",
      riskManagement: metrics.maxDrawdown <= 5 ? "EXCELLENT" : metrics.maxDrawdown <= 15 ? "GOOD" : "REVIEW NEEDED",
    },
    generatedAt: new Date().toISOString(),
  });
});

// ─── OPEN POSITIONS MONITOR ────────────────────────────────────────────────────
router.get("/portfolio/:userId/positions", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const positions = await db.select().from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "OPEN")))
    .orderBy(desc(tradesTable.entryTime));

  const totalUnrealized = positions.reduce((acc, p) => acc + (p.unrealizedPnl ?? 0), 0);
  const totalNotional = positions.reduce((acc, p) => acc + (p.notionalValue ?? 0), 0);

  const alerts = positions
    .filter(p => {
      if (!p.stopLoss || !p.unrealizedPnl) return false;
      const distToSL = Math.abs((p.unrealizedPnl ?? 0) / (p.notionalValue ?? 1)) * 100;
      return distToSL > 80;
    })
    .map(p => ({ tradeId: p.id, symbol: p.symbol, alert: "APPROACHING STOP LOSS", unrealizedPnl: p.unrealizedPnl }));

  res.json({
    positions,
    count: positions.length,
    totalUnrealizedPnl: parseFloat(totalUnrealized.toFixed(2)),
    totalNotional: parseFloat(totalNotional.toFixed(2)),
    alerts,
    timestamp: new Date().toISOString(),
  });
});

export default router;
