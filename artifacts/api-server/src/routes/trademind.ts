import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

async function fetchBinancePrice(symbol: string): Promise<{ price: number; change24h: number } | null> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!res.ok) return null;
    const data = await res.json() as { lastPrice: string; priceChangePercent: string };
    return {
      price: parseFloat(data.lastPrice),
      change24h: parseFloat(data.priceChangePercent),
    };
  } catch {
    return null;
  }
}

async function fetchCMCData(): Promise<{ fearGreed?: number; btcDominance?: number } | null> {
  try {
    const key = process.env.COINMARKETCAP_API_KEY;
    if (!key) return null;
    const res = await fetch("https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", {
      headers: { "X-CMC_PRO_API_KEY": key },
    });
    if (!res.ok) return null;
    const data = await res.json() as { data: { btc_dominance: number } };
    return { btcDominance: data.data.btc_dominance };
  } catch {
    return null;
  }
}

async function fetchTwelveDataPrice(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const key = process.env.TWELVEDATA_API_KEY;
    if (!key) return null;
    const res = await fetch(`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${key}`);
    if (!res.ok) return null;
    const data = await res.json() as { close: string; percent_change: string };
    return {
      price: parseFloat(data.close),
      change: parseFloat(data.percent_change),
    };
  } catch {
    return null;
  }
}

router.post("/trademind/analyze", async (req, res) => {
  try {
    const { asset = "BTC", timeframe = "1D", userQuery = "" } = req.body as {
      asset?: string;
      timeframe?: string;
      userQuery?: string;
    };

    const symbolMap: Record<string, string> = {
      BTC: "BTCUSDT",
      ETH: "ETHUSDT",
      BNB: "BNBUSDT",
      SOL: "SOLUSDT",
      XRP: "XRPUSDT",
    };

    const [binanceData, cmcData, tdGold] = await Promise.all([
      fetchBinancePrice(symbolMap[asset] ?? "BTCUSDT"),
      fetchCMCData(),
      fetchTwelveDataPrice("XAU/USD"),
    ]);

    const marketContext = [
      binanceData ? `${asset}/USDT: $${binanceData.price.toLocaleString()} (${binanceData.change24h > 0 ? "+" : ""}${binanceData.change24h.toFixed(2)}% 24h)` : `${asset} price unavailable`,
      cmcData?.btcDominance ? `BTC Dominance: ${cmcData.btcDominance.toFixed(1)}%` : "",
      tdGold ? `Gold (XAU/USD): $${tdGold.price.toLocaleString()} (${tdGold.change > 0 ? "+" : ""}${tdGold.change.toFixed(2)}%)` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are TradeMind AI, an elite financial intelligence system. You analyze live market data and provide precise, actionable trading insights. You are concise, confident, and data-driven. Never hedge excessively. Always provide a clear directional bias.

Current live market data:
${marketContext}
Timeframe: ${timeframe}`;

    const userMessage = userQuery
      ? `Analyze ${asset} on the ${timeframe} timeframe. ${userQuery}`
      : `Provide a complete trading analysis for ${asset} on the ${timeframe} timeframe. Include: market structure, key levels, momentum assessment, signal (LONG/SHORT/HOLD/CAUTION), confidence score 0-100, and a concise trade plan.`;

    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const analysisText = message.content[0].type === "text" ? message.content[0].text : "";

    const signalMatch = analysisText.match(/\b(LONG|SHORT|HOLD|CAUTION)\b/i);
    const confidenceMatch = analysisText.match(/confidence[:\s]+(\d+)/i);
    const signal = signalMatch ? signalMatch[1].toUpperCase() : "HOLD";
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 65;

    res.json({
      asset,
      timeframe,
      signal,
      confidence,
      analysis: analysisText,
      marketData: {
        price: binanceData?.price ?? null,
        change24h: binanceData?.change24h ?? null,
        btcDominance: cmcData?.btcDominance ?? null,
        goldPrice: tdGold?.price ?? null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "TradeMind analyze error");
    res.status(500).json({ error: "Analysis failed", message: String(err) });
  }
});

router.get("/trademind/prices", async (req, res) => {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];
    const results = await Promise.all(symbols.map((s) => fetchBinancePrice(s)));
    const prices: Record<string, { price: number; change24h: number } | null> = {};
    symbols.forEach((s, i) => { prices[s] = results[i]; });

    const [cmcData, goldData, spxData] = await Promise.all([
      fetchCMCData(),
      fetchTwelveDataPrice("XAU/USD"),
      fetchTwelveDataPrice("SPX"),
    ]);

    res.json({
      crypto: prices,
      btcDominance: cmcData?.btcDominance ?? null,
      gold: goldData,
      spx: spxData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "TradeMind prices error");
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

router.get("/trademind/signals", async (req, res) => {
  try {
    const assets = [
      { asset: "BTC", symbol: "BTCUSDT" },
      { asset: "ETH", symbol: "ETHUSDT" },
      { asset: "SOL", symbol: "SOLUSDT" },
    ];

    const priceData = await Promise.all(assets.map((a) => fetchBinancePrice(a.symbol)));

    const marketSummary = assets
      .map((a, i) => priceData[i] ? `${a.asset}: $${priceData[i]!.price.toLocaleString()} (${priceData[i]!.change24h > 0 ? "+" : ""}${priceData[i]!.change24h.toFixed(2)}% 24h)` : `${a.asset}: data unavailable`)
      .join(", ");

    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 400,
      system: "You are TradeMind AI. Given live market data, generate exactly 4 trading signals in JSON format. Each signal must have: asset (string), signal (LONG|SHORT|HOLD|CAUTION), confidence (number 0-100), reason (string, max 8 words). Respond ONLY with a valid JSON array, no other text.",
      messages: [{
        role: "user",
        content: `Live market data: ${marketSummary}\n\nGenerate signals for: BTC/USD, ETH/USD, Gold, S&P 500`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    let signals;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      signals = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      signals = [];
    }

    res.json({ signals, timestamp: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "TradeMind signals error");
    res.status(500).json({ error: "Failed to generate signals" });
  }
});

export default router;
