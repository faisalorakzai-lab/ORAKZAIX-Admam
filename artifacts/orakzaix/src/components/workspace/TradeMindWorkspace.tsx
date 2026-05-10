import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Model } from "../../layouts/AppShell";
import { useMarketPrices, useAISignals, useTradeAnalysis } from "../../hooks/useTradeMind";

const SIGNAL_COLOR: Record<string, string> = {
  LONG: "#0ED359", SHORT: "#f87171", HOLD: "#F59E0B", CAUTION: "#FB923C",
};

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP"];
const TIMEFRAMES = ["15m", "1H", "4H", "1D", "1W"];

const SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", BNB: "BNBUSDT", XRP: "XRPUSDT",
};

function PriceTicker({ label, price, change, color = "#0ED359" }: {
  label: string; price: string; change: number | null; color?: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{price}</div>
        {change !== null && (
          <div style={{ fontSize: 10, color: up ? color : "#f87171", marginTop: 1 }}>
            {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}

function LiveDot({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#0ED359" : "#f87171", boxShadow: active ? "0 0 8px #0ED359" : "none", animation: active ? "pulse 2s infinite" : "none" }} />
      <span style={{ fontSize: 10, color: active ? "#0ED359" : "#f87171", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {active ? "Live" : "Offline"}
      </span>
    </div>
  );
}

function TradingViewChart({ symbol, theme = "dark" }: { symbol: string; theme?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!container.current) return;
    if (scriptRef.current) scriptRef.current.remove();
    container.current.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    container.current.appendChild(wrapper);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${symbol}`,
      interval: "D",
      timezone: "Etc/UTC",
      theme,
      style: "1",
      locale: "en",
      backgroundColor: "rgba(0,0,0,0)",
      gridColor: "rgba(255,255,255,0.04)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    container.current.appendChild(script);
    scriptRef.current = script;
  }, [symbol]);

  return (
    <div ref={container} className="tradingview-widget-container" style={{ height: "100%", width: "100%" }} />
  );
}

function AnalysisPanel({ model, asset, timeframe }: { model: Model; asset: string; timeframe: string }) {
  const { result, loading, analyze } = useTradeAnalysis();
  const [query, setQuery] = useState("");
  const [hasRun, setHasRun] = useState(false);

  const run = async () => {
    setHasRun(true);
    await analyze(asset, timeframe, query || undefined);
  };

  useEffect(() => {
    setHasRun(false);
  }, [asset, timeframe]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: model.color, boxShadow: `0 0 6px ${model.color}` }} />
          <span style={{ fontSize: 10, color: model.color, letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Deep Analysis</span>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
              {[100, 85, 95, 70, 90].map((w, i) => (
                <div key={i} style={{ height: 8, borderRadius: 4, background: `rgba(255,255,255,0.04)`, width: `${w}%`, animation: "shimmer 1.5s infinite" }} />
              ))}
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4, letterSpacing: "0.06em" }}>
                Analyzing {asset}/{timeframe} with live data…
              </p>
            </motion.div>
          ) : result && hasRun ? (
            <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{result.asset} · {result.timeframe}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: SIGNAL_COLOR[result.signal] ?? "#F59E0B", background: `${SIGNAL_COLOR[result.signal] ?? "#F59E0B"}18`, padding: "3px 10px", borderRadius: 5, letterSpacing: "0.08em" }}>
                    {result.signal}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{result.confidence}%</span>
                </div>
              </div>
              {result.marketData.price && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                  <div style={{ padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>Price</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", fontVariantNumeric: "tabular-nums" }}>${result.marketData.price.toLocaleString()}</p>
                  </div>
                  {result.marketData.btcDominance && (
                    <div style={{ padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>BTC Dom.</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#F59E0B" }}>{result.marketData.btcDominance.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              )}
              <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", marginBottom: 10, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${result.confidence}%` }} transition={{ duration: 0.8 }}
                  style={{ height: "100%", borderRadius: 99, background: SIGNAL_COLOR[result.signal] ?? "#F59E0B" }} />
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result.analysis}</p>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
                {new Date(result.timestamp).toLocaleTimeString()}
              </p>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
                Ask TradeMind AI for a live analysis of {asset} on the {timeframe} timeframe — powered by real market data and Claude AI.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && run()}
          placeholder={`Ask about ${asset}…`}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit" }}
        />
        <button
          onClick={run}
          disabled={loading}
          style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: loading ? "rgba(255,255,255,0.06)" : model.color, color: loading ? "rgba(255,255,255,0.3)" : "#000", fontSize: 12, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.2s", minWidth: 64 }}>
          {loading ? "…" : "Analyze"}
        </button>
      </div>
    </div>
  );
}

export default function TradeMindWorkspace({ model }: { model: Model }) {
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [selectedTF, setSelectedTF] = useState("1D");
  const { data: prices, loading: pricesLoading } = useMarketPrices(15000);
  const { signals, loading: signalsLoading, refetch: refetchSignals } = useAISignals(90000);

  const btcData = prices?.crypto?.["BTCUSDT"];
  const ethData = prices?.crypto?.["ETHUSDT"];
  const solData = prices?.crypto?.["SOLUSDT"];
  const bnbData = prices?.crypto?.["BNBUSDT"];
  const xrpData = prices?.crypto?.["XRPUSDT"];

  const selectedSymbol = SYMBOL_MAP[selectedAsset] ?? "BTCUSDT";

  return (
    <div style={{ minHeight: "100%", padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes shimmer { 0%,100% { opacity:0.06 } 50% { opacity:0.12 } }
      `}</style>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: model.color, boxShadow: `0 0 10px ${model.color}` }} />
            <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>TradeMind AI</span>
            <LiveDot active={!pricesLoading && !!prices} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 300, color: "#fff", letterSpacing: "-0.02em" }}>Financial Intelligence Terminal</h1>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {ASSETS.map((a) => (
            <button key={a} onClick={() => setSelectedAsset(a)}
              style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${selectedAsset === a ? model.color + "60" : "rgba(255,255,255,0.08)"}`, background: selectedAsset === a ? model.color + "15" : "transparent", color: selectedAsset === a ? model.color : "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              {a}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Main 3-col grid */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 260px", gap: 12, flex: 1, minHeight: 0 }}>

        {/* LEFT — live watchlist */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Live Prices</p>

          {pricesLoading && !prices ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 50, borderRadius: 10, background: "rgba(255,255,255,0.03)", animation: "shimmer 1.5s infinite" }} />
            ))
          ) : (
            <>
              <PriceTicker label="BTC/USD" price={btcData ? `$${btcData.price.toLocaleString()}` : "—"} change={btcData?.change24h ?? null} />
              <PriceTicker label="ETH/USD" price={ethData ? `$${ethData.price.toLocaleString()}` : "—"} change={ethData?.change24h ?? null} color="#8B5CF6" />
              <PriceTicker label="SOL/USD" price={solData ? `$${solData.price.toLocaleString()}` : "—"} change={solData?.change24h ?? null} color="#14F195" />
              <PriceTicker label="BNB/USD" price={bnbData ? `$${bnbData.price.toLocaleString()}` : "—"} change={bnbData?.change24h ?? null} color="#F0B90B" />
              <PriceTicker label="XRP/USD" price={xrpData ? `$${xrpData.price.toLocaleString()}` : "—"} change={xrpData?.change24h ?? null} color="#346AA9" />
              {prices?.gold && prices.gold.price != null && (
                <PriceTicker label="XAU/USD" price={`$${prices.gold.price.toLocaleString()}`} change={prices.gold.change} color="#F59E0B" />
              )}
              {prices?.spx && prices.spx.price != null && (
                <PriceTicker label="SPX" price={prices.spx.price.toLocaleString()} change={prices.spx.change} color="#1C69F0" />
              )}
            </>
          )}

          {/* BTC Dominance */}
          {prices?.btcDominance && (
            <div style={{ marginTop: 4, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>BTC Dominance</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${prices.btcDominance}%`, background: "#F59E0B", borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#F59E0B" }}>{prices.btcDominance.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Timeframe selector */}
          <div style={{ marginTop: 4, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Timeframe</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {TIMEFRAMES.map((tf) => (
                <button key={tf} onClick={() => setSelectedTF(tf)}
                  style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${selectedTF === tf ? model.color + "60" : "rgba(255,255,255,0.06)"}`, background: selectedTF === tf ? model.color + "15" : "transparent", color: selectedTF === tf ? model.color : "rgba(255,255,255,0.3)", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CENTER — TradingView chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
          style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div style={{ flex: 1, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "#000", overflow: "hidden", minHeight: 300 }}>
            <TradingViewChart symbol={selectedSymbol} />
          </div>
        </motion.div>

        {/* RIGHT — AI signals + analysis */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>

          {/* AI Signals header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>AI Signals</p>
            <button onClick={refetchSignals} disabled={signalsLoading}
              style={{ fontSize: 9, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: signalsLoading ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.35)", cursor: signalsLoading ? "default" : "pointer", fontFamily: "inherit" }}>
              {signalsLoading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          {/* Signal cards */}
          <AnimatePresence>
            {signalsLoading && signals.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 72, borderRadius: 12, background: "rgba(255,255,255,0.03)", animation: "shimmer 1.5s infinite" }} />
              ))
            ) : signals.length > 0 ? (
              signals.map((sig, i) => (
                <motion.div key={`${sig.asset}-${i}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  style={{ padding: "11px 13px", borderRadius: 12, border: `1px solid ${SIGNAL_COLOR[sig.signal] ?? "#888"}25`, background: `${SIGNAL_COLOR[sig.signal] ?? "#888"}07` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{sig.asset}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: SIGNAL_COLOR[sig.signal] ?? "#888", background: `${SIGNAL_COLOR[sig.signal] ?? "#888"}18`, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em" }}>
                      {sig.signal}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>Confidence</span>
                    <span style={{ fontSize: 10, color: SIGNAL_COLOR[sig.signal] ?? "#888" }}>{sig.confidence}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 6 }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${sig.confidence}%` }} transition={{ duration: 0.7, delay: 0.3 + i * 0.06 }}
                      style={{ height: "100%", borderRadius: 99, background: SIGNAL_COLOR[sig.signal] ?? "#888" }} />
                  </div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.4 }}>{sig.reason}</p>
                </motion.div>
              ))
            ) : (
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Click Refresh to load live AI signals</p>
              </div>
            )}
          </AnimatePresence>

          {/* Deep Analysis */}
          <AnalysisPanel model={model} asset={selectedAsset} timeframe={selectedTF} />
        </motion.div>
      </div>
    </div>
  );
}
