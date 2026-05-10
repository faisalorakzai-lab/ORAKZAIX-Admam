import { motion } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";

interface HomeScreenProps {
  user: { displayName: string | null; email: string | null; photoURL: string | null };
  onSignOut: () => void;
}

export default function HomeScreen({ user, onSignOut }: HomeScreenProps) {
  const handleSignOut = async () => {
    await signOut(auth);
    onSignOut();
  };

  return (
    <motion.div
      className="min-h-screen bg-black flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <img src="/orakzaix-logo.png" alt="OrakzaiX" className="w-8 h-8 object-contain" />
          <div className="flex items-baseline">
            <span className="text-white font-light tracking-wider">Orakzai</span>
            <span className="font-semibold" style={{ color: "#0ED359" }}>X</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user.photoURL && (
            <img src={user.photoURL} alt={user.displayName || ""} className="w-8 h-8 rounded-full opacity-90" />
          )}
          <span className="text-sm hidden sm:block" style={{ color: "rgba(255,255,255,0.45)" }}>
            {user.displayName || user.email}
          </span>
          <motion.button
            onClick={handleSignOut}
            className="text-xs px-4 py-2 rounded-lg transition-colors"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.02)",
            }}
            whileHover={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
            whileTap={{ scale: 0.97 }}
          >
            Sign out
          </motion.button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.25)" }}>
            Authenticated
          </p>
          <h1 className="text-4xl font-extralight text-white mb-3 tracking-tight">
            Welcome, {user.displayName?.split(" ")[0] || "User"}.
          </h1>
          <p className="text-sm font-light" style={{ color: "rgba(255,255,255,0.3)" }}>
            OrakzaiX Intelligence Platform is ready.
          </p>
          <div
            className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs"
            style={{
              background: "rgba(14,211,89,0.06)",
              border: "1px solid rgba(14,211,89,0.2)",
              color: "#0ED359",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            System Online
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
