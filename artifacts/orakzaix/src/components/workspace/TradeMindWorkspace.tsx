import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Model } from "../../layouts/AppShell";
import MarketScanner from "./trademind/MarketScanner";
import TradeExecution from "./trademind/TradeExecution";
import RiskManager from "./trademind/RiskManager";
import NewsIntelligence from "./trademind/NewsIntelligence";
import PortfolioIntelligence from "./trademind/PortfolioIntelligence";
import StrategyBrain from "./trademind/StrategyBrain";
import AIAnalyst from "./trademind/AIAnalyst";

interface Bot {
  id: string;
  name: string;
  tagline: string;
  description: string;
  color: string;
  icon: string;
  status: "ACTIVE" | "IDLE" | "LIVE";
  stats: { label: string; value: string }[];
}

const BOTS: Bot[] = [
  {
    id: "scanner",
    name: "Market Scanner",
    tagline: "Live Market Scanning",
    description: "Scans 10 assets in real-time for breakouts, trend changes, RSI divergences, and volume spikes across any timeframe.",
    color: "#00D4FF",
    icon: "📡",
    status: "ACTIVE",
    stats: [{ label: "Assets", value: "10" }, { label: "Intervals", value: "6" }],
  },
  {
    id: "execution",
    name: "Trade Execution",
    tagline: "Binance · Bybit · Paper",
    description: "Execute trades on Binance and Bybit in paper or live mode. Full order history and position tracking.",
    color: "#0ED359",
    icon: "⚡",
    status: "LIVE",
    stats: [{ label: "Exchanges", value: "2" }, { label: "Mode", value: "Paper" }],
  },
  {
    id: "risk",
    name: "Risk Manager",
    tagline: "Drawdown Protection",
    description: "Controls stop-loss, max drawdown, leverage limits, and emergency shutdown. The most important bot.",
    color: "#f87171",
    icon: "🛡️",
    status: "ACTIVE",
    stats: [{ label: "Risk", value: "LOW" }, { label: "DD", value: "0%" }],
  },
  {
    id: "news",
    name: "News Intelligence",
    tagline: "Macro · Sentiment · Fear/Greed",
    description: "Real-time Fear & Greed Index, BTC dominance, global market cap, top gainers, and market regime analysis.",
    color: "#8B5CF6",
    icon: "📰",
    status: "ACTIVE",
    stats: [{ label: "Sources", value: "3" }, { label: "F&G", value: "Live" }],
  },
  {
    id: "portfolio",
    name: "Portfolio Intelligence",
    tagline: "Binance · Bybit · Paper P&L",
    description: "Live portfolio view across Binance, Bybit, and paper trading accounts. Allocation charts and P&L tracking.",
    color: "#F59E0B",
    icon: "💼",
    status: "ACTIVE",
    stats: [{ label: "Accounts", value: "3" }, { label: "PnL", value: "Live" }],
  },
  {
    id: "strategy",
    name: "Strategy Brain",
    tagline: "AI Quant Strategist",
    description: "Generates full institutional strategies with precise entry, stop-loss, take-profit, and risk/reward for any asset.",
    color: "#06B6D4",
    icon: "⚙️",
    status: "IDLE",
    stats: [{ label: "Styles", value: "4" }, { label: "Engine", value: "Claude" }],
  },
  {
    id: "analyst",
    name: "AI Analyst",
    tagline: "Institutional Reports",
    description: "Claude writes daily intelligence briefs, trade analyses, and weekly outlooks using live market data.",
    color: "#EC4899",
    icon: "📋",
    status: "IDLE",
    stats: [{ label: "Report Types", value: "3" }, { label: "AI", value: "Opus" }],
  },
];

const STATUS_COLOR = { ACTIVE: "#0ED359", LIVE: "#F59E0B", IDLE: "#6b7280" };
const STATUS_PULSE = { ACTIVE: true, LIVE: true, IDLE: false };

function BotCard({ bot, onOpen }: { bot: Bot; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3 }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: "pointer",
        padding: "20px",
        borderRadius: 16,
        border: `1px solid ${hovered ? bot.color + "40" : "rgba(255,255,255,0.07)"}`,
        background: hovered ? `${bot.color}08` : "rgba(255,255,255,0.02)",
        display: "flex", flexDirection: "column", gap: 12,
        transition: "border-color 0.2s, background 0.2s",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Glow bg */}
      {hovered && (
        <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: bot.color, opacity: 0.06, filter: "blur(30px)", pointerEvents: "none" }} />
      )}

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22, lineHeight: 1 }}>{bot.icon}</div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: hovered ? "#fff" : "rgba(255,255,255,0.85)", margin: 0, letterSpacing: "-0.01em" }}>{bot.name}</h3>
            <p style={{ fontSize: 10, color: bot.color, margin: "2px 0 0", letterSpacing: "0.05em" }}>{bot.tagline}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: STATUS_COLOR[bot.status], animation: STATUS_PULSE[bot.status] ? "pulse 2s infinite" : "none" }} />
          <span style={{ fontSize: 9, color: STATUS_COLOR[bot.status], fontWeight: 600, letterSpacing: "0.1em" }}>{bot.status}</span>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, margin: 0 }}>{bot.description}</p>

      {/* Stats + launch */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {bot.stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: bot.color }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div style={{
          padding: "6px 14px", borderRadius: 8, border: `1px solid ${bot.color}40`,
          background: hovered ? bot.color + "20" : "transparent",
          color: bot.color, fontSize: 11, fontWeight: 600, transition: "background 0.2s",
          letterSpacing: "0.04em",
        }}>
          Launch →
        </div>
      </div>
    </motion.div>
  );
}

const BOT_COMPONENTS: Record<string, React.ComponentType<{ color: string }>> = {
  scanner: MarketScanner,
  execution: TradeExecution,
  risk: RiskManager,
  news: NewsIntelligence,
  portfolio: PortfolioIntelligence,
  strategy: StrategyBrain,
  analyst: AIAnalyst,
};

export default function TradeMindWorkspace({ model }: { model: Model }) {
  const [activeBot, setActiveBot] = useState<Bot | null>(null);

  const BotComponent = activeBot ? BOT_COMPONENTS[activeBot.id] : null;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      {/* ── Header ── */}
      <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {activeBot && (
            <button onClick={() => setActiveBot(null)}
              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              ←
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: activeBot ? activeBot.color : model.color, boxShadow: `0 0 10px ${activeBot ? activeBot.color : model.color}` }} />
            <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>TradeMind AI</span>
            {activeBot && (
              <>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>›</span>
                <span style={{ fontSize: 11, color: activeBot.color, fontWeight: 600 }}>{activeBot.name}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0ED359", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#0ED359", letterSpacing: "0.12em" }}>LIVE</span>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "18px 22px 20px" }}>
        <AnimatePresence mode="wait">
          {!activeBot ? (
            <motion.div key="hub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
              {/* Hub title */}
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 300, color: "#fff", letterSpacing: "-0.02em", margin: "0 0 4px" }}>
                  Financial Intelligence Hub
                </h1>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>
                  7 live AI agents — click any agent to launch its full workspace
                </p>
              </div>

              {/* Bot grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {BOTS.map((bot, i) => (
                  <motion.div key={bot.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <BotCard bot={bot} onOpen={() => setActiveBot(bot)} />
                  </motion.div>
                ))}
              </div>

              {/* Bottom status bar */}
              <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>System Status</span>
                {[
                  { label: "Binance API", color: "#0ED359" },
                  { label: "Bybit API", color: "#0ED359" },
                  { label: "Claude AI", color: "#0ED359" },
                  { label: "CMC Data", color: "#0ED359" },
                  { label: "Fear & Greed", color: "#0ED359" },
                ].map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key={activeBot.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}
              style={{ height: "calc(100vh - 160px)" }}>
              {/* Bot workspace header */}
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{activeBot.icon}</span>
                    <h2 style={{ fontSize: 18, fontWeight: 400, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>{activeBot.name}</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: STATUS_COLOR[activeBot.status], animation: STATUS_PULSE[activeBot.status] ? "pulse 2s infinite" : "none" }} />
                      <span style={{ fontSize: 9, color: STATUS_COLOR[activeBot.status], fontWeight: 600, letterSpacing: "0.1em" }}>{activeBot.status}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "4px 0 0", paddingLeft: 28 }}>{activeBot.tagline}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {BOTS.map((b) => (
                    <button key={b.id} onClick={() => setActiveBot(b)}
                      style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${activeBot.id === b.id ? b.color + "60" : "rgba(255,255,255,0.08)"}`, background: activeBot.id === b.id ? b.color + "18" : "transparent", color: activeBot.id === b.id ? b.color : "rgba(255,255,255,0.25)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      title={b.name}>
                      {b.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot content */}
              {BotComponent && <BotComponent color={activeBot.color} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
