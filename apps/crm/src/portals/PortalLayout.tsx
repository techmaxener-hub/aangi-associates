import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, X, ChevronsLeft, ChevronsRight, LogOut, type LucideIcon } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { GlobalSearch } from "./GlobalSearch";
import { effectiveTheme, applyTheme } from "../lib/theme";

const SIDEBAR_COLLAPSE_KEY = "aangi-sidebar-collapsed";

// public/img is copied as-is to the build output root, then served under
// Vite's own base ("/app/" in production, "/" in dev) — not a module
// import, since Vite doesn't bundle files under public/.
const aangiLogo = `${import.meta.env.BASE_URL}img/aangi-logo-full-tight.png`;

const SEARCHABLE_ROLES: Record<string, string> = {
  admin: "/admin",
  staff: "/staff",
  associate: "/associate",
};

export interface NavItem {
  label: string;
  href: string;
  group?: string;
  icon: LucideIcon;
}

interface Breadcrumb {
  label: string;
  href?: string;
}

// A dashboard root ("/admin") is a path prefix of every one of its own
// sibling subpages ("/admin/clients", "/admin/leads", ...), so it can only
// ever match exactly. Any other item also matches its own nested detail
// routes (e.g. "/admin/clients/9" under "/admin/clients").
function isNavItemActive(href: string, pathname: string) {
  const isPortalRoot = href.split("/").filter(Boolean).length <= 1;
  return pathname === href || (!isPortalRoot && pathname.startsWith(`${href}/`));
}

export function PortalLayout({
  title,
  breadcrumbs,
  navItems,
  children,
}: {
  title: string;
  breadcrumbs?: Breadcrumb[];
  navItems: NavItem[];
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const searchBasePath = profile ? SEARCHABLE_ROLES[profile.role] : undefined;
  const [theme, setTheme] = useState(effectiveTheme);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const { pathname } = useLocation();

  // The sidebar becomes a slide-in drawer below md — close it on every
  // navigation so it doesn't stay open covering the new page's content.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  // Icon-only compact mode — desktop only (the mobile drawer is a
  // temporary overlay, not persistent chrome, so it always shows full
  // labels). Reclaims width on data-dense pages like Clients or Leads
  // Desk; remembered per-browser so it doesn't reset every visit.
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* localStorage unavailable (private mode, etc.) — collapse still works for this session */
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:text-on-navy"
      >
        Skip to content
      </a>
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy/50 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`${mobileNavOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col justify-between bg-navy p-4 text-on-navy md:static md:z-auto md:flex ${collapsed ? "md:w-[4.5rem]" : "md:w-56"} transition-[width] duration-150`}
      >
        <div>
          <div className={`mb-6 flex items-center ${collapsed ? "md:flex-col md:gap-2" : "justify-between"}`}>
            {/* The mobile drawer ignores the desktop collapse preference —
                it's a temporary overlay, always shown expanded — so the
                full frame only gets md:hidden (desktop-only hide) rather
                than being unmounted outright when collapsed=true. */}
            <a
              href="/app/"
              className={`sidebar-brand-frame ${collapsed ? "md:hidden" : ""}`}
              aria-label="Aangi Associates"
            >
              <div className="sidebar-brand-frame-inner">
                <img src={aangiLogo} alt="Aangi Associates" className="sidebar-brand-logo" />
              </div>
            </a>
            {collapsed && (
              <a href="/app/" className="hidden md:block" aria-label="Aangi Associates">
                <img src={aangiLogo} alt="Aangi Associates" className="h-7 w-auto" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-md text-on-navy hover:bg-white/10 md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-navy/60 hover:bg-white/10 hover:text-on-navy md:flex"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="space-y-0.5">
            {navItems.map((item, i) => {
              const isNewGroup = item.group && item.group !== navItems[i - 1]?.group;
              const active = isNavItemActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <div key={item.href}>
                  {isNewGroup && (
                    <p
                      className={`mb-1.5 px-3 text-[0.65rem] font-semibold uppercase tracking-wide text-on-navy/40 ${i === 0 ? "" : "mt-4"} ${collapsed ? "md:hidden" : ""}`}
                    >
                      {item.group}
                    </p>
                  )}
                  {isNewGroup && collapsed && <div className="mb-1.5 mt-3 hidden border-t border-white/10 md:block" />}
                  <Link
                    to={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={
                      (active
                        ? "border-gold bg-white/10 font-semibold opacity-100"
                        : "border-transparent opacity-85 hover:bg-white/10 hover:opacity-100") +
                      ` flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm ${collapsed ? "md:justify-center md:px-0" : ""}`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className={collapsed ? "md:hidden" : undefined}>{item.label}</span>
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>
        <div>
          <p className={`mb-2 truncate text-xs opacity-70 ${collapsed ? "md:hidden" : ""}`}>
            {profile?.full_name ?? "Signed in"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            title={collapsed ? "Sign out" : undefined}
            className={`w-full text-on-navy ${collapsed ? "md:justify-center md:px-0" : "justify-start"}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={collapsed ? "md:hidden" : undefined}>Sign out</span>
          </Button>
        </div>
      </aside>
      <div className="wood-divider-v hidden md:block" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10">
          <header className="bg-surface px-4 py-4 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open navigation menu"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line-strong text-text-soft hover:bg-surface-2 md:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div>
                  {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav aria-label="Breadcrumb" className="mb-1">
                      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-text-soft">
                        {breadcrumbs.map((crumb, i) => (
                          <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                            {i > 0 && <span aria-hidden="true">/</span>}
                            {crumb.href ? (
                              <Link to={crumb.href} className="hover:text-text hover:underline">
                                {crumb.label}
                              </Link>
                            ) : (
                              <span aria-current="page" className="text-text">
                                {crumb.label}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </nav>
                  )}
                  <h1 className="font-display text-2xl">{title}</h1>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-end gap-3">
                {searchBasePath && (
                  <div className="w-full max-w-md">
                    <GlobalSearch basePath={searchBasePath} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-text-soft hover:bg-surface-2"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </header>
          <div className="wood-divider-h" aria-hidden="true" />
        </div>
        <main id="main-content" className="flex-1 p-4 md:p-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
