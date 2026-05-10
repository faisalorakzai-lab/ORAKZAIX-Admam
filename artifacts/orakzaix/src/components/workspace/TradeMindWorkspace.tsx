import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Model } from "../../layouts/AppShell";

function useFakePrice(base: number, volatility = 0.003) {
  const [price, setPrice] = useState(base);
  const [change, setChange] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setPrice((p) => {
        const delta = p * volatility * (Math.random() - 0.48);
        const next = parseFloat((p + delta).toFixed(2));
        setChange(parseFloat(delta.toFixed(2)));
        return next;
      });
    }, 1800);
    return () => clearInterval(id);
  }, [volatility]);
  return { price, change };
}

function Ticker({ symbol, base, vol }: { symbol: string; base: number; vol?: number }) {
  const { price, change } = useFakePrice(base, vol);
  const up = change >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em" }}>{symbol}</span>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#fff", fontVariantNumeric: "tabular-nums" }}>${price.toLocaleString()}</div>
        <div style={{ fontSize: 10, color: up ? "#0ED359" : "#f87171", marginTop: 1 }}>
          {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function MiniChart({ color }: { color: string }) {
  const points = Array.from({ length: 18 }, () => 30 + Math.random() * 40);
  const max = Math.max(...points), min = Math.min(...points);
  const norm = (v: number) => ((v - min) / (max - min)) * 60;
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * 220},${70 - norm(v)}`).join(" ");
  return (
    <svg width="100%" height="70" viewBox="0 0 220 70" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path}L220,70L0,70Z`} fill={`url(#grad-${color})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const AI_SIGNALS = [
  { asset: "BTC/USD", signal: "LONG", confidence: 87, reason: "Bullish structure above 200 EMA" },
  { asset: "ETH/USD", signal: "HOLD", confidence: 63, reason: "Consolidating near key resistance" },
  { asset: "Gold",    signal: "LONG", confidence: 79, reason: "Safe-haven demand increasing" },
  { asset: "S&P 500", signal: "CAUTION", confidence: 55, reason: "Overbought on daily RSI" },
];

const SIGNAL_COLOR: Record<string, string> = {
  LONG: "#0ED359", HOLD: "#F59E0B", SHORT: "#f87171", CAUTION: "#FB923C",
};

export default function TradeMindWorkspace({ model }: { model: Model }) {
  return (
    <div style={{ minHeight: "100%", padding: "24px 24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: model.color, boxShadow: `0 0 10px ${model.color}` }} />
            <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>TradeMind AI</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: "#fff", letterSpacing: "-0.02em" }}>Financial Intelligence Terminal</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["1H", "4H", "1D", "1W"].map((tf) => (
            <button key={tf} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: tf === "1D" ? "rgba(14,211,89,0.1)" : "transparent", color: tf === "1D" ? "#0ED359" : "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              {tf}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", gap: 14, flex: 1, minHeight: 0 }}>

        {/* LEFT — watchlist */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Watchlist</p>
          <Ticker symbol="BTC/USD" base={67420} vol={0.004} />
          <Ticker symbol="ETH/USD" base={3540}  vol={0.005} />
          <Ticker symbol="XAU/USD" base={2318}  vol={0.002} />
          <Ticker symbol="SPX"     base={5240}  vol={0.0015} />
          <Ticker symbol="NQ100"   base={18340} vol={0.002} />
          <Ticker symbol="DXY"     base={104.2} vol={0.001} />

          {/* Session status */}
          <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Session</p>
            {[{ label: "New York", status: "Open", dot: "#0ED359" }, { label: "London", status: "Closed", dot: "#f87171" }, { label: "Tokyo", status: "Closed", dot: "#f87171" }].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{s.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
                  <span style={{ fontSize: 10, color: s.dot }}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CENTER — chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
          style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* Chart panel */}
          <div style={{ flex: 1, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>BTC / USD</span>
                <span style={{ fontSize: 22, fontWeight: 300, color: "#fff", fontVariantNumeric: "tabular-nums" }}>$67,420</span>
                <span style={{ fontSize: 12, color: "#0ED359" }}>▲ 2.34%</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Candles", "EMA", "RSI", "MACD"].map((ind) => (
                  <button key={ind} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.28)", cursor: "pointer", fontFamily: "inherit" }}>
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* Fake chart placeholder */}
            <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", inset: 0, padding: "20px 20px 10px" }}>
                {/* Grid lines */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ position: "absolute", left: 20, right: 20, top: `${20 + i * 16}%`, height: 1, background: "rgba(255,255,255,0.03)" }} />
                ))}
                {/* Chart path */}
                <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="none" style={{ display: "block" }}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ED359" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#0ED359" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.8, ease: "easeInOut" }}
                    d="M0,160 C30,155 60,140 90,130 C120,120 140,145 170,125 C200,105 220,90 260,80 C300,70 320,95 360,75 C400,55 420,60 460,45 C500,30 530,40 570,30 L600,25"
                    fill="none" stroke="#0ED359" strokeWidth="1.8" strokeLinecap="round"
                  />
                  <motion.path
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.8, delay: 0.3 }}
                    d="M0,160 C30,155 60,140 90,130 C120,120 140,145 170,125 C200,105 220,90 260,80 C300,70 320,95 360,75 C400,55 420,60 460,45 C500,30 530,40 570,30 L600,25 L600,200 L0,200 Z"
                    fill="url(#chartGrad)"
                  />
                  {/* EMA line */}
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.8, delay: 0.2 }}
                    d="M0,155 C60,140 120,130 180,120 C240,110 300,100 360,88 C420,76 480,60 600,45"
                    fill="none" stroke="#1C69F0" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
                  />
                </svg>
              </div>
              {/* Watermark */}
              <div style={{ position: "absolute", bottom: 12, right: 16, fontSize: 10, color: "rgba(255,255,255,0.08)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                TradeMind AI · Preview Mode
              </div>
            </div>
          </div>

          {/* Bottom mini charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[{ label: "ETH/USD", color: "#8B5CF6" }, { label: "Gold", color: "#F59E0B" }].map((c) => (
              <div key={c.label} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", overflow: "hidden", padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{c.label}</span>
                  <span style={{ fontSize: 10, color: c.color }}>▲ 1.2%</span>
                </div>
                <MiniChart color={c.color} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* RIGHT — AI signals */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>AI Signals</p>

          {AI_SIGNALS.map((sig, i) => (
            <motion.div key={sig.asset} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
              style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${SIGNAL_COLOR[sig.signal]}25`, background: `${SIGNAL_COLOR[sig.signal]}08` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{sig.asset}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: SIGNAL_COLOR[sig.signal], background: `${SIGNAL_COLOR[sig.signal]}18`, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em" }}>
                  {sig.signal}
                </span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Confidence</span>
                  <span style={{ fontSize: 10, color: SIGNAL_COLOR[sig.signal] }}>{sig.confidence}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${sig.confidence}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.06 }}
                    style={{ height: "100%", borderRadius: 99, background: SIGNAL_COLOR[sig.signal] }} />
                </div>
              </div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.4 }}>{sig.reason}</p>
            </motion.div>
          ))}

          {/* AI Summary */}
          <div style={{ marginTop: 4, padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: model.color, boxShadow: `0 0 6px ${model.color}` }} />
              <span style={{ fontSize: 10, color: model.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>AI Market Summary</span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.65 }}>
              Markets trending bullish on risk assets. Dollar weakening supports commodities. Watch NY session open for momentum confirmation.
            </p>
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(14,211,89,0.06)", border: "1px solid rgba(14,211,89,0.15)" }}>
              <span style={{ fontSize: 10, color: "#0ED359" }}>⚡ Live trading backend — Coming Phase 4</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
