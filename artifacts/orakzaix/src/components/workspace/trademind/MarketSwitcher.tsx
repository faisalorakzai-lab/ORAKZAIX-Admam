import { useState } from "react";
import { motion } from "framer-motion";

export type Market = "crypto" | "forex" | "indices" | "commodities";

interface MarketOption {
  id: Market;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const MARKET_OPTIONS: MarketOption[] = [
  {
    id: "crypto",
    name: "Crypto",
    icon: "₿",
    description: "Bitcoin, Ethereum, Altcoins",
    color: "#F7931A",
  },
  {
    id: "forex",
    name: "Forex",
    icon: "💱",
    description: "EUR/USD, GBP/USD, Pairs",
    color: "#0ED359",
  },
  {
    id: "indices",
    name: "Indices",
    icon: "📊",
    description: "US30, NASDAQ, SPX500",
    color: "#1C69F0",
  },
  {
    id: "commodities",
    name: "Commodities",
    icon: "🛢️",
    description: "Gold, Silver, Oil",
    color: "#F59E0B",
  },
];

interface MarketSwitcherProps {
  activeMarket: Market;
  onMarketChange: (market: Market) => void;
}

export default function MarketSwitcher({ activeMarket, onMarketChange }: MarketSwitcherProps) {
  const [expanded, setExpanded] = useState(false);

  const activeOption = MARKET_OPTIONS.find((m) => m.id === activeMarket);

  return (
    <div style={{ position: "relative" }}>
      {/* Main Button */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          border: `1px solid ${activeOption?.color}40`,
          background: `${activeOption?.color}12`,
          color: activeOption?.color,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.2s",
        }}
        whileHover={{ background: `${activeOption?.color}20` }}
      >
        <span style={{ fontSize: 16 }}>{activeOption?.icon}</span>
        <span>{activeOption?.name}</span>
        <span style={{ fontSize: 12, marginLeft: 4 }}>▼</span>
      </motion.button>

      {/* Dropdown Menu */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 8,
            background: "rgba(20, 20, 35, 0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            overflow: "hidden",
            backdropFilter: "blur(10px)",
            zIndex: 1000,
            minWidth: 280,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          {MARKET_OPTIONS.map((option) => (
            <motion.button
              key={option.id}
              onClick={() => {
                onMarketChange(option.id);
                setExpanded(false);
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: activeMarket === option.id ? `${option.color}20` : "transparent",
                color: activeMarket === option.id ? option.color : "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 12,
                transition: "all 0.15s",
                borderBottom: option.id !== MARKET_OPTIONS[MARKET_OPTIONS.length - 1].id ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
              whileHover={{ background: `${option.color}15` }}
            >
              <span style={{ fontSize: 18 }}>{option.icon}</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 600, color: activeMarket === option.id ? option.color : "rgba(255,255,255,0.85)" }}>
                  {option.name}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{option.description}</div>
              </div>
              {activeMarket === option.id && (
                <div style={{ marginLeft: "auto", color: option.color, fontSize: 14 }}>✓</div>
              )}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Close overlay when clicking outside */}
      {expanded && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
