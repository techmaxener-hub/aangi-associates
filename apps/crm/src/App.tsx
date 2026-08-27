import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireRole } from "./auth/RequireRole";
import { LoginEmail } from "./pages/LoginEmail";
import { LoginPhone } from "./pages/LoginPhone";
import { NotFound } from "./pages/NotFound";
import { AdminDashboard } from "./portals/admin/AdminDashboard";
import { StaffDashboard } from "./portals/staff/StaffDashboard";
import { AssociateDashboard } from "./portals/associate/AssociateDashboard";
import { ClientDashboard } from "./portals/client/ClientDashboard";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginEmail />} />
          <Route path="/client-login" element={<LoginPhone />} />
          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/staff"
            element={
              <RequireRole role="staff">
                <StaffDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/associate"
            element={
              <RequireRole role="associate">
                <AssociateDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/client"
            element={
              <RequireRole role="client">
                <ClientDashboard />
              </RequireRole>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
