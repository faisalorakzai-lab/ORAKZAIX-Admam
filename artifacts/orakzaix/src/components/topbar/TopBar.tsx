import { motion, AnimatePresence } from "framer-motion";
import type { Model } from "../../layouts/AppShell";

interface TopBarProps {
  model: Model;
  user: { displayName: string | null; email: string | null; photoURL: string | null };
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function TopBar({ model, user, sidebarOpen, onToggleSidebar }: TopBarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        height: 54,
        flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,0.055)",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(20px)",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Left: hamburger + breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={onToggleSidebar}
          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", padding: 4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {sidebarOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>

        {/* Active model badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={model.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: model.color,
              boxShadow: `0 0 8px ${model.color}`,
            }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)", letterSpacing: "0.02em" }}>
              {model.name}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>·</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", letterSpacing: "0.01em" }}>
              {model.tag}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Center: status */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: "50%", background: "#0ED359" }}
        />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          System Online
        </span>
      </div>

      {/* Right: user */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right", display: "none" }} className="sm-block">
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{user.displayName}</div>
        </div>
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
              opacity: 0.9,
            }}
          />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(28,105,240,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "#fff", fontWeight: 500,
          }}>
            {(user.displayName || user.email || "?")[0].toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
