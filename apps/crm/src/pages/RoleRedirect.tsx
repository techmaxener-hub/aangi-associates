import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { RouteLoading } from "../components/ui/route-loading";
import type { Role } from "../auth/types";

const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  staff: "/staff",
  associate: "/associate",
  client: "/client",
};

export function RoleRedirect() {
  const { session, profile, loading } = useAuth();

  if (loading) return <RouteLoading />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-soft">Setting up your account…</div>
    );
  }

  return <Navigate to={ROLE_HOME[profile.role]} replace />;
}
