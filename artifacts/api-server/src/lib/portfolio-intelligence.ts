/**
 * TradeMind Portfolio Intelligence System
 * Tracks equity, PnL, allocation, exposure, and generates
 * AI-powered rebalancing and hedging suggestions.
 */

import { db } from "@workspace/db";
import { portfoliosTable, portfolioSnapshotsTable, tradesTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { logger } from "./logger";

export interface AllocationSuggestion {
  type: "rebalance" | "hedge" | "reduce_exposure" | "diversify" | "take_profit";
  priority: "low" | "medium" | "high" | "critical";
  asset?: string;
  action: string;
  reason: string;
  estimatedImpact: string;
}

export interface PortfolioSummary {
  userId: string;
  totalBalance: number;
  availableBalance: number;
  totalEquity: number;
  unrealizedPnl: number;
  realizedPnlToday: number;
  realizedPnlTotal: number;
  returnPct: number;
  drawdownPct: number;
  peakBalance: number;
  allocation: Record<string, number>;
  exposure: Record<string, number>;
  openPositionCount: number;
  riskMetrics: {
    concentrationRisk: "LOW" | "MEDIUM" | "HIGH";
    correlationWarning: boolean;
    leverageExposure: number;
    liquidationRisk: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  };
  suggestions: AllocationSuggestion[];
  lastUpdated: string;
}

function analyzeAllocation(allocation: Record<string, number>, exposure: Record<string, number>): AllocationSuggestion[] {
  const suggestions: AllocationSuggestion[] = [];
  const assets = Object.keys(allocation);
  const totalExposure = Object.values(exposure).reduce((a, b) => a + b, 0);

  for (const asset of assets) {
    const pct = allocation[asset] ?? 0;
    if (pct > 40) {
      suggestions.push({
        type: "reduce_exposure",
        priority: "high",
        asset,
        action: `Reduce ${asset} allocation from ${pct.toFixed(1)}% to below 30%`,
        reason: "High concentration risk — single asset exceeds 40% of portfolio",
        estimatedImpact: "Reduces maximum drawdown potential by ~25%",
      });
    }
  }

  if (assets.length < 3 && totalExposure > 0) {
    suggestions.push({
      type: "diversify",
      priority: "medium",
      action: "Consider adding 2-3 uncorrelated assets",
      reason: "Portfolio has less than 3 assets — high concentration risk",
      estimatedImpact: "Reduces portfolio volatility through diversification",
    });
  }

  const btcExposure = exposure["BTC"] ?? 0;
  const ethExposure = exposure["ETH"] ?? 0;
  if (btcExposure > 0 && ethExposure > 0) {
    suggestions.push({
      type: "hedge",
      priority: "low",
      action: "BTC and ETH positions may be highly correlated",
      reason: "Correlated positions do not provide true diversification",
      estimatedImpact: "Consider hedging with uncorrelated asset (e.g. gold, forex pair)",
    });
  }

  if (totalExposure > 80) {
    suggestions.push({
      type: "reduce_exposure",
      priority: "high",
      action: "Reduce total portfolio exposure — consider taking profits",
      reason: `Total exposure ${totalExposure.toFixed(1)}% of balance is very high`,
      estimatedImpact: "Freeing capital provides flexibility for better opportunities",
    });
  }

  return suggestions;
}

export async function getOrCreatePortfolio(userId: string): Promise<typeof portfoliosTable.$inferSelect> {
  const [existing] = await db.select().from(portfoliosTable).where(eq(portfoliosTable.userId, userId));
  if (existing) return existing;

  const [created] = await db.insert(portfoliosTable).values({ userId }).returning();
  return created;
}

export async function updatePortfolioFromTrades(userId: string, currentBalance: number): Promise<PortfolioSummary> {
  const portfolio = await getOrCreatePortfolio(userId);

  const openTrades = await db.select().from(tradesTable).where(
    and(eq(tradesTable.userId, userId), eq(tradesTable.status, "OPEN"))
  );

  const today = new Date().toISOString().slice(0, 10);
  const closedToday = await db.select().from(tradesTable).where(
    and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.status, "CLOSED"),
      gte(tradesTable.exitTime, new Date(today))
    )
  );

  const unrealizedPnl = openTrades.reduce((acc, t) => acc + (t.unrealizedPnl ?? 0), 0);
  const realizedToday = closedToday.reduce((acc, t) => acc + (t.realizedPnl ?? 0), 0);

  const allocation: Record<string, number> = {};
  const exposure: Record<string, number> = {};

  for (const trade of openTrades) {
    const notional = trade.notionalValue ?? (trade.quantity * trade.entryPrice);
    const pct = (notional / currentBalance) * 100;
    allocation[trade.symbol] = (allocation[trade.symbol] ?? 0) + pct;
    exposure[trade.symbol] = (exposure[trade.symbol] ?? 0) + notional;
  }

  const peakBalance = Math.max(portfolio.peakBalance, currentBalance + unrealizedPnl);
  const currentEquity = currentBalance + unrealizedPnl;
  const drawdownPct = peakBalance > 0 ? ((peakBalance - currentEquity) / peakBalance) * 100 : 0;
  const returnPct = portfolio.startBalance > 0 ? ((currentEquity - portfolio.startBalance) / portfolio.startBalance) * 100 : 0;

  const totalExposure = Object.values(exposure).reduce((a, b) => a + b, 0);
  const concentrationRisk = Object.values(allocation).some(v => v > 40) ? "HIGH" : Object.values(allocation).some(v => v > 25) ? "MEDIUM" : "LOW";
  const leverageExposure = openTrades.reduce((acc, t) => acc + ((t.leverage ?? 1) * (t.notionalValue ?? 0)), 0) / (currentBalance || 1);

  await db.update(portfoliosTable).set({
    totalBalance: currentBalance,
    availableBalance: currentBalance - totalExposure,
    peakBalance,
    unrealizedPnl,
    realizedPnlToday: realizedToday,
    currentDrawdown: peakBalance - currentEquity,
    drawdownPercent: drawdownPct,
    allocation,
    exposure,
    openPositions: openTrades.map(t => ({ id: t.id, symbol: t.symbol, side: t.side, unrealizedPnl: t.unrealizedPnl })),
    lastSnapshotAt: new Date(),
  }).where(eq(portfoliosTable.userId, userId));

  const suggestions = analyzeAllocation(allocation, exposure);

  return {
    userId,
    totalBalance: currentBalance,
    availableBalance: currentBalance - totalExposure,
    totalEquity: currentEquity,
    unrealizedPnl,
    realizedPnlToday: realizedToday,
    realizedPnlTotal: portfolio.realizedPnlTotal + realizedToday,
    returnPct: parseFloat(returnPct.toFixed(2)),
    drawdownPct: parseFloat(drawdownPct.toFixed(2)),
    peakBalance,
    allocation,
    exposure,
    openPositionCount: openTrades.length,
    riskMetrics: {
      concentrationRisk,
      correlationWarning: !!(allocation["BTC"] && allocation["ETH"]),
      leverageExposure: parseFloat(leverageExposure.toFixed(2)),
      liquidationRisk: drawdownPct > 60 ? "HIGH" : drawdownPct > 30 ? "MEDIUM" : drawdownPct > 10 ? "LOW" : "NONE",
    },
    suggestions,
    lastUpdated: new Date().toISOString(),
  };
}

export async function takePortfolioSnapshot(userId: string, balance: number): Promise<void> {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const portfolio = await getOrCreatePortfolio(userId);

    const closedTrades = await db.select().from(tradesTable).where(
      and(eq(tradesTable.userId, userId), eq(tradesTable.status, "CLOSED"))
    );

    const wins = closedTrades.filter(t => (t.realizedPnl ?? 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
    const realizedPnl = closedTrades.reduce((acc, t) => acc + (t.realizedPnl ?? 0), 0);

    await db.insert(portfolioSnapshotsTable).values({
      userId,
      date,
      totalBalance: balance,
      realizedPnl,
      unrealizedPnl: portfolio.unrealizedPnl,
      drawdownPercent: portfolio.drawdownPercent,
      winRate: parseFloat(winRate.toFixed(2)),
      allocation: portfolio.allocation as Record<string, number>,
    });
  } catch (err) {
    logger.error({ err, userId }, "Failed to take portfolio snapshot");
  }
}

export async function getPortfolioHistory(userId: string, days = 30): Promise<typeof portfolioSnapshotsTable.$inferSelect[]> {
  return db.select()
    .from(portfolioSnapshotsTable)
    .where(eq(portfolioSnapshotsTable.userId, userId))
    .orderBy(desc(portfolioSnapshotsTable.createdAt))
    .limit(days);
}
