import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

// ─── In-memory paper order store ───────────────────────────────────────────
interface PaperOrder {
  id: string; symbol: string; side: "BUY" | "SELL"; qty: number;
  price: number; status: "FILLED"; timestamp: string; exchange: string;
  pnl?: number;
}
const paperOrders: PaperOrder[] = [];
let paperBalance = 10000; // USDT paper balance

// ─── Helpers ────────────────────────────────────────────────────────────────
async function binanceFetch(symbol: string): Promise<{ price: number; change24h: number } | null> {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!r.ok) return null;
    const d = await r.json() as { lastPrice: string; priceChangePercent: string };
    return { price: parseFloat(d.lastPrice), change24h: parseFloat(d.priceChangePercent) };
  } catch { return null; }
}

async function getKlines(symbol: string, interval: string, limit: number) {
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

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const diffs = closes.slice(1).map((c, i) => c - closes[i]);
  const avgGain = diffs.slice(-period).reduce((a, d) => a + (d > 0 ? d : 0), 0) / period;
  const avgLoss = diffs.slice(-period).reduce((a, d) => a + (d < 0 ? -d : 0), 0) / period;
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
}

function calcEMA(closes: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return parseFloat(ema.toFixed(2));
}

function detectSignal(closes: number[], rsi: number, vol: number[], avgVol: number): string {
  const last = closes[closes.length - 1];
  const ema20 = calcEMA(closes.slice(-20), 20);
  const ema50 = calcEMA(closes.slice(-50), 50);
  const volSpike = vol[vol.length - 1] > avgVol * 1.5;
  if (rsi > 70) return "OVERBOUGHT";
  if (rsi < 30) return "OVERSOLD";
  if (last > ema20 && ema20 > ema50 && volSpike) return "BREAKOUT";
  if (last < ema20 && ema20 < ema50) return "BEARISH";
  if (last > ema20 && ema20 > ema50) return "BULLISH";
  return "NEUTRAL";
}

async function getBinanceAccount() {
  const key = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_SECRET_KEY;
  if (!key || !secret) return null;
  try {
    const ts = Date.now();
    const qs = `timestamp=${ts}`;
    const sig = createHmac("sha256", secret).update(qs).digest("hex");
    const r = await fetch(`https://api.binance.com/api/v3/account?${qs}&signature=${sig}`, {
      headers: { "X-MBX-APIKEY": key },
    });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

async function getBybitBalance() {
  const key = process.env.BYBIT_API_KEY;
  const secret = process.env.BYBIT_SECRET_KEY;
  if (!key || !secret) return null;
  try {
    const ts = String(Date.now());
    const rw = "5000";
    const params = "accountType=UNIFIED";
    const sig = createHmac("sha256", secret).update(ts + key + rw + params).digest("hex");
    const r = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${params}`, {
      headers: { "X-BAPI-API-KEY": key, "X-BAPI-TIMESTAMP": ts, "X-BAPI-SIGN": sig, "X-BAPI-RECV-WINDOW": rw },
    });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

async function executeBinanceLive(symbol: string, side: string, qty: string) {
  const key = process.env.BINANCE_API_KEY!;
  const secret = process.env.BINANCE_SECRET_KEY!;
  const ts = Date.now();
  const params = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${qty}&timestamp=${ts}`;
  const sig = createHmac("sha256", secret).update(params).digest("hex");
  const r = await fetch("https://api.binance.com/api/v3/order", {
    method: "POST",
    headers: { "X-MBX-APIKEY": key, "Content-Type": "application/x-www-form-urlencoded" },
    body: `${params}&signature=${sig}`,
  });
  return r.json();
}

async function executeBybitLive(symbol: string, side: string, qty: string) {
  const key = process.env.BYBIT_API_KEY!;
  const secret = process.env.BYBIT_SECRET_KEY!;
  const ts = String(Date.now());
  const rw = "5000";
  const body = JSON.stringify({ category: "spot", symbol, side: side === "BUY" ? "Buy" : "Sell", orderType: "Market", qty });
  const sig = createHmac("sha256", secret).update(ts + key + rw + body).digest("hex");
  const r = await fetch("https://api.bybit.com/v5/order/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-BAPI-API-KEY": key, "X-BAPI-TIMESTAMP": ts, "X-BAPI-SIGN": sig, "X-BAPI-RECV-WINDOW": rw },
    body,
  });
  return r.json();
}

// ─── EXISTING ROUTES ─────────────────────────────────────────────────────────
router.get("/trademind/prices", async (req, res) => {
  const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];
  const results = await Promise.all(symbols.map(binanceFetch));
  const crypto: Record<string, typeof results[0]> = {};
  symbols.forEach((s, i) => { crypto[s] = results[i]; });

  const [cmcData, goldData] = await Promise.all([
    (async () => {
      try {
        const k = process.env.COINMARKETCAP_API_KEY;
        if (!k) return null;
        const r = await fetch("https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", { headers: { "X-CMC_PRO_API_KEY": k } });
        if (!r.ok) return null;
        const d = await r.json() as { data: { btc_dominance: number } };
        return { btcDominance: d.data.btc_dominance };
      } catch { return null; }
    })(),
    (async () => {
      try {
        const k = process.env.TWELVEDATA_API_KEY;
        if (!k) return null;
        const r = await fetch(`https://api.twelvedata.com/quote?symbol=XAU/USD&apikey=${k}`);
        if (!r.ok) return null;
        const d = await r.json() as { close: string; percent_change: string };
        const price = parseFloat(d.close);
        if (isNaN(price)) return null;
        return { price, change: parseFloat(d.percent_change) };
      } catch { return null; }
    })(),
  ]);

  res.json({ crypto, btcDominance: cmcData?.btcDominance ?? null, gold: goldData, spx: null, timestamp: new Date().toISOString() });
});

router.get("/trademind/signals", async (req, res) => {
  const assets = [{ asset: "BTC", symbol: "BTCUSDT" }, { asset: "ETH", symbol: "ETHUSDT" }, { asset: "SOL", symbol: "SOLUSDT" }];
  const prices = await Promise.all(assets.map((a) => binanceFetch(a.symbol)));
  const summary = assets.map((a, i) => prices[i] ? `${a.asset}: $${prices[i]!.price.toLocaleString()} (${prices[i]!.change24h > 0 ? "+" : ""}${prices[i]!.change24h.toFixed(2)}% 24h)` : `${a.asset}: unavailable`).join(", ");

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5", max_tokens: 400,
    system: "You are TradeMind AI. Given live market data, generate exactly 4 trading signals as a JSON array. Each must have: asset (string), signal (LONG|SHORT|HOLD|CAUTION), confidence (number 0-100), reason (string max 8 words). Respond ONLY with the JSON array.",
    messages: [{ role: "user", content: `Live: ${summary}\nGenerate signals for: BTC/USD, ETH/USD, Gold, S&P 500` }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  let signals = [];
  try { const m = text.match(/\[[\s\S]*\]/); signals = m ? JSON.parse(m[0]) : []; } catch { signals = []; }
  res.json({ signals, timestamp: new Date().toISOString() });
});

router.post("/trademind/analyze", async (req, res) => {
  const { asset = "BTC", timeframe = "1D", userQuery = "" } = req.body as { asset?: string; timeframe?: string; userQuery?: string };
  const symMap: Record<string, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT", BNB: "BNBUSDT", SOL: "SOLUSDT", XRP: "XRPUSDT" };
  const priceData = await binanceFetch(symMap[asset] ?? "BTCUSDT");
  const ctx = priceData ? `${asset}: $${priceData.price.toLocaleString()} (${priceData.change24h > 0 ? "+" : ""}${priceData.change24h.toFixed(2)}% 24h)` : `${asset}: unavailable`;

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5", max_tokens: 600,
    system: `You are TradeMind AI, elite financial intelligence. Timeframe: ${timeframe}\nLive: ${ctx}`,
    messages: [{ role: "user", content: userQuery ? `Analyze ${asset} ${timeframe}. ${userQuery}` : `Complete analysis for ${asset} ${timeframe}: structure, key levels, signal (LONG/SHORT/HOLD/CAUTION), confidence 0-100, trade plan.` }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const sigM = text.match(/\b(LONG|SHORT|HOLD|CAUTION)\b/i);
  const confM = text.match(/confidence[:\s]+(\d+)/i);
  res.json({ asset, timeframe, signal: sigM ? sigM[1].toUpperCase() : "HOLD", confidence: confM ? parseInt(confM[1]) : 65, analysis: text, marketData: { price: priceData?.price ?? null, change24h: priceData?.change24h ?? null, btcDominance: null, goldPrice: null }, timestamp: new Date().toISOString() });
});

// ─── AGENT 1: MARKET SCANNER ─────────────────────────────────────────────────
router.get("/trademind/scanner", async (req, res) => {
  const interval = (req.query.interval as string) || "1h";
  const SCAN_ASSETS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "MATICUSDT", "AVAXUSDT", "LINKUSDT"];

  const results = await Promise.all(SCAN_ASSETS.map(async (sym) => {
    const klines = await getKlines(sym, interval, 60);
    if (!klines.length) return null;
    const closes = klines.map((k) => k.close);
    const volumes = klines.map((k) => k.volume);
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const rsi = calcRSI(closes);
    const signal = detectSignal(closes, rsi, volumes, avgVol);
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const change1h = parseFloat(((last - prev) / prev * 100).toFixed(2));
    const high24h = Math.max(...klines.slice(-24).map((k) => k.high));
    const low24h = Math.min(...klines.slice(-24).map((k) => k.low));
    return { symbol: sym, price: last, change1h, rsi, signal, volume: volumes[volumes.length - 1], avgVolume: avgVol, volRatio: parseFloat((volumes[volumes.length - 1] / avgVol).toFixed(2)), high24h, low24h };
  }));

  const scan = results.filter(Boolean);
  const breakouts = scan.filter((s) => s && ["BREAKOUT", "BULLISH", "OVERSOLD"].includes(s.signal));
  res.json({ scan, breakouts: breakouts.length, interval, timestamp: new Date().toISOString() });
});

// ─── AGENT 2: TRADE EXECUTION ────────────────────────────────────────────────
router.post("/trademind/execute", async (req, res) => {
  const { symbol, side, qty, mode, exchange } = req.body as { symbol: string; side: "BUY" | "SELL"; qty: number; mode: "paper" | "live"; exchange: "binance" | "bybit" };

  if (mode === "paper") {
    const priceData = await binanceFetch(symbol);
    const price = priceData?.price ?? 0;
    const cost = price * qty;
    if (side === "BUY" && cost > paperBalance) {
      res.status(400).json({ error: "Insufficient paper balance", balance: paperBalance });
      return;
    }
    if (side === "BUY") paperBalance -= cost;
    else paperBalance += cost;
    const order: PaperOrder = { id: `PAPER-${Date.now()}`, symbol, side, qty, price, status: "FILLED", timestamp: new Date().toISOString(), exchange: "paper" };
    paperOrders.unshift(order);
    res.json({ success: true, order, paperBalance: parseFloat(paperBalance.toFixed(2)) });
    return;
  }

  if (mode === "live") {
    try {
      let result;
      if (exchange === "binance") result = await executeBinanceLive(symbol, side, String(qty));
      else result = await executeBybitLive(symbol, side, String(qty));
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: "Execution failed", message: String(err) });
    }
    return;
  }

  res.status(400).json({ error: "Invalid mode" });
});

router.get("/trademind/orders", (_req, res) => {
  res.json({ orders: paperOrders.slice(0, 50), paperBalance: parseFloat(paperBalance.toFixed(2)), count: paperOrders.length });
});

// ─── AGENT 3: RISK MANAGER ───────────────────────────────────────────────────
router.get("/trademind/risk", async (_req, res) => {
  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  const prices = await Promise.all(symbols.map(binanceFetch));

  const openPositions = paperOrders.reduce((acc, o) => {
    if (!acc[o.symbol]) acc[o.symbol] = { qty: 0, avgPrice: 0, count: 0 };
    if (o.side === "BUY") { acc[o.symbol].qty += o.qty; acc[o.symbol].avgPrice += o.price; acc[o.symbol].count++; }
    else { acc[o.symbol].qty -= o.qty; }
    return acc;
  }, {} as Record<string, { qty: number; avgPrice: number; count: number }>);

  const exposure = Object.entries(openPositions).map(([sym, pos]) => {
    const current = prices.find((_, i) => symbols[i] === sym);
    const currentPrice = current?.price ?? pos.avgPrice / (pos.count || 1);
    const avgEntry = pos.count > 0 ? pos.avgPrice / pos.count : 0;
    const unrealizedPnl = (currentPrice - avgEntry) * pos.qty;
    return { symbol: sym, qty: pos.qty, avgEntry: parseFloat(avgEntry.toFixed(2)), currentPrice, unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)) };
  }).filter((p) => p.qty !== 0);

  const totalPnl = exposure.reduce((a, p) => a + p.unrealizedPnl, 0);
  const riskScore = Math.min(100, Math.abs(totalPnl / paperBalance * 100) * 5);
  const riskLevel = riskScore > 20 ? "HIGH" : riskScore > 10 ? "MEDIUM" : "LOW";

  const btcData = prices[0];
  const volatility24h = btcData ? Math.abs(btcData.change24h) : 0;

  res.json({
    riskScore: parseFloat(riskScore.toFixed(1)), riskLevel,
    paperBalance: parseFloat(paperBalance.toFixed(2)),
    totalExposure: exposure.reduce((a, p) => a + Math.abs(p.currentPrice * p.qty), 0),
    unrealizedPnl: parseFloat(totalPnl.toFixed(2)),
    positions: exposure,
    volatility24h: parseFloat(volatility24h.toFixed(2)),
    maxDrawdown: parseFloat(Math.min(0, (paperBalance - 10000) / 10000 * 100).toFixed(2)),
    leverageSuggestion: riskScore > 15 ? "Reduce exposure" : "Within limits",
    timestamp: new Date().toISOString(),
  });
});

// ─── AGENT 4: NEWS INTELLIGENCE ─────────────────────────────────────────────
router.get("/trademind/news", async (req, res) => {
  const [fng, cmcGlobal, topCoins] = await Promise.all([
    (async () => {
      try {
        const r = await fetch("https://api.alternative.me/fng/?limit=7");
        if (!r.ok) return null;
        return r.json();
      } catch { return null; }
    })(),
    (async () => {
      try {
        const k = process.env.COINMARKETCAP_API_KEY;
        if (!k) return null;
        const r = await fetch("https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", { headers: { "X-CMC_PRO_API_KEY": k } });
        if (!r.ok) return null;
        return r.json();
      } catch { return null; }
    })(),
    (async () => {
      try {
        const k = process.env.COINMARKETCAP_API_KEY;
        if (!k) return null;
        const r = await fetch("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=10&sort=percent_change_24h&sort_dir=desc", { headers: { "X-CMC_PRO_API_KEY": k } });
        if (!r.ok) return null;
        return r.json();
      } catch { return null; }
    })(),
  ]);

  const fngData = fng?.data?.[0];
  const global = cmcGlobal?.data;
  const gainers = topCoins?.data?.map((c: any) => ({
    name: c.name, symbol: c.symbol,
    change24h: parseFloat(c.quote?.USD?.percent_change_24h?.toFixed(2) ?? "0"),
    price: c.quote?.USD?.price,
  })) ?? [];

  res.json({
    fearGreed: fngData ? { value: parseInt(fngData.value), classification: fngData.value_classification } : null,
    fngHistory: fng?.data?.slice(0, 7)?.map((d: any) => ({ value: parseInt(d.value), classification: d.value_classification, date: new Date(parseInt(d.timestamp) * 1000).toLocaleDateString() })) ?? [],
    global: global ? {
      btcDominance: parseFloat(global.btc_dominance?.toFixed(2) ?? "0"),
      ethDominance: parseFloat(global.eth_dominance?.toFixed(2) ?? "0"),
      totalMarketCap: global.quote?.USD?.total_market_cap,
      volume24h: global.quote?.USD?.total_volume_24h,
      change24h: parseFloat(global.quote?.USD?.total_market_cap_yesterday_percentage_change?.toFixed(2) ?? "0"),
    } : null,
    topGainers: gainers.slice(0, 5),
    timestamp: new Date().toISOString(),
  });
});

// ─── AGENT 5: PORTFOLIO INTELLIGENCE ────────────────────────────────────────
router.get("/trademind/portfolio", async (_req, res) => {
  const [binanceAcc, bybitBal] = await Promise.all([getBinanceAccount(), getBybitBalance()]);

  let binanceBalances: any[] = [];
  if (binanceAcc?.balances) {
    binanceBalances = binanceAcc.balances.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0).map((b: any) => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }));
  }

  let bybitBalances: any[] = [];
  if (bybitBal?.result?.list?.[0]?.coin) {
    bybitBalances = bybitBal.result.list[0].coin.filter((c: any) => parseFloat(c.walletBalance) > 0).map((c: any) => ({ asset: c.coin, balance: parseFloat(c.walletBalance), usdValue: parseFloat(c.usdValue ?? "0") }));
  }

  const bybitTotal = bybitBalances.reduce((a, c) => a + c.usdValue, 0);

  res.json({
    binance: { balances: binanceBalances, connected: !!binanceAcc },
    bybit: { balances: bybitBalances, totalUSD: parseFloat(bybitTotal.toFixed(2)), connected: !!bybitBal },
    paper: { balance: parseFloat(paperBalance.toFixed(2)), startBalance: 10000, pnl: parseFloat((paperBalance - 10000).toFixed(2)), pnlPct: parseFloat(((paperBalance - 10000) / 10000 * 100).toFixed(2)) },
    timestamp: new Date().toISOString(),
  });
});

// ─── AGENT 6: STRATEGY BRAIN ─────────────────────────────────────────────────
router.post("/trademind/strategy", async (req, res) => {
  const { asset = "BTC", timeframe = "1h", style = "swing", riskPercent = 2 } = req.body as { asset?: string; timeframe?: string; style?: string; riskPercent?: number };
  const sym = `${asset}USDT`;
  const [priceData, klines] = await Promise.all([binanceFetch(sym), getKlines(sym, timeframe, 60)]);

  const closes = klines.map((k) => k.close);
  const rsi = calcRSI(closes);
  const ema20 = closes.length >= 20 ? calcEMA(closes.slice(-20), 20) : null;
  const ema50 = closes.length >= 50 ? calcEMA(closes.slice(-50), 50) : null;
  const last = priceData?.price ?? 0;

  const prompt = `Generate a complete ${style} trading strategy for ${asset}/USDT on ${timeframe} timeframe.
Live data: Price $${last.toLocaleString()}, RSI: ${rsi}, EMA20: $${ema20}, EMA50: $${ema50}, 24h change: ${priceData?.change24h ?? 0}%
Risk per trade: ${riskPercent}%

Provide:
1. ENTRY: exact entry price zone
2. STOP LOSS: exact stop level and reasoning  
3. TAKE PROFIT 1: first target
4. TAKE PROFIT 2: extended target
5. RISK/REWARD ratio
6. POSITION SIZE recommendation
7. KEY INVALIDATION: what cancels this trade
8. MARKET STRUCTURE: current bias
Keep it precise and institutional. No generic advice.`;

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5", max_tokens: 700,
    system: "You are TradeMind Strategy Brain — a quantitative trading strategist. Generate precise, institutional-grade trading strategies with exact levels.",
    messages: [{ role: "user", content: prompt }],
  });

  const strategy = msg.content[0].type === "text" ? msg.content[0].text : "";
  const signalM = strategy.match(/\b(LONG|SHORT|HOLD|CAUTION|BUY|SELL)\b/i);

  res.json({ asset, timeframe, style, strategy, signal: signalM ? signalM[1].toUpperCase() : "HOLD", marketData: { price: last, rsi, ema20, ema50, change24h: priceData?.change24h ?? 0 }, timestamp: new Date().toISOString() });
});

// ─── AGENT 7: AI ANALYST ─────────────────────────────────────────────────────
router.post("/trademind/analyst", async (req, res) => {
  const { reportType = "daily", assets = ["BTC", "ETH"] } = req.body as { reportType?: string; assets?: string[] };
  const prices = await Promise.all(assets.slice(0, 5).map((a) => binanceFetch(`${a}USDT`)));
  const fng = await fetch("https://api.alternative.me/fng/?limit=1").then((r) => r.json()).catch(() => null);
  const fngVal = fng?.data?.[0];

  const mktCtx = assets.map((a, i) => prices[i] ? `${a}: $${prices[i]!.price.toLocaleString()} (${prices[i]!.change24h > 0 ? "+" : ""}${prices[i]!.change24h.toFixed(2)}% 24h)` : `${a}: N/A`).join("\n");

  const prompts: Record<string, string> = {
    daily: `Write a professional Daily Market Intelligence Report covering: ${assets.join(", ")}\n\nLive data:\n${mktCtx}\nFear & Greed Index: ${fngVal?.value ?? "N/A"} (${fngVal?.value_classification ?? "N/A"})\n\nInclude: Executive Summary, Market Regime, Key Themes, Asset Outlooks, Risk Factors, Today's Watchlist. Format as an institutional report.`,
    trade: `Write a Trade Intelligence Report for ${assets[0]}.\nPrice: ${prices[0] ? `$${prices[0].price.toLocaleString()}` : "N/A"}\nAnalyze: recent price action, current setup quality, institutional activity indicators, options flow implications, on-chain signals, recommended positioning.`,
    outlook: `Write a Weekly Market Outlook for crypto markets.\n\nLive data:\n${mktCtx}\nFear & Greed: ${fngVal?.value ?? "N/A"}\n\nCover: macro backdrop, BTC cycle position, altcoin rotation, key levels to watch, potential catalysts, risk scenarios.`,
  };

  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5", max_tokens: 900,
    system: "You are TradeMind AI Analyst — a senior institutional analyst who writes professional market intelligence reports. Write clearly, concisely, and with conviction. Use professional financial language.",
    messages: [{ role: "user", content: prompts[reportType] ?? prompts.daily }],
  });

  const report = msg.content[0].type === "text" ? msg.content[0].text : "";
  res.json({ reportType, assets, report, marketData: Object.fromEntries(assets.map((a, i) => [a, prices[i]])), fearGreed: fngVal ? { value: parseInt(fngVal.value), classification: fngVal.value_classification } : null, timestamp: new Date().toISOString() });
});

export default router;
