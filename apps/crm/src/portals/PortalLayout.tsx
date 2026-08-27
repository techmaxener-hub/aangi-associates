import type { ReactNode } from "react";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";

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

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <aside className="flex w-56 flex-col justify-between border-r border-line bg-navy p-4 text-on-navy">
        <div>
          <p className="mb-6 font-display text-lg">Aangi Associates</p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm opacity-85 hover:bg-white/10 hover:opacity-100"
              >
                {item.label}
              </a>
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
      <main className="flex-1 p-8">
        <h1 className="mb-6 font-display text-2xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}
