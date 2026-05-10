import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForexExecution, useForexPositions, useClosePosition } from "../../../hooks/useForex";

const FOREX_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "NZD/USD"];
const COMMODITIES = ["XAU/USD", "XAG/USD"];

export default function ForexExecution({ color }: { color: string }) {
  const [pair, setPair] = useState("EUR/USD");
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [volume, setVolume] = useState("1.0");
  const [stopLoss, setStopLoss] = useState("1.0500");
  const [takeProfit, setTakeProfit] = useState("1.0600");
  const [mode, setMode] = useState<"paper" | "live" | "assisted">("paper");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [resultType, setResultType] = useState<"success" | "error">("success");

  const { execute, loading } = useForexExecution();
  const { positions } = useForexPositions();
  const { closePosition, loading: closeLoading } = useClosePosition();

  const allPairs = [...FOREX_PAIRS, ...COMMODITIES];

  const handleExecute = async () => {
    if (!volume || parseFloat(volume) <= 0) return;

    const result = await execute(pair, type, parseFloat(volume), parseFloat(stopLoss), parseFloat(takeProfit), mode);
    if (result) {
      setLastResult(`✓ ${type} ${volume} ${pair} @ Market — PENDING`);
      setResultType("success");
      setVolume("1.0");
    } else {
      setLastResult("✗ Execution failed");
      setResultType("error");
    }
  };

  const handleClosePosition = async (orderId: string) => {
    const result = await closePosition(orderId);
    if (result) {
      setLastResult(`✓ Closed position - P&L: ${result.pnl > 0 ? "+" : ""}${result.pnl.toFixed(2)} pips`);
      setResultType("success");
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, height: "100%" }}>
      {/* Order Entry */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["paper", "live", "assisted"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                border: "none",
                background:
                  mode === m
                    ? m === "paper"
                      ? "#1C69F018"
                      : m === "live"
                        ? "#f8717118"
                        : "#8B5CF618"
                    : "transparent",
                color:
                  mode === m
                    ? m === "paper"
                      ? "#1C69F0"
                      : m === "live"
                        ? "#f87171"
                        : "#8B5CF6"
                    : "rgba(255,255,255,0.3)",
                transition: "all 0.15s",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {m === "paper" ? "📄" : m === "live" ? "⚡" : "🤖"}
            </button>
          ))}
        </div>

        {/* Pair */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            Pair
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
            {allPairs.map((p) => (
              <option key={p} value={p} style={{ background: "#1a1a2e" }}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* BUY / SELL */}
        <div style={{ display: "flex", gap: 8 }}>
          {(["BUY", "SELL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setType(s)}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 9,
                border: `1px solid ${type === s ? (s === "BUY" ? "#0ED35960" : "#f8717160") : "rgba(255,255,255,0.08)"}`,
                background: type === s ? (s === "BUY" ? "#0ED35920" : "#f8717120") : "transparent",
                color: type === s ? (s === "BUY" ? "#0ED359" : "#f87171") : "rgba(255,255,255,0.3)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.06em",
              }}
            >
              {s === "BUY" ? "▲ BUY" : "▼ SELL"}
            </button>
          ))}
        </div>

        {/* Volume */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            Volume (Lots)
          </label>
          <input
            type="number"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            step="0.1"
            min="0"
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
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {["0.1", "0.5", "1.0", "2.0"].map((v) => (
              <button
                key={v}
                onClick={() => setVolume(v)}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Stop Loss */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            Stop Loss
          </label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            step="0.0001"
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
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Take Profit */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            Take Profit
          </label>
          <input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            step="0.0001"
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
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Execute button */}
        <button
          onClick={handleExecute}
          disabled={loading}
          style={{
            padding: "14px",
            borderRadius: 10,
            border: "none",
            background: loading ? "rgba(255,255,255,0.06)" : type === "BUY" ? "#0ED359" : "#f87171",
            color: loading ? "rgba(255,255,255,0.3)" : "#000",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
            letterSpacing: "0.04em",
          }}
        >
          {loading ? "Executing…" : `${type} ${volume} ${pair}`}
        </button>

        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                padding: "10px 12px",
                borderRadius: 9,
                border: `1px solid ${resultType === "success" ? "#0ED35930" : "#f8717130"}`,
                background: `${resultType === "success" ? "#0ED359" : "#f87171"}0a`,
                fontSize: 11,
                color: resultType === "success" ? "#0ED359" : "#f87171",
              }}
            >
              {lastResult}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Positions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", margin: 0 }}>
            Open Positions
          </p>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{positions.length} positions</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Pair", "Type", "Volume", "Entry", "Current", "P&L", "Action"].map((h) => (
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
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "24px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.15)" }}>
                    No open positions
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr key={pos.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                      {pos.symbol}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: pos.type === "BUY" ? "#0ED359" : "#f87171",
                          background: (pos.type === "BUY" ? "#0ED359" : "#f87171") + "18",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        {pos.type}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
                      {pos.volume}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                      {pos.openPrice.toFixed(5)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                      {pos.currentPrice.toFixed(5)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: pos.pnl >= 0 ? "#0ED359" : "#f87171",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {pos.pnl >= 0 ? "+" : ""}{pos.pnl.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={() => handleClosePosition(pos.id)}
                        disabled={closeLoading}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 5,
                          border: "1px solid rgba(255,255,255,0.1)",
                          background: "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 9,
                          cursor: closeLoading ? "default" : "pointer",
                          fontFamily: "inherit",
                          fontWeight: 600,
                        }}
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
