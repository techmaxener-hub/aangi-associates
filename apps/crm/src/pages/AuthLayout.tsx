import type { ReactNode } from "react";

// public/img is copied as-is to the build output root — see the same note
// in PortalLayout.tsx.
const aangiLogo = `${import.meta.env.BASE_URL}img/aangi-logo-full-tight.png`;

// Shared shell for both login screens (email/password and phone/OTP) — a
// branded identity panel on one side, the actual form on the other,
// instead of a bare card floating on white. The identity panel is
// hidden below lg (the form alone is plenty on a phone-sized screen).
//
// No theme toggle here on purpose: tokens.css locked the whole app to a
// single palette on 2026-09-12 (dark mode removed as dead code) — the
// toggle that still lingers in PortalLayout.tsx no longer changes
// anything, so this page doesn't repeat that same non-functional control.
export function AuthLayout({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="auth-brand-panel relative hidden flex-col items-center justify-center gap-6 overflow-hidden bg-navy p-12 text-center text-on-navy lg:flex lg:w-1/2">
        <div className="sidebar-brand-frame relative z-10" style={{ maxWidth: 240 }}>
          <div className="sidebar-brand-frame-inner">
            <img src={aangiLogo} alt="Aangi Associates" className="sidebar-brand-logo" />
          </div>
        </div>
        <p className="relative z-10 max-w-xs font-display text-xl">Protecting What Matters. Securing What You Build.</p>
        <p className="relative z-10 text-sm text-on-navy/70">17+ Years · 1,400+ Families · MDRT-Qualified Practice</p>
      </div>
      <div className="wood-divider-v hidden lg:block" aria-hidden="true" />
      <div className="auth-form-panel relative flex flex-1 flex-col items-center justify-center bg-bg px-4 py-12">
        <div className="relative z-10 w-full max-w-sm">
          <div className="mb-6 text-center lg:hidden">
            <img src={aangiLogo} alt="Aangi Associates" className="mx-auto mb-3 h-12 w-auto" />
          </div>
          <p className="mb-6 text-center text-sm text-text-soft lg:text-left">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
