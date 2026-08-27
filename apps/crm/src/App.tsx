import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireRole } from "./auth/RequireRole";
import { ToastProvider } from "./components/ui/toast";
import { RouteLoading } from "./components/ui/route-loading";
import { LoginEmail } from "./pages/LoginEmail";
import { LoginPhone } from "./pages/LoginPhone";
import { NotFound } from "./pages/NotFound";
import { RoleRedirect } from "./pages/RoleRedirect";
import { adminNavItems } from "./portals/admin/nav";
import { staffNavItems } from "./portals/staff/nav";
import { associateNavItems } from "./portals/associate/nav";

// Everything below is code-split by route — none of it is needed for the
// (small, fast) login screens, and most of it is role-specific, so an
// Associate never downloads Admin-only settings code, etc.
const AdminDashboard = lazy(() => import("./portals/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const IntegrationsSettingsPage = lazy(() =>
  import("./portals/admin/settings/IntegrationsSettingsPage").then((m) => ({ default: m.IntegrationsSettingsPage })),
);
const TelephonySettingsPage = lazy(() =>
  import("./portals/admin/settings/TelephonySettingsPage").then((m) => ({ default: m.TelephonySettingsPage })),
);
const StaffDashboard = lazy(() => import("./portals/staff/StaffDashboard").then((m) => ({ default: m.StaffDashboard })));
const AssociateDashboard = lazy(() =>
  import("./portals/associate/AssociateDashboard").then((m) => ({ default: m.AssociateDashboard })),
);
const ClientDashboard = lazy(() => import("./portals/client/ClientDashboard").then((m) => ({ default: m.ClientDashboard })));
const ClientClaimStatusPage = lazy(() =>
  import("./portals/client/ClaimStatusPage").then((m) => ({ default: m.ClaimStatusPage })),
);
const ClientRenewalsPage = lazy(() => import("./portals/client/RenewalsPage").then((m) => ({ default: m.RenewalsPage })));
const LeadsDeskPage = lazy(() => import("./modules/leads/LeadsDeskPage").then((m) => ({ default: m.LeadsDeskPage })));
const ClientsListPage = lazy(() => import("./modules/clients/ClientsListPage").then((m) => ({ default: m.ClientsListPage })));
const ClientDetailPage = lazy(() => import("./modules/clients/ClientDetailPage").then((m) => ({ default: m.ClientDetailPage })));
const ClaimsQueuePage = lazy(() => import("./modules/claims/ClaimsQueuePage").then((m) => ({ default: m.ClaimsQueuePage })));
const CandidatesPage = lazy(() => import("./modules/onboarding/CandidatesPage").then((m) => ({ default: m.CandidatesPage })));
const CandidateDetailPage = lazy(() =>
  import("./modules/onboarding/CandidateDetailPage").then((m) => ({ default: m.CandidateDetailPage })),
);
const TasksPage = lazy(() => import("./modules/tasks/TasksPage").then((m) => ({ default: m.TasksPage })));

// import.meta.env.BASE_URL follows vite.config.ts's `base` — "/app/" in a
// production build (subpath deploy on aa.tmarinternational.com), "/" in dev.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/login" element={<LoginEmail />} />
              <Route path="/client-login" element={<LoginPhone />} />

              {/* Admin */}
              <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
              <Route
                path="/admin/leads"
                element={
                  <RequireRole role="admin">
                    <LeadsDeskPage navItems={adminNavItems} basePath="/admin" />
                  </RequireRole>
                }
              />
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
              <Route path="/admin/team/:id" element={<RequireRole role="admin"><CandidateDetailPage /></RequireRole>} />
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
                    <TasksPage navItems={adminNavItems} basePath="/admin" />
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
              <Route
                path="/admin/telephony"
                element={
                  <RequireRole role="admin">
                    <TelephonySettingsPage />
                  </RequireRole>
                }
              />

              {/* Staff */}
              <Route path="/staff" element={<RequireRole role="staff"><StaffDashboard /></RequireRole>} />
              <Route
                path="/staff/leads"
                element={
                  <RequireRole role="staff">
                    <LeadsDeskPage navItems={staffNavItems} basePath="/staff" />
                  </RequireRole>
                }
              />
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
                    <TasksPage navItems={staffNavItems} basePath="/staff" />
                  </RequireRole>
                }
              />

              {/* Associate */}
              <Route path="/associate" element={<RequireRole role="associate"><AssociateDashboard /></RequireRole>} />
              <Route
                path="/associate/leads"
                element={
                  <RequireRole role="associate">
                    <LeadsDeskPage navItems={associateNavItems} basePath="/associate" />
                  </RequireRole>
                }
              />
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
                    <TasksPage navItems={associateNavItems} basePath="/associate" />
                  </RequireRole>
                }
              />

              {/* Client */}
              <Route path="/client" element={<RequireRole role="client"><ClientDashboard /></RequireRole>} />
              <Route path="/client/claims" element={<RequireRole role="client"><ClientClaimStatusPage /></RequireRole>} />
              <Route path="/client/renewals" element={<RequireRole role="client"><ClientRenewalsPage /></RequireRole>} />

              <Route path="/" element={<RoleRedirect />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
