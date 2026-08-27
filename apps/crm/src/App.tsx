import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireRole } from "./auth/RequireRole";
import { ToastProvider } from "./components/ui/toast";
import { LoginEmail } from "./pages/LoginEmail";
import { LoginPhone } from "./pages/LoginPhone";
import { NotFound } from "./pages/NotFound";
import { RoleRedirect } from "./pages/RoleRedirect";
import { AdminDashboard } from "./portals/admin/AdminDashboard";
import { IntegrationsSettingsPage } from "./portals/admin/settings/IntegrationsSettingsPage";
import { adminNavItems } from "./portals/admin/nav";
import { StaffDashboard } from "./portals/staff/StaffDashboard";
import { staffNavItems } from "./portals/staff/nav";
import { AssociateDashboard } from "./portals/associate/AssociateDashboard";
import { associateNavItems } from "./portals/associate/nav";
import { ClientDashboard } from "./portals/client/ClientDashboard";
import { ClientsListPage } from "./modules/clients/ClientsListPage";
import { ClientDetailPage } from "./modules/clients/ClientDetailPage";
import { ClaimsQueuePage } from "./modules/claims/ClaimsQueuePage";
import { CandidatesPage } from "./modules/onboarding/CandidatesPage";
import { TasksPage } from "./modules/tasks/TasksPage";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginEmail />} />
            <Route path="/client-login" element={<LoginPhone />} />

            {/* Admin */}
            <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
            <Route
              path="/admin/clients"
              element={
                <RequireRole role="admin">
                  <ClientsListPage navItems={adminNavItems} basePath="/admin" />
                </RequireRole>
              }
            />
            <Route
              path="/admin/clients/:id"
              element={
                <RequireRole role="admin">
                  <ClientDetailPage navItems={adminNavItems} basePath="/admin" />
                </RequireRole>
              }
            />
            <Route path="/admin/team" element={<RequireRole role="admin"><CandidatesPage /></RequireRole>} />
            <Route
              path="/admin/claims"
              element={
                <RequireRole role="admin">
                  <ClaimsQueuePage navItems={adminNavItems} basePath="/admin" />
                </RequireRole>
              }
            />
            <Route
              path="/admin/tasks"
              element={
                <RequireRole role="admin">
                  <TasksPage navItems={adminNavItems} />
                </RequireRole>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <RequireRole role="admin">
                  <IntegrationsSettingsPage />
                </RequireRole>
              }
            />

            {/* Staff */}
            <Route path="/staff" element={<RequireRole role="staff"><StaffDashboard /></RequireRole>} />
            <Route
              path="/staff/clients"
              element={
                <RequireRole role="staff">
                  <ClientsListPage navItems={staffNavItems} basePath="/staff" />
                </RequireRole>
              }
            />
            <Route
              path="/staff/clients/:id"
              element={
                <RequireRole role="staff">
                  <ClientDetailPage navItems={staffNavItems} basePath="/staff" />
                </RequireRole>
              }
            />
            <Route
              path="/staff/claims"
              element={
                <RequireRole role="staff">
                  <ClaimsQueuePage navItems={staffNavItems} basePath="/staff" />
                </RequireRole>
              }
            />
            <Route
              path="/staff/tasks"
              element={
                <RequireRole role="staff">
                  <TasksPage navItems={staffNavItems} />
                </RequireRole>
              }
            />

            {/* Associate */}
            <Route path="/associate" element={<RequireRole role="associate"><AssociateDashboard /></RequireRole>} />
            <Route
              path="/associate/clients"
              element={
                <RequireRole role="associate">
                  <ClientsListPage navItems={associateNavItems} basePath="/associate" />
                </RequireRole>
              }
            />
            <Route
              path="/associate/clients/:id"
              element={
                <RequireRole role="associate">
                  <ClientDetailPage navItems={associateNavItems} basePath="/associate" />
                </RequireRole>
              }
            />
            <Route
              path="/associate/tasks"
              element={
                <RequireRole role="associate">
                  <TasksPage navItems={associateNavItems} />
                </RequireRole>
              }
            />

            {/* Client */}
            <Route path="/client" element={<RequireRole role="client"><ClientDashboard /></RequireRole>} />

            <Route path="/" element={<RoleRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
