import { useState, useEffect, useCallback, useRef } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Forex Types ──────────────────────────────────────────────────────────────

export interface ForexPrice {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  time: string;
}

export interface ForexMarketData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  volatility: number;
  session: string;
  trend: string;
  liquidityZone: { level: number; strength: string };
}

export interface ForexSignal {
  pair: string;
  signal: "LONG" | "SHORT" | "HOLD";
  confidence: number;
  reason: string;
}

export interface ForexAnalysisResult {
  pair: string;
  timeframe: string;
  signal: string;
  confidence: number;
  analysis: string;
  marketData: {
    bid: number;
    ask: number;
    spread: number;
    volatility: number;
    session: string;
  };
  timestamp: string;
}

export interface ForexOrder {
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

export interface ForexPosition {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  currentPrice: number;
  pnlPips: number;
  pnl: number;
  stopLoss: number;
  takeProfit: number;
  status: "OPEN" | "CLOSED";
  openTime: string;
}

export interface ForexRiskData {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  balance: number;
  totalExposure: number;
  unrealizedPnl: number;
  positions: number;
  maxDrawdown: number;
  drawdownExceeded: boolean;
  leverageRecommendation: string;
  riskConfig: {
    maxLeverage: number;
    maxDrawdown: number;
    maxRiskPerTrade: number;
    maxLotSize: number;
    stopLossEnforced: boolean;
  };
  timestamp: string;
}

// ─── Forex Prices Hook ────────────────────────────────────────────────────────

export function useForexPrices(market: "major" | "commodities" | "indices" | "all" = "major", refreshInterval = 15000) {
  const [data, setData] = useState<Record<string, ForexPrice | null> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/forex/prices?market=${market}`);
      if (!res.ok) throw new Error("Failed to fetch forex prices");
      const json = (await res.json()) as { prices: Record<string, ForexPrice | null> };
      setData(json.prices);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(id);
  }, [fetchPrices, refreshInterval]);

  return { data, loading, error, refetch: fetchPrices };
}

// ─── Forex Market Data Hook ───────────────────────────────────────────────────

export function useForexMarketData(symbols: string[] = ["EUR/USD", "GBP/USD", "USD/JPY"], refreshInterval = 15000) {
  const [data, setData] = useState<Record<string, ForexMarketData | null> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketData = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/forex/market-data?symbols=${symbols.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch forex market data");
      const json = (await res.json()) as { marketData: Record<string, ForexMarketData | null> };
      setData(json.marketData);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchMarketData();
    const id = setInterval(fetchMarketData, refreshInterval);
    return () => clearInterval(id);
  }, [fetchMarketData, refreshInterval]);

  return { data, loading, error, refetch: fetchMarketData };
}

// ─── Forex Signals Hook ───────────────────────────────────────────────────────

export function useForexSignals(refreshInterval = 60000) {
  const [signals, setSignals] = useState<ForexSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetch = useRef(0);

  const fetchSignals = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetch.current < 30000) return;
    lastFetch.current = now;
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/api/forex/signals`);
      if (!res.ok) throw new Error("Failed to fetch forex signals");
      const json = (await res.json()) as { signals: ForexSignal[] };
      setSignals(json.signals);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals(true);
    const id = setInterval(() => fetchSignals(), refreshInterval);
    return () => clearInterval(id);
  }, [fetchSignals, refreshInterval]);

  return { signals, loading, error, refetch: () => fetchSignals(true) };
}

// ─── Forex Analysis Hook ──────────────────────────────────────────────────────

export function useForexAnalysis() {
  const [result, setResult] = useState<ForexAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (pair: string, timeframe: string, userQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/forex/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair, timeframe, userQuery }),
      });
      if (!res.ok) throw new Error("Analysis request failed");
      const json = (await res.json()) as ForexAnalysisResult;
      setResult(json);
      return json;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, analyze };
}

// ─── Forex Positions Hook ─────────────────────────────────────────────────────

export function useForexPositions(refreshInterval = 10000) {
  const [positions, setPositions] = useState<ForexPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/forex/positions`);
      if (!res.ok) throw new Error("Failed to fetch positions");
      const json = (await res.json()) as { positions: ForexPosition[] };
      setPositions(json.positions);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    const id = setInterval(fetchPositions, refreshInterval);
    return () => clearInterval(id);
  }, [fetchPositions, refreshInterval]);

  return { positions, loading, error, refetch: fetchPositions };
}

// ─── Forex Risk Hook ──────────────────────────────────────────────────────────

export function useForexRisk(refreshInterval = 10000) {
  const [risk, setRisk] = useState<ForexRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRisk = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/forex/risk`);
      if (!res.ok) throw new Error("Failed to fetch risk data");
      const json = (await res.json()) as ForexRiskData;
      setRisk(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRisk();
    const id = setInterval(fetchRisk, refreshInterval);
    return () => clearInterval(id);
  }, [fetchRisk, refreshInterval]);

  return { risk, loading, error, refetch: fetchRisk };
}

// ─── Forex Execution Hook ─────────────────────────────────────────────────────

export function useForexExecution() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ForexOrder | null>(null);

  const execute = useCallback(
    async (pair: string, type: "BUY" | "SELL", volume: number, stopLoss: number, takeProfit: number, mode: "paper" | "live" | "assisted" = "paper") => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE}/api/forex/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pair, type, volume, stopLoss, takeProfit, mode }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error: string };
          throw new Error(err.error);
        }
        const json = (await res.json()) as { order: ForexOrder };
        setLastResult(json.order);
        return json.order;
      } catch (e) {
        setError(String(e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { execute, loading, error, lastResult };
}

// ─── Close Position Hook ──────────────────────────────────────────────────────

export function useClosePosition() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closePosition = useCallback(async (orderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/forex/close-position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) throw new Error("Failed to close position");
      const json = (await res.json()) as { order: ForexOrder; pnl: number };
      return json;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { closePosition, loading, error };
}
