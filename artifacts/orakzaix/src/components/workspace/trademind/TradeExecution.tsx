import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Order { id: string; symbol: string; side: "BUY" | "SELL"; qty: number; price: number; status: string; timestamp: string; exchange: string; }

export default function TradeExecution({ color }: { color: string }) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("0.001");
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [exchange, setExchange] = useState<"binance" | "bybit">("binance");
  const [orders, setOrders] = useState<Order[]>([]);
  const [paperBalance, setPaperBalance] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [resultType, setResultType] = useState<"success" | "error">("success");

  const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT"];

  useEffect(() => {
    fetch(`${BASE}/api/trademind/orders`)
      .then((r) => r.json())
      .then((d: { orders: Order[]; paperBalance: number }) => { setOrders(d.orders ?? []); setPaperBalance(d.paperBalance); })
      .catch(() => {});
  }, []);

  const execute = async () => {
    if (!qty || parseFloat(qty) <= 0) return;
    setLoading(true);
    setLastResult(null);
    try {
      const r = await fetch(`${BASE}/api/trademind/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, qty: parseFloat(qty), mode, exchange }),
      });
      const d = await r.json() as { success: boolean; order?: Order; paperBalance?: number; error?: string; result?: any };
      if (d.success && d.order) {
        setOrders((prev) => [d.order!, ...prev]);
        if (d.paperBalance !== undefined) setPaperBalance(d.paperBalance);
        setLastResult(`✓ ${side} ${qty} ${symbol} @ $${d.order.price.toLocaleString()} — FILLED`);
        setResultType("success");
      } else {
        setLastResult(`✗ ${d.error ?? "Execution failed"}`);
        setResultType("error");
      }
    } catch (e) {
      setLastResult(`✗ ${String(e)}`);
      setResultType("error");
    } finally { setLoading(false); }
  };

  const pnl = paperBalance - 10000;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, height: "100%" }}>
      {/* Order Entry */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["paper", "live"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: "9px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none", background: mode === m ? (m === "paper" ? "#1C69F018" : "#f8717118") : "transparent", color: mode === m ? (m === "paper" ? "#1C69F0" : "#f87171") : "rgba(255,255,255,0.3)", transition: "all 0.15s", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {m === "paper" ? "📄 Paper" : "⚡ Live"}
            </button>
          ))}
        </div>

        {mode === "paper" && (
          <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(28,105,240,0.2)", background: "rgba(28,105,240,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Paper Balance</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1C69F0" }}>${paperBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Total P&L</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: pnl >= 0 ? "#0ED359" : "#f87171" }}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} ({((pnl / 10000) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {mode === "live" && (
          <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["binance", "bybit"] as const).map((ex) => (
              <button key={ex} onClick={() => setExchange(ex)}
                style={{ flex: 1, padding: "8px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none", background: exchange === ex ? color + "18" : "transparent", color: exchange === ex ? color : "rgba(255,255,255,0.3)", transition: "all 0.15s", textTransform: "capitalize" }}>
                {ex === "binance" ? "🟡 Binance" : "🟠 Bybit"}
              </button>
            ))}
          </div>
        )}

        {/* Symbol */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Symbol</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" }}>
            {SYMBOLS.map((s) => <option key={s} value={s} style={{ background: "#1a1a2e" }}>{s.replace("USDT", " / USDT")}</option>)}
          </select>
        </div>

        {/* BUY / SELL */}
        <div style={{ display: "flex", gap: 8 }}>
          {(["BUY", "SELL"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              style={{ flex: 1, padding: "12px", borderRadius: 9, border: `1px solid ${side === s ? (s === "BUY" ? "#0ED35960" : "#f8717160") : "rgba(255,255,255,0.08)"}`, background: side === s ? (s === "BUY" ? "#0ED35920" : "#f8717120") : "transparent", color: side === s ? (s === "BUY" ? "#0ED359" : "#f87171") : "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}>
              {s === "BUY" ? "▲ LONG" : "▼ SHORT"}
            </button>
          ))}
        </div>

        {/* Quantity */}
        <div>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Quantity</label>
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} step="0.001" min="0"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {["0.001", "0.01", "0.1", "1"].map((q) => (
              <button key={q} onClick={() => setQty(q)} style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{q}</button>
            ))}
          </div>
        </div>

        {/* Execute button */}
        <button onClick={execute} disabled={loading}
          style={{ padding: "14px", borderRadius: 10, border: "none", background: loading ? "rgba(255,255,255,0.06)" : side === "BUY" ? "#0ED359" : "#f87171", color: loading ? "rgba(255,255,255,0.3)" : "#000", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.15s", letterSpacing: "0.04em" }}>
          {loading ? "Executing…" : `${side} ${symbol.replace("USDT", "")}`}
        </button>

        <AnimatePresence>
          {lastResult && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ padding: "10px 12px", borderRadius: 9, border: `1px solid ${resultType === "success" ? "#0ED35930" : "#f8717130"}`, background: `${resultType === "success" ? "#0ED359" : "#f87171"}0a`, fontSize: 11, color: resultType === "success" ? "#0ED359" : "#f87171" }}>
              {lastResult}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Order History */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Order History</p>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{orders.length} orders</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Symbol", "Side", "Qty", "Price", "Exchange", "Time"].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 500, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.15)" }}>No orders yet — place your first trade</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{o.symbol.replace("USDT", "/USDT")}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: o.side === "BUY" ? "#0ED359" : "#f87171", background: (o.side === "BUY" ? "#0ED359" : "#f87171") + "18", padding: "2px 8px", borderRadius: 4 }}>{o.side}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>{o.qty}</td>
                  <td style={{ padding: "10px 12px", fontSize: 11, color: "#fff", fontVariantNumeric: "tabular-nums" }}>${o.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: "10px 12px", fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "capitalize" }}>{o.exchange}</td>
                  <td style={{ padding: "10px 12px", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{new Date(o.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
