import { useEffect, useState } from "react";
import { api } from "../../lib/api";
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

    api
      .get<Client | null>("/clients.php")
      .then(async (clientRow) => {
        if (cancelled) return;
        setClient(clientRow ?? null);

        if (clientRow) {
          const [p, c] = await Promise.all([
            api.get<ClientPolicy[]>(`/client_policies.php?client_id=${clientRow.id}`),
            api.get<Claim[]>(`/claims.php?client_id=${clientRow.id}`),
          ]);
          if (!cancelled) {
            setPolicies(p ?? []);
            setClaims(c ?? []);
          }
        }
        if (!cancelled) setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load client record", err);
        setClient(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  return { client, policies, claims, loading };
}
