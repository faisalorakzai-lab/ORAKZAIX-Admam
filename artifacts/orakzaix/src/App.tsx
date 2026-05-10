import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import SplashScreen from "./screens/SplashScreen";
import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import { auth } from "./firebase/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

type AppState = "splash" | "auth" | "home";

export default function App() {
  const [appState, setAppState] = useState<AppState>("splash");
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  const handleSplashComplete = () => {
    if (authChecked && user) {
      setAppState("home");
    } else {
      setAppState("auth");
    }
  };

  const handleAuthSuccess = (_userData: { displayName: string | null; email: string | null; photoURL: string | null }) => {
    setAppState("home");
  };

  const handleSignOut = () => {
    setUser(null);
    setAppState("auth");
  };

  return (
    <div className="relative w-full min-h-screen bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        {appState === "splash" && (
          <SplashScreen key="splash" onComplete={handleSplashComplete} />
        )}
        {appState === "auth" && (
          <AuthScreen
            key="auth"
            onAuthSuccess={handleAuthSuccess}
          />
        )}
        {appState === "home" && user && (
          <HomeScreen
            key="home"
            user={{
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
            }}
            onSignOut={handleSignOut}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
