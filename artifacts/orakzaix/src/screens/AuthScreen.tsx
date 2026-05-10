import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase/firebase";

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

type AuthMode = "login" | "signup";

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setName(""); setEmail(""); setPassword(""); setError(null); setShowPw(false); };
  const switchMode = (m: AuthMode) => { setMode(m); reset(); };

  const errMsg = (code = ""): string =>
    ({
      "auth/invalid-email": "Invalid email address.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Wrong email or password.",
      "auth/email-already-in-use": "Account already exists. Sign in instead.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/network-request-failed": "Network error. Check your connection.",
    }[code] ?? "Something went wrong. Try again.");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (mode === "signup" && !name.trim()) return setError("Please enter your full name.");
    if (!email.trim()) return setError("Please enter your email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onAuthSuccess();
    } catch (err: unknown) {
      setError(errMsg((err as { code?: string }).code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (gLoading) return;
    setGLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onAuthSuccess();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(errMsg(code));
      }
    } finally {
      setGLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black overflow-auto py-8 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(28,105,240,0.12) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(14,211,89,0.08) 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div className="relative w-full" style={{ maxWidth: 420 }}>

        {/* Logo */}
        <motion.div
          className="flex items-center justify-center gap-2 mb-8"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <img src="/orakzaix-logo.png" alt="OrakzaiX" style={{ width: 36, height: 36, objectFit: "contain" }} />
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ color: "#fff", fontSize: 20, fontWeight: 300, letterSpacing: "0.1em" }}>Orakzai</span>
            <span style={{ color: "#0ED359", fontSize: 20, fontWeight: 600 }}>X</span>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          }}
        >
          {/* Tab row */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {(["login", "signup"] as AuthMode[]).map((tab) => (
              <button
                key={tab}
                onClick={() => switchMode(tab)}
                style={{
                  flex: 1,
                  padding: "16px 0",
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  color: mode === tab ? "#fff" : "rgba(255,255,255,0.28)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "color 0.2s",
                }}
              >
                {tab === "login" ? "Sign In" : "Create Account"}
                {mode === tab && (
                  <motion.div
                    layoutId="tab-line"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 20,
                      right: 20,
                      height: 1,
                      borderRadius: 99,
                      background: "linear-gradient(90deg,#1C69F0,#0ED359)",
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Form area */}
          <div style={{ padding: "28px 28px 24px" }}>

            {/* Heading */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{ marginBottom: 22 }}
              >
                <p style={{ color: "#fff", fontSize: 18, fontWeight: 300, marginBottom: 4 }}>
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                  {mode === "login"
                    ? "Sign in to access OrakzaiX"
                    : "Join the OrakzaiX platform"}
                </p>
              </motion.div>
            </AnimatePresence>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Name field — signup only */}
              <AnimatePresence initial={false}>
                {mode === "signup" && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: "hidden" }}
                  >
                    <Field
                      label="Full Name"
                      type="text"
                      value={name}
                      onChange={setName}
                      placeholder="Your full name"
                      autoComplete="name"
                      icon={<UserIcon />}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <Field
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
                icon={<EmailIcon />}
              />

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <label style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, letterSpacing: "0.05em" }}>Password</label>
                  {mode === "login" && (
                    <button type="button" style={{ fontSize: 12, color: "rgba(28,105,240,0.8)", background: "none", border: "none", cursor: "pointer" }}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.22)", display: "flex" }}>
                    <LockIcon />
                  </span>
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.22)", display: "flex", padding: 2 }}
                  >
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.9)", fontSize: 12 }}
                  >
                    <AlertIcon />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { boxShadow: "0 0 28px rgba(28,105,240,0.4)" } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg,#1C69F0,#1558d4)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.75 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {loading
                  ? <Spinner /> 
                  : null}
                {loading
                  ? (mode === "signup" ? "Creating account…" : "Signing in…")
                  : (mode === "signup" ? "Create Account" : "Sign In")}
              </motion.button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>or</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            </div>

            {/* Google */}
            <motion.button
              onClick={handleGoogle}
              disabled={gLoading}
              whileHover={!gLoading ? { borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)" } : {}}
              whileTap={!gLoading ? { scale: 0.98 } : {}}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "12px 0",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 14,
                fontWeight: 400,
                cursor: gLoading ? "not-allowed" : "pointer",
              }}
            >
              {gLoading ? <Spinner small /> : <GoogleIcon />}
              <span>Continue with Google</span>
            </motion.button>

            {/* Footer note */}
            <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.15)", marginTop: 20, lineHeight: 1.6 }}>
              By continuing, you agree to our{" "}
              <span style={{ color: "rgba(255,255,255,0.28)", cursor: "pointer" }}>Terms</span>
              {" & "}
              <span style={{ color: "rgba(255,255,255,0.28)", cursor: "pointer" }}>Privacy Policy</span>
            </p>
          </div>
        </motion.div>

        {/* Tag line */}
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.1)", marginTop: 20, letterSpacing: "0.2em" }}>
          SECURE · ENCRYPTED · PRIVATE
        </p>
      </div>
    </motion.div>
  );
}

/* ── Shared field component ── */
function Field({
  label, type, value, onChange, placeholder, autoComplete, icon,
}: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  autoComplete: string; icon: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: "block", color: "rgba(255,255,255,0.35)", fontSize: 12, letterSpacing: "0.05em", marginBottom: 7 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.22)", display: "flex" }}>
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={inputStyle}
        />
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 42px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

/* ── Icon components ── */
function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function EmailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
function Spinner({ small }: { small?: boolean }) {
  const size = small ? 14 : 16;
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
      style={{ width: size, height: size, borderRadius: "50%", border: `2px solid rgba(255,255,255,0.2)`, borderTopColor: "#fff", flexShrink: 0 }}
    />
  );
}
