import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const SIGNAL_COLOR: Record<string, string> = {
  BREAKOUT: "#0ED359", BULLISH: "#22d3ee", OVERSOLD: "#a78bfa",
  BEARISH: "#f87171", OVERBOUGHT: "#fb923c", NEUTRAL: "#6b7280",
};

interface ScanResult {
  symbol: string; price: number; change1h: number; rsi: number;
  signal: string; volRatio: number; high24h: number; low24h: number;
}

export default function MarketScanner({ color }: { color: string }) {
  const [scan, setScan] = useState<ScanResult[]>([]);
  const [breakouts, setBreakouts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [interval, setIntervalTF] = useState("1h");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const runScan = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/trademind/scanner?interval=${interval}`);
      const d = await r.json() as { scan: ScanResult[]; breakouts: number; timestamp: string };
      setScan(d.scan ?? []);
      setBreakouts(d.breakouts ?? 0);
      setLastUpdate(new Date(d.timestamp).toLocaleTimeString());
    } catch { /* silent */ } finally { setLoading(false); }
  }, [interval]);

  useEffect(() => { runScan(); }, [runScan]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(runScan, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, runScan]);

  const fmt = (sym: string) => sym.replace("USDT", "/USDT");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
          <button key={tf} onClick={() => setIntervalTF(tf)}
            style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${interval === tf ? color + "60" : "rgba(255,255,255,0.08)"}`, background: interval === tf ? color + "18" : "transparent", color: interval === tf ? color : "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
            {tf}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setAutoRefresh(!autoRefresh)}
          style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${autoRefresh ? "#0ED35960" : "rgba(255,255,255,0.08)"}`, background: autoRefresh ? "#0ED35918" : "transparent", color: autoRefresh ? "#0ED359" : "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
          {autoRefresh ? "● Auto ON" : "Auto OFF"}
        </button>
        <button onClick={runScan} disabled={loading}
          style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: loading ? "rgba(255,255,255,0.06)" : color, color: "#000", fontSize: 11, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}>
          {loading ? "Scanning…" : "↻ Scan Now"}
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[
          { label: "Assets Scanned", value: String(scan.length), accent: color },
          { label: "Breakouts", value: String(breakouts), accent: "#0ED359" },
          { label: "Bearish", value: String(scan.filter((s) => s.signal === "BEARISH").length), accent: "#f87171" },
          { label: "Last Update", value: lastUpdate ?? "—", accent: "rgba(255,255,255,0.3)" },
        ].map((s) => (
          <div key={s.label} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: s.accent, fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Scan table */}
      <div style={{ flex: 1, overflow: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Symbol", "Price", "1H %", "RSI", "Vol Ratio", "Signal"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 500, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {loading && scan.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} style={{ padding: "12px 14px" }}>
                    <div style={{ height: 14, borderRadius: 4, background: "rgba(255,255,255,0.04)", animation: "shimmer 1.5s infinite", width: `${60 + Math.random() * 30}%` }} />
                  </td></tr>
                ))
              ) : scan.map((row, i) => (
                <motion.tr key={row.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{fmt(row.symbol)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#fff", fontVariantNumeric: "tabular-nums" }}>${row.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: "11px 14px", fontSize: 11, color: row.change1h >= 0 ? "#0ED359" : "#f87171", fontVariantNumeric: "tabular-nums" }}>
                    {row.change1h >= 0 ? "▲" : "▼"} {Math.abs(row.change1h).toFixed(2)}%
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 32, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${row.rsi}%`, background: row.rsi > 70 ? "#fb923c" : row.rsi < 30 ? "#a78bfa" : "#0ED359", borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, color: row.rsi > 70 ? "#fb923c" : row.rsi < 30 ? "#a78bfa" : "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>{row.rsi}</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 11, color: row.volRatio > 1.5 ? "#0ED359" : "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums" }}>{row.volRatio}x</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: SIGNAL_COLOR[row.signal] ?? "#888", background: (SIGNAL_COLOR[row.signal] ?? "#888") + "18", padding: "3px 9px", borderRadius: 5, letterSpacing: "0.06em" }}>
                      {row.signal}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:.06}50%{opacity:.14}}`}</style>
    </div>
  );
}
