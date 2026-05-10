/**
 * TradeMind Performance Analytics
 * Institutional-grade metrics: Sharpe ratio, Sortino, profit factor,
 * win rate, max drawdown, monthly returns, equity curve.
 */

import { db } from "@workspace/db";
import { tradesTable, portfolioSnapshotsTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  lossRate: number;

  totalPnl: number;
  totalFees: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  avgRR: number;
  profitFactor: number;
  expectancy: number;

  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;

  maxDrawdown: number;
  maxDrawdownPct: number;
  avgDrawdown: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  recoveryFactor: number;

  bestTrade: number;
  worstTrade: number;
  largestWinStreak: number;
  largestLossStreak: number;

  monthlyReturns: Record<string, number>;
  dailyReturns: number[];
  equityCurve: { date: string; equity: number; drawdown: number }[];
  tradingBySymbol: Record<string, { trades: number; pnl: number; winRate: number }>;
  tradingBySide: { BUY: { trades: number; pnl: number }; SELL: { trades: number; pnl: number } };

  avgHoldingTimeHours: number;
  bestMonth: string;
  worstMonth: string;
  profitableMonths: number;
  unprofitableMonths: number;
}

function calcSharpe(returns: number[], riskFreeRate = 0.05 / 252): number {
  if (returns.length < 2) return 0;
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - avg, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  return stdDev > 0 ? parseFloat(((avg - riskFreeRate) / stdDev * Math.sqrt(252)).toFixed(3)) : 0;
}

function calcSortino(returns: number[], riskFreeRate = 0.05 / 252): number {
  if (returns.length < 2) return 0;
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downsideReturns = returns.filter(r => r < 0);
  if (downsideReturns.length === 0) return 3;
  const downsideVariance = downsideReturns.reduce((acc, r) => acc + Math.pow(r, 2), 0) / downsideReturns.length;
  const downsideStdDev = Math.sqrt(downsideVariance);
  return downsideStdDev > 0 ? parseFloat(((avg - riskFreeRate) / downsideStdDev * Math.sqrt(252)).toFixed(3)) : 0;
}

export async function getPerformanceMetrics(userId: string, days?: number): Promise<PerformanceMetrics> {
  const filter = days
    ? and(eq(tradesTable.userId, userId), eq(tradesTable.status, "CLOSED"), gte(tradesTable.exitTime, new Date(Date.now() - days * 86400000)))
    : and(eq(tradesTable.userId, userId), eq(tradesTable.status, "CLOSED"));

  const trades = await db.select().from(tradesTable).where(filter).orderBy(desc(tradesTable.exitTime));

  if (trades.length === 0) {
    return emptyMetrics();
  }

  const pnls = trades.map(t => t.realizedPnl ?? 0);
  const wins = trades.filter(t => (t.realizedPnl ?? 0) > 0);
  const losses = trades.filter(t => (t.realizedPnl ?? 0) <= 0);

  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const totalFees = trades.reduce((acc, t) => acc + (t.fees ?? 0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((acc, t) => acc + (t.realizedPnl ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((acc, t) => acc + (t.realizedPnl ?? 0), 0) / losses.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : wins.length > 0 ? 99 : 0;
  const winRate = (wins.length / trades.length) * 100;
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;
  const expectancy = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;

  let maxConsecLoss = 0, maxConsecWin = 0, curLoss = 0, curWin = 0;
  let maxDrawdown = 0, equity = 0, peak = 0, avgDD = 0, ddCount = 0;
  const equityCurve: PerformanceMetrics["equityCurve"] = [];

  for (const t of [...trades].reverse()) {
    const pnl = t.realizedPnl ?? 0;
    equity += pnl;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (dd > 0) { avgDD += dd; ddCount++; }

    if (pnl > 0) { curWin++; curLoss = 0; maxConsecWin = Math.max(maxConsecWin, curWin); }
    else { curLoss++; curWin = 0; maxConsecLoss = Math.max(maxConsecLoss, curLoss); }

    equityCurve.push({ date: (t.exitTime ?? t.createdAt).toISOString(), equity: parseFloat(equity.toFixed(2)), drawdown: parseFloat(dd.toFixed(2)) });
  }

  const dailyReturns: number[] = [];
  const monthlyMap: Record<string, number> = {};
  const bySymbol: PerformanceMetrics["tradingBySymbol"] = {};
  const bySide: PerformanceMetrics["tradingBySide"] = { BUY: { trades: 0, pnl: 0 }, SELL: { trades: 0, pnl: 0 } };

  for (const t of trades) {
    const pnl = t.realizedPnl ?? 0;
    const month = (t.exitTime ?? t.createdAt).toISOString().slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] ?? 0) + pnl;

    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { trades: 0, pnl: 0, winRate: 0 };
    bySymbol[t.symbol]!.trades++;
    bySymbol[t.symbol]!.pnl += pnl;

    const side = t.side === "BUY" ? "BUY" : "SELL";
    bySide[side].trades++;
    bySide[side].pnl += pnl;
  }

  for (const sym of Object.keys(bySymbol)) {
    const symTrades = trades.filter(t => t.symbol === sym);
    const symWins = symTrades.filter(t => (t.realizedPnl ?? 0) > 0);
    bySymbol[sym]!.winRate = parseFloat(((symWins.length / symTrades.length) * 100).toFixed(1));
    bySymbol[sym]!.pnl = parseFloat(bySymbol[sym]!.pnl.toFixed(2));
  }

  const startBalance = 10000;
  for (const [, v] of Object.entries(monthlyMap)) {
    dailyReturns.push(v / startBalance);
  }

  const months = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b));
  const bestMonth = months.sort(([, a], [, b]) => b - a)[0]?.[0] ?? "";
  const worstMonth = months.sort(([, a], [, b]) => a - b)[0]?.[0] ?? "";
  const profitableMonths = Object.values(monthlyMap).filter(v => v > 0).length;

  const holdingTimes = trades
    .filter(t => t.entryTime && t.exitTime)
    .map(t => (new Date(t.exitTime!).getTime() - new Date(t.entryTime).getTime()) / 3600000);
  const avgHoldingTimeHours = holdingTimes.length > 0 ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length : 0;

  const sharpe = calcSharpe(dailyReturns);
  const sortino = calcSortino(dailyReturns);
  const calmar = maxDrawdown > 0 ? parseFloat((totalPnl / startBalance / (maxDrawdown / 100)).toFixed(3)) : 0;
  const recoveryFactor = maxDrawdown > 0 ? parseFloat((totalPnl / (maxDrawdown / 100 * startBalance)).toFixed(3)) : 0;

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: parseFloat(winRate.toFixed(2)),
    lossRate: parseFloat((100 - winRate).toFixed(2)),
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    totalFees: parseFloat(totalFees.toFixed(2)),
    netPnl: parseFloat((totalPnl - totalFees).toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    avgRR: parseFloat(avgRR.toFixed(3)),
    profitFactor: parseFloat(profitFactor.toFixed(3)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    sharpeRatio: sharpe,
    sortinoRatio: sortino,
    calmarRatio: calmar,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    maxDrawdownPct: parseFloat(maxDrawdown.toFixed(2)),
    avgDrawdown: ddCount > 0 ? parseFloat((avgDD / ddCount).toFixed(2)) : 0,
    maxConsecutiveLosses: maxConsecLoss,
    maxConsecutiveWins: maxConsecWin,
    recoveryFactor,
    bestTrade: parseFloat(Math.max(...pnls).toFixed(2)),
    worstTrade: parseFloat(Math.min(...pnls).toFixed(2)),
    largestWinStreak: maxConsecWin,
    largestLossStreak: maxConsecLoss,
    monthlyReturns: Object.fromEntries(Object.entries(monthlyMap).map(([k, v]) => [k, parseFloat(v.toFixed(2))])),
    dailyReturns: dailyReturns.map(r => parseFloat(r.toFixed(6))),
    equityCurve: equityCurve.slice(-100),
    tradingBySymbol: bySymbol,
    tradingBySide: bySide,
    avgHoldingTimeHours: parseFloat(avgHoldingTimeHours.toFixed(2)),
    bestMonth,
    worstMonth,
    profitableMonths,
    unprofitableMonths: Object.keys(monthlyMap).length - profitableMonths,
  };
}

function emptyMetrics(): PerformanceMetrics {
  return {
    totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, lossRate: 0,
    totalPnl: 0, totalFees: 0, netPnl: 0, avgWin: 0, avgLoss: 0, avgRR: 0,
    profitFactor: 0, expectancy: 0, sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0,
    maxDrawdown: 0, maxDrawdownPct: 0, avgDrawdown: 0, maxConsecutiveLosses: 0,
    maxConsecutiveWins: 0, recoveryFactor: 0, bestTrade: 0, worstTrade: 0,
    largestWinStreak: 0, largestLossStreak: 0,
    monthlyReturns: {}, dailyReturns: [], equityCurve: [], tradingBySymbol: {},
    tradingBySide: { BUY: { trades: 0, pnl: 0 }, SELL: { trades: 0, pnl: 0 } },
    avgHoldingTimeHours: 0, bestMonth: "", worstMonth: "",
    profitableMonths: 0, unprofitableMonths: 0,
  };
}
