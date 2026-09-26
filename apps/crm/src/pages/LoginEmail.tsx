import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi, ApiError } from "../lib/api";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AuthLayout } from "./AuthLayout";

const REMEMBERED_EMAIL_KEY = "aangi-remembered-email";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginEmail() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const rememberedEmail = (() => {
    try {
      return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  })();
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(rememberedEmail !== "");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailInvalid = touched.email && !isValidEmail(email);
  const passwordInvalid = touched.password && password.length === 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!isValidEmail(email) || password.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const { user } = await authApi.login(email, password);
      try {
        if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      } catch {
        /* localStorage unavailable — login still succeeds, just won't be remembered */
      }
      setUser(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle="Staff, Associate & Admin sign in">
      <Card>
        <h1 className="mb-1 font-display text-xl text-text">{rememberedEmail ? "Welcome back" : "Aangi Associates"}</h1>
        {rememberedEmail && <p className="mb-4 text-xs text-text-soft">Signing in as {rememberedEmail}</p>}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              aria-invalid={emailInvalid}
              className={emailInvalid ? "border-crimson focus-visible:ring-crimson" : undefined}
            />
            {emailInvalid && <p className="text-xs text-crimson">Enter a valid email address.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                aria-invalid={passwordInvalid}
                className={`pr-10 ${passwordInvalid ? "border-crimson focus-visible:ring-crimson" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-soft hover:text-text"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordInvalid && <p className="text-xs text-crimson">Enter your password.</p>}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-line-strong accent-crimson"
            />
            <Label htmlFor="remember" className="cursor-pointer text-xs font-normal text-text-soft">
              Remember my email on this device
            </Label>
          </div>
          {error && <p className="text-sm text-crimson">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-[0.7rem] text-text-soft">
            Your session stays active on this device until you sign out.
          </p>
        </form>
        <p className="mt-6 text-center text-xs text-text-soft">
          Client?{" "}
          <Link to="/client-login" className="underline">
            Sign in with your phone number
          </Link>
        </p>
      </Card>
    </AuthLayout>
  );
}
