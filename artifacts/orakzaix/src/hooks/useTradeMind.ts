import { useState, useEffect, useCallback, useRef } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface PriceData {
  price: number;
  change24h: number;
}

export interface MarketPrices {
  crypto: Record<string, PriceData | null>;
  btcDominance: number | null;
  gold: { price: number; change: number } | null;
  spx: { price: number; change: number } | null;
  timestamp: string;
}

export interface AISignal {
  asset: string;
  signal: "LONG" | "SHORT" | "HOLD" | "CAUTION";
  confidence: number;
  reason: string;
}

export interface AnalysisResult {
  asset: string;
  timeframe: string;
  signal: string;
  confidence: number;
  analysis: string;
  marketData: {
    price: number | null;
    change24h: number | null;
    btcDominance: number | null;
    goldPrice: number | null;
  };
  timestamp: string;
}

export function useMarketPrices(refreshInterval = 15000) {
  const [data, setData] = useState<MarketPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/trademind/prices`);
      if (!res.ok) throw new Error("Failed to fetch prices");
      const json = await res.json() as MarketPrices;
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(id);
  }, [fetchPrices, refreshInterval]);

  return { data, loading, error, refetch: fetchPrices };
}

export function useAISignals(refreshInterval = 60000) {
  const [signals, setSignals] = useState<AISignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetch = useRef(0);

  const fetchSignals = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetch.current < 30000) return;
    lastFetch.current = now;
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/api/trademind/signals`);
      if (!res.ok) throw new Error("Failed to fetch signals");
      const json = await res.json() as { signals: AISignal[] };
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

export function useTradeAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (asset: string, timeframe: string, userQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/trademind/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, timeframe, userQuery }),
      });
      if (!res.ok) throw new Error("Analysis request failed");
      const json = await res.json() as AnalysisResult;
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
