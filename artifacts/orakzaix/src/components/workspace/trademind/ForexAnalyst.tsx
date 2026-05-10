import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForexAnalysis, useForexMarketData } from "../../../hooks/useForex";

const FOREX_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD"];
const TIMEFRAMES = ["15M", "1H", "4H", "1D", "1W"];

interface AnalysisHistory {
  pair: string;
  timeframe: string;
  signal: string;
  confidence: number;
  timestamp: string;
}

export default function ForexAnalyst({ color }: { color: string }) {
  const [pair, setPair] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("1H");
  const [userQuery, setUserQuery] = useState("");
  const [history, setHistory] = useState<AnalysisHistory[]>([]);

  const { result, loading, analyze } = useForexAnalysis();
  const { data: marketData } = useForexMarketData([pair]);

  const handleAnalyze = async () => {
    const result = await analyze(pair, timeframe, userQuery);
    if (result) {
      setHistory((prev) => [
        {
          pair,
          timeframe,
          signal: result.signal,
          confidence: result.confidence,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 10));
      setUserQuery("");
    }
  };

  const marketInfo = marketData?.[pair];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, height: "100%" }}>
      {/* Configuration Panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Pair Selection */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            Forex Pair
          </label>
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          >
            {FOREX_PAIRS.map((p) => (
              <option key={p} value={p} style={{ background: "#1a1a2e" }}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe Selection */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            Timeframe
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  padding: "8px",
                  borderRadius: 8,
                  border: `1px solid ${timeframe === tf ? color + "40" : "rgba(255,255,255,0.08)"}`,
                  background: timeframe === tf ? color + "15" : "transparent",
                  color: timeframe === tf ? color : "rgba(255,255,255,0.3)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Market Info */}
        {marketInfo && (
          <div style={{ padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Live Data
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Bid:</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>{marketInfo.bid.toFixed(5)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Ask:</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>{marketInfo.ask.toFixed(5)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Spread:</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>{marketInfo.spread.toFixed(5)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Session:</span>
                <span style={{ color: color, fontWeight: 600 }}>{marketInfo.session}</span>
              </div>
            </div>
          </div>
        )}

        {/* Custom Query */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            Custom Query (Optional)
          </label>
          <textarea
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Ask about structure, liquidity, session behavior..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              minHeight: "80px",
            }}
          />
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: loading ? "rgba(255,255,255,0.06)" : color,
            color: loading ? "rgba(255,255,255,0.3)" : "#000",
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
            letterSpacing: "0.04em",
          }}
        >
          {loading ? "Analyzing…" : "🔍 Analyze"}
        </button>

        {/* Analysis History */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>
            History
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.02)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>
                    {h.pair} {h.timeframe}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: h.signal === "LONG" ? "#0ED359" : h.signal === "SHORT" ? "#f87171" : "rgba(255,255,255,0.5)",
                      background:
                        (h.signal === "LONG" ? "#0ED359" : h.signal === "SHORT" ? "#f87171" : "rgba(255,255,255,0.1)") + "20",
                      padding: "2px 6px",
                      borderRadius: 3,
                    }}
                  >
                    {h.signal}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                  <span>Conf: {h.confidence}%</span>
                  <span>{h.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analysis Result */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
        <AnimatePresence>
          {result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: 12,
                  border: `1px solid ${color}40`,
                  background: `${color}10`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                    {result.pair} {result.timeframe}
                  </h3>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>
                    {new Date(result.timestamp).toLocaleString()}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: result.signal === "LONG" ? "#0ED359" : result.signal === "SHORT" ? "#f87171" : "rgba(255,255,255,0.5)",
                      background:
                        (result.signal === "LONG" ? "#0ED359" : result.signal === "SHORT" ? "#f87171" : "rgba(255,255,255,0.1)") + "20",
                      padding: "4px 10px",
                      borderRadius: 6,
                      marginBottom: 4,
                    }}
                  >
                    {result.signal}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                    Confidence: {result.confidence}%
                  </div>
                </div>
              </div>

              {/* Market Data Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    Bid/Ask
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                    {result.marketData.bid.toFixed(5)} / {result.marketData.ask.toFixed(5)}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    Spread
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                    {result.marketData.spread.toFixed(5)} pips
                  </div>
                </div>
                <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    Volatility
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                    {(result.marketData.volatility * 100).toFixed(2)}%
                  </div>
                </div>
                <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    Session
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: color }}>
                    {result.marketData.session}
                  </div>
                </div>
              </div>

              {/* Analysis Text */}
              <div style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                <h4 style={{ fontSize: 11, fontWeight: 600, color: "#fff", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Institutional Analysis
                </h4>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "rgba(255,255,255,0.7)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {result.analysis}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "rgba(255,255,255,0.2)",
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Select a pair and click Analyze</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  Get institutional-grade forex analysis with structure, liquidity, and session insights
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
