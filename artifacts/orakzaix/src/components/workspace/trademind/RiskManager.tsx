import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface RiskData {
  riskScore: number; riskLevel: "LOW" | "MEDIUM" | "HIGH"; paperBalance: number;
  totalExposure: number; unrealizedPnl: number; volatility24h: number;
  maxDrawdown: number; leverageSuggestion: string;
  positions: { symbol: string; qty: number; avgEntry: number; currentPrice: number; unrealizedPnl: number }[];
  timestamp: string;
}

const RISK_COLOR = { LOW: "#0ED359", MEDIUM: "#F59E0B", HIGH: "#f87171" };

export default function RiskManager({ color }: { color: string }) {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emergency, setEmergency] = useState(false);
  const [maxLeverage, setMaxLeverage] = useState(3);
  const [maxRiskPct, setMaxRiskPct] = useState(2);
  const [stopLossEnabled, setStopLossEnabled] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/trademind/risk`);
      setData(await r.json() as RiskData);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const id = setInterval(fetch_, 30000); return () => clearInterval(id); }, [fetch_]);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading risk metrics…</div>;
  if (!data) return null;

  const riskColor = RISK_COLOR[data.riskLevel];
  const scoreAngle = (data.riskScore / 100) * 180;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {/* Risk gauge */}
        <div style={{ padding: "16px", borderRadius: 14, border: `1px solid ${riskColor}30`, background: `${riskColor}08`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Risk Score</p>
          <svg width="120" height="70" viewBox="0 0 120 70">
            <path d="M15,65 A50,50 0 0,1 105,65" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
            <motion.path d="M15,65 A50,50 0 0,1 105,65" fill="none" stroke={riskColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray="157" initial={{ strokeDashoffset: 157 }} animate={{ strokeDashoffset: 157 - (157 * data.riskScore / 100) }} transition={{ duration: 1 }} />
            <text x="60" y="58" textAnchor="middle" fill={riskColor} fontSize="18" fontWeight="bold">{data.riskScore.toFixed(0)}</text>
            <text x="60" y="70" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9">{data.riskLevel}</text>
          </svg>
        </div>

        {/* Key metrics */}
        <div style={{ padding: "14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Paper Balance", value: `$${data.paperBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: "#1C69F0" },
            { label: "Unrealized P&L", value: `${data.unrealizedPnl >= 0 ? "+" : ""}$${data.unrealizedPnl.toFixed(2)}`, color: data.unrealizedPnl >= 0 ? "#0ED359" : "#f87171" },
            { label: "Max Drawdown", value: `${data.maxDrawdown.toFixed(2)}%`, color: data.maxDrawdown < 0 ? "#f87171" : "rgba(255,255,255,0.5)" },
            { label: "24h Volatility", value: `${data.volatility24h.toFixed(2)}%`, color: "rgba(255,255,255,0.5)" },
          ].map((m) => (
            <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{m.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: m.color, fontVariantNumeric: "tabular-nums" }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Emergency stop */}
        <div style={{ padding: "14px", borderRadius: 14, border: `1px solid ${emergency ? "#f87171" : "rgba(255,255,255,0.07)"}`, background: emergency ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Emergency</p>
          <button onClick={() => setEmergency(!emergency)}
            style={{ width: 64, height: 64, borderRadius: "50%", border: `3px solid ${emergency ? "#f87171" : "rgba(248,113,113,0.3)"}`, background: emergency ? "rgba(248,113,113,0.25)" : "transparent", color: emergency ? "#f87171" : "rgba(248,113,113,0.5)", fontSize: 24, cursor: "pointer", transition: "all 0.2s", boxShadow: emergency ? "0 0 24px rgba(248,113,113,0.4)" : "none" }}>
            ⏹
          </button>
          <p style={{ fontSize: 9, color: emergency ? "#f87171" : "rgba(255,255,255,0.2)", textAlign: "center", lineHeight: 1.4 }}>{emergency ? "STOP ACTIVE\nAll trading halted" : "Stop All\nTrading"}</p>
        </div>
      </div>

      {/* Risk controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "Max Leverage", value: maxLeverage, set: setMaxLeverage, min: 1, max: 20, step: 1, unit: "x", color: "#F59E0B" },
          { label: "Max Risk / Trade", value: maxRiskPct, set: setMaxRiskPct, min: 0.5, max: 10, step: 0.5, unit: "%", color: "#f87171" },
        ].map((ctrl) => (
          <div key={ctrl.label} style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{ctrl.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: ctrl.color }}>{ctrl.value}{ctrl.unit}</span>
            </div>
            <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} value={ctrl.value} onChange={(e) => ctrl.set(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: ctrl.color }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>{ctrl.min}{ctrl.unit}</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>{ctrl.max}{ctrl.unit}</span>
            </div>
          </div>
        ))}
        <div style={{ padding: "14px", borderRadius: 12, border: `1px solid ${stopLossEnabled ? "#0ED35930" : "rgba(255,255,255,0.07)"}`, background: stopLossEnabled ? "rgba(14,211,89,0.05)" : "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Auto Stop-Loss</span>
          <button onClick={() => setStopLossEnabled(!stopLossEnabled)}
            style={{ padding: "8px", borderRadius: 8, border: `1px solid ${stopLossEnabled ? "#0ED35960" : "rgba(255,255,255,0.1)"}`, background: stopLossEnabled ? "#0ED35920" : "transparent", color: stopLossEnabled ? "#0ED359" : "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {stopLossEnabled ? "● ENABLED" : "○ DISABLED"}
          </button>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>{data.leverageSuggestion}</p>
        </div>
      </div>

      {/* Open positions */}
      {data.positions.length > 0 && (
        <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Open Positions</p>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["Symbol", "Qty", "Avg Entry", "Current", "Unrealized P&L"].map((h) => (
                <th key={h} style={{ padding: "8px 14px", fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 500, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.positions.map((p) => (
                <tr key={p.symbol} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{p.symbol.replace("USDT", "/USDT")}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>{p.qty}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>${p.avgEntry.toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#fff", fontVariantNumeric: "tabular-nums" }}>${p.currentPrice.toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: p.unrealizedPnl >= 0 ? "#0ED359" : "#f87171", fontVariantNumeric: "tabular-nums" }}>
                    {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
