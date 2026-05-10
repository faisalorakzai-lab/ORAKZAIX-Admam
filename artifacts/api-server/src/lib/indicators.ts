/**
 * TradeMind Technical Indicators
 * RSI, MACD, Bollinger Bands, ATR, VWAP, Volume Analysis,
 * Support/Resistance, Smart Money Concepts, Volatility, Trend
 */

export interface Kline {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  position: "UPPER" | "LOWER" | "MIDDLE";
  squeeze: boolean;
}

export interface SMCResult {
  orderBlocks: { level: number; type: "BULLISH" | "BEARISH"; strength: "STRONG" | "WEAK" }[];
  fairValueGaps: { high: number; low: number; direction: "UP" | "DOWN" }[];
  liquidityGrabs: { level: number; direction: "SWEEP_HIGH" | "SWEEP_LOW" }[];
  marketStructure: "HIGHER_HIGHS" | "LOWER_LOWS" | "RANGING";
  imbalance: "BULLISH" | "BEARISH" | "BALANCED";
}

export interface SRResult {
  supports: { level: number; strength: number; touches: number }[];
  resistances: { level: number; strength: number; touches: number }[];
  pivotPoint: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
}

export interface FullIndicators {
  rsi: number;
  rsiSignal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  macd: MACDResult;
  bollinger: BollingerResult;
  atr: number;
  atrPercent: number;
  vwap: number;
  priceVsVwap: "ABOVE" | "BELOW";
  ema20: number;
  ema50: number;
  ema200: number;
  trendDirection: "STRONG_UP" | "UP" | "FLAT" | "DOWN" | "STRONG_DOWN";
  volumeAnalysis: {
    current: number;
    average: number;
    ratio: number;
    signal: "HIGH" | "NORMAL" | "LOW";
    trend: "INCREASING" | "DECREASING" | "STABLE";
  };
  volatilityAnalysis: {
    atr: number;
    atrPercent: number;
    level: "HIGH" | "NORMAL" | "LOW";
    bbWidth: number;
    regime: "TRENDING" | "RANGING" | "BREAKOUT";
  };
  sentimentAnalysis: {
    score: number;
    label: "VERY_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "VERY_BEARISH";
    priceStrength: number;
    volumeConfirmation: boolean;
  };
  smartMoney: SMCResult;
  supportResistance: SRResult;
  overallSignal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  signalScore: number;
}

function ema(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  const k = 2 / (period + 1);
  let val = closes[0];
  for (let i = 1; i < closes.length; i++) val = closes[i] * k + val * (1 - k);
  return parseFloat(val.toFixed(6));
}

function emaArray(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    result.push(closes[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const diffs = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = diffs.slice(-period).map((d) => (d > 0 ? d : 0));
  const losses = diffs.slice(-period).map((d) => (d < 0 ? -d : 0));
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
}

export function calcMACD(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MACDResult {
  if (closes.length < slow + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0, trend: "NEUTRAL" };
  }
  const emaFast = emaArray(closes, fast);
  const emaSlow = emaArray(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  const macdSlice = macdLine.slice(-signalPeriod - 1);
  const signalLine = ema(macdSlice, signalPeriod);
  const lastMacd = macdLine[macdLine.length - 1];
  const histogram = lastMacd - signalLine;

  let trend: MACDResult["trend"] = "NEUTRAL";
  if (lastMacd > 0 && lastMacd > signalLine) trend = "BULLISH";
  else if (lastMacd < 0 && lastMacd < signalLine) trend = "BEARISH";

  return {
    macd: parseFloat(lastMacd.toFixed(6)),
    signal: parseFloat(signalLine.toFixed(6)),
    histogram: parseFloat(histogram.toFixed(6)),
    trend,
  };
}

export function calcBollinger(closes: number[], period = 20, stdDevMult = 2): BollingerResult {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 0;
    return { upper: last, middle: last, lower: last, bandwidth: 0, position: "MIDDLE", squeeze: false };
  }
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = middle + stdDevMult * stdDev;
  const lower = middle - stdDevMult * stdDev;
  const bandwidth = ((upper - lower) / middle) * 100;
  const last = closes[closes.length - 1];
  const squeeze = bandwidth < 2;

  let position: BollingerResult["position"] = "MIDDLE";
  if (last >= upper * 0.99) position = "UPPER";
  else if (last <= lower * 1.01) position = "LOWER";

  return {
    upper: parseFloat(upper.toFixed(6)),
    middle: parseFloat(middle.toFixed(6)),
    lower: parseFloat(lower.toFixed(6)),
    bandwidth: parseFloat(bandwidth.toFixed(2)),
    position,
    squeeze,
  };
}

export function calcATR(klines: Kline[], period = 14): number {
  if (klines.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    const prevClose = klines[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const slice = trs.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(6));
}

export function calcVWAP(klines: Kline[]): number {
  let totalTypicalVol = 0;
  let totalVol = 0;
  for (const k of klines) {
    const typicalPrice = (k.high + k.low + k.close) / 3;
    totalTypicalVol += typicalPrice * k.volume;
    totalVol += k.volume;
  }
  return totalVol > 0 ? parseFloat((totalTypicalVol / totalVol).toFixed(6)) : 0;
}

export function detectSmartMoney(klines: Kline[]): SMCResult {
  const orderBlocks: SMCResult["orderBlocks"] = [];
  const fairValueGaps: SMCResult["fairValueGaps"] = [];
  const liquidityGrabs: SMCResult["liquidityGrabs"] = [];

  const recent = klines.slice(-30);

  for (let i = 2; i < recent.length - 1; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    const next = recent[i + 1];

    if (curr.close < curr.open && next.close > curr.high) {
      orderBlocks.push({
        level: parseFloat(((curr.high + curr.low) / 2).toFixed(6)),
        type: "BULLISH",
        strength: curr.volume > (recent.slice(Math.max(0, i - 10), i).reduce((a, k) => a + k.volume, 0) / 10) ? "STRONG" : "WEAK",
      });
    }
    if (curr.close > curr.open && next.close < curr.low) {
      orderBlocks.push({
        level: parseFloat(((curr.high + curr.low) / 2).toFixed(6)),
        type: "BEARISH",
        strength: curr.volume > (recent.slice(Math.max(0, i - 10), i).reduce((a, k) => a + k.volume, 0) / 10) ? "STRONG" : "WEAK",
      });
    }

    if (i + 2 < recent.length) {
      const a = recent[i];
      const b = recent[i + 1];
      const c = recent[i + 2];
      if (c.low > a.high) {
        fairValueGaps.push({ high: parseFloat(c.low.toFixed(6)), low: parseFloat(a.high.toFixed(6)), direction: "UP" });
      }
      if (c.high < a.low) {
        fairValueGaps.push({ high: parseFloat(a.low.toFixed(6)), low: parseFloat(c.high.toFixed(6)), direction: "DOWN" });
      }
    }
  }

  const highs = recent.map((k) => k.high);
  const lows = recent.map((k) => k.low);
  const prevHigh = Math.max(...highs.slice(0, -3));
  const prevLow = Math.min(...lows.slice(0, -3));
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  if (lastHigh > prevHigh && recent[recent.length - 1].close < prevHigh) {
    liquidityGrabs.push({ level: parseFloat(prevHigh.toFixed(6)), direction: "SWEEP_HIGH" });
  }
  if (lastLow < prevLow && recent[recent.length - 1].close > prevLow) {
    liquidityGrabs.push({ level: parseFloat(prevLow.toFixed(6)), direction: "SWEEP_LOW" });
  }

  const closes = recent.map((k) => k.close);
  let higherHighs = 0;
  let lowerLows = 0;
  for (let i = 5; i < closes.length; i += 5) {
    if (highs[i] > highs[i - 5]) higherHighs++;
    if (lows[i] < lows[i - 5]) lowerLows++;
  }
  const marketStructure: SMCResult["marketStructure"] =
    higherHighs > lowerLows ? "HIGHER_HIGHS" : lowerLows > higherHighs ? "LOWER_LOWS" : "RANGING";

  const buyOBs = orderBlocks.filter((o) => o.type === "BULLISH").length;
  const sellOBs = orderBlocks.filter((o) => o.type === "BEARISH").length;
  const imbalance: SMCResult["imbalance"] = buyOBs > sellOBs ? "BULLISH" : sellOBs > buyOBs ? "BEARISH" : "BALANCED";

  return {
    orderBlocks: orderBlocks.slice(-5),
    fairValueGaps: fairValueGaps.slice(-3),
    liquidityGrabs: liquidityGrabs.slice(-3),
    marketStructure,
    imbalance,
  };
}

export function calcSupportResistance(klines: Kline[]): SRResult {
  const recent = klines.slice(-50);
  const levels: Record<string, { level: number; touches: number }> = {};

  for (const k of recent) {
    const roundedHigh = Math.round(k.high * 100) / 100;
    const roundedLow = Math.round(k.low * 100) / 100;
    const keyH = roundedHigh.toFixed(2);
    const keyL = roundedLow.toFixed(2);
    levels[keyH] = levels[keyH] ? { level: roundedHigh, touches: levels[keyH].touches + 1 } : { level: roundedHigh, touches: 1 };
    levels[keyL] = levels[keyL] ? { level: roundedLow, touches: levels[keyL].touches + 1 } : { level: roundedLow, touches: 1 };
  }

  const lastClose = recent[recent.length - 1]?.close ?? 0;
  const allLevels = Object.values(levels).sort((a, b) => b.touches - a.touches).slice(0, 20);

  const resistances = allLevels
    .filter((l) => l.level > lastClose)
    .sort((a, b) => a.level - b.level)
    .slice(0, 5)
    .map((l) => ({ level: l.level, strength: Math.min(100, l.touches * 20), touches: l.touches }));

  const supports = allLevels
    .filter((l) => l.level < lastClose)
    .sort((a, b) => b.level - a.level)
    .slice(0, 5)
    .map((l) => ({ level: l.level, strength: Math.min(100, l.touches * 20), touches: l.touches }));

  const high = Math.max(...recent.slice(-1).map((k) => k.high));
  const low = Math.min(...recent.slice(-1).map((k) => k.low));
  const close = lastClose;
  const pp = (high + low + close) / 3;

  return {
    supports,
    resistances,
    pivotPoint: parseFloat(pp.toFixed(6)),
    r1: parseFloat((2 * pp - low).toFixed(6)),
    r2: parseFloat((pp + (high - low)).toFixed(6)),
    s1: parseFloat((2 * pp - high).toFixed(6)),
    s2: parseFloat((pp - (high - low)).toFixed(6)),
  };
}

export function calcFullIndicators(klines: Kline[]): FullIndicators {
  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);
  const last = closes[closes.length - 1] ?? 0;

  const rsi = calcRSI(closes);
  const rsiSignal: FullIndicators["rsiSignal"] = rsi >= 70 ? "OVERBOUGHT" : rsi <= 30 ? "OVERSOLD" : "NEUTRAL";

  const macd = calcMACD(closes);
  const bollinger = calcBollinger(closes);
  const atr = calcATR(klines);
  const atrPercent = last > 0 ? parseFloat(((atr / last) * 100).toFixed(2)) : 0;
  const vwap = calcVWAP(klines);
  const priceVsVwap: FullIndicators["priceVsVwap"] = last >= vwap ? "ABOVE" : "BELOW";

  const ema20v = klines.length >= 20 ? ema(closes.slice(-20), 20) : last;
  const ema50v = klines.length >= 50 ? ema(closes.slice(-50), 50) : last;
  const ema200v = klines.length >= 200 ? ema(closes.slice(-200), 200) : last;

  let trendDirection: FullIndicators["trendDirection"] = "FLAT";
  if (last > ema20v && ema20v > ema50v && ema50v > ema200v) trendDirection = "STRONG_UP";
  else if (last > ema20v && ema20v > ema50v) trendDirection = "UP";
  else if (last < ema20v && ema20v < ema50v && ema50v < ema200v) trendDirection = "STRONG_DOWN";
  else if (last < ema20v && ema20v < ema50v) trendDirection = "DOWN";

  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const lastVol = volumes[volumes.length - 1] ?? 0;
  const volRatio = avgVolume > 0 ? lastVol / avgVolume : 1;
  const volSignal: "HIGH" | "NORMAL" | "LOW" = volRatio > 1.5 ? "HIGH" : volRatio < 0.5 ? "LOW" : "NORMAL";
  const recentVols = volumes.slice(-10);
  const firstHalf = recentVols.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const secondHalf = recentVols.slice(5).reduce((a, b) => a + b, 0) / 5;
  const volTrend: "INCREASING" | "DECREASING" | "STABLE" = secondHalf > firstHalf * 1.1 ? "INCREASING" : secondHalf < firstHalf * 0.9 ? "DECREASING" : "STABLE";

  const volatilityLevel: "HIGH" | "NORMAL" | "LOW" = atrPercent > 3 ? "HIGH" : atrPercent < 0.5 ? "LOW" : "NORMAL";
  let volRegime: "TRENDING" | "RANGING" | "BREAKOUT" = "RANGING";
  if (bollinger.squeeze && volSignal === "HIGH") volRegime = "BREAKOUT";
  else if (trendDirection === "STRONG_UP" || trendDirection === "STRONG_DOWN") volRegime = "TRENDING";

  let sentimentScore = 50;
  if (trendDirection === "STRONG_UP") sentimentScore += 20;
  else if (trendDirection === "UP") sentimentScore += 10;
  else if (trendDirection === "DOWN") sentimentScore -= 10;
  else if (trendDirection === "STRONG_DOWN") sentimentScore -= 20;
  if (rsi > 60) sentimentScore += 10;
  else if (rsi < 40) sentimentScore -= 10;
  if (macd.trend === "BULLISH") sentimentScore += 10;
  else if (macd.trend === "BEARISH") sentimentScore -= 10;
  if (priceVsVwap === "ABOVE") sentimentScore += 5;
  else sentimentScore -= 5;
  sentimentScore = Math.max(0, Math.min(100, sentimentScore));

  let sentimentLabel: FullIndicators["sentimentAnalysis"]["label"] = "NEUTRAL";
  if (sentimentScore >= 80) sentimentLabel = "VERY_BULLISH";
  else if (sentimentScore >= 60) sentimentLabel = "BULLISH";
  else if (sentimentScore <= 20) sentimentLabel = "VERY_BEARISH";
  else if (sentimentScore <= 40) sentimentLabel = "BEARISH";

  const priceStrength = parseFloat(((last - ema200v) / ema200v * 100).toFixed(2));
  const volumeConfirmation = volSignal === "HIGH" && (trendDirection === "STRONG_UP" || trendDirection === "UP");

  const smartMoney = detectSmartMoney(klines);
  const supportResistance = calcSupportResistance(klines);

  let signalScore = 0;
  if (rsiSignal === "OVERSOLD") signalScore += 20;
  else if (rsiSignal === "OVERBOUGHT") signalScore -= 20;
  if (macd.trend === "BULLISH") signalScore += 20;
  else if (macd.trend === "BEARISH") signalScore -= 20;
  if (trendDirection === "STRONG_UP") signalScore += 25;
  else if (trendDirection === "UP") signalScore += 15;
  else if (trendDirection === "DOWN") signalScore -= 15;
  else if (trendDirection === "STRONG_DOWN") signalScore -= 25;
  if (bollinger.position === "LOWER") signalScore += 10;
  else if (bollinger.position === "UPPER") signalScore -= 10;
  if (priceVsVwap === "ABOVE") signalScore += 10;
  else signalScore -= 10;
  if (smartMoney.imbalance === "BULLISH") signalScore += 10;
  else if (smartMoney.imbalance === "BEARISH") signalScore -= 10;
  if (volumeConfirmation) signalScore += 5;

  let overallSignal: FullIndicators["overallSignal"] = "HOLD";
  if (signalScore >= 60) overallSignal = "STRONG_BUY";
  else if (signalScore >= 25) overallSignal = "BUY";
  else if (signalScore <= -60) overallSignal = "STRONG_SELL";
  else if (signalScore <= -25) overallSignal = "SELL";

  return {
    rsi,
    rsiSignal,
    macd,
    bollinger,
    atr,
    atrPercent,
    vwap,
    priceVsVwap,
    ema20: parseFloat(ema20v.toFixed(6)),
    ema50: parseFloat(ema50v.toFixed(6)),
    ema200: parseFloat(ema200v.toFixed(6)),
    trendDirection,
    volumeAnalysis: { current: lastVol, average: parseFloat(avgVolume.toFixed(2)), ratio: parseFloat(volRatio.toFixed(2)), signal: volSignal, trend: volTrend },
    volatilityAnalysis: { atr, atrPercent, level: volatilityLevel, bbWidth: bollinger.bandwidth, regime: volRegime },
    sentimentAnalysis: { score: sentimentScore, label: sentimentLabel, priceStrength, volumeConfirmation },
    smartMoney,
    supportResistance,
    overallSignal,
    signalScore,
  };
}
