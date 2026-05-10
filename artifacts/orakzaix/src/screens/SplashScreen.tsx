import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const hasCalledComplete = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCalledComplete.current) {
        hasCalledComplete.current = true;
        onComplete();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(28,105,240,0.07) 0%, rgba(14,211,89,0.04) 50%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(14,211,89,0.03) 0%, transparent 60%)",
          }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
      </div>

      {/* Subtle light trails */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px"
            style={{
              top: `${20 + i * 12}%`,
              left: 0,
              right: 0,
              background: i % 2 === 0
                ? "linear-gradient(90deg, transparent, rgba(28,105,240,0.15), transparent)"
                : "linear-gradient(90deg, transparent, rgba(14,211,89,0.10), transparent)",
            }}
            animate={{ opacity: [0, 1, 0], x: ["-100%", "100%"] }}
            transition={{
              duration: 3 + i * 0.4,
              repeat: Infinity,
              delay: i * 0.6,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-8">
        {/* Logo with arc ring */}
        <div className="relative flex items-center justify-center">
          {/* Outer progress arc */}
          <svg
            className="absolute"
            width="220"
            height="220"
            viewBox="0 0 220 220"
            fill="none"
          >
            <motion.circle
              cx="110"
              cy="110"
              r="104"
              stroke="rgba(28,105,240,0.15)"
              strokeWidth="1"
            />
            <motion.circle
              cx="110"
              cy="110"
              r="104"
              stroke="url(#arcGrad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="653"
              initial={{ strokeDashoffset: 653 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 4.2, ease: [0.4, 0, 0.2, 1] }}
              style={{ transform: "rotate(-90deg)", transformOrigin: "110px 110px" }}
            />
            <defs>
              <linearGradient id="arcGrad" x1="0" y1="0" x2="220" y2="220" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1C69F0" />
                <stop offset="100%" stopColor="#0ED359" />
              </linearGradient>
            </defs>
          </svg>

          {/* Inner glow ring */}
          <motion.div
            className="absolute w-[160px] h-[160px] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(14,211,89,0.08) 0%, transparent 70%)",
              boxShadow: "0 0 60px rgba(14,211,89,0.12), 0 0 120px rgba(28,105,240,0.08)",
            }}
            animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Logo image */}
          <motion.div
            className="relative w-[140px] h-[140px] flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.img
              src="/orakzaix-logo.png"
              alt="OrakzaiX"
              className="w-[130px] h-[130px] object-contain"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>

        {/* Brand name */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="flex items-baseline gap-0">
            <span
              className="text-4xl font-light tracking-[0.15em] text-white"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Orakzai
            </span>
            <span
              className="text-4xl font-semibold tracking-[0.05em]"
              style={{ color: "#0ED359", fontFamily: "'Inter', sans-serif" }}
            >
              X
            </span>
          </div>
          <motion.p
            className="text-xs tracking-[0.35em] uppercase"
            style={{ color: "rgba(255,255,255,0.3)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            Intelligence Platform
          </motion.p>
        </motion.div>

        {/* Progress dots */}
        <motion.div
          className="flex gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: "rgba(28,105,240,0.5)" }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.3, 1] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
