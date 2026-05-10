import { useState } from "react";
import { motion } from "framer-motion";
import type { Model } from "../../layouts/AppShell";

export default function PromptWorkspace({ model }: { model: Model }) {
  const [input, setInput] = useState("");

  const suggestions = [
    "Write a product launch strategy for a B2B SaaS company",
    "Create a compelling investor pitch for a fintech startup",
    "Draft a go-to-market plan for Southeast Asian markets",
    "Analyze competitive positioning for an AI platform",
  ];

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "32px 28px 24px", maxWidth: 860, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: model.color, boxShadow: `0 0 10px ${model.color}` }} />
          <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Prompt AI</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 300, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6 }}>
          What do you want to create?
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 300 }}>
          Intelligent prompting for business, creative, and strategic work.
        </p>
      </motion.div>

      {/* Main prompt area */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
        style={{ position: "relative", marginBottom: 20 }}>
        <div style={{
          borderRadius: 16, border: "1px solid rgba(255,255,255,0.09)",
          background: "rgba(255,255,255,0.025)",
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
          transition: "border-color 0.2s",
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to build, write, or solve..."
            rows={6}
            style={{
              width: "100%", padding: "20px 20px 0", background: "transparent",
              border: "none", outline: "none", resize: "none",
              color: "#fff", fontSize: 15, fontFamily: "inherit",
              lineHeight: 1.65, boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 16px" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {["Business", "Creative", "Strategy", "Technical"].map((tag) => (
                <button key={tag} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "inherit",
                }}>
                  {tag}
                </button>
              ))}
            </div>
            <motion.button
              whileHover={{ boxShadow: `0 0 20px ${model.color}50`, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 10,
                background: `linear-gradient(135deg, ${model.color}, #1254c4)`,
                border: "none", color: "#fff", fontSize: 13,
                fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Generate
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Suggestions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
          Suggestions
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {suggestions.map((s, i) => (
            <motion.button key={i}
              onClick={() => setInput(s)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + i * 0.05 }}
              whileHover={{ borderColor: "rgba(28,105,240,0.4)", background: "rgba(28,105,240,0.05)" }}
              style={{
                padding: "14px 16px", borderRadius: 12, textAlign: "left",
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.02)",
                color: "rgba(255,255,255,0.5)", fontSize: 12,
                lineHeight: 1.5, cursor: "pointer",
                fontFamily: "inherit", transition: "all 0.2s",
              }}>
              {s}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
        style={{ display: "flex", gap: 20, marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {[
          { label: "Prompts Generated", value: "—" },
          { label: "Avg Response Time", value: "—" },
          { label: "Success Rate", value: "—" },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 18, fontWeight: 300, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{s.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
