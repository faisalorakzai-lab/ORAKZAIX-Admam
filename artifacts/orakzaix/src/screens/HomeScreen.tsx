import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import AppShell from "../layouts/AppShell";

interface HomeScreenProps {
  user: { displayName: string | null; email: string | null; photoURL: string | null };
  onSignOut: () => void;
}

export default function HomeScreen({ user, onSignOut }: HomeScreenProps) {
  const handleSignOut = async () => {
    await signOut(auth);
    onSignOut();
  };

  return <AppShell user={user} onSignOut={handleSignOut} />;
}
