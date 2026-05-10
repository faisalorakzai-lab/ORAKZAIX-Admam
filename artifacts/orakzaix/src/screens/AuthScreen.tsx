import { useState } from "react";
import { motion } from "framer-motion";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase/firebase";

interface AuthScreenProps {
  onAuthSuccess: (user: { displayName: string | null; email: string | null; photoURL: string | null }) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const { displayName, email, photoURL } = result.user;
      onAuthSuccess({ displayName, email, photoURL });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        setError(null);
      } else {
        setError("Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 flex bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* LEFT PANEL */}
      <div className="relative hidden md:flex flex-col justify-between w-1/2 px-16 py-14 overflow-hidden">
        {/* Background ambient */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full opacity-20"
            style={{
              background: "radial-gradient(circle, rgba(28,105,240,0.4) 0%, transparent 70%)",
              filter: "blur(80px)",
              transform: "translate(-30%, -30%)",
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-15"
            style={{
              background: "radial-gradient(circle, rgba(14,211,89,0.4) 0%, transparent 70%)",
              filter: "blur(80px)",
              transform: "translate(30%, 30%)",
            }}
          />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Top logo */}
        <motion.div
          className="relative flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <img src="/orakzaix-logo.png" alt="OrakzaiX" className="w-9 h-9 object-contain" />
          <div className="flex items-baseline">
            <span className="text-white text-lg font-light tracking-wider">Orakzai</span>
            <span className="text-lg font-semibold tracking-wide" style={{ color: "#0ED359" }}>X</span>
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
            Intelligence Platform
          </p>
          <h1 className="text-5xl font-extralight text-white leading-[1.15] tracking-tight mb-4">
            OrakzaiX.
          </h1>
          <motion.h2
            className="text-5xl font-extralight leading-[1.15] tracking-tight"
            style={{
              background: "linear-gradient(135deg, #1C69F0 0%, #0ED359 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            Access Granted.
          </motion.h2>

          <div className="mt-10 flex flex-col gap-3">
            {["Advanced AI Intelligence", "Real-time Analytics", "Secure & Private"].map((item, i) => (
              <motion.div
                key={item}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.1, duration: 0.5 }}
              >
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: "#0ED359" }} />
                <span className="text-sm font-light" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {item}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom text */}
        <motion.p
          className="relative text-xs"
          style={{ color: "rgba(255,255,255,0.2)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          © 2025 OrakzaiX. All rights reserved.
        </motion.p>
      </div>

      {/* Vertical divider */}
      <div className="hidden md:block w-px self-stretch my-16" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.06), transparent)" }} />

      {/* RIGHT PANEL */}
      <div className="relative flex flex-col items-center justify-center w-full md:w-1/2 px-8 py-14">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: "radial-gradient(ellipse at center, rgba(28,105,240,0.08) 0%, transparent 70%)",
          }}
        />

        <motion.div
          className="relative w-full max-w-sm"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Mobile logo */}
          <div className="md:hidden flex items-center justify-center gap-2 mb-10">
            <img src="/orakzaix-logo.png" alt="OrakzaiX" className="w-8 h-8 object-contain" />
            <div className="flex items-baseline">
              <span className="text-white text-base font-light tracking-wider">Orakzai</span>
              <span className="text-base font-semibold" style={{ color: "#0ED359" }}>X</span>
            </div>
          </div>

          {/* Glass card */}
          <div
            className="relative rounded-2xl p-8 overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Card inner glow */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
            />

            <div className="flex flex-col items-center text-center mb-8">
              <motion.div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(28,105,240,0.1)",
                  border: "1px solid rgba(28,105,240,0.2)",
                }}
                animate={{ boxShadow: ["0 0 0px rgba(28,105,240,0)", "0 0 20px rgba(28,105,240,0.2)", "0 0 0px rgba(28,105,240,0)"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 1.5L12.5 7H18L13.5 10.5L15.5 16L10 12.5L4.5 16L6.5 10.5L2 7H7.5L10 1.5Z" stroke="#1C69F0" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </motion.div>
              <h3 className="text-white text-xl font-light tracking-tight mb-1.5">Welcome back</h3>
              <p className="text-sm font-light" style={{ color: "rgba(255,255,255,0.35)" }}>
                Sign in to your OrakzaiX account
              </p>
            </div>

            {/* Google Sign In Button */}
            <motion.button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="relative w-full flex items-center justify-center gap-3 rounded-xl px-6 py-3.5 text-sm font-medium transition-all duration-300 overflow-hidden group"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(28,105,240,0.3)",
                color: "rgba(255,255,255,0.85)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
              whileHover={!loading ? {
                background: "rgba(28,105,240,0.08)",
                borderColor: "rgba(28,105,240,0.55)",
                boxShadow: "0 0 24px rgba(28,105,240,0.15)",
              } : {}}
              whileTap={!loading ? { scale: 0.985 } : {}}
            >
              {/* Hover shimmer */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: "linear-gradient(135deg, rgba(28,105,240,0.05) 0%, rgba(14,211,89,0.03) 100%)",
                }}
              />

              {loading ? (
                <motion.div
                  className="w-5 h-5 rounded-full border-2"
                  style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "#1C69F0" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <svg className="relative w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span className="relative tracking-wide">
                {loading ? "Signing in..." : "Sign in with Google Account"}
              </span>
            </motion.button>

            {error && (
              <motion.p
                className="mt-4 text-center text-xs"
                style={{ color: "rgba(239,68,68,0.8)" }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-center text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.2)" }}>
                By signing in, you agree to our{" "}
                <span className="underline underline-offset-2 cursor-pointer hover:text-white/40 transition-colors">Terms of Service</span>
                {" "}and{" "}
                <span className="underline underline-offset-2 cursor-pointer hover:text-white/40 transition-colors">Privacy Policy</span>
              </p>
            </div>
          </div>

          {/* Below card tagline */}
          <motion.p
            className="text-center text-xs mt-6 tracking-wider"
            style={{ color: "rgba(255,255,255,0.15)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            SECURE · ENCRYPTED · PRIVATE
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}
