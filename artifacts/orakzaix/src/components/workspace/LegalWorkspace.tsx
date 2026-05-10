import { useState } from "react";
import { motion } from "framer-motion";
import type { Model } from "../../layouts/AppShell";

const DOCUMENT_TYPES = [
  { id: "nda",        label: "NDA",              desc: "Non-Disclosure Agreement" },
  { id: "contract",   label: "Contract",          desc: "Service Agreement" },
  { id: "terms",      label: "Terms of Service",  desc: "Platform Terms" },
  { id: "privacy",    label: "Privacy Policy",    desc: "Data Policy" },
  { id: "mou",        label: "MOU",               desc: "Memorandum of Understanding" },
  { id: "ip",         label: "IP Assignment",     desc: "Intellectual Property" },
];

export default function LegalWorkspace({ model }: { model: Model }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "32px 28px 24px", maxWidth: 960, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: model.color, boxShadow: `0 0 10px ${model.color}` }} />
          <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Legal AI</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 300, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6 }}>
          Legal Document Intelligence
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 300 }}>
          Draft, review, and analyse legal documents with AI precision.
        </p>
      </motion.div>

      {/* Two column layout */}
      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>

        {/* LEFT — document type picker */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.06 }}
          style={{ width: 210, flexShrink: 0 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.15em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: 10 }}>
            Document Type
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {DOCUMENT_TYPES.map((doc) => {
              const isSelected = selected === doc.id;
              return (
                <motion.button key={doc.id}
                  onClick={() => setSelected(doc.id)}
                  whileHover={{ borderColor: `${model.color}40` }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                    padding: "10px 12px", borderRadius: 10, textAlign: "left",
                    border: `1px solid ${isSelected ? model.color + "40" : "rgba(255,255,255,0.07)"}`,
                    background: isSelected ? `${model.color}0f` : "rgba(255,255,255,0.02)",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                  }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: isSelected ? "#fff" : "rgba(255,255,255,0.5)" }}>
                    {doc.label}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
                    {doc.desc}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* RIGHT — editor */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            {["Parties", "Jurisdiction", "Clauses", "Date"].map((tool) => (
              <button key={tool} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.08)", background: "transparent",
                color: "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "inherit",
              }}>
                {tool}
              </button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontFamily: "inherit" }}>Export PDF</button>
            </div>
          </div>

          {/* Editor area */}
          <div style={{
            flex: 1, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)", overflow: "hidden", display: "flex", flexDirection: "column",
          }}>
            {/* Doc header bar */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.7)" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>
                {selected ? DOCUMENT_TYPES.find((d) => d.id === selected)?.label + " Draft" : "Select a document type to begin"}
              </span>
              {selected && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: model.color, background: `${model.color}15`, padding: "2px 8px", borderRadius: 4 }}>
                  AI Ready
                </span>
              )}
            </div>

            {/* Text area */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={selected
                ? "Describe the parties, key terms, and requirements for your document…"
                : "Select a document type from the left panel to get started."}
              disabled={!selected}
              style={{
                flex: 1, padding: "18px 20px", background: "transparent",
                border: "none", outline: "none", resize: "none",
                color: "#fff", fontSize: 14, fontFamily: "'Georgia', serif",
                lineHeight: 1.8, opacity: selected ? 1 : 0.3,
              }}
            />
          </div>

          {/* Action bar */}
          <div style={{ display: "flex", gap: 10 }}>
            <motion.button disabled={!selected}
              whileHover={selected ? { boxShadow: `0 0 20px ${model.color}40` } : {}}
              style={{
                flex: 1, padding: "12px", borderRadius: 10,
                background: selected ? `linear-gradient(135deg, ${model.color}, #6d28d9)` : "rgba(255,255,255,0.05)",
                border: "none", color: selected ? "#fff" : "rgba(255,255,255,0.2)",
                fontSize: 13, fontWeight: 500, cursor: selected ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}>
              Draft with AI
            </motion.button>
            <button style={{
              padding: "12px 20px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent", color: "rgba(255,255,255,0.3)",
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>
              Review
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
