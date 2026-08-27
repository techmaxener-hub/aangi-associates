import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../auth/useAuth";
import type { Client, ClientPolicy, Claim } from "../clients/types";

export function useMyClient() {
  const { session } = useAuth();
  const [client, setClient] = useState<Client | null | undefined>(undefined); // undefined = loading, null = not linked yet
  const [policies, setPolicies] = useState<ClientPolicy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;
    setLoading(true);

    supabase
      .from("clients")
      .select("*")
      .eq("portal_user_id", session.user.id)
      .maybeSingle()
      .then(async ({ data: clientRow, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load client record", error);
          setClient(null);
          setLoading(false);
          return;
        }
        setClient(clientRow ?? null);

        if (clientRow) {
          const [p, c] = await Promise.all([
            supabase
              .from("client_policies")
              .select("*")
              .eq("client_id", clientRow.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("claims")
              .select("*")
              .eq("client_id", clientRow.id)
              .order("notified_at", { ascending: false }),
          ]);
          if (!cancelled) {
            setPolicies(p.data ?? []);
            setClaims(c.data ?? []);
          }
        }
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  return { client, policies, claims, loading };
}
