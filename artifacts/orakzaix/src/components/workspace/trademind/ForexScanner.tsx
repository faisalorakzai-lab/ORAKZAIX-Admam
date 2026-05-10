import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForexMarketData } from "../../../hooks/useForex";

interface ScanResult {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  volatility: number;
  session: string;
  trend: string;
  liquidityZone: { level: number; strength: string };
}

const FOREX_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "NZD/USD"];
const COMMODITIES = ["XAU/USD", "XAG/USD"];
const INDICES = ["US30", "NASDAQ", "SPX500"];

export default function ForexScanner({ color }: { color: string }) {
  const [activeTab, setActiveTab] = useState<"forex" | "commodities" | "indices">("forex");
  const [scan, setScan] = useState<ScanResult[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const symbols = activeTab === "forex" ? FOREX_PAIRS : activeTab === "commodities" ? COMMODITIES : INDICES;
  const { data: marketData, loading } = useForexMarketData(symbols, autoRefresh ? 15000 : 999999);

  useEffect(() => {
    if (marketData) {
      const results = Object.entries(marketData)
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

      setScan(results);
      setLastUpdate(new Date().toLocaleTimeString());
    }
  }, [marketData]);

  const highVolatilityCount = scan.filter((s) => s.volatility > 0.005).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>Forex Market Scanner</h3>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", margin: "4px 0 0" }}>
            {lastUpdate ? `Last update: ${lastUpdate}` : "Loading..."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${autoRefresh ? color + "40" : "rgba(255,255,255,0.1)"}`,
              background: autoRefresh ? color + "15" : "transparent",
              color: autoRefresh ? color : "rgba(255,255,255,0.3)",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {autoRefresh ? "🔄 Auto" : "⏸ Manual"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 12 }}>
        {(["forex", "commodities", "indices"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: activeTab === tab ? color + "20" : "transparent",
              color: activeTab === tab ? color : "rgba(255,255,255,0.3)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              textTransform: "capitalize",
              transition: "all 0.15s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Symbols
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: color, marginTop: 4 }}>{scan.length}</div>
        </div>
        <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            High Vol
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f87171", marginTop: 4 }}>{highVolatilityCount}</div>
        </div>
      </div>

      {/* Scanner Table */}
      <div style={{ flex: 1, overflow: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Symbol", "Bid", "Ask", "Spread", "Vol", "Session", "Trend", "Liquidity"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "9px 12px",
                    fontSize: 9,
                    color: "rgba(255,255,255,0.2)",
                    fontWeight: 500,
                    textAlign: "left",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {scan.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "24px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.15)" }}>
                    {loading ? "Loading market data..." : "No data available"}
                  </td>
                </tr>
              ) : (
                scan.map((s, i) => (
                  <motion.tr
                    key={s.symbol}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02 }}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <td style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                      {s.symbol}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
                      {s.bid.toFixed(5)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
                      {s.ask.toFixed(5)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: 11,
                        color: s.spread > 0.005 ? "#f87171" : "#0ED359",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {s.spread.toFixed(5)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: 10,
                        color: s.volatility > 0.005 ? "#f87171" : "rgba(255,255,255,0.3)",
                        fontWeight: 600,
                      }}
                    >
                      {(s.volatility * 100).toFixed(2)}%
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                      {s.session}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: s.trend === "BULLISH" ? "#0ED359" : "#f87171",
                          background: (s.trend === "BULLISH" ? "#0ED359" : "#f87171") + "18",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        {s.trend}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                      {s.liquidityZone.strength}
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
