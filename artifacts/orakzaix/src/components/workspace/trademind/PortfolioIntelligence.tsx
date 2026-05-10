import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PortfolioData {
  binance: { balances: { asset: string; free: number; locked: number }[]; connected: boolean };
  bybit: { balances: { asset: string; balance: number; usdValue: number }[]; totalUSD: number; connected: boolean };
  paper: { balance: number; startBalance: number; pnl: number; pnlPct: number };
  timestamp: string;
}

function AllocationChart({ items }: { items: { label: string; pct: number; color: string }[] }) {
  let angle = -90;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      {items.map((item, i) => {
        const sweep = (item.pct / 100) * 360;
        const startRad = (angle * Math.PI) / 180;
        const endRad = ((angle + sweep) * Math.PI) / 180;
        const x1 = 50 + 40 * Math.cos(startRad), y1 = 50 + 40 * Math.sin(startRad);
        const x2 = 50 + 40 * Math.cos(endRad), y2 = 50 + 40 * Math.sin(endRad);
        const large = sweep > 180 ? 1 : 0;
        const d = `M50,50 L${x1},${y1} A40,40 0 ${large},1 ${x2},${y2} Z`;
        angle += sweep;
        return <path key={i} d={d} fill={item.color} opacity="0.85" />;
      })}
      <circle cx="50" cy="50" r="22" fill="#0d0d1a" />
    </svg>
  );
}

const ASSET_COLORS = ["#F59E0B", "#8B5CF6", "#0ED359", "#1C69F0", "#f87171", "#22d3ee", "#fb923c", "#ec4899"];

export default function PortfolioIntelligence({ color }: { color: string }) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"paper" | "binance" | "bybit">("paper");

  useEffect(() => {
    fetch(`${BASE}/api/trademind/portfolio`)
      .then((r) => r.json()).then((d: PortfolioData) => setData(d))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Loading portfolio…</div>;
  if (!data) return null;

  const binanceTotal = data.binance.balances.reduce((a, b) => a + b.free + b.locked, 0);
  const allBalances = activeTab === "binance" ? data.binance.balances.map((b) => ({ asset: b.asset, amount: b.free + b.locked, usdValue: 0 }))
    : activeTab === "bybit" ? data.bybit.balances.map((b) => ({ asset: b.asset, amount: b.balance, usdValue: b.usdValue }))
    : [];

  const bybitTotal = data.bybit.totalUSD;
  const totalUSD = (bybitTotal || 0) + data.paper.balance;

  const chartItems = activeTab === "paper" ? [{ label: "USDT", pct: 100, color: "#1C69F0" }]
    : activeTab === "bybit" && data.bybit.balances.length > 0
    ? data.bybit.balances.slice(0, 6).map((b, i) => ({ label: b.asset, pct: (b.usdValue / (bybitTotal || 1)) * 100, color: ASSET_COLORS[i] ?? "#888" }))
    : [{ label: "Empty", pct: 100, color: "rgba(255,255,255,0.1)" }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Paper Trading", value: `$${data.paper.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, sub: `${data.paper.pnl >= 0 ? "+" : ""}$${data.paper.pnl.toFixed(2)} (${data.paper.pnlPct.toFixed(2)}%)`, color: "#1C69F0", subColor: data.paper.pnl >= 0 ? "#0ED359" : "#f87171" },
          { label: "Bybit Portfolio", value: bybitTotal > 0 ? `$${bybitTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—", sub: data.bybit.connected ? `${data.bybit.balances.length} assets` : "Not connected", color: "#F59E0B", subColor: "rgba(255,255,255,0.3)" },
          { label: "Binance Portfolio", value: data.binance.connected ? `${binanceTotal.toFixed(4)} assets` : "—", sub: data.binance.connected ? `${data.binance.balances.length} holdings` : "Not connected", color: "#F0B90B", subColor: "rgba(255,255,255,0.3)" },
        ].map((c) => (
          <div key={c.label} style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{c.label}</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: c.color, fontVariantNumeric: "tabular-nums" }}>{c.value}</p>
            <p style={{ fontSize: 10, color: c.subColor, marginTop: 3 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tab selector */}
      <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", width: "fit-content" }}>
        {(["paper", "binance", "bybit"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "8px 18px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: "none", background: activeTab === t ? color + "20" : "transparent", color: activeTab === t ? color : "rgba(255,255,255,0.3)", transition: "all 0.15s", textTransform: "capitalize", letterSpacing: "0.04em" }}>
            {t === "paper" ? "📄 Paper" : t === "binance" ? "🟡 Binance" : "🟠 Bybit"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 14, flex: 1 }}>
        {/* Allocation chart */}
        <div style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Allocation</p>
          <AllocationChart items={chartItems} />
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
            {chartItems.map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{item.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Holdings table */}
        <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          {activeTab === "paper" ? (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Starting Balance</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>${data.paper.startBalance.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Current Balance</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>${data.paper.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Total P&L</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: data.paper.pnl >= 0 ? "#0ED359" : "#f87171" }}>
                  {data.paper.pnl >= 0 ? "+" : ""}${data.paper.pnl.toFixed(2)} ({data.paper.pnlPct.toFixed(2)}%)
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, 50 + data.paper.pnlPct / 2)}%` }} transition={{ duration: 1 }}
                  style={{ height: "100%", borderRadius: 99, background: data.paper.pnl >= 0 ? "#0ED359" : "#f87171" }} />
              </div>
            </div>
          ) : allBalances.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: 12 }}>
              {activeTab === "binance" ? (data.binance.connected ? "No balances found" : "API key not connected") : (data.bybit.connected ? "No balances found" : "API key not connected")}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Asset", "Balance", "USD Value"].map((h) => <th key={h} style={{ padding: "10px 14px", fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 500, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {allBalances.map((b, i) => (
                  <tr key={b.asset} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "11px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{b.asset}</span>
                    </div></td>
                    <td style={{ padding: "11px 14px", fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>{b.amount.toFixed(6)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 11, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{b.usdValue > 0 ? `$${b.usdValue.toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
