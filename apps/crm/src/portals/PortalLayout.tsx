import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { GlobalSearch } from "./GlobalSearch";
import { effectiveTheme, applyTheme } from "../lib/theme";

const SEARCHABLE_ROLES: Record<string, string> = {
  admin: "/admin",
  staff: "/staff",
  associate: "/associate",
};

interface NavItem {
  label: string;
  href: string;
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
  const { pathname } = useLocation();

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:text-on-navy"
      >
        Skip to content
      </a>
      <aside className="flex w-56 flex-col justify-between border-r border-line bg-navy p-4 text-on-navy">
        <div>
          <p className="mb-6 font-display text-lg">Aangi Associates</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = isNavItemActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "block rounded-md border-l-2 border-gold bg-white/10 px-3 py-2 text-sm font-semibold opacity-100"
                      : "block rounded-md border-l-2 border-transparent px-3 py-2 text-sm opacity-85 hover:bg-white/10 hover:opacity-100"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div>
          <p className="mb-2 text-xs opacity-70">{profile?.full_name ?? "Signed in"}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className="w-full justify-start text-on-navy"
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main id="main-content" className="flex-1 p-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl">{title}</h1>
          <div className="flex flex-1 items-center justify-end gap-3">
            {searchBasePath && (
              <div className="w-full max-w-sm">
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
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
