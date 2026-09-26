import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authApi, ApiError } from "../lib/api";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AuthLayout } from "./AuthLayout";

export function LoginPhone() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const phoneInvalid = phoneTouched && !/^\+?[0-9]{10,15}$/.test(phone);

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setPhoneTouched(true);
    if (!/^\+?[0-9]{10,15}$/.test(phone)) return;

    setLoading(true);
    setError(null);
    try {
      const { sms_sent } = await authApi.requestOtp(phone);
      if (!sms_sent) {
        // No SMS gateway configured yet (see apps/crm-api/lib/sms.php) —
        // the code was still generated and logged server-side, so testing
        // can continue; a real client can't receive it yet.
        console.warn("SMS gateway not configured — OTP was generated but not sent. Check server logs.");
      }
      setStage("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { user } = await authApi.verifyOtp(phone, otp);
      setUser(user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout subtitle="Client portal sign in">
      <Card>
        <h1 className="mb-1 font-display text-xl text-text">Aangi Associates</h1>
        <p className="mb-6 text-sm text-text-soft">
          {stage === "phone" ? "Enter your mobile number to get a one-time code." : "Enter the code we sent you."}
        </p>

        {stage === "phone" ? (
          <form onSubmit={requestOtp} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91XXXXXXXXXX"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
                aria-invalid={phoneInvalid}
                className={phoneInvalid ? "border-crimson focus-visible:ring-crimson" : undefined}
              />
              {phoneInvalid && (
                <p className="text-xs text-crimson">Enter your number with country code, e.g. +919876543210.</p>
              )}
            </div>
            {error && <p className="text-sm text-crimson">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Sending code…" : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="otp">Enter the code sent to {phone}</Label>
              <Input
                id="otp"
                inputMode="numeric"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-crimson">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Verifying…" : "Verify & sign in"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStage("phone");
                setOtp("");
                setError(null);
              }}
              className="w-full text-center text-xs text-text-soft underline"
            >
              &larr; Use a different number
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-text-soft">
          Staff or Associate?{" "}
          <Link to="/login" className="underline">
            Sign in with email
          </Link>
        </p>
      </Card>
    </AuthLayout>
  );
}
