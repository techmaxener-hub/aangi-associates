import { createContext, useEffect, useRef, useState, type ReactNode } from "react";
import { authApi, type ApiUser } from "../lib/api";
import type { Profile } from "./types";

// Auto-logout after inactivity — this handles real client financial data,
// so an unattended, still-logged-in browser is a real exposure.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

// Kept as `{ user: ApiUser } | null` (rather than just `ApiUser | null`) so
// every existing `session?.user.id` call site across the app — the PHP
// backend now sets created_by/logged_by server-side from the session
// itself, but those call sites still read the id for other purposes —
// keeps working unchanged.
interface Session {
  user: ApiUser;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  // Called by LoginEmail.tsx / LoginPhone.tsx with the `user` object
  // auth.php's login/verify_otp actions return, so context state updates
  // immediately after a successful sign-in without a full page reload
  // (this provider only fetches /auth.php?action=session once, on mount).
  setUser: (user: ApiUser) => void;
}

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .session()
      .then(({ user }) => {
        if (user) {
          setSession({ user });
          setProfile({ id: user.id, role: user.role, full_name: user.full_name });
        }
      })
      .catch((err) => console.error("Failed to load session", err))
      .finally(() => setLoading(false));
  }, []);

  async function signOut() {
    await authApi.logout().catch(() => {});
    setSession(null);
    setProfile(null);
  }

  function setUser(user: ApiUser) {
    setSession({ user });
    setProfile({ id: user.id, role: user.role, full_name: user.full_name });
  }

  const idleTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!session) return;

    function resetTimer() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        void signOut();
      }, IDLE_TIMEOUT_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, setUser }}>{children}</AuthContext.Provider>
  );
}
