import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

// public/img is copied as-is to the build output root — see the same note
// in PortalLayout.tsx. Kept in sync deliberately: even an edge-case screen
// like this one should carry the same wood-framed identity as the rest of
// the app, not a plain unbranded message.
const aangiLogo = `${import.meta.env.BASE_URL}img/aangi-logo-full-tight.png`;

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-navy px-4 text-center text-on-navy">
      <a href="/app/" className="sidebar-brand-frame" aria-label="Aangi Associates">
        <div className="sidebar-brand-frame-inner">
          <img src={aangiLogo} alt="Aangi Associates" className="sidebar-brand-logo" />
        </div>
      </a>
      <p className="font-mono text-sm uppercase tracking-widest text-gold-on-navy">404</p>
      <h1 className="font-display text-3xl">This page took a different path.</h1>
      <p className="max-w-sm text-sm opacity-80">
        The page you're looking for doesn't exist, or you may not have access to it from this account.
      </p>
      <Button asChild className="mt-2">
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
