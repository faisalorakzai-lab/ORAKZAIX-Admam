/**
 * TradeMind Shared Risk Manager
 * Handles: daily loss limits, max trade size, emergency stop,
 * cooldown after losses, position sizing, loss protection
 */

export interface RiskConfig {
  maxDailyLossPercent: number;
  maxTradeSizePercent: number;
  maxDailyTrades: number;
  maxOpenPositions: number;
  consecutiveLossesForCooldown: number;
  cooldownMinutes: number;
  emergencyStopActive: boolean;
  riskRewardMinRatio: number;
  maxLeverageCrypto: number;
  maxLeverageForex: number;
}

export interface DailyStats {
  date: string;
  startBalance: number;
  realizedPnl: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  consecutiveLosses: number;
  cooldownUntil: Date | null;
  lastTradeTime: Date | null;
}

export interface TradeRecord {
  id: string;
  market: "crypto" | "forex";
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice?: number;
  qty: number;
  pnl?: number;
  timestamp: string;
  status: "OPEN" | "CLOSED";
}

const DEFAULT_CONFIG: RiskConfig = {
  maxDailyLossPercent: 5,
  maxTradeSizePercent: 10,
  maxDailyTrades: 20,
  maxOpenPositions: 5,
  consecutiveLossesForCooldown: 3,
  cooldownMinutes: 60,
  emergencyStopActive: false,
  riskRewardMinRatio: 1.5,
  maxLeverageCrypto: 5,
  maxLeverageForex: 30,
};

class RiskManager {
  private config: RiskConfig = { ...DEFAULT_CONFIG };
  private daily: DailyStats = this.freshDayStats(10000);
  private tradeLog: TradeRecord[] = [];

  private freshDayStats(balance: number): DailyStats {
    return {
      date: new Date().toISOString().split("T")[0],
      startBalance: balance,
      realizedPnl: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      consecutiveLosses: 0,
      cooldownUntil: null,
      lastTradeTime: null,
    };
  }

  private ensureTodayStats(currentBalance: number) {
    const today = new Date().toISOString().split("T")[0];
    if (this.daily.date !== today) {
      this.daily = this.freshDayStats(currentBalance);
    }
  }

  getConfig(): RiskConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<RiskConfig>): RiskConfig {
    this.config = { ...this.config, ...partial };
    return this.getConfig();
  }

  setEmergencyStop(active: boolean): void {
    this.config.emergencyStopActive = active;
  }

  isEmergencyStop(): boolean {
    return this.config.emergencyStopActive;
  }

  getDailyStats(currentBalance: number): DailyStats {
    this.ensureTodayStats(currentBalance);
    return { ...this.daily };
  }

  isInCooldown(): boolean {
    if (!this.daily.cooldownUntil) return false;
    return new Date() < this.daily.cooldownUntil;
  }

  getCooldownMinutesRemaining(): number {
    if (!this.daily.cooldownUntil) return 0;
    const diff = this.daily.cooldownUntil.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 60000));
  }

  validateTrade(params: {
    balance: number;
    tradeValue: number;
    openPositionsCount: number;
  }): { allowed: boolean; reason?: string } {
    const { balance, tradeValue, openPositionsCount } = params;
    this.ensureTodayStats(balance);

    if (this.config.emergencyStopActive) {
      return { allowed: false, reason: "EMERGENCY STOP is active — all trading halted" };
    }

    if (this.isInCooldown()) {
      return { allowed: false, reason: `Cooldown active — ${this.getCooldownMinutesRemaining()} min remaining after ${this.config.consecutiveLossesForCooldown} consecutive losses` };
    }

    const dailyLoss = Math.min(0, this.daily.realizedPnl);
    const dailyLossPct = Math.abs(dailyLoss) / this.daily.startBalance * 100;
    if (dailyLossPct >= this.config.maxDailyLossPercent) {
      return { allowed: false, reason: `Max daily loss limit reached: ${dailyLossPct.toFixed(2)}% / ${this.config.maxDailyLossPercent}%` };
    }

    if (this.daily.tradeCount >= this.config.maxDailyTrades) {
      return { allowed: false, reason: `Max daily trades reached: ${this.daily.tradeCount} / ${this.config.maxDailyTrades}` };
    }

    if (openPositionsCount >= this.config.maxOpenPositions) {
      return { allowed: false, reason: `Max open positions reached: ${openPositionsCount} / ${this.config.maxOpenPositions}` };
    }

    const tradeSizePct = (tradeValue / balance) * 100;
    if (tradeSizePct > this.config.maxTradeSizePercent) {
      return { allowed: false, reason: `Trade size ${tradeSizePct.toFixed(2)}% exceeds max ${this.config.maxTradeSizePercent}% of balance` };
    }

    return { allowed: true };
  }

  recordTradeOpen(trade: TradeRecord): void {
    this.ensureTodayStats(trade.entryPrice);
    this.tradeLog.push(trade);
    this.daily.tradeCount++;
    this.daily.lastTradeTime = new Date();
  }

  recordTradeClose(id: string, exitPrice: number, pnl: number): void {
    const trade = this.tradeLog.find((t) => t.id === id);
    if (trade) {
      trade.exitPrice = exitPrice;
      trade.pnl = pnl;
      trade.status = "CLOSED";
    }

    this.daily.realizedPnl += pnl;

    if (pnl >= 0) {
      this.daily.winCount++;
      this.daily.consecutiveLosses = 0;
    } else {
      this.daily.lossCount++;
      this.daily.consecutiveLosses++;
      if (this.daily.consecutiveLosses >= this.config.consecutiveLossesForCooldown) {
        this.daily.cooldownUntil = new Date(Date.now() + this.config.cooldownMinutes * 60000);
      }
    }
  }

  calculatePositionSize(params: {
    balance: number;
    riskPercent: number;
    entryPrice: number;
    stopLossPrice: number;
    pipValue?: number;
  }): {
    positionSize: number;
    riskAmount: number;
    stopLossPips: number;
    riskRewardInfo: string;
  } {
    const { balance, riskPercent, entryPrice, stopLossPrice, pipValue = 1 } = params;
    const riskAmount = (riskPercent / 100) * balance;
    const stopLossDiff = Math.abs(entryPrice - stopLossPrice);
    const stopLossPips = stopLossDiff / (pipValue || 1);
    const positionSize = stopLossDiff > 0 ? riskAmount / stopLossDiff : 0;

    const cappedByPercent = (this.config.maxTradeSizePercent / 100) * balance / entryPrice;
    const finalSize = Math.min(positionSize, cappedByPercent);

    return {
      positionSize: parseFloat(finalSize.toFixed(6)),
      riskAmount: parseFloat(riskAmount.toFixed(2)),
      stopLossPips: parseFloat(stopLossPips.toFixed(1)),
      riskRewardInfo: `Risking $${riskAmount.toFixed(2)} (${riskPercent}% of $${balance.toFixed(0)})`,
    };
  }

  getTradeLog(limit = 50): TradeRecord[] {
    return this.tradeLog.slice(-limit).reverse();
  }

  getStatus(currentBalance: number): {
    safe: boolean;
    emergencyStop: boolean;
    inCooldown: boolean;
    cooldownMinutesLeft: number;
    dailyLossPct: number;
    dailyTrades: number;
    consecutiveLosses: number;
    config: RiskConfig;
    daily: DailyStats;
  } {
    this.ensureTodayStats(currentBalance);
    const dailyLoss = Math.min(0, this.daily.realizedPnl);
    const dailyLossPct = parseFloat((Math.abs(dailyLoss) / this.daily.startBalance * 100).toFixed(2));

    return {
      safe: !this.config.emergencyStopActive && !this.isInCooldown() && dailyLossPct < this.config.maxDailyLossPercent,
      emergencyStop: this.config.emergencyStopActive,
      inCooldown: this.isInCooldown(),
      cooldownMinutesLeft: this.getCooldownMinutesRemaining(),
      dailyLossPct,
      dailyTrades: this.daily.tradeCount,
      consecutiveLosses: this.daily.consecutiveLosses,
      config: this.getConfig(),
      daily: this.getDailyStats(currentBalance),
    };
  }
}

export const riskManager = new RiskManager();
