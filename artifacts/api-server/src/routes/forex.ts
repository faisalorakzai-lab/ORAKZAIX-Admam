/**
 * Forex + MT5 Trading Routes
 * Extends TradeMind with institutional-grade forex trading capabilities
 */

import { Router, type IRouter } from "express";
import { forexDataProvider, forexRiskEngine, forexAnalysisEngine, mt5Manager } from "../integrations/mt5-bridge";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

// ─── In-memory forex paper trading store ──────────────────────────────────────
interface ForexPaperOrder {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  stopLoss: number;
  takeProfit: number;
  status: "OPEN" | "CLOSED";
  openTime: string;
  closeTime?: string;
  pnl?: number;
}

const forexPaperOrders: ForexPaperOrder[] = [];
let forexPaperBalance = 10000; // USDT paper balance

// ─── FOREX MARKET DATA ────────────────────────────────────────────────────────
router.get("/forex/prices", async (req, res) => {
  const { market = "major" } = req.query;

  const majorPairs = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD"];
  const commodities = ["XAU/USD", "XAG/USD"];
  const indices = ["US30", "NASDAQ", "SPX500"];

  let symbols: string[] = [];
  if (market === "major") symbols = majorPairs;
  else if (market === "commodities") symbols = commodities;
  else if (market === "indices") symbols = indices;
  else symbols = [...majorPairs, ...commodities, ...indices];

  const prices = await forexDataProvider.getMultipleForexPrices(symbols);

  res.json({
    market,
    prices,
    timestamp: new Date().toISOString(),
  });
});

// ─── FOREX MARKET DATA WITH ANALYSIS ──────────────────────────────────────────
router.get("/forex/market-data", async (req, res) => {
  const { symbols = "EUR/USD,GBP/USD,USD/JPY" } = req.query;
  const symbolList = (symbols as string).split(",");

  const marketData = await forexDataProvider.getMultipleForexMarketData(symbolList);

  res.json({
    marketData,
    timestamp: new Date().toISOString(),
  });
});

// ─── FOREX SCANNER ───────────────────────────────────────────────────────────
router.get("/forex/scanner", async (req, res) => {
  const forexPairs = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "NZD/USD"];
  const commodities = ["XAU/USD", "XAG/USD"];
  const indices = ["US30", "NASDAQ", "SPX500"];

  const allSymbols = [...forexPairs, ...commodities, ...indices];
  const marketData = await forexDataProvider.getMultipleForexMarketData(allSymbols);

  const scan = Object.entries(marketData)
    .filter(([_, data]) => data !== null)
    .map(([symbol, data]) => ({
      symbol,
      bid: data!.bid,
      ask: data!.ask,
      spread: data!.spread,
      volatility: data!.volatility,
      session: data!.session,
      trend: data!.trend,
      liquidityZone: data!.liquidityZone,
    }));

  const highVolatility = scan.filter((s) => s.volatility > 0.005);

  res.json({
    scan,
    highVolatility: highVolatility.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── FOREX SIGNALS ───────────────────────────────────────────────────────────
router.get("/forex/signals", async (req, res) => {
  const pairs = ["EUR/USD", "GBP/USD", "USD/JPY"];
  const marketData = await forexDataProvider.getMultipleForexMarketData(pairs);

  const summary = pairs
    .map((p) => {
      const data = marketData[p];
      return data ? `${p}: Bid ${data.bid.toFixed(5)}, Ask ${data.ask.toFixed(5)}, Spread ${data.spread.toFixed(5)}` : `${p}: unavailable`;
    })
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 400,
    system:
      "You are TradeMind Forex AI. Given live forex data, generate exactly 3 trading signals as a JSON array. Each must have: pair (string), signal (LONG|SHORT|HOLD), confidence (0-100), reason (max 10 words). Respond ONLY with JSON array.",
    messages: [{ role: "user", content: `Live forex data:\n${summary}\n\nGenerate signals.` }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  let signals = [];
  try {
    const m = text.match(/\[[\s\S]*\]/);
    signals = m ? JSON.parse(m[0]) : [];
  } catch {
    signals = [];
  }

  res.json({ signals, timestamp: new Date().toISOString() });
});

// ─── FOREX ANALYSIS ──────────────────────────────────────────────────────────
router.post("/forex/analyze", async (req, res) => {
  const { pair = "EUR/USD", timeframe = "1H", userQuery = "" } = req.body as { pair?: string; timeframe?: string; userQuery?: string };

  const marketData = await forexDataProvider.getForexMarketData(pair);
  if (!marketData) {
    res.status(400).json({ error: "Failed to fetch market data" });
    return;
  }

  const ctx = `${pair}: Bid ${marketData.bid.toFixed(5)}, Ask ${marketData.ask.toFixed(5)}\nSpread: ${marketData.spread.toFixed(5)}\nSession: ${marketData.session}\nTrend: ${marketData.trend}\nVolatility: ${marketData.volatility.toFixed(5)}`;

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 600,
    system: `You are TradeMind Forex Analyst. Timeframe: ${timeframe}\nLive: ${ctx}`,
    messages: [
      {
        role: "user",
        content: userQuery
          ? `Analyze ${pair} ${timeframe}. ${userQuery}`
          : `Complete forex analysis for ${pair} ${timeframe}: structure, key levels, liquidity zones, session behavior, signal (LONG/SHORT/HOLD), confidence 0-100, trade plan.`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const sigM = text.match(/\b(LONG|SHORT|HOLD|CAUTION)\b/i);
  const confM = text.match(/confidence[:\s]+(\d+)/i);

  res.json({
    pair,
    timeframe,
    signal: sigM ? sigM[1].toUpperCase() : "HOLD",
    confidence: confM ? parseInt(confM[1]) : 65,
    analysis: text,
    marketData: {
      bid: marketData.bid,
      ask: marketData.ask,
      spread: marketData.spread,
      volatility: marketData.volatility,
      session: marketData.session,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── FOREX EXECUTION (PAPER TRADING) ──────────────────────────────────────────
router.post("/forex/execute", async (req, res) => {
  const { pair, type, volume, stopLoss, takeProfit, mode = "paper" } = req.body as {
    pair: string;
    type: "BUY" | "SELL";
    volume: number;
    stopLoss: number;
    takeProfit: number;
    mode?: "paper" | "live" | "assisted";
  };

  // Fetch current price
  const marketData = await forexDataProvider.getForexPrice(pair);
  if (!marketData) {
    res.status(400).json({ error: "Failed to fetch market data" });
    return;
  }

  const currentPrice = type === "BUY" ? marketData.ask : marketData.bid;

  // Validate trade
  const validation = forexRiskEngine.validateTrade(pair, volume, stopLoss, takeProfit, currentPrice);
  if (!validation.valid) {
    res.status(400).json({ error: validation.reason });
    return;
  }

  if (mode === "paper") {
    // Paper trading
    const pipValue = 0.0001; // Standard pip value for most pairs
    const riskPips = Math.abs(currentPrice - stopLoss) / pipValue;
    const cost = volume * currentPrice;

    if (cost > forexPaperBalance) {
      res.status(400).json({ error: "Insufficient paper balance", balance: forexPaperBalance });
      return;
    }

    const order: ForexPaperOrder = {
      id: `FX-PAPER-${Date.now()}`,
      symbol: pair,
      type,
      volume,
      openPrice: currentPrice,
      stopLoss,
      takeProfit,
      status: "OPEN",
      openTime: new Date().toISOString(),
    };

    forexPaperOrders.push(order);
    forexPaperBalance -= cost * 0.01; // Margin requirement

    res.json({
      success: true,
      order,
      balance: parseFloat(forexPaperBalance.toFixed(2)),
      message: `${type} ${volume} ${pair} @ ${currentPrice.toFixed(5)}`,
    });
  } else if (mode === "live" || mode === "assisted") {
    // Live or assisted execution
    res.status(501).json({ error: "Live execution requires MT5 broker connection" });
  } else {
    res.status(400).json({ error: "Invalid mode" });
  }
});

// ─── FOREX POSITIONS ──────────────────────────────────────────────────────────
router.get("/forex/positions", async (_req, res) => {
  const openPositions = forexPaperOrders.filter((o) => o.status === "OPEN");

  // Calculate unrealized PnL
  const positions = await Promise.all(
    openPositions.map(async (pos) => {
      const marketData = await forexDataProvider.getForexPrice(pos.symbol);
      if (!marketData) return pos;

      const currentPrice = pos.type === "BUY" ? marketData.bid : marketData.ask;
      const pnlPips = ((currentPrice - pos.openPrice) / 0.0001) * (pos.type === "BUY" ? 1 : -1);
      const pnl = pnlPips * pos.volume * 10; // Approximate PnL

      return { ...pos, currentPrice, pnlPips, pnl };
    })
  );

  res.json({
    positions,
    count: positions.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── FOREX ORDERS ────────────────────────────────────────────────────────────
router.get("/forex/orders", (_req, res) => {
  res.json({
    orders: forexPaperOrders.slice(0, 50),
    balance: parseFloat(forexPaperBalance.toFixed(2)),
    count: forexPaperOrders.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── FOREX RISK MANAGEMENT ───────────────────────────────────────────────────
router.get("/forex/risk", async (_req, res) => {
  const openPositions = forexPaperOrders.filter((o) => o.status === "OPEN");

  let totalExposure = 0;
  let totalUnrealizedPnl = 0;

  for (const pos of openPositions) {
    const marketData = await forexDataProvider.getForexPrice(pos.symbol);
    if (marketData) {
      const currentPrice = pos.type === "BUY" ? marketData.bid : marketData.ask;
      const exposure = pos.volume * currentPrice;
      const pnl = (currentPrice - pos.openPrice) * pos.volume * (pos.type === "BUY" ? 1 : -1);

      totalExposure += exposure;
      totalUnrealizedPnl += pnl;
    }
  }

  const riskScore = Math.min(100, Math.abs(totalUnrealizedPnl / forexPaperBalance) * 100 * 5);
  const riskLevel = riskScore > 20 ? "HIGH" : riskScore > 10 ? "MEDIUM" : "LOW";
  const maxDrawdown = Math.min(0, (forexPaperBalance - 10000) / 10000) * 100;
  const drawdownExceeded = Math.abs(maxDrawdown) > forexRiskEngine.getConfig().maxDrawdown;

  res.json({
    riskScore: parseFloat(riskScore.toFixed(1)),
    riskLevel,
    balance: parseFloat(forexPaperBalance.toFixed(2)),
    totalExposure: parseFloat(totalExposure.toFixed(2)),
    unrealizedPnl: parseFloat(totalUnrealizedPnl.toFixed(2)),
    positions: openPositions.length,
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    drawdownExceeded,
    leverageRecommendation: riskScore > 15 ? "Reduce exposure" : "Within limits",
    riskConfig: forexRiskEngine.getConfig(),
    timestamp: new Date().toISOString(),
  });
});

// ─── CLOSE POSITION ──────────────────────────────────────────────────────────
router.post("/forex/close-position", async (req, res) => {
  const { orderId } = req.body as { orderId: string };

  const order = forexPaperOrders.find((o) => o.id === orderId);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const marketData = await forexDataProvider.getForexPrice(order.symbol);
  if (!marketData) {
    res.status(400).json({ error: "Failed to fetch market data" });
    return;
  }

  const closePrice = order.type === "BUY" ? marketData.bid : marketData.ask;
  const pnl = (closePrice - order.openPrice) * order.volume * (order.type === "BUY" ? 1 : -1);

  order.status = "CLOSED";
  order.closeTime = new Date().toISOString();
  order.pnl = pnl;

  forexPaperBalance += pnl;

  res.json({
    success: true,
    order,
    pnl: parseFloat(pnl.toFixed(2)),
    balance: parseFloat(forexPaperBalance.toFixed(2)),
  });
});

// ─── UPDATE RISK CONFIG ──────────────────────────────────────────────────────
router.post("/forex/risk-config", (req, res) => {
  const { maxLeverage, maxDrawdown, maxRiskPerTrade, maxLotSize } = req.body;

  forexRiskEngine.updateConfig({
    maxLeverage: maxLeverage ?? undefined,
    maxDrawdown: maxDrawdown ?? undefined,
    maxRiskPerTrade: maxRiskPerTrade ?? undefined,
    maxLotSize: maxLotSize ?? undefined,
  });

  res.json({
    success: true,
    config: forexRiskEngine.getConfig(),
  });
});

export default router;
