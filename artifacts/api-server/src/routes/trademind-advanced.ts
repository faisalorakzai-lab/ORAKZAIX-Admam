/**
 * TradeMind Advanced Routes
 * New features added on top of existing agents:
 * - Full technical indicators (MACD, BB, ATR, VWAP, Smart Money, S/R)
 * - AI-generated entry/SL/TP/risk/confidence signals
 * - Risk management (daily loss limit, emergency stop, cooldown, position sizing)
 * - Auto SL/TP monitoring for open positions
 * - Multi-trade monitor
 */

import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { calcFullIndicators, calcRSI, calcMACD, type Kline } from "../lib/indicators";
import { riskManager } from "../lib/risk-manager";

const router: IRouter = Router();

// ─── Helpers (local copies to avoid circular deps) ────────────────────────────
async function binanceFetch(symbol: string): Promise<{ price: number; change24h: number } | null> {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!r.ok) return null;
    const d = await r.json() as { lastPrice: string; priceChangePercent: string };
    return { price: parseFloat(d.lastPrice), change24h: parseFloat(d.priceChangePercent) };
  } catch { return null; }
}

async function getKlines(symbol: string, interval: string, limit: number): Promise<Kline[]> {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!r.ok) return [];
    const data = await r.json() as any[][];
    return data.map((k) => ({
      open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]),  close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch { return []; }
}

async function getForexKlines(symbol: string): Promise<Kline[]> {
  try {
    const key = process.env.TWELVEDATA_API_KEY;
    if (!key) return [];
    const r = await fetch(`https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1h&outputsize=200&apikey=${key}`);
    if (!r.ok) return [];
    const d = await r.json() as { values?: any[] };
    if (!d.values) return [];
    return d.values.reverse().map((v: any) => ({
      open: parseFloat(v.open), high: parseFloat(v.high),
      low: parseFloat(v.low),   close: parseFloat(v.close),
      volume: parseFloat(v.volume ?? "1000"),
    }));
  } catch { return []; }
}

const CRYPTO_SYM_MAP: Record<string, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", BNB: "BNBUSDT", SOL: "SOLUSDT",
  XRP: "XRPUSDT", ADA: "ADAUSDT", DOGE: "DOGEUSDT", AVAX: "AVAXUSDT",
  LINK: "LINKUSDT", MATIC: "MATICUSDT",
};

const INTERVAL_MAP: Record<string, string> = {
  "1M": "1m", "5M": "5m", "15M": "15m", "30M": "30m",
  "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1w",
};

// ─── In-memory monitored positions ────────────────────────────────────────────
interface MonitoredPosition {
  id: string;
  market: "crypto" | "forex";
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  qty: number;
  openTime: string;
  status: "OPEN" | "CLOSED_SL" | "CLOSED_TP" | "CLOSED_MANUAL";
  closedAt?: string;
  closedPrice?: number;
  pnl?: number;
  exchange?: string;
}

const monitoredPositions: MonitoredPosition[] = [];

// ─── GET /trademind/indicators/:symbol ────────────────────────────────────────
// Full technical analysis: RSI, MACD, BB, ATR, VWAP, Volume, Volatility,
// Sentiment, Smart Money Concepts, Support/Resistance
router.get("/trademind/indicators/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const { timeframe = "1H", market = "crypto" } = req.query as { timeframe?: string; market?: string };

  let klines: Kline[] = [];
  let currentPrice: number | null = null;

  if (market === "forex") {
    klines = await getForexKlines(symbol);
    if (klines.length > 0) currentPrice = klines[klines.length - 1].close;
  } else {
    const binanceSym = CRYPTO_SYM_MAP[symbol.toUpperCase()] ?? `${symbol.toUpperCase()}USDT`;
    const interval = INTERVAL_MAP[timeframe.toUpperCase()] ?? "1h";
    klines = await getKlines(binanceSym, interval, 200);
    const priceData = await binanceFetch(binanceSym);
    currentPrice = priceData?.price ?? null;
  }

  if (klines.length < 30) {
    res.status(400).json({ error: "Not enough data for analysis", symbol, market });
    return;
  }

  const indicators = calcFullIndicators(klines);

  res.json({
    symbol,
    market,
    timeframe,
    currentPrice,
    indicators,
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /trademind/ai-trade-signal ─────────────────────────────────────────
// AI generates structured entry, SL, TP, risk%, confidence score
router.post("/trademind/ai-trade-signal", async (req, res) => {
  const {
    symbol = "BTC",
    market = "crypto",
    timeframe = "1H",
    accountBalance = 10000,
    riskPercent = 2,
    style = "swing",
  } = req.body as {
    symbol?: string;
    market?: string;
    timeframe?: string;
    accountBalance?: number;
    riskPercent?: number;
    style?: string;
  };

  let klines: Kline[] = [];
  let currentPrice: number | null = null;
  let change24h: number | null = null;

  if (market === "forex") {
    klines = await getForexKlines(symbol);
    if (klines.length > 0) currentPrice = klines[klines.length - 1].close;
  } else {
    const binanceSym = CRYPTO_SYM_MAP[symbol.toUpperCase()] ?? `${symbol.toUpperCase()}USDT`;
    const interval = INTERVAL_MAP[timeframe.toUpperCase()] ?? "1h";
    klines = await getKlines(binanceSym, interval, 200);
    const priceData = await binanceFetch(binanceSym);
    currentPrice = priceData?.price ?? null;
    change24h = priceData?.change24h ?? null;
  }

  if (!currentPrice || klines.length < 30) {
    res.status(400).json({ error: "Insufficient market data", symbol, market });
    return;
  }

  const indicators = calcFullIndicators(klines);
  const atr = indicators.atr;
  const sr = indicators.supportResistance;

  const contextSummary = `
Symbol: ${symbol} | Market: ${market} | Timeframe: ${timeframe}
Current Price: ${currentPrice}
Change 24h: ${change24h ?? "N/A"}%
RSI: ${indicators.rsi} (${indicators.rsiSignal})
MACD: ${indicators.macd.macd.toFixed(6)} | Signal: ${indicators.macd.signal.toFixed(6)} | Histogram: ${indicators.macd.histogram.toFixed(6)} | Trend: ${indicators.macd.trend}
EMA20: ${indicators.ema20} | EMA50: ${indicators.ema50} | EMA200: ${indicators.ema200}
Bollinger Bands: Upper ${indicators.bollinger.upper} | Middle ${indicators.bollinger.middle} | Lower ${indicators.bollinger.lower} | Position: ${indicators.bollinger.position}
ATR: ${atr} (${indicators.atrPercent}%)
VWAP: ${indicators.vwap} | Price vs VWAP: ${indicators.priceVsVwap}
Volume: ${indicators.volumeAnalysis.signal} (ratio: ${indicators.volumeAnalysis.ratio}x avg)
Trend: ${indicators.trendDirection}
Sentiment Score: ${indicators.sentimentAnalysis.score}/100 (${indicators.sentimentAnalysis.label})
Smart Money: Market Structure ${indicators.smartMoney.marketStructure} | Imbalance: ${indicators.smartMoney.imbalance}
Order Blocks: ${indicators.smartMoney.orderBlocks.length} detected
Fair Value Gaps: ${indicators.smartMoney.fairValueGaps.length} detected
Liquidity Grabs: ${indicators.smartMoney.liquidityGrabs.length} detected
Key Support: ${sr.supports[0]?.level ?? "N/A"} | Key Resistance: ${sr.resistances[0]?.level ?? "N/A"}
Pivot Point: ${sr.pivotPoint} | S1: ${sr.s1} | S2: ${sr.s2} | R1: ${sr.r1} | R2: ${sr.r2}
Overall Signal: ${indicators.overallSignal} (score: ${indicators.signalScore})
Account Balance: $${accountBalance} | Risk per trade: ${riskPercent}%
Style: ${style}`;

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 800,
    system: `You are TradeMind AI Signal Engine — an institutional-grade quant trading system. 
Analyze the provided technical indicators and generate a precise trade signal.
You MUST respond with ONLY a valid JSON object — no text before or after.
The JSON must have exactly these fields:
{
  "signal": "LONG" | "SHORT" | "HOLD",
  "confidence": <number 0-100>,
  "entryPrice": <number>,
  "stopLoss": <number>,
  "takeProfit1": <number>,
  "takeProfit2": <number>,
  "riskPercent": <number>,
  "positionSize": <number>,
  "riskAmount": <number>,
  "riskRewardRatio": <number>,
  "reasoning": "<string max 3 sentences>",
  "keyLevels": {"support": <number>, "resistance": <number>},
  "invalidation": "<string max 1 sentence>",
  "timeHorizon": "<string e.g. '4-8 hours' or '2-5 days'>"
}`,
    messages: [{ role: "user", content: contextSummary }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  let signal: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    signal = m ? JSON.parse(m[0]) : {};
  } catch { signal = {}; }

  if (!signal.entryPrice) signal.entryPrice = currentPrice;
  if (!signal.stopLoss) {
    signal.stopLoss = signal.signal === "LONG"
      ? parseFloat((currentPrice - atr * 2).toFixed(6))
      : parseFloat((currentPrice + atr * 2).toFixed(6));
  }
  if (!signal.takeProfit1) {
    signal.takeProfit1 = signal.signal === "LONG"
      ? parseFloat((currentPrice + atr * 3).toFixed(6))
      : parseFloat((currentPrice - atr * 3).toFixed(6));
  }
  if (!signal.positionSize) {
    const posCalc = riskManager.calculatePositionSize({
      balance: accountBalance,
      riskPercent,
      entryPrice: currentPrice,
      stopLossPrice: signal.stopLoss,
    });
    signal.positionSize = posCalc.positionSize;
    signal.riskAmount = posCalc.riskAmount;
  }

  res.json({
    symbol,
    market,
    timeframe,
    style,
    currentPrice,
    signal,
    indicators: {
      rsi: indicators.rsi,
      rsiSignal: indicators.rsiSignal,
      macd: indicators.macd,
      trend: indicators.trendDirection,
      sentiment: indicators.sentimentAnalysis,
      overallSignal: indicators.overallSignal,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /trademind/risk-status ───────────────────────────────────────────────
router.get("/trademind/risk-status", (req, res) => {
  const { balance = 10000 } = req.query;
  const status = riskManager.getStatus(parseFloat(String(balance)));
  res.json({ ...status, timestamp: new Date().toISOString() });
});

// ─── POST /trademind/risk-config ──────────────────────────────────────────────
router.post("/trademind/risk-config", (req, res) => {
  const {
    maxDailyLossPercent,
    maxTradeSizePercent,
    maxDailyTrades,
    maxOpenPositions,
    consecutiveLossesForCooldown,
    cooldownMinutes,
    riskRewardMinRatio,
    maxLeverageCrypto,
    maxLeverageForex,
  } = req.body;

  const updated = riskManager.updateConfig({
    ...(maxDailyLossPercent !== undefined && { maxDailyLossPercent }),
    ...(maxTradeSizePercent !== undefined && { maxTradeSizePercent }),
    ...(maxDailyTrades !== undefined && { maxDailyTrades }),
    ...(maxOpenPositions !== undefined && { maxOpenPositions }),
    ...(consecutiveLossesForCooldown !== undefined && { consecutiveLossesForCooldown }),
    ...(cooldownMinutes !== undefined && { cooldownMinutes }),
    ...(riskRewardMinRatio !== undefined && { riskRewardMinRatio }),
    ...(maxLeverageCrypto !== undefined && { maxLeverageCrypto }),
    ...(maxLeverageForex !== undefined && { maxLeverageForex }),
  });

  res.json({ success: true, config: updated, timestamp: new Date().toISOString() });
});

// ─── POST /trademind/emergency-stop ──────────────────────────────────────────
router.post("/trademind/emergency-stop", (req, res) => {
  const { active } = req.body as { active: boolean };
  riskManager.setEmergencyStop(active);
  const status = riskManager.getStatus(10000);

  res.json({
    success: true,
    emergencyStopActive: active,
    message: active ? "EMERGENCY STOP ACTIVATED — all new trades blocked" : "Emergency stop deactivated — trading resumed",
    status,
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /trademind/position-sizing ─────────────────────────────────────────
router.post("/trademind/position-sizing", (req, res) => {
  const {
    balance = 10000,
    riskPercent = 2,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    pipValue = 1,
  } = req.body as {
    balance?: number;
    riskPercent?: number;
    entryPrice: number;
    stopLossPrice: number;
    takeProfitPrice?: number;
    pipValue?: number;
  };

  if (!entryPrice || !stopLossPrice) {
    res.status(400).json({ error: "entryPrice and stopLossPrice are required" });
    return;
  }

  const result = riskManager.calculatePositionSize({ balance, riskPercent, entryPrice, stopLossPrice, pipValue });
  const riskAmount = result.riskAmount;
  const rewardAmount = takeProfitPrice ? Math.abs(takeProfitPrice - entryPrice) * result.positionSize : null;
  const riskReward = rewardAmount ? parseFloat((rewardAmount / riskAmount).toFixed(2)) : null;

  res.json({
    ...result,
    entryPrice,
    stopLossPrice,
    takeProfitPrice: takeProfitPrice ?? null,
    rewardAmount: rewardAmount ? parseFloat(rewardAmount.toFixed(2)) : null,
    riskRewardRatio: riskReward,
    riskOk: riskReward ? riskReward >= riskManager.getConfig().riskRewardMinRatio : null,
    balanceUsed: parseFloat(((result.positionSize * entryPrice / balance) * 100).toFixed(2)),
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /trademind/monitor-add ──────────────────────────────────────────────
// Add a position to auto SL/TP monitoring
router.post("/trademind/monitor-add", async (req, res) => {
  const {
    symbol,
    side,
    entryPrice,
    stopLoss,
    takeProfit,
    qty,
    market = "crypto",
    exchange,
  } = req.body as {
    symbol: string;
    side: "BUY" | "SELL";
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    qty: number;
    market?: "crypto" | "forex";
    exchange?: string;
  };

  if (!symbol || !side || !entryPrice || !stopLoss || !takeProfit || !qty) {
    res.status(400).json({ error: "Missing required fields: symbol, side, entryPrice, stopLoss, takeProfit, qty" });
    return;
  }

  const id = `MON-${Date.now()}`;
  const position: MonitoredPosition = {
    id, market, symbol, side, entryPrice, stopLoss, takeProfit,
    qty, openTime: new Date().toISOString(), status: "OPEN", exchange,
  };

  monitoredPositions.push(position);

  riskManager.recordTradeOpen({
    id, market, symbol, side, entryPrice, qty,
    timestamp: new Date().toISOString(), status: "OPEN",
  });

  res.json({ success: true, position, message: `Position ${id} added to auto SL/TP monitor`, timestamp: new Date().toISOString() });
});

// ─── POST /trademind/monitor-check ────────────────────────────────────────────
// Check all monitored positions and auto-close at SL/TP
router.post("/trademind/monitor-check", async (req, res) => {
  const openPositions = monitoredPositions.filter((p) => p.status === "OPEN");
  const results: { id: string; symbol: string; action: string; price?: number; pnl?: number }[] = [];

  for (const pos of openPositions) {
    let currentPrice: number | null = null;

    if (pos.market === "forex") {
      try {
        const key = process.env.TWELVEDATA_API_KEY;
        if (key) {
          const r = await fetch(`https://api.twelvedata.com/quote?symbol=${pos.symbol}&apikey=${key}`);
          if (r.ok) {
            const d = await r.json() as any;
            currentPrice = parseFloat(d.close);
          }
        }
      } catch { /* skip */ }
    } else {
      const binanceSym = pos.symbol.includes("USDT") ? pos.symbol : `${pos.symbol}USDT`;
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSym}`);
        if (r.ok) {
          const d = await r.json() as { price: string };
          currentPrice = parseFloat(d.price);
        }
      } catch { /* skip */ }
    }

    if (!currentPrice) {
      results.push({ id: pos.id, symbol: pos.symbol, action: "SKIP_NO_PRICE" });
      continue;
    }

    const isBuy = pos.side === "BUY";
    let action = "HOLD";
    let triggered = false;

    if (isBuy && currentPrice <= pos.stopLoss) {
      pos.status = "CLOSED_SL";
      action = "CLOSED_STOP_LOSS";
      triggered = true;
    } else if (!isBuy && currentPrice >= pos.stopLoss) {
      pos.status = "CLOSED_SL";
      action = "CLOSED_STOP_LOSS";
      triggered = true;
    } else if (isBuy && currentPrice >= pos.takeProfit) {
      pos.status = "CLOSED_TP";
      action = "CLOSED_TAKE_PROFIT";
      triggered = true;
    } else if (!isBuy && currentPrice <= pos.takeProfit) {
      pos.status = "CLOSED_TP";
      action = "CLOSED_TAKE_PROFIT";
      triggered = true;
    }

    if (triggered) {
      const pnl = isBuy
        ? (currentPrice - pos.entryPrice) * pos.qty
        : (pos.entryPrice - currentPrice) * pos.qty;
      pos.closedAt = new Date().toISOString();
      pos.closedPrice = currentPrice;
      pos.pnl = parseFloat(pnl.toFixed(4));
      riskManager.recordTradeClose(pos.id, currentPrice, pos.pnl);
      results.push({ id: pos.id, symbol: pos.symbol, action, price: currentPrice, pnl: pos.pnl });
    } else {
      const unrealizedPnl = isBuy
        ? (currentPrice - pos.entryPrice) * pos.qty
        : (pos.entryPrice - currentPrice) * pos.qty;
      results.push({ id: pos.id, symbol: pos.symbol, action: "MONITORING", price: currentPrice, pnl: parseFloat(unrealizedPnl.toFixed(4)) });
    }
  }

  res.json({ checked: openPositions.length, results, timestamp: new Date().toISOString() });
});

// ─── GET /trademind/monitor-positions ─────────────────────────────────────────
router.get("/trademind/monitor-positions", (_req, res) => {
  const open = monitoredPositions.filter((p) => p.status === "OPEN");
  const closed = monitoredPositions.filter((p) => p.status !== "OPEN");
  const totalPnl = closed.reduce((a, p) => a + (p.pnl ?? 0), 0);

  res.json({
    openPositions: open,
    closedPositions: closed.slice(-20),
    openCount: open.length,
    closedCount: closed.length,
    totalRealizedPnl: parseFloat(totalPnl.toFixed(4)),
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /trademind/monitor-close ────────────────────────────────────────────
// Manually close a monitored position
router.post("/trademind/monitor-close", async (req, res) => {
  const { id } = req.body as { id: string };
  const pos = monitoredPositions.find((p) => p.id === id && p.status === "OPEN");

  if (!pos) {
    res.status(404).json({ error: "Open position not found" });
    return;
  }

  let currentPrice = pos.entryPrice;
  if (pos.market === "crypto") {
    const binanceSym = pos.symbol.includes("USDT") ? pos.symbol : `${pos.symbol}USDT`;
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSym}`);
      if (r.ok) {
        const d = await r.json() as { price: string };
        currentPrice = parseFloat(d.price);
      }
    } catch { /* use entry price */ }
  }

  const isBuy = pos.side === "BUY";
  const pnl = isBuy
    ? (currentPrice - pos.entryPrice) * pos.qty
    : (pos.entryPrice - currentPrice) * pos.qty;

  pos.status = "CLOSED_MANUAL";
  pos.closedAt = new Date().toISOString();
  pos.closedPrice = currentPrice;
  pos.pnl = parseFloat(pnl.toFixed(4));

  riskManager.recordTradeClose(pos.id, currentPrice, pos.pnl);

  res.json({ success: true, position: pos, pnl: pos.pnl, timestamp: new Date().toISOString() });
});

// ─── POST /trademind/validate-trade ──────────────────────────────────────────
// Check if a trade is allowed by risk rules before executing
router.post("/trademind/validate-trade", (req, res) => {
  const { balance = 10000, tradeValue, openPositionsCount = 0 } = req.body as {
    balance?: number;
    tradeValue: number;
    openPositionsCount?: number;
  };

  if (!tradeValue) {
    res.status(400).json({ error: "tradeValue is required" });
    return;
  }

  const validation = riskManager.validateTrade({ balance, tradeValue, openPositionsCount });
  const status = riskManager.getStatus(balance);

  res.json({
    ...validation,
    riskStatus: status,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /trademind/multi-monitor ─────────────────────────────────────────────
// Full dashboard: all positions + risk status + daily stats
router.get("/trademind/multi-monitor", async (req, res) => {
  const { balance = 10000 } = req.query;
  const bal = parseFloat(String(balance));

  const open = monitoredPositions.filter((p) => p.status === "OPEN");
  const riskStatus = riskManager.getStatus(bal);
  const tradeLog = riskManager.getTradeLog(20);

  const symbolsToWatch = [...new Set(open.map((p) => p.symbol))];
  const priceUpdates: Record<string, number> = {};

  await Promise.all(
    symbolsToWatch.map(async (sym) => {
      try {
        const binanceSym = sym.includes("USDT") ? sym : `${sym}USDT`;
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSym}`);
        if (r.ok) {
          const d = await r.json() as { price: string };
          priceUpdates[sym] = parseFloat(d.price);
        }
      } catch { /* skip */ }
    }),
  );

  const positionsWithPnl = open.map((pos) => {
    const current = priceUpdates[pos.symbol] ?? pos.entryPrice;
    const isBuy = pos.side === "BUY";
    const unrealizedPnl = isBuy
      ? (current - pos.entryPrice) * pos.qty
      : (pos.entryPrice - current) * pos.qty;
    const distanceToSl = Math.abs(current - pos.stopLoss);
    const distanceToTp = Math.abs(pos.takeProfit - current);
    const slPct = parseFloat(((distanceToSl / current) * 100).toFixed(2));
    const tpPct = parseFloat(((distanceToTp / current) * 100).toFixed(2));

    return {
      ...pos,
      currentPrice: current,
      unrealizedPnl: parseFloat(unrealizedPnl.toFixed(4)),
      slDistancePct: slPct,
      tpDistancePct: tpPct,
      nearSl: slPct < 1,
      nearTp: tpPct < 1,
    };
  });

  const totalUnrealized = positionsWithPnl.reduce((a, p) => a + p.unrealizedPnl, 0);

  res.json({
    openPositions: positionsWithPnl,
    totalOpenPositions: open.length,
    totalUnrealizedPnl: parseFloat(totalUnrealized.toFixed(4)),
    riskStatus,
    recentTrades: tradeLog,
    alerts: [
      ...positionsWithPnl.filter((p) => p.nearSl).map((p) => ({ type: "NEAR_SL", position: p.id, symbol: p.symbol })),
      ...positionsWithPnl.filter((p) => p.nearTp).map((p) => ({ type: "NEAR_TP", position: p.id, symbol: p.symbol })),
      ...(riskStatus.emergencyStop ? [{ type: "EMERGENCY_STOP", message: "Emergency stop is ACTIVE" }] : []),
      ...(riskStatus.inCooldown ? [{ type: "COOLDOWN", message: `Cooldown: ${riskStatus.cooldownMinutesLeft} min remaining` }] : []),
      ...(riskStatus.dailyLossPct >= riskStatus.config.maxDailyLossPercent * 0.8
        ? [{ type: "NEAR_DAILY_LIMIT", message: `Daily loss ${riskStatus.dailyLossPct}% approaching limit ${riskStatus.config.maxDailyLossPercent}%` }]
        : []),
    ],
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /trademind/auto-execute-check ────────────────────────────────────────
// Auto buy/sell using Binance — with full risk validation before execution
router.post("/trademind/auto-execute", async (req, res) => {
  const {
    symbol,
    side,
    qty,
    mode = "paper",
    exchange = "binance",
    stopLoss,
    takeProfit,
    balance = 10000,
  } = req.body as {
    symbol: string;
    side: "BUY" | "SELL";
    qty: number;
    mode: "paper" | "live";
    exchange?: string;
    stopLoss?: number;
    takeProfit?: number;
    balance?: number;
  };

  const priceData = await binanceFetch(symbol.includes("USDT") ? symbol : `${symbol}USDT`);
  const currentPrice = priceData?.price ?? 0;
  const tradeValue = currentPrice * qty;

  const openCount = monitoredPositions.filter((p) => p.status === "OPEN").length;
  const validation = riskManager.validateTrade({ balance, tradeValue, openPositionsCount: openCount });

  if (!validation.allowed) {
    res.status(403).json({
      success: false,
      blocked: true,
      reason: validation.reason,
      riskStatus: riskManager.getStatus(balance),
    });
    return;
  }

  const binanceSym = symbol.includes("USDT") ? symbol : `${symbol}USDT`;

  if (mode === "live") {
    const key = process.env.BINANCE_API_KEY;
    const secret = process.env.BINANCE_SECRET_KEY;
    if (!key || !secret) {
      res.status(400).json({ error: "Binance API keys not configured" });
      return;
    }
    try {
      const ts = Date.now();
      const params = `symbol=${binanceSym}&side=${side}&type=MARKET&quantity=${qty}&timestamp=${ts}`;
      const sig = createHmac("sha256", secret).update(params).digest("hex");
      const r = await fetch("https://api.binance.com/api/v3/order", {
        method: "POST",
        headers: { "X-MBX-APIKEY": key, "Content-Type": "application/x-www-form-urlencoded" },
        body: `${params}&signature=${sig}`,
      });
      const result = await r.json();

      if (stopLoss && takeProfit) {
        const id = `MON-${Date.now()}`;
        monitoredPositions.push({
          id, market: "crypto", symbol: binanceSym, side, entryPrice: currentPrice,
          stopLoss, takeProfit, qty, openTime: new Date().toISOString(), status: "OPEN", exchange,
        });
        riskManager.recordTradeOpen({ id, market: "crypto", symbol: binanceSym, side, entryPrice: currentPrice, qty, timestamp: new Date().toISOString(), status: "OPEN" });
      }

      res.json({ success: true, mode: "live", result, currentPrice, tradeValue, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: "Execution failed", message: String(err) });
    }
    return;
  }

  const id = `AUTO-${Date.now()}`;
  if (stopLoss && takeProfit) {
    monitoredPositions.push({
      id, market: "crypto", symbol: binanceSym, side, entryPrice: currentPrice,
      stopLoss, takeProfit, qty, openTime: new Date().toISOString(), status: "OPEN", exchange: "paper",
    });
    riskManager.recordTradeOpen({ id, market: "crypto", symbol: binanceSym, side, entryPrice: currentPrice, qty, timestamp: new Date().toISOString(), status: "OPEN" });
  }

  res.json({
    success: true,
    mode: "paper",
    order: { id, symbol: binanceSym, side, qty, price: currentPrice, status: "FILLED", timestamp: new Date().toISOString() },
    currentPrice,
    tradeValue,
    stopLoss: stopLoss ?? null,
    takeProfit: takeProfit ?? null,
    monitoringActive: !!(stopLoss && takeProfit),
    timestamp: new Date().toISOString(),
  });
});

export default router;
