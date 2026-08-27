import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import type { Role } from "./types";

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="p-8 text-text-soft">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="p-8 text-text-soft">Setting up your account…</div>;
  if (profile.role !== role) return <Navigate to="/" replace />;

  return <>{children}</>;
}
