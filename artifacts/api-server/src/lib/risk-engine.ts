/**
 * TradeMind Institutional Risk Engine
 * Protects capital at all times — drawdown tracking, volatility guards,
 * emergency kill switch, audit logging, and real-time risk scoring.
 */

import { db } from "@workspace/db";
import { riskLogsTable } from "@workspace/db";
import { logger } from "./logger";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DrawdownState {
  peakBalance: number;
  currentBalance: number;
  currentDrawdown: number;
  currentDrawdownPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  unrealizedLoss: number;
  realizedLoss: number;
}

export interface VolatilityState {
  atr: number;
  atrPercent: number;
  volatilityLevel: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  spreadExpansion: boolean;
  positionSizeMultiplier: number;
  aiPaused: boolean;
}

export interface RiskEngineConfig {
  maxDailyLossPercent: number;
  maxDrawdownPercent: number;
  maxLeverage: number;
  maxPositionSizePercent: number;
  maxOpenPositions: number;
  maxDailyTrades: number;
  cooldownMinutes: number;
  consecutiveLossesForCooldown: number;
  volatilityPauseAtrMultiple: number;
  riskRewardMinRatio: number;
  emergencyStopActive: boolean;
}

export interface RiskScore {
  overall: number;
  riskLevel: RiskLevel;
  confidence: number;
  volatility: number;
  probability: number;
  label: string;
  breakdown: {
    marketRisk: number;
    positionRisk: number;
    portfolioRisk: number;
    volatilityRisk: number;
  };
  warnings: string[];
  recommendation: "PROCEED" | "REDUCE_SIZE" | "SKIP" | "EMERGENCY_STOP";
}

export interface DailyState {
  date: string;
  startBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  consecutiveLosses: number;
  cooldownUntil: Date | null;
  peakIntraday: number;
}

const DEFAULT_CONFIG: RiskEngineConfig = {
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 15,
  maxLeverage: 10,
  maxPositionSizePercent: 10,
  maxOpenPositions: 5,
  maxDailyTrades: 20,
  cooldownMinutes: 60,
  consecutiveLossesForCooldown: 3,
  volatilityPauseAtrMultiple: 3,
  riskRewardMinRatio: 1.5,
  emergencyStopActive: false,
};

class RiskEngineService {
  private config: RiskEngineConfig = { ...DEFAULT_CONFIG };
  private drawdown: DrawdownState = this.freshDrawdown(10000);
  private daily: DailyState = this.freshDay(10000);
  private volatility: VolatilityState = this.neutralVolatility();
  private killSwitchActive = false;
  private killSwitchReason = "";

  private freshDrawdown(balance: number): DrawdownState {
    return {
      peakBalance: balance,
      currentBalance: balance,
      currentDrawdown: 0,
      currentDrawdownPct: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      unrealizedLoss: 0,
      realizedLoss: 0,
    };
  }

  private freshDay(balance: number): DailyState {
    return {
      date: new Date().toISOString().slice(0, 10),
      startBalance: balance,
      realizedPnl: 0,
      unrealizedPnl: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      consecutiveLosses: 0,
      cooldownUntil: null,
      peakIntraday: balance,
    };
  }

  private neutralVolatility(): VolatilityState {
    return {
      atr: 0,
      atrPercent: 0,
      volatilityLevel: "NORMAL",
      spreadExpansion: false,
      positionSizeMultiplier: 1,
      aiPaused: false,
    };
  }

  private ensureToday(balance: number) {
    const today = new Date().toISOString().slice(0, 10);
    if (this.daily.date !== today) {
      this.daily = this.freshDay(balance);
      this.drawdown.peakBalance = Math.max(this.drawdown.peakBalance, balance);
    }
  }

  // ─── CONFIG ───────────────────────────────────────────────────────────────

  updateConfig(partial: Partial<RiskEngineConfig>): RiskEngineConfig {
    this.config = { ...this.config, ...partial };
    return { ...this.config };
  }

  getConfig(): RiskEngineConfig {
    return { ...this.config };
  }

  // ─── EMERGENCY KILL SWITCH ────────────────────────────────────────────────

  activateKillSwitch(reason: string, userId?: string): void {
    this.killSwitchActive = true;
    this.killSwitchReason = reason;
    this.config.emergencyStopActive = true;
    logger.warn({ reason, userId }, "EMERGENCY KILL SWITCH ACTIVATED");

    if (userId) {
      void this.logRiskEvent(userId, "KILL_SWITCH_ACTIVATED", "critical",
        "Emergency Kill Switch Activated",
        `All trading halted. Reason: ${reason}`, { reason });
    }
  }

  deactivateKillSwitch(userId?: string): void {
    this.killSwitchActive = false;
    this.killSwitchReason = "";
    this.config.emergencyStopActive = false;
    logger.info({ userId }, "Kill switch deactivated — trading resumed");

    if (userId) {
      void this.logRiskEvent(userId, "KILL_SWITCH_DEACTIVATED", "info",
        "Kill Switch Deactivated", "Trading has been resumed");
    }
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive || this.config.emergencyStopActive;
  }

  getKillSwitchReason(): string {
    return this.killSwitchReason;
  }

  // ─── DRAWDOWN TRACKING ────────────────────────────────────────────────────

  updateEquity(balance: number, unrealizedPnl: number, userId?: string): DrawdownState {
    this.ensureToday(balance);

    const equity = balance + unrealizedPnl;
    this.drawdown.currentBalance = equity;
    this.drawdown.unrealizedLoss = Math.min(0, unrealizedPnl);

    if (equity > this.drawdown.peakBalance) {
      this.drawdown.peakBalance = equity;
    }
    if (equity > this.daily.peakIntraday) {
      this.daily.peakIntraday = equity;
    }

    this.drawdown.currentDrawdown = this.drawdown.peakBalance - equity;
    this.drawdown.currentDrawdownPct = (this.drawdown.currentDrawdown / this.drawdown.peakBalance) * 100;

    if (this.drawdown.currentDrawdown > this.drawdown.maxDrawdown) {
      this.drawdown.maxDrawdown = this.drawdown.currentDrawdown;
      this.drawdown.maxDrawdownPct = this.drawdown.currentDrawdownPct;
    }

    if (this.drawdown.currentDrawdownPct >= this.config.maxDrawdownPercent && userId) {
      this.activateKillSwitch(`Max drawdown ${this.drawdown.currentDrawdownPct.toFixed(2)}% exceeded limit ${this.config.maxDrawdownPercent}%`, userId);
    }

    return { ...this.drawdown };
  }

  getDrawdown(): DrawdownState {
    return { ...this.drawdown };
  }

  // ─── VOLATILITY PROTECTION ────────────────────────────────────────────────

  updateVolatility(atr: number, price: number, spreadExpansion = false): VolatilityState {
    const atrPct = (atr / price) * 100;
    this.volatility.atr = atr;
    this.volatility.atrPercent = atrPct;
    this.volatility.spreadExpansion = spreadExpansion;

    let level: VolatilityState["volatilityLevel"] = "NORMAL";
    let sizeMultiplier = 1;
    let aiPaused = false;

    if (atrPct < 0.5) { level = "LOW"; sizeMultiplier = 1.1; }
    else if (atrPct < 1.5) { level = "NORMAL"; sizeMultiplier = 1; }
    else if (atrPct < 3) { level = "HIGH"; sizeMultiplier = 0.6; }
    else { level = "EXTREME"; sizeMultiplier = 0.3; aiPaused = true; }

    if (spreadExpansion) { sizeMultiplier *= 0.5; aiPaused = true; }
    if (atrPct >= this.config.volatilityPauseAtrMultiple) { aiPaused = true; }

    this.volatility = { atr, atrPercent: atrPct, volatilityLevel: level, spreadExpansion, positionSizeMultiplier: sizeMultiplier, aiPaused };
    return { ...this.volatility };
  }

  getVolatility(): VolatilityState {
    return { ...this.volatility };
  }

  // ─── COOLDOWN MANAGEMENT ─────────────────────────────────────────────────

  isInCooldown(): boolean {
    return this.daily.cooldownUntil ? new Date() < this.daily.cooldownUntil : false;
  }

  getCooldownMinutesLeft(): number {
    if (!this.daily.cooldownUntil) return 0;
    return Math.max(0, Math.ceil((this.daily.cooldownUntil.getTime() - Date.now()) / 60000));
  }

  // ─── TRADE VALIDATION ─────────────────────────────────────────────────────

  canTrade(balance: number, tradeValue = 0, openPositions = 0): { allowed: boolean; reason?: string } {
    this.ensureToday(balance);

    if (this.isKillSwitchActive()) {
      return { allowed: false, reason: `KILL SWITCH ACTIVE: ${this.killSwitchReason || "Emergency stop engaged"}` };
    }

    if (this.isInCooldown()) {
      return { allowed: false, reason: `COOLDOWN: ${this.getCooldownMinutesLeft()} min remaining after ${this.config.consecutiveLossesForCooldown} consecutive losses` };
    }

    const dailyLossPct = Math.abs(Math.min(0, this.daily.realizedPnl)) / this.daily.startBalance * 100;
    if (dailyLossPct >= this.config.maxDailyLossPercent) {
      return { allowed: false, reason: `MAX DAILY LOSS: ${dailyLossPct.toFixed(2)}% of ${this.config.maxDailyLossPercent}% limit reached` };
    }

    if (this.daily.tradeCount >= this.config.maxDailyTrades) {
      return { allowed: false, reason: `MAX DAILY TRADES: ${this.daily.tradeCount}/${this.config.maxDailyTrades} reached` };
    }

    if (openPositions >= this.config.maxOpenPositions) {
      return { allowed: false, reason: `MAX OPEN POSITIONS: ${openPositions}/${this.config.maxOpenPositions}` };
    }

    if (tradeValue > 0) {
      const sizePct = (tradeValue / balance) * 100;
      if (sizePct > this.config.maxPositionSizePercent) {
        return { allowed: false, reason: `POSITION SIZE: ${sizePct.toFixed(1)}% exceeds max ${this.config.maxPositionSizePercent}%` };
      }
    }

    if (this.volatility.aiPaused) {
      return { allowed: false, reason: `VOLATILITY PROTECTION: Market too volatile (ATR ${this.volatility.atrPercent.toFixed(2)}%) — AI entries paused` };
    }

    if (this.drawdown.currentDrawdownPct >= this.config.maxDrawdownPercent * 0.8) {
      return { allowed: false, reason: `DRAWDOWN WARNING: ${this.drawdown.currentDrawdownPct.toFixed(2)}% approaching limit ${this.config.maxDrawdownPercent}%` };
    }

    return { allowed: true };
  }

  // ─── RISK SCORING ─────────────────────────────────────────────────────────

  scoreRisk(params: {
    balance: number;
    tradeValue: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage: number;
    symbol: string;
    openPositionsCount: number;
    existingExposure?: number;
  }): RiskScore {
    const { balance, tradeValue, entryPrice, stopLoss, takeProfit, leverage, openPositionsCount, existingExposure = 0 } = params;
    const warnings: string[] = [];

    const positionSizePct = (tradeValue / balance) * 100;
    const positionRisk = Math.min(100, (positionSizePct / this.config.maxPositionSizePercent) * 50);

    const leverageRisk = Math.min(100, (leverage / this.config.maxLeverage) * 60);
    if (leverage > this.config.maxLeverage * 0.8) warnings.push(`High leverage: ${leverage}x`);

    const portfolioRisk = Math.min(100, ((openPositionsCount / this.config.maxOpenPositions) * 30) + (existingExposure / balance) * 20);
    if (openPositionsCount >= this.config.maxOpenPositions - 1) warnings.push("Near max open positions");

    let rrRatio = 0;
    if (stopLoss && takeProfit && entryPrice) {
      const risk = Math.abs(entryPrice - stopLoss);
      const reward = Math.abs(takeProfit - entryPrice);
      rrRatio = risk > 0 ? reward / risk : 0;
      if (rrRatio < this.config.riskRewardMinRatio) {
        warnings.push(`R:R ratio ${rrRatio.toFixed(2)} below minimum ${this.config.riskRewardMinRatio}`);
      }
    } else {
      warnings.push("No stop loss defined — capital unprotected");
    }

    const volLevel = this.volatility.volatilityLevel;
    const volatilityRisk = volLevel === "EXTREME" ? 90 : volLevel === "HIGH" ? 65 : volLevel === "LOW" ? 15 : 30;
    if (volLevel === "HIGH" || volLevel === "EXTREME") warnings.push(`${volLevel} market volatility`);

    const marketRisk = Math.min(100, leverageRisk * 0.6 + (rrRatio < 1.5 ? 40 : 10));

    const overall = Math.min(100, Math.round(
      positionRisk * 0.3 + marketRisk * 0.25 + portfolioRisk * 0.2 + volatilityRisk * 0.25
    ));

    let riskLevel: RiskLevel;
    let label: string;
    let recommendation: RiskScore["recommendation"];

    if (overall < 25) { riskLevel = "LOW"; label = "LOW RISK"; recommendation = "PROCEED"; }
    else if (overall < 50) { riskLevel = "MEDIUM"; label = "MEDIUM RISK"; recommendation = "PROCEED"; }
    else if (overall < 75) { riskLevel = "HIGH"; label = "HIGH RISK"; recommendation = "REDUCE_SIZE"; }
    else { riskLevel = "CRITICAL"; label = "CRITICAL RISK"; recommendation = "SKIP"; }

    if (this.isKillSwitchActive()) recommendation = "EMERGENCY_STOP";

    const dailyLossPct = Math.abs(Math.min(0, this.daily.realizedPnl)) / this.daily.startBalance * 100;
    const confidence = Math.max(0, Math.min(100, Math.round(
      100 - overall * 0.5 - (dailyLossPct / this.config.maxDailyLossPercent) * 20 - (this.daily.consecutiveLosses * 5)
    )));

    const volatility = Math.round(volatilityRisk);
    const probability = Math.max(0, Math.min(100, Math.round(
      70 - overall * 0.3 + (rrRatio >= 2 ? 15 : 0) - (warnings.length * 5)
    )));

    return {
      overall,
      riskLevel,
      confidence,
      volatility,
      probability,
      label,
      breakdown: { marketRisk: Math.round(marketRisk), positionRisk: Math.round(positionRisk), portfolioRisk: Math.round(portfolioRisk), volatilityRisk: Math.round(volatilityRisk) },
      warnings,
      recommendation,
    };
  }

  // ─── TRADE RECORDING ──────────────────────────────────────────────────────

  recordTradeOpen(balance: number): void {
    this.ensureToday(balance);
    this.daily.tradeCount++;
  }

  recordTradeClose(pnl: number, balance: number, userId?: string): void {
    this.ensureToday(balance);
    this.daily.realizedPnl += pnl;
    this.drawdown.realizedLoss += Math.min(0, pnl);

    if (pnl >= 0) {
      this.daily.winCount++;
      this.daily.consecutiveLosses = 0;
    } else {
      this.daily.lossCount++;
      this.daily.consecutiveLosses++;

      if (this.daily.consecutiveLosses >= this.config.consecutiveLossesForCooldown) {
        this.daily.cooldownUntil = new Date(Date.now() + this.config.cooldownMinutes * 60000);
        logger.warn({ consecutiveLosses: this.daily.consecutiveLosses, userId }, "Cooldown period started");

        if (userId) {
          void this.logRiskEvent(userId, "COOLDOWN_STARTED", "warning",
            "Trading Cooldown Activated",
            `${this.daily.consecutiveLosses} consecutive losses — ${this.config.cooldownMinutes} min cooldown`,
            { consecutiveLosses: this.daily.consecutiveLosses });
        }
      }

      const dailyLossPct = Math.abs(this.daily.realizedPnl) / this.daily.startBalance * 100;
      if (dailyLossPct >= this.config.maxDailyLossPercent && userId) {
        void this.logRiskEvent(userId, "DAILY_LOSS_LIMIT", "critical",
          "Daily Loss Limit Reached",
          `Daily loss ${dailyLossPct.toFixed(2)}% hit limit ${this.config.maxDailyLossPercent}%`,
          { dailyLossPct, limit: this.config.maxDailyLossPercent });
      }
    }
  }

  // ─── AUDIT LOG ────────────────────────────────────────────────────────────

  async logRiskEvent(
    userId: string,
    eventType: string,
    severity: string,
    title: string,
    message: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await db.insert(riskLogsTable).values({ userId, eventType, severity, title, message, metadata });
    } catch (err) {
      logger.error({ err }, "Failed to write risk log");
    }
  }

  // ─── FULL STATUS ─────────────────────────────────────────────────────────

  getStatus(balance: number) {
    this.ensureToday(balance);
    const dailyLossPct = Math.abs(Math.min(0, this.daily.realizedPnl)) / this.daily.startBalance * 100;
    const tradeAllowed = this.canTrade(balance);

    return {
      killSwitch: { active: this.isKillSwitchActive(), reason: this.killSwitchReason },
      canTrade: tradeAllowed,
      daily: {
        ...this.daily,
        dailyLossPct: parseFloat(dailyLossPct.toFixed(2)),
        dailyLossRemaining: parseFloat((this.config.maxDailyLossPercent - dailyLossPct).toFixed(2)),
        tradesRemaining: this.config.maxDailyTrades - this.daily.tradeCount,
      },
      drawdown: this.drawdown,
      volatility: this.volatility,
      cooldown: {
        active: this.isInCooldown(),
        minutesRemaining: this.getCooldownMinutesLeft(),
        until: this.daily.cooldownUntil,
      },
      config: this.config,
      timestamp: new Date().toISOString(),
    };
  }
}

export const riskEngine = new RiskEngineService();
