/**
 * MT5 Bridge Integration Layer
 * Handles MetaTrader 5 connections, forex data, and execution
 * Supports multiple brokers and market types (Forex, Indices, Commodities)
 */

interface MT5Config {
  broker: string;
  account: string;
  password: string;
  server: string;
}

interface ForexPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  time: string;
}

interface ForexMarketData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  volatility: number;
  session: string;
  trend: string;
  liquidityZone: { level: number; strength: string };
}

interface MT5Order {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  stopLoss: number;
  takeProfit: number;
  status: "OPEN" | "CLOSED" | "PENDING";
  openTime: string;
  pnl?: number;
}

interface ForexRiskConfig {
  maxLeverage: number;
  maxDrawdown: number;
  maxRiskPerTrade: number;
  maxLotSize: number;
  stopLossEnforced: boolean;
}

// ─── MT5 Connection Manager ───────────────────────────────────────────────────
class MT5ConnectionManager {
  private config: MT5Config | null = null;
  private connected = false;
  private orders: MT5Order[] = [];
  private paperBalance = 10000;

  constructor() {
    this.config = null;
  }

  /**
   * Initialize MT5 connection (simulated for now, would use REST API bridge in production)
   */
  async connect(broker: string, account: string, password: string, server: string): Promise<boolean> {
    try {
      this.config = { broker, account, password, server };
      // In production, this would connect to an actual MT5 REST API bridge
      // For now, we simulate the connection
      this.connected = true;
      console.log(`[MT5] Connected to ${broker} - Account: ${account}`);
      return true;
    } catch (error) {
      console.error("[MT5] Connection failed:", error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get account info from MT5
   */
  async getAccountInfo(): Promise<any> {
    if (!this.connected) return null;
    return {
      balance: this.paperBalance,
      equity: this.paperBalance,
      freeMargin: this.paperBalance * 0.8,
      usedMargin: this.paperBalance * 0.2,
      leverage: 1,
      currency: "USD",
    };
  }

  /**
   * Get open positions from MT5
   */
  async getPositions(): Promise<MT5Order[]> {
    return this.orders.filter((o) => o.status === "OPEN");
  }

  /**
   * Execute order on MT5
   */
  async executeOrder(symbol: string, type: "BUY" | "SELL", volume: number, stopLoss: number, takeProfit: number): Promise<MT5Order | null> {
    if (!this.connected) return null;

    const order: MT5Order = {
      id: `MT5-${Date.now()}`,
      symbol,
      type,
      volume,
      openPrice: 0, // Would be fetched from MT5
      stopLoss,
      takeProfit,
      status: "OPEN",
      openTime: new Date().toISOString(),
    };

    this.orders.push(order);
    return order;
  }

  /**
   * Close position
   */
  async closePosition(orderId: string): Promise<boolean> {
    const order = this.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = "CLOSED";
      return true;
    }
    return false;
  }

  /**
   * Get order history
   */
  getOrderHistory(limit: number = 50): MT5Order[] {
    return this.orders.slice(-limit);
  }
}

// ─── Forex Data Provider ──────────────────────────────────────────────────────
class ForexDataProvider {
  private twelveDataKey: string;

  constructor(apiKey: string) {
    this.twelveDataKey = apiKey;
  }

  /**
   * Fetch forex pair data from TwelveData
   */
  async getForexPrice(symbol: string): Promise<ForexPrice | null> {
    try {
      const response = await fetch(`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${this.twelveDataKey}`);
      if (!response.ok) return null;

      const data = (await response.json()) as any;
      const bid = parseFloat(data.bid || data.close);
      const ask = parseFloat(data.ask || data.close);
      const spread = ask - bid;

      return {
        symbol,
        bid,
        ask,
        spread,
        time: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[ForexData] Failed to fetch ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get multiple forex pairs
   */
  async getMultipleForexPrices(symbols: string[]): Promise<Record<string, ForexPrice | null>> {
    const results = await Promise.all(symbols.map((s) => this.getForexPrice(s)));
    const data: Record<string, ForexPrice | null> = {};
    symbols.forEach((s, i) => {
      data[s] = results[i];
    });
    return data;
  }

  /**
   * Get forex market data with technical analysis
   */
  async getForexMarketData(symbol: string): Promise<ForexMarketData | null> {
    const priceData = await this.getForexPrice(symbol);
    if (!priceData) return null;

    // Determine market session
    const hour = new Date().getUTCHours();
    let session = "ASIAN";
    if (hour >= 8 && hour < 16) session = "EUROPEAN";
    if (hour >= 13 && hour < 21) session = "AMERICAN";

    // Estimate volatility (would use real ATR in production)
    const volatility = priceData.spread * 100;

    // Determine trend (would use real technical analysis)
    const trend = Math.random() > 0.5 ? "BULLISH" : "BEARISH";

    // Identify liquidity zones (would use real support/resistance)
    const liquidityZone = {
      level: priceData.bid,
      strength: "MEDIUM",
    };

    return {
      symbol,
      bid: priceData.bid,
      ask: priceData.ask,
      spread: priceData.spread,
      volatility,
      session,
      trend,
      liquidityZone,
    };
  }

  /**
   * Get multiple forex pairs with market data
   */
  async getMultipleForexMarketData(symbols: string[]): Promise<Record<string, ForexMarketData | null>> {
    const results = await Promise.all(symbols.map((s) => this.getForexMarketData(s)));
    const data: Record<string, ForexMarketData | null> = {};
    symbols.forEach((s, i) => {
      data[s] = results[i];
    });
    return data;
  }
}

// ─── Forex Risk Engine ────────────────────────────────────────────────────────
class ForexRiskEngine {
  private config: ForexRiskConfig;
  private trades: MT5Order[] = [];

  constructor(config: Partial<ForexRiskConfig> = {}) {
    this.config = {
      maxLeverage: config.maxLeverage ?? 10,
      maxDrawdown: config.maxDrawdown ?? 20,
      maxRiskPerTrade: config.maxRiskPerTrade ?? 2,
      maxLotSize: config.maxLotSize ?? 10,
      stopLossEnforced: config.stopLossEnforced ?? true,
    };
  }

  /**
   * Validate trade against risk parameters
   */
  validateTrade(symbol: string, volume: number, stopLoss: number, takeProfit: number, currentPrice: number): { valid: boolean; reason?: string } {
    // Check lot size
    if (volume > this.config.maxLotSize) {
      return { valid: false, reason: `Lot size ${volume} exceeds maximum ${this.config.maxLotSize}` };
    }

    // Check stop loss enforcement
    if (this.config.stopLossEnforced && !stopLoss) {
      return { valid: false, reason: "Stop loss is required" };
    }

    // Check risk/reward ratio
    const riskPoints = Math.abs(currentPrice - stopLoss);
    const rewardPoints = Math.abs(takeProfit - currentPrice);
    if (rewardPoints < riskPoints) {
      return { valid: false, reason: `Risk/Reward ratio unfavorable: ${(rewardPoints / riskPoints).toFixed(2)}:1` };
    }

    return { valid: true };
  }

  /**
   * Calculate position size based on risk
   */
  calculatePositionSize(accountBalance: number, riskAmount: number, stopLossPoints: number): number {
    if (stopLossPoints === 0) return 0;
    const positionSize = riskAmount / stopLossPoints;
    return Math.min(positionSize, this.config.maxLotSize);
  }

  /**
   * Check drawdown limit
   */
  checkDrawdownLimit(currentBalance: number, startingBalance: number): boolean {
    const drawdown = ((startingBalance - currentBalance) / startingBalance) * 100;
    return drawdown <= this.config.maxDrawdown;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ForexRiskConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ForexRiskConfig {
    return this.config;
  }
}

// ─── Forex Analysis Engine ────────────────────────────────────────────────────
class ForexAnalysisEngine {
  /**
   * Analyze forex structure (support/resistance, liquidity zones)
   */
  analyzeStructure(symbol: string, prices: number[]): { support: number; resistance: number; pivotPoint: number } {
    if (prices.length === 0) {
      return { support: 0, resistance: 0, pivotPoint: 0 };
    }

    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const close = prices[prices.length - 1];

    const pivotPoint = (high + low + close) / 3;
    const resistance = 2 * pivotPoint - low;
    const support = 2 * pivotPoint - high;

    return { support, resistance, pivotPoint };
  }

  /**
   * Detect session behavior
   */
  detectSessionBehavior(hour: number): string {
    if (hour >= 0 && hour < 8) return "ASIAN_QUIET";
    if (hour >= 8 && hour < 12) return "ASIAN_ACTIVE";
    if (hour >= 12 && hour < 16) return "EUROPEAN_OVERLAP";
    if (hour >= 16 && hour < 20) return "AMERICAN_ACTIVE";
    return "AMERICAN_QUIET";
  }

  /**
   * Analyze macro news impact (would integrate with news API)
   */
  analyzeMacroImpact(newsItems: any[]): { sentiment: string; impactLevel: string } {
    // Placeholder for macro news analysis
    return { sentiment: "NEUTRAL", impactLevel: "LOW" };
  }

  /**
   * Identify institutional flow
   */
  identifyInstitutionalFlow(volume: number, avgVolume: number): string {
    const ratio = volume / avgVolume;
    if (ratio > 1.5) return "ACCUMULATION";
    if (ratio < 0.5) return "DISTRIBUTION";
    return "NEUTRAL";
  }
}

// ─── Export instances ─────────────────────────────────────────────────────────
export const mt5Manager = new MT5ConnectionManager();
export const forexDataProvider = new ForexDataProvider(process.env.TWELVEDATA_API_KEY || "");
export const forexRiskEngine = new ForexRiskEngine();
export const forexAnalysisEngine = new ForexAnalysisEngine();

export { MT5ConnectionManager, ForexDataProvider, ForexRiskEngine, ForexAnalysisEngine };
export type { MT5Config, ForexPrice, ForexMarketData, MT5Order, ForexRiskConfig };
