import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StrategyResult {
  asset: string; timeframe: string; style: string; strategy: string; signal: string;
  marketData: { price: number; rsi: number; ema20: number | null; ema50: number | null; change24h: number };
  timestamp: string;
}

const SIGNAL_COLOR: Record<string, string> = { LONG: "#0ED359", SHORT: "#f87171", HOLD: "#F59E0B", CAUTION: "#fb923c", BUY: "#0ED359", SELL: "#f87171" };

export default function StrategyBrain({ color }: { color: string }) {
  const [asset, setAsset] = useState("BTC");
  const [timeframe, setTimeframe] = useState("4h");
  const [style, setStyle] = useState("swing");
  const [risk, setRisk] = useState(2);
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StrategyResult[]>([]);

  const generate = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${BASE}/api/trademind/strategy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, timeframe, style, riskPercent: risk }),
      });
      const d = await r.json() as StrategyResult;
      setResult(d); setHistory((prev) => [d, ...prev.slice(0, 4)]);
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  };

  const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE"];
  const TFS = ["5m", "15m", "1h", "4h", "1d", "1w"];
  const STYLES = [
    { key: "scalp", label: "Scalp", desc: "1-30 min" },
    { key: "swing", label: "Swing", desc: "1-7 days" },
    { key: "position", label: "Position", desc: "Weeks-months" },
    { key: "breakout", label: "Breakout", desc: "On breakout" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, height: "100%" }}>
      {/* Config panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Strategy Parameters</p>

        {/* Asset */}
        <div>
          <label style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Asset</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {ASSETS.map((a) => (
              <button key={a} onClick={() => setAsset(a)}
                style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${asset === a ? color + "60" : "rgba(255,255,255,0.08)"}`, background: asset === a ? color + "18" : "transparent", color: asset === a ? color : "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <label style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Timeframe</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {TFS.map((tf) => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${timeframe === tf ? color + "60" : "rgba(255,255,255,0.08)"}`, background: timeframe === tf ? color + "18" : "transparent", color: timeframe === tf ? color : "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div>
          <label style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Trading Style</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {STYLES.map((s) => (
              <button key={s.key} onClick={() => setStyle(s.key)}
                style={{ padding: "9px 12px", borderRadius: 9, border: `1px solid ${style === s.key ? color + "50" : "rgba(255,255,255,0.07)"}`, background: style === s.key ? color + "12" : "transparent", color: style === s.key ? color : "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: style === s.key ? 600 : 400 }}>{s.label}</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Risk */}
        <div>
          <label style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Risk Per Trade: <span style={{ color: "#f87171" }}>{risk}%</span></label>
          <input type="range" min="0.5" max="5" step="0.5" value={risk} onChange={(e) => setRisk(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#f87171" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>0.5%</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>5%</span>
          </div>
        </div>

        <button onClick={generate} disabled={loading}
          style={{ padding: "13px", borderRadius: 10, border: "none", background: loading ? "rgba(255,255,255,0.06)" : color, color: loading ? "rgba(255,255,255,0.3)" : "#000", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
          {loading ? "⚙ Generating Strategy…" : "⚡ Generate Strategy"}
        </button>

        {/* History */}
        {history.length > 1 && (
          <div>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Recent</p>
            {history.slice(1).map((h, i) => (
              <button key={i} onClick={() => setResult(h)}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.35)", fontSize: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 4 }}>
                {h.asset}/{h.timeframe} · {h.style} · <span style={{ color: SIGNAL_COLOR[h.signal] ?? "#888" }}>{h.signal}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result panel */}
      <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)", overflow: "auto", padding: "20px" }}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, animation: "pulse 1s infinite" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Strategy Brain analyzing {asset}/{timeframe}…</span>
              </div>
              {[100, 80, 95, 70, 85, 75, 90].map((w, i) => (
                <div key={i} style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.04)", width: `${w}%`, animation: "shimmer 1.5s infinite" }} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: "#f87171", fontSize: 12 }}>{error}</motion.div>
          ) : result ? (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 300, color: "#fff", letterSpacing: "-0.02em" }}>{result.asset}/USDT · {result.timeframe} · {result.style.toUpperCase()}</h2>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{new Date(result.timestamp).toLocaleString()}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: SIGNAL_COLOR[result.signal] ?? "#888", background: (SIGNAL_COLOR[result.signal] ?? "#888") + "18", padding: "6px 14px", borderRadius: 8, letterSpacing: "0.06em" }}>
                  {result.signal}
                </span>
              </div>

              {/* Market data */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Price", value: `$${result.marketData.price.toLocaleString()}` },
                  { label: "RSI", value: result.marketData.rsi.toString() },
                  { label: "EMA20", value: result.marketData.ema20 ? `$${result.marketData.ema20.toLocaleString()}` : "—" },
                  { label: "24H Change", value: `${result.marketData.change24h >= 0 ? "+" : ""}${result.marketData.change24h.toFixed(2)}%` },
                ].map((m) => (
                  <div key={m.label} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <p style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{m.label}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums" }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Strategy text */}
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                {result.strategy}
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <div style={{ fontSize: 40 }}>⚙️</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>Configure parameters on the left<br />and click Generate Strategy</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.12)", textAlign: "center" }}>Claude AI will analyze live {asset} data<br />and generate a full institutional trade plan</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes shimmer{0%,100%{opacity:.06}50%{opacity:.14}}`}</style>
    </div>
  );
}
