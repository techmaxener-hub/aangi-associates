import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
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

export function PortalLayout({
  title,
  navItems,
  children,
}: {
  title: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const searchBasePath = profile ? SEARCHABLE_ROLES[profile.role] : undefined;
  const [theme, setTheme] = useState(effectiveTheme);

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
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="block rounded-md px-3 py-2 text-sm opacity-85 hover:bg-white/10 hover:opacity-100"
              >
                {item.label}
              </Link>
            ))}
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
