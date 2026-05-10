import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useForexRisk } from "../../../hooks/useForex";

export default function ForexRiskManager({ color }: { color: string }) {
  const { risk, loading } = useForexRisk();
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    maxLeverage: 10,
    maxDrawdown: 20,
    maxRiskPerTrade: 2,
    maxLotSize: 10,
  });

  useEffect(() => {
    if (risk?.riskConfig) {
      setConfig({
        maxLeverage: risk.riskConfig.maxLeverage,
        maxDrawdown: risk.riskConfig.maxDrawdown,
        maxRiskPerTrade: risk.riskConfig.maxRiskPerTrade,
        maxLotSize: risk.riskConfig.maxLotSize,
      });
    }
  }, [risk]);

  const getRiskColor = (level: string) => {
    if (level === "HIGH") return "#f87171";
    if (level === "MEDIUM") return "#F59E0B";
    return "#0ED359";
  };

  const getRiskGaugePercent = (score: number) => {
    return Math.min(100, score);
  };

  if (loading || !risk) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.3)" }}>
        Loading risk data...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>Forex Risk Engine</h3>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", margin: "4px 0 0" }}>Institutional-grade risk controls</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ⚙️ Config
        </button>
      </div>

      {/* Risk Gauge */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: 100, height: 100 }}>
          <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={getRiskColor(risk.riskLevel)}
              strokeWidth="8"
              strokeDasharray={`${getRiskGaugePercent(risk.riskScore) * 2.51} 251`}
              initial={{ strokeDasharray: "0 251" }}
              animate={{ strokeDasharray: `${getRiskGaugePercent(risk.riskScore) * 2.51} 251` }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: getRiskColor(risk.riskLevel) }}>
              {risk.riskScore.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Score</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Risk Level
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: getRiskColor(risk.riskLevel) }}>
              {risk.riskLevel}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Balance
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
              ${risk.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Max Drawdown
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: Math.abs(risk.maxDrawdown) > risk.riskConfig.maxDrawdown ? "#f87171" : "#0ED359",
              }}
            >
              {risk.maxDrawdown.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Emergency Stop */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${emergencyStop ? "#f87171" : "rgba(255,255,255,0.1)"}`,
          background: emergencyStop ? "#f8717115" : "rgba(255,255,255,0.02)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: emergencyStop ? "#f87171" : "#fff" }}>
            Emergency Stop
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            Halt all trading immediately
          </div>
        </div>
        <button
          onClick={() => setEmergencyStop(!emergencyStop)}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: emergencyStop ? "#f87171" : "rgba(255,255,255,0.1)",
            color: emergencyStop ? "#000" : "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s",
          }}
        >
          {emergencyStop ? "🛑 ACTIVE" : "⏸ Inactive"}
        </button>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Total Exposure
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginTop: 4 }}>
            ${risk.totalExposure.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Unrealized P&L
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: risk.unrealizedPnl >= 0 ? "#0ED359" : "#f87171",
              marginTop: 4,
            }}
          >
            {risk.unrealizedPnl >= 0 ? "+" : ""}${risk.unrealizedPnl.toFixed(2)}
          </div>
        </div>
        <div style={{ padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Open Positions
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginTop: 4 }}>
            {risk.positions}
          </div>
        </div>
        <div style={{ padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Recommendation
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            {risk.leverageRecommendation}
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 4 }}>
              Max Leverage: {config.maxLeverage}x
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={config.maxLeverage}
              onChange={(e) => setConfig({ ...config, maxLeverage: parseInt(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 4 }}>
              Max Drawdown: {config.maxDrawdown}%
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={config.maxDrawdown}
              onChange={(e) => setConfig({ ...config, maxDrawdown: parseInt(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 4 }}>
              Max Risk Per Trade: {config.maxRiskPerTrade}%
            </label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={config.maxRiskPerTrade}
              onChange={(e) => setConfig({ ...config, maxRiskPerTrade: parseFloat(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 4 }}>
              Max Lot Size: {config.maxLotSize}
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={config.maxLotSize}
              onChange={(e) => setConfig({ ...config, maxLotSize: parseInt(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>
        </motion.div>
      )}

      {/* Warnings */}
      {risk.drawdownExceeded && (
        <div
          style={{
            padding: "12px",
            borderRadius: 10,
            border: "1px solid #f8717140",
            background: "#f8717110",
            color: "#f87171",
            fontSize: 11,
          }}
        >
          ⚠️ Maximum drawdown limit exceeded. Consider reducing exposure.
        </div>
      )}
    </div>
  );
}
