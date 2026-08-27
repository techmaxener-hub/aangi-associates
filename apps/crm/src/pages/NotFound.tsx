import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy px-4 text-center text-on-navy">
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
