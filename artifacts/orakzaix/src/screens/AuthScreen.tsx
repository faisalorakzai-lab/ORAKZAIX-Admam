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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setError(null);
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    clearForm();
  };

  const getFirebaseError = (code: string): string => {
    const map: Record<string, string> = {
      "auth/invalid-email": "Invalid email address.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/email-already-in-use": "An account with this email already exists.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Please try again later.",
      "auth/invalid-credential": "Invalid email or password.",
      "auth/network-request-failed": "Network error. Check your connection.",
    };
    return map[code] || "Something went wrong. Please try again.";
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

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
      const e = err as { code?: string };
      setError(getFirebaseError(e.code || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onAuthSuccess();
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setError(getFirebaseError(e.code || ""));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 flex bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* LEFT PANEL — hidden on mobile */}
      <div className="relative hidden lg:flex flex-col justify-between w-[45%] px-16 py-14 overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full opacity-25"
            style={{ background: "radial-gradient(circle, rgba(28,105,240,0.45) 0%, transparent 70%)", filter: "blur(90px)", transform: "translate(-30%, -30%)" }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, rgba(14,211,89,0.4) 0%, transparent 70%)", filter: "blur(80px)", transform: "translate(30%, 30%)" }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        {/* Logo */}
        <motion.div className="relative flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <img src="/orakzaix-logo.png" alt="OrakzaiX" className="w-10 h-10 object-contain" />
          <div className="flex items-baseline">
            <span className="text-white text-xl font-light tracking-wider">Orakzai</span>
            <span className="text-xl font-semibold" style={{ color: "#0ED359" }}>X</span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div className="relative"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}>
          <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: "rgba(255,255,255,0.25)" }}>
            Intelligence Platform
          </p>
          <h1 className="text-5xl font-extralight text-white leading-[1.15] tracking-tight mb-3">
            OrakzaiX.
          </h1>
          <motion.h2 className="text-5xl font-extralight leading-[1.15] tracking-tight"
            style={{ background: "linear-gradient(135deg, #1C69F0 0%, #0ED359 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            animate={{ opacity: [0.8, 1, 0.8] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            Access Granted.
          </motion.h2>

          <div className="mt-10 flex flex-col gap-3">
            {["Advanced AI Intelligence", "Real-time Analytics", "Secure & Private"].map((item, i) => (
              <motion.div key={item} className="flex items-center gap-3"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 + i * 0.1, duration: 0.5 }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#0ED359" }} />
                <span className="text-sm font-light" style={{ color: "rgba(255,255,255,0.4)" }}>{item}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.p className="relative text-xs" style={{ color: "rgba(255,255,255,0.18)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          © 2025 OrakzaiX. All rights reserved.
        </motion.p>
      </div>

      {/* Divider */}
      <div className="hidden lg:block w-px self-stretch my-14"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.07), transparent)" }} />

      {/* RIGHT PANEL */}
      <div className="relative flex flex-col items-center justify-center w-full lg:w-[55%] px-6 py-10">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: "radial-gradient(ellipse at center, rgba(28,105,240,0.1) 0%, transparent 65%)" }} />

        <motion.div className="relative w-full max-w-[400px]"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
            <img src="/orakzaix-logo.png" alt="OrakzaiX" className="w-8 h-8 object-contain" />
            <div className="flex items-baseline">
              <span className="text-white text-base font-light tracking-wider">Orakzai</span>
              <span className="text-base font-semibold" style={{ color: "#0ED359" }}>X</span>
            </div>
          </div>

          {/* Glass card */}
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)", backdropFilter: "blur(24px)" }}>

            {/* Top shimmer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }} />

            {/* Tab switcher */}
            <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              {(["login", "signup"] as AuthMode[]).map((tab) => (
                <button key={tab} onClick={() => switchMode(tab)}
                  className="flex-1 py-4 text-sm font-medium tracking-wide transition-all duration-200 relative"
                  style={{ color: mode === tab ? "#ffffff" : "rgba(255,255,255,0.3)", background: "transparent" }}>
                  {tab === "login" ? "Sign In" : "Create Account"}
                  {mode === tab && (
                    <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-4 right-4 h-px rounded-full"
                      style={{ background: "linear-gradient(90deg, #1C69F0, #0ED359)" }} />
                  )}
                </button>
              ))}
            </div>

            <div className="p-7">
              {/* Header */}
              <div className="mb-6">
                <AnimatePresence mode="wait">
                  <motion.div key={mode}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                    <h3 className="text-white text-xl font-light tracking-tight mb-1">
                      {mode === "login" ? "Welcome back" : "Create your account"}
                    </h3>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {mode === "login"
                        ? "Sign in to access your OrakzaiX account"
                        : "Join OrakzaiX Intelligence Platform"}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Form */}
              <form onSubmit={handleEmailAuth} className="flex flex-col gap-3.5">
                {/* Name — signup only */}
                <AnimatePresence>
                  {mode === "signup" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                      <label className="block text-xs mb-1.5 tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Full Name
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </span>
                        <input
                          type="text" value={name} onChange={(e) => setName(e.target.value)}
                          placeholder="Your full name" autoComplete="name"
                          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all duration-200"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                          onFocus={(e) => { e.target.style.borderColor = "rgba(28,105,240,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(28,105,240,0.08)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email */}
                <div>
                  <label className="block text-xs mb-1.5 tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </span>
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all duration-200"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      onFocus={(e) => { e.target.style.borderColor = "rgba(28,105,240,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(28,105,240,0.08)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Password</label>
                    {mode === "login" && (
                      <button type="button" className="text-xs transition-colors"
                        style={{ color: "rgba(28,105,240,0.7)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#1C69F0")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(28,105,240,0.7)")}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Min. 6 characters" : "Enter your password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="w-full pl-10 pr-11 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all duration-200"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                      onFocus={(e) => { e.target.style.borderColor = "rgba(28,105,240,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(28,105,240,0.08)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "rgba(255,255,255,0.2)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}>
                      {showPassword ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.9)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit button */}
                <motion.button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-medium tracking-wide transition-all duration-200 relative overflow-hidden mt-1"
                  style={{ background: "linear-gradient(135deg, #1C69F0 0%, #1558d4 100%)", color: "#ffffff", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
                  whileHover={!loading ? { boxShadow: "0 0 30px rgba(28,105,240,0.35)", scale: 1.005 } : {}}
                  whileTap={!loading ? { scale: 0.995 } : {}}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                        animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                      {mode === "signup" ? "Creating account..." : "Signing in..."}
                    </span>
                  ) : (
                    mode === "signup" ? "Create Account" : "Sign In"
                  )}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>or continue with</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>

              {/* Google button */}
              <motion.button onClick={handleGoogleSignIn} disabled={googleLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", cursor: googleLoading ? "not-allowed" : "pointer" }}
                whileHover={!googleLoading ? { borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.9)" } : {}}
                whileTap={!googleLoading ? { scale: 0.995 } : {}}>
                {googleLoading ? (
                  <motion.div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70"
                    animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>Continue with Google</span>
              </motion.button>

              {/* Footer */}
              <p className="text-center text-xs mt-5" style={{ color: "rgba(255,255,255,0.18)" }}>
                By continuing, you agree to our{" "}
                <span className="underline underline-offset-2 cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>Terms</span>
                {" "}and{" "}
                <span className="underline underline-offset-2 cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>Privacy Policy</span>
              </p>
            </div>
          </div>

          <p className="text-center text-xs mt-5 tracking-widest" style={{ color: "rgba(255,255,255,0.1)" }}>
            SECURE · ENCRYPTED · PRIVATE
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
