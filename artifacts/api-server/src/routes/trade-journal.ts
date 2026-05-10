import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tradesTable, aiAnalysisTable } from "@workspace/db";
import { eq, and, desc, asc, gte, lte, like, sql } from "drizzle-orm";
import { getPerformanceMetrics } from "../lib/performance-analytics";
import { riskEngine } from "../lib/risk-engine";

const router: IRouter = Router();

// ─── LOG A TRADE (OPEN) ───────────────────────────────────────────────────────
router.post("/journal/trade/open", async (req, res): Promise<void> => {
  const {
    userId, connectionId, exchange = "manual", symbol, market = "crypto",
    side, quantity, entryPrice, leverage = 1, stopLoss, takeProfit1, takeProfit2,
    tradingMode = "manual", aiReasoning, aiSignal, marketConditions, indicators,
    riskScore, confidenceScore, volatilityScore, riskLevel, tags, notes,
    balance = 10000,
  } = req.body as Record<string, any>;

  if (!userId || !symbol || !side || !quantity || !entryPrice) {
    res.status(400).json({ error: "userId, symbol, side, quantity, and entryPrice are required" });
    return;
  }

  const notionalValue = entryPrice * quantity * (leverage ?? 1);

  const [trade] = await db.insert(tradesTable).values({
    userId, connectionId, exchange, symbol, market, side,
    status: "OPEN", tradingMode,
    entryPrice, quantity, leverage, notionalValue,
    stopLoss, takeProfit1, takeProfit2,
    aiReasoning, aiSignal, marketConditions, indicators,
    riskScore, confidenceScore, volatilityScore, riskLevel,
    tags: tags ?? [], notes,
    entryTime: new Date(),
  }).returning();

  riskEngine.recordTradeOpen(balance);

  if (aiReasoning || aiSignal) {
    await db.insert(aiAnalysisTable).values({
      userId,
      tradeId: trade.id,
      symbol,
      analysisType: "TRADE_ENTRY",
      signal: aiSignal,
      reasoning: aiReasoning ?? "No AI reasoning provided",
      confidenceScore, riskScore, volatilityScore, riskLevel,
      entryPrice, stopLoss, takeProfit1,
      marketConditions: marketConditions ?? {},
      indicators: indicators ?? {},
    });
  }

  await riskEngine.logRiskEvent(userId, "TRADE_OPENED", "info",
    `Trade Opened: ${side} ${symbol}`,
    `${quantity} ${symbol} @ $${entryPrice.toLocaleString()} | Leverage: ${leverage}x`,
    { tradeId: trade.id, symbol, side, entryPrice, notionalValue });

  res.status(201).json({ success: true, trade, timestamp: new Date().toISOString() });
});

// ─── CLOSE A TRADE ────────────────────────────────────────────────────────────
router.post("/journal/trade/:tradeId/close", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tradeId) ? req.params.tradeId[0] : req.params.tradeId;
  const tradeId = parseInt(rawId, 10);
  const { exitPrice, fees = 0, notes, balance = 10000, userId } = req.body as {
    exitPrice: number; fees?: number; notes?: string; balance?: number; userId?: string;
  };

  if (!exitPrice) {
    res.status(400).json({ error: "exitPrice is required" });
    return;
  }

  const [existing] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeId));
  if (!existing) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  const isLong = existing.side === "BUY";
  const priceDiff = isLong ? exitPrice - existing.entryPrice : existing.entryPrice - exitPrice;
  const rawPnl = priceDiff * existing.quantity * (existing.leverage ?? 1);
  const realizedPnl = parseFloat((rawPnl - fees).toFixed(2));

  const [closed] = await db.update(tradesTable).set({
    exitPrice, exitTime: new Date(),
    status: "CLOSED",
    realizedPnl,
    fees,
    unrealizedPnl: 0,
    notes: notes ?? existing.notes,
  }).where(eq(tradesTable.id, tradeId)).returning();

  const resolvedUserId = userId ?? existing.userId;
  riskEngine.recordTradeClose(realizedPnl, balance, resolvedUserId);

  await db.update(aiAnalysisTable).set({
    outcome: realizedPnl >= 0 ? "WIN" : "LOSS",
    actualPnl: realizedPnl,
  }).where(and(eq(aiAnalysisTable.tradeId, tradeId), eq(aiAnalysisTable.userId, resolvedUserId)));

  await riskEngine.logRiskEvent(resolvedUserId, "TRADE_CLOSED", realizedPnl >= 0 ? "info" : "warning",
    `Trade Closed: ${existing.side} ${existing.symbol} — ${realizedPnl >= 0 ? "WIN" : "LOSS"}`,
    `Exit @ $${exitPrice.toLocaleString()} | P&L: ${realizedPnl >= 0 ? "+" : ""}$${realizedPnl}`,
    { tradeId, symbol: existing.symbol, entryPrice: existing.entryPrice, exitPrice, realizedPnl });

  res.json({ success: true, trade: closed, realizedPnl, timestamp: new Date().toISOString() });
});

// ─── UPDATE UNREALIZED PNL ─────────────────────────────────────────────────────
router.patch("/journal/trade/:tradeId/pnl", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tradeId) ? req.params.tradeId[0] : req.params.tradeId;
  const tradeId = parseInt(rawId, 10);
  const { currentPrice } = req.body as { currentPrice: number };

  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeId));
  if (!trade) { res.status(404).json({ error: "Trade not found" }); return; }

  const isLong = trade.side === "BUY";
  const priceDiff = isLong ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
  const unrealizedPnl = parseFloat((priceDiff * trade.quantity * (trade.leverage ?? 1)).toFixed(2));

  await db.update(tradesTable).set({ unrealizedPnl }).where(eq(tradesTable.id, tradeId));

  res.json({ tradeId, currentPrice, unrealizedPnl, timestamp: new Date().toISOString() });
});

// ─── LIST TRADES (with filtering) ─────────────────────────────────────────────
router.get("/journal/trades/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const rawStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  const rawSymbol = Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol;
  const rawSide = Array.isArray(req.query.side) ? req.query.side[0] : req.query.side;
  const rawFrom = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
  const rawTo = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const rawOffset = Array.isArray(req.query.offset) ? req.query.offset[0] : req.query.offset;

  const status = typeof rawStatus === "string" ? rawStatus : undefined;
  const symbol = typeof rawSymbol === "string" ? rawSymbol : undefined;
  const side = typeof rawSide === "string" ? rawSide : undefined;
  const limit = Math.min(200, parseInt(typeof rawLimit === "string" ? rawLimit : "50", 10) || 50);
  const offset = parseInt(typeof rawOffset === "string" ? rawOffset : "0", 10) || 0;

  const conditions = [eq(tradesTable.userId, userId)];
  if (status) conditions.push(eq(tradesTable.status, status));
  if (symbol) conditions.push(eq(tradesTable.symbol, symbol.toUpperCase()));
  if (side) conditions.push(eq(tradesTable.side, side.toUpperCase()));
  if (rawFrom) conditions.push(gte(tradesTable.entryTime, new Date(rawFrom as string)));
  if (rawTo) conditions.push(lte(tradesTable.entryTime, new Date(rawTo as string)));

  const trades = await db.select().from(tradesTable)
    .where(and(...conditions))
    .orderBy(desc(tradesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const summary = {
    totalTrades: trades.length,
    openTrades: trades.filter(t => t.status === "OPEN").length,
    closedTrades: trades.filter(t => t.status === "CLOSED").length,
    totalPnl: parseFloat(trades.reduce((acc, t) => acc + (t.realizedPnl ?? 0), 0).toFixed(2)),
    totalUnrealizedPnl: parseFloat(trades.reduce((acc, t) => acc + (t.unrealizedPnl ?? 0), 0).toFixed(2)),
    winRate: (() => {
      const closed = trades.filter(t => t.status === "CLOSED");
      const wins = closed.filter(t => (t.realizedPnl ?? 0) > 0);
      return closed.length > 0 ? parseFloat(((wins.length / closed.length) * 100).toFixed(2)) : 0;
    })(),
  };

  res.json({ trades, summary, limit, offset, timestamp: new Date().toISOString() });
});

// ─── SINGLE TRADE ─────────────────────────────────────────────────────────────
router.get("/journal/trade/:tradeId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.tradeId) ? req.params.tradeId[0] : req.params.tradeId;
  const tradeId = parseInt(rawId, 10);

  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, tradeId));
  if (!trade) { res.status(404).json({ error: "Trade not found" }); return; }

  const analysis = await db.select().from(aiAnalysisTable).where(eq(aiAnalysisTable.tradeId, tradeId));

  res.json({ trade, aiAnalysis: analysis, timestamp: new Date().toISOString() });
});

// ─── PERFORMANCE ANALYTICS ────────────────────────────────────────────────────
router.get("/journal/analytics/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const rawDays = Array.isArray(req.query.days) ? req.query.days[0] : req.query.days;
  const days = rawDays && typeof rawDays === "string" ? parseInt(rawDays, 10) : undefined;

  const metrics = await getPerformanceMetrics(userId, days);
  res.json({ userId, metrics, generatedAt: new Date().toISOString() });
});

// ─── AI ANALYSIS HISTORY ──────────────────────────────────────────────────────
router.get("/journal/ai-analysis/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.min(100, parseInt(typeof rawLimit === "string" ? rawLimit : "20", 10) || 20);

  const analysis = await db.select().from(aiAnalysisTable)
    .where(eq(aiAnalysisTable.userId, userId))
    .orderBy(desc(aiAnalysisTable.createdAt))
    .limit(limit);

  const winCount = analysis.filter(a => a.outcome === "WIN").length;
  const analyzed = analysis.filter(a => a.outcome);
  const aiWinRate = analyzed.length > 0 ? parseFloat(((winCount / analyzed.length) * 100).toFixed(2)) : null;
  const avgConfidence = analysis.length > 0
    ? parseFloat((analysis.reduce((acc, a) => acc + (a.confidenceScore ?? 0), 0) / analysis.length).toFixed(2))
    : null;

  res.json({ userId, analysis, aiStats: { aiWinRate, avgConfidence, totalAnalyzed: analyzed.length }, timestamp: new Date().toISOString() });
});

// ─── EXPORT TRADES (CSV-ready JSON) ────────────────────────────────────────────
router.get("/journal/export/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(asc(tradesTable.entryTime));

  const csv = [
    ["ID", "Symbol", "Market", "Side", "Status", "Entry Price", "Exit Price", "Quantity", "Leverage", "PnL", "Fees", "Net PnL", "Risk Score", "Confidence", "AI Signal", "Entry Time", "Exit Time", "Notes"].join(","),
    ...trades.map(t => [
      t.id, t.symbol, t.market, t.side, t.status,
      t.entryPrice, t.exitPrice ?? "", t.quantity, t.leverage,
      t.realizedPnl ?? "", t.fees ?? 0,
      t.realizedPnl != null ? (t.realizedPnl - (t.fees ?? 0)).toFixed(2) : "",
      t.riskScore ?? "", t.confidenceScore ?? "", t.aiSignal ?? "",
      t.entryTime.toISOString(), t.exitTime?.toISOString() ?? "",
      (t.notes ?? "").replace(/,/g, ";"),
    ].join(","))
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="trademind-journal-${userId}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// ─── WIN/LOSS SUMMARY ─────────────────────────────────────────────────────────
router.get("/journal/summary/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const [totals] = await db.select({
    total: sql<number>`count(*)`,
    wins: sql<number>`sum(case when realized_pnl > 0 then 1 else 0 end)`,
    losses: sql<number>`sum(case when realized_pnl <= 0 then 1 else 0 end)`,
    totalPnl: sql<number>`sum(coalesce(realized_pnl, 0))`,
    avgPnl: sql<number>`avg(coalesce(realized_pnl, 0))`,
    bestTrade: sql<number>`max(realized_pnl)`,
    worstTrade: sql<number>`min(realized_pnl)`,
    totalFees: sql<number>`sum(coalesce(fees, 0))`,
  }).from(tradesTable).where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "CLOSED")));

  const openCount = await db.select({ count: sql<number>`count(*)` })
    .from(tradesTable).where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "OPEN")));

  res.json({
    userId,
    closed: totals,
    openPositions: openCount[0]?.count ?? 0,
    winRate: totals.total > 0 ? parseFloat(((Number(totals.wins) / Number(totals.total)) * 100).toFixed(2)) : 0,
    netPnl: parseFloat(((totals.totalPnl ?? 0) - (totals.totalFees ?? 0)).toFixed(2)),
    timestamp: new Date().toISOString(),
  });
});

export default router;
