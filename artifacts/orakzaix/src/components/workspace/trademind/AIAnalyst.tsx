import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ReportResult {
  reportType: string; assets: string[]; report: string;
  marketData: Record<string, { price: number; change24h: number } | null>;
  fearGreed: { value: number; classification: string } | null;
  timestamp: string;
}

const REPORT_TYPES = [
  { key: "daily", label: "Daily Intelligence", icon: "📊", desc: "Full market brief: sentiment, technicals, themes" },
  { key: "trade", label: "Trade Analysis", icon: "🎯", desc: "Deep dive on a single asset position" },
  { key: "outlook", label: "Weekly Outlook", icon: "🔭", desc: "Strategic view: macro, BTC cycle, rotation" },
];

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX"];

export default function AIAnalyst({ color }: { color: string }) {
  const [reportType, setReportType] = useState("daily");
  const [selectedAssets, setSelectedAssets] = useState<string[]>(["BTC", "ETH"]);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAsset = (a: string) => {
    setSelectedAssets((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a].slice(0, 5));
  };

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${BASE}/api/trademind/analyst`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, assets: selectedAssets }),
      });
      setResult(await r.json() as ReportResult);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  };

  const fgColor = (v: number) => v >= 75 ? "#f87171" : v >= 55 ? "#fb923c" : v >= 45 ? "#F59E0B" : "#0ED359";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, height: "100%" }}>
      {/* Config */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Report Configuration</p>

        {/* Report type */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {REPORT_TYPES.map((t) => (
            <button key={t.key} onClick={() => setReportType(t.key)}
              style={{ padding: "11px 12px", borderRadius: 10, border: `1px solid ${reportType === t.key ? color + "50" : "rgba(255,255,255,0.07)"}`, background: reportType === t.key ? color + "12" : "transparent", color: "rgba(255,255,255,0.7)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: reportType === t.key ? 600 : 400, color: reportType === t.key ? color : "rgba(255,255,255,0.6)" }}>
                {t.icon} {t.label}
              </span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", paddingLeft: 18 }}>{t.desc}</span>
            </button>
          ))}
        </div>

        {/* Asset selection */}
        <div>
          <label style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
            Assets ({selectedAssets.length}/5)
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {ASSETS.map((a) => (
              <button key={a} onClick={() => toggleAsset(a)}
                style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${selectedAssets.includes(a) ? color + "60" : "rgba(255,255,255,0.08)"}`, background: selectedAssets.includes(a) ? color + "18" : "transparent", color: selectedAssets.includes(a) ? color : "rgba(255,255,255,0.3)", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

        {/* AI model indicator */}
        <div style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>AI Engine</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Claude Opus 4.5</span>
          </div>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", marginTop: 4 }}>Institutional analysis via live market data</p>
        </div>

        <button onClick={generate} disabled={loading || selectedAssets.length === 0}
          style={{ padding: "13px", borderRadius: 10, border: "none", background: loading ? "rgba(255,255,255,0.06)" : color, color: loading ? "rgba(255,255,255,0.3)" : "#000", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}>
          {loading ? "Generating Report…" : "Generate Report"}
        </button>
      </div>

      {/* Report output */}
      <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)", overflow: "auto" }}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, animation: "pulse 1s infinite" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>AI Analyst drafting report…</span>
              </div>
              {[100, 75, 90, 65, 80, 70, 85, 60, 95, 72].map((w, i) => (
                <div key={i} style={{ height: 9, borderRadius: 5, background: "rgba(255,255,255,0.04)", width: `${w}%`, animation: "shimmer 1.5s infinite", animationDelay: `${i * 0.1}s` }} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "24px", color: "#f87171", fontSize: 12 }}>{error}</motion.div>
          ) : result ? (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ padding: "24px" }}>
              {/* Report header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                    <span style={{ fontSize: 10, color: color, textTransform: "uppercase", letterSpacing: "0.15em" }}>TradeMind AI Analyst</span>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 300, color: "#fff", letterSpacing: "-0.02em" }}>
                    {REPORT_TYPES.find((t) => t.key === result.reportType)?.label ?? "Report"}
                  </h2>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                    {new Date(result.timestamp).toLocaleString()} · Assets: {result.assets.join(", ")}
                  </p>
                </div>
                {result.fearGreed && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${fgColor(result.fearGreed.value)}30`, background: `${fgColor(result.fearGreed.value)}08`, textAlign: "center" }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: fgColor(result.fearGreed.value) }}>{result.fearGreed.value}</p>
                    <p style={{ fontSize: 9, color: fgColor(result.fearGreed.value), textTransform: "uppercase", letterSpacing: "0.08em" }}>{result.fearGreed.classification}</p>
                  </div>
                )}
              </div>

              {/* Live prices strip */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {result.assets.map((a) => {
                  const d = result.marketData[a];
                  return d ? (
                    <div key={a} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{a} </span>
                      <span style={{ fontSize: 11, color: "#fff", fontVariantNumeric: "tabular-nums" }}>${d.price.toLocaleString()}</span>
                      <span style={{ fontSize: 9, color: d.change24h >= 0 ? "#0ED359" : "#f87171", marginLeft: 4 }}>{d.change24h >= 0 ? "+" : ""}{d.change24h.toFixed(2)}%</span>
                    </div>
                  ) : null;
                })}
              </div>

              {/* Report body */}
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.85, whiteSpace: "pre-wrap" }}>
                {result.report}
              </div>

              {/* Disclaimer */}
              <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.12)", lineHeight: 1.5 }}>
                  This report is generated by TradeMind AI for informational purposes. Not financial advice. Always do your own research before making trading decisions.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14 }}>
              <div style={{ fontSize: 48 }}>📋</div>
              <p style={{ fontSize: 14, fontWeight: 300, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>Select report type & assets<br />then click Generate</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.12)", textAlign: "center" }}>Claude AI writes institutional-grade reports<br />using live market data in real-time</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes shimmer{0%,100%{opacity:.06}50%{opacity:.14}}`}</style>
    </div>
  );
}
