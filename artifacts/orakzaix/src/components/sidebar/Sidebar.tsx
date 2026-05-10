import { motion, AnimatePresence } from "framer-motion";
import type { Model, ModelId } from "../../layouts/AppShell";

interface SidebarProps {
  models: Model[];
  comingSoon: { name: string; tag: string }[];
  activeModel: ModelId;
  onSelect: (id: ModelId) => void;
  open: boolean;
  onToggle: () => void;
  user: { displayName: string | null; email: string | null; photoURL: string | null };
  onSignOut: () => void;
}

export default function Sidebar({ models, comingSoon, activeModel, onSelect, open, user, onSignOut }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-10 lg:hidden"
            style={{ background: "rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: open ? 240 : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-20 flex-shrink-0 flex flex-col overflow-hidden"
        style={{
          background: "rgba(8,8,8,0.95)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ width: 240 }} className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <img src="/orakzaix-logo.png" alt="OrakzaiX" style={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 300, letterSpacing: "0.08em" }}>Orakzai</span>
              <span style={{ color: "#0ED359", fontSize: 16, fontWeight: 600 }}>X</span>
            </div>
          </div>

          {/* Scroll area */}
          <div className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth: "none" }}>
            {/* Active models label */}
            <div className="px-5 mb-2">
              <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
                Active Models
              </span>
            </div>

            {/* Active model items */}
            {models.map((model) => {
              const isActive = activeModel === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => onSelect(model.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 14px 9px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    textAlign: "left",
                    margin: "1px 0",
                  }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      style={{
                        position: "absolute",
                        inset: "2px 6px",
                        borderRadius: 10,
                        background: `${model.color}12`,
                        border: `1px solid ${model.color}25`,
                      }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    />
                  )}

                  {/* Color dot */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: model.color,
                      boxShadow: isActive ? `0 0 8px ${model.color}80` : "none",
                      transition: "box-shadow 0.3s",
                    }} />
                  </div>

                  {/* Text */}
                  <div style={{ position: "relative", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: isActive ? "#fff" : "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.2s" }}>
                      {model.name}
                    </div>
                    <div style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                      {model.tag}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "12px 16px" }} />

            {/* Coming soon label */}
            <div className="px-5 mb-2">
              <span style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.15)", textTransform: "uppercase" }}>
                Coming Soon
              </span>
            </div>

            {/* Coming soon items */}
            {comingSoon.map((item) => (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 16px",
                  opacity: 0.4,
                  cursor: "not-allowed",
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                    {item.tag}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, letterSpacing: "0.08em", color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>
                    SOON
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* User section */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, opacity: 0.85 }} />
              ) : (
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(28,105,240,0.3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" }}>
                  {(user.displayName || user.email || "?")[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.displayName || "User"}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.email}
                </div>
              </div>
              <button
                onClick={onSignOut}
                title="Sign out"
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", padding: 4, flexShrink: 0, display: "flex" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
