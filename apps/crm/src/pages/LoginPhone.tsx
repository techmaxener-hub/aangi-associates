import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function LoginPhone() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) setError(error.message);
    else setStage("otp");
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-xl text-text">Aangi Associates</h1>
        <p className="mb-6 text-sm text-text-soft">Client portal sign in</p>

        {stage === "phone" ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91XXXXXXXXXX"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-crimson">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending code…" : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="otp">Enter the code sent to {phone}</Label>
              <Input id="otp" inputMode="numeric" required value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            {error && <p className="text-sm text-crimson">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying…" : "Verify & sign in"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-text-soft">
          Staff or Associate? <a href="/login" className="underline">Sign in with email</a>
        </p>
      </Card>
    </div>
  );
}
