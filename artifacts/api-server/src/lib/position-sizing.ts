/**
 * TradeMind Position Sizing Engine
 * ATR-based, volatility-adjusted lot sizing for all markets.
 * Capital preservation is always the primary objective.
 */

export type RiskProfile = "conservative" | "moderate" | "aggressive";

export interface PositionSizeResult {
  positionSize: number;
  notionalValue: number;
  riskAmount: number;
  riskPercent: number;
  stopLossPips: number;
  stopLossPercent: number;
  takeProfitTargets: { tp1: number; tp2: number; tp3: number };
  leverage: number;
  effectiveLeverage: number;
  portfolioExposurePct: number;
  atrMultiple: number;
  volatilityAdjusted: boolean;
  maxLossScenario: number;
  recommendation: string;
  warnings: string[];
}

const PROFILE_RISK: Record<RiskProfile, number> = {
  conservative: 0.5,
  moderate: 1,
  aggressive: 2,
};

export function calculatePositionSize(params: {
  balance: number;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice?: number;
  leverage?: number;
  riskPercent?: number;
  riskProfile?: RiskProfile;
  atr?: number;
  volatilityMultiplier?: number;
  maxPositionPct?: number;
  pipValue?: number;
  market?: "crypto" | "forex" | "stock";
}): PositionSizeResult {
  const {
    balance,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    leverage = 1,
    riskProfile = "moderate",
    atr,
    volatilityMultiplier = 1,
    maxPositionPct = 10,
    pipValue = 1,
    market = "crypto",
  } = params;

  const effectiveRiskPct = (params.riskPercent ?? PROFILE_RISK[riskProfile]) / volatilityMultiplier;
  const riskAmount = (effectiveRiskPct / 100) * balance;
  const warnings: string[] = [];

  const slDistance = Math.abs(entryPrice - stopLossPrice);
  const slPercent = (slDistance / entryPrice) * 100;

  if (slDistance === 0) {
    return {
      positionSize: 0, notionalValue: 0, riskAmount: 0, riskPercent: 0,
      stopLossPips: 0, stopLossPercent: 0,
      takeProfitTargets: { tp1: 0, tp2: 0, tp3: 0 },
      leverage, effectiveLeverage: 0, portfolioExposurePct: 0, atrMultiple: 0,
      volatilityAdjusted: false, maxLossScenario: 0,
      recommendation: "Invalid stop loss — same as entry",
      warnings: ["Stop loss distance is zero"],
    };
  }

  let baseSize = riskAmount / slDistance;

  if (atr && atr > 0) {
    const atrMultiple = slDistance / atr;
    if (atrMultiple < 0.5) {
      warnings.push(`Stop too tight: only ${atrMultiple.toFixed(2)}x ATR — high chance of stop-out`);
      baseSize *= 0.7;
    } else if (atrMultiple > 3) {
      warnings.push(`Stop very wide: ${atrMultiple.toFixed(2)}x ATR — consider tighter entry or splitting size`);
    }
  }

  const maxByPercent = (maxPositionPct / 100) * balance / entryPrice;
  const cappedSize = Math.min(baseSize, maxByPercent);
  if (baseSize > maxByPercent) {
    warnings.push(`Position size capped at ${maxPositionPct}% of account`);
  }

  const finalSize = parseFloat((cappedSize / leverage).toFixed(6));
  const notionalValue = finalSize * entryPrice * leverage;
  const effectiveLeverage = notionalValue / balance;
  const portfolioExposurePct = (notionalValue / balance) * 100;

  if (effectiveLeverage > 10) warnings.push(`Effective leverage ${effectiveLeverage.toFixed(1)}x is very high`);
  if (portfolioExposurePct > 25) warnings.push(`High portfolio exposure: ${portfolioExposurePct.toFixed(1)}%`);
  if (slPercent > 5) warnings.push(`Wide stop loss: ${slPercent.toFixed(2)}% from entry`);

  const slPips = market === "forex" ? slDistance * 10000 : slDistance;

  const rrRatio = takeProfitPrice ? Math.abs(takeProfitPrice - entryPrice) / slDistance : 2;
  const tpDistance = slDistance * rrRatio;
  const isLong = stopLossPrice < entryPrice;
  const tp1 = isLong ? entryPrice + tpDistance : entryPrice - tpDistance;
  const tp2 = isLong ? entryPrice + tpDistance * 2 : entryPrice - tpDistance * 2;
  const tp3 = takeProfitPrice ?? (isLong ? entryPrice + tpDistance * 3 : entryPrice - tpDistance * 3);

  const maxLossScenario = finalSize * slDistance * leverage;

  let recommendation = "PROCEED — position size within risk parameters";
  if (warnings.length >= 2) recommendation = "REDUCE SIZE — multiple risk warnings detected";
  if (portfolioExposurePct > 20) recommendation = "CAUTION — high portfolio exposure";
  if (effectiveLeverage > 10) recommendation = "REDUCE LEVERAGE — risk of significant loss";

  return {
    positionSize: finalSize,
    notionalValue: parseFloat(notionalValue.toFixed(2)),
    riskAmount: parseFloat(riskAmount.toFixed(2)),
    riskPercent: parseFloat(effectiveRiskPct.toFixed(3)),
    stopLossPips: parseFloat(slPips.toFixed(1)),
    stopLossPercent: parseFloat(slPercent.toFixed(3)),
    takeProfitTargets: {
      tp1: parseFloat(tp1.toFixed(market === "forex" ? 5 : 2)),
      tp2: parseFloat(tp2.toFixed(market === "forex" ? 5 : 2)),
      tp3: parseFloat(tp3.toFixed(market === "forex" ? 5 : 2)),
    },
    leverage,
    effectiveLeverage: parseFloat(effectiveLeverage.toFixed(2)),
    portfolioExposurePct: parseFloat(portfolioExposurePct.toFixed(2)),
    atrMultiple: atr ? parseFloat((slDistance / atr).toFixed(2)) : 0,
    volatilityAdjusted: volatilityMultiplier !== 1,
    maxLossScenario: parseFloat(maxLossScenario.toFixed(2)),
    recommendation,
    warnings,
  };
}

export function calculateOptimalLeverage(params: {
  balance: number;
  riskPercent: number;
  stopLossPercent: number;
  maxLeverage: number;
  riskProfile?: RiskProfile;
}): { optimalLeverage: number; explanation: string } {
  const { balance, riskPercent, stopLossPercent, maxLeverage, riskProfile = "moderate" } = params;
  const effectiveRisk = (riskPercent ?? PROFILE_RISK[riskProfile]);
  const optimalLeverage = Math.min(maxLeverage, effectiveRisk / stopLossPercent);
  const safeLevel = Math.max(1, Math.floor(optimalLeverage * 10) / 10);

  return {
    optimalLeverage: safeLevel,
    explanation: `With ${effectiveRisk}% risk on a $${balance.toFixed(0)} account and ${stopLossPercent}% SL, safe leverage is ${safeLevel}x (max: ${maxLeverage}x)`,
  };
}

export function getVolatilityAdjustedSize(baseSize: number, atrPercent: number): {
  adjustedSize: number;
  multiplier: number;
  explanation: string;
} {
  let multiplier = 1;
  let explanation = "No volatility adjustment";

  if (atrPercent < 0.5) { multiplier = 1.1; explanation = "Low volatility — slight size increase"; }
  else if (atrPercent < 1.5) { multiplier = 1.0; explanation = "Normal volatility — no adjustment"; }
  else if (atrPercent < 2.5) { multiplier = 0.75; explanation = "Elevated volatility — 25% size reduction"; }
  else if (atrPercent < 4) { multiplier = 0.5; explanation = "High volatility — 50% size reduction"; }
  else { multiplier = 0.25; explanation = "Extreme volatility — 75% size reduction (capital preservation)"; }

  return { adjustedSize: parseFloat((baseSize * multiplier).toFixed(6)), multiplier, explanation };
}
