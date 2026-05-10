import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NewsData {
  fearGreed: { value: number; classification: string } | null;
  fngHistory: { value: number; classification: string; date: string }[];
  global: { btcDominance: number; ethDominance: number; totalMarketCap: number; volume24h: number; change24h: number } | null;
  topGainers: { name: string; symbol: string; change24h: number; price: number }[];
  timestamp: string;
}

function FearGreedGauge({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? "#f87171" : value >= 55 ? "#fb923c" : value >= 45 ? "#F59E0B" : value >= 25 ? "#22d3ee" : "#0ED359";
  const angle = -90 + (value / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 80, cy = 80, r = 60;
  const nx = cx + r * Math.cos(rad), ny = cy + r * Math.sin(rad);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="160" height="100" viewBox="0 0 160 100">
        <path d="M20,80 A60,60 0 0,1 140,80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round" />
        {[
          { start: 0, end: 25, color: "#0ED359" }, { start: 25, end: 45, color: "#22d3ee" },
          { start: 45, end: 55, color: "#F59E0B" }, { start: 55, end: 75, color: "#fb923c" },
          { start: 75, end: 100, color: "#f87171" },
        ].map((seg) => {
          const s = -90 + (seg.start / 100) * 180;
          const e = -90 + (seg.end / 100) * 180;
          const sr = s * Math.PI / 180, er = e * Math.PI / 180;
          const x1 = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
          const x2 = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
          const large = (e - s) > 90 ? 1 : 0;
          return <path key={seg.start} d={`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2}`} fill="none" stroke={seg.color} strokeWidth="12" strokeLinecap="butt" opacity="0.7" />;
        })}
        <motion.line x1={cx} y1={cy} x2={cx} y2={cy}
          animate={{ x2: nx.toFixed(1), y2: ny.toFixed(1) }}
          transition={{ duration: 1, ease: "easeOut" }}
          stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={color} />
        <text x={cx} y={cy + 18} textAnchor="middle" fill={color} fontSize="20" fontWeight="bold">{value}</text>
      </svg>
      <p style={{ fontSize: 13, fontWeight: 600, color, marginTop: -6 }}>{label}</p>
      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>Fear & Greed Index</p>
    </div>
  );
}

export default function NewsIntelligence({ color }: { color: string }) {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/trademind/news`)
      .then((r) => r.json()).then((d: NewsData) => setData(d))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading market intelligence…</div>;

  const fg = data?.fearGreed;
  const global = data?.global;
  const mcap = global?.totalMarketCap ? (global.totalMarketCap / 1e12).toFixed(2) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflow: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>
        {/* Fear & Greed */}
        <div style={{ padding: "16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {fg ? <FearGreedGauge value={fg.value} label={fg.classification} /> : <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Unavailable</p>}
          {data?.fngHistory && data.fngHistory.length > 0 && (
            <div style={{ width: "100%", marginTop: 10 }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>7-Day History</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {data.fngHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{h.date}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: Math.max(6, h.value * 0.6), height: 5, borderRadius: 99, background: h.value >= 55 ? "#fb923c" : h.value >= 45 ? "#F59E0B" : "#0ED359" }} />
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums", minWidth: 20 }}>{h.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Global metrics */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Global Market Metrics</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {global ? [
              { label: "Total Market Cap", value: mcap ? `$${mcap}T` : "—", sub: `${global.change24h >= 0 ? "+" : ""}${global.change24h}% 24h`, color: global.change24h >= 0 ? "#0ED359" : "#f87171" },
              { label: "BTC Dominance", value: `${global.btcDominance.toFixed(1)}%`, sub: "Market share", color: "#F59E0B" },
              { label: "ETH Dominance", value: `${global.ethDominance.toFixed(1)}%`, sub: "Market share", color: "#8B5CF6" },
              { label: "24h Volume", value: global.volume24h ? `$${(global.volume24h / 1e9).toFixed(0)}B` : "—", sub: "Global trading volume", color: color },
            ].map((m) => (
              <div key={m.label} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{m.label}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: m.color, fontVariantNumeric: "tabular-nums" }}>{m.value}</p>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{m.sub}</p>
              </div>
            )) : <div style={{ gridColumn: "span 2", padding: "16px", color: "rgba(255,255,255,0.2)", fontSize: 12, textAlign: "center" }}>Global data unavailable</div>}
          </div>

          {/* Top Gainers */}
          {data?.topGainers && data.topGainers.length > 0 && (
            <div>
              <p style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: 8 }}>Top Gainers 24H</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.topGainers.map((g, i) => (
                  <motion.div key={g.symbol} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(14,211,89,0.1)", background: "rgba(14,211,89,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ED359" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{g.symbol}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{g.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0ED359" }}>+{g.change24h.toFixed(2)}%</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Market Regime */}
      <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Market Regime Analysis</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: fg && fg.value < 30 ? "🐻 Extreme Fear" : fg && fg.value < 50 ? "⚠️ Fear Zone" : fg && fg.value < 75 ? "🟡 Greed Zone" : "🔴 Extreme Greed", desc: "Sentiment signal" },
            { label: global && global.change24h > 0 ? "📈 Market Expanding" : "📉 Market Contracting", desc: "Market cap trend" },
            { label: global && global.btcDominance > 55 ? "🟡 BTC Season" : "🔵 Alt Season", desc: "Cycle indicator" },
          ].map((r) => (
            <div key={r.label} style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{r.label}</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
