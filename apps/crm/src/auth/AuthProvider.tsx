import { createContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "./types";

// Auto-logout after inactivity — this handles real client financial data,
// so an unattended, still-logged-in browser is a real exposure.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load profile", error);
          setProfile(null);
          return;
        }
        setProfile(data as Profile);
      });
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
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

  return <AuthContext.Provider value={{ session, profile, loading, signOut }}>{children}</AuthContext.Provider>;
}
