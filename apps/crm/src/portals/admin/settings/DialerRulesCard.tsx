import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useToast } from "../../../components/ui/toast";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";

interface DialerRules {
  delay_seconds: number;
  max_retries: number;
  post_call_whatsapp_template: string;
}

export function DialerRulesCard() {
  const { showToast } = useToast();
  const [rules, setRules] = useState<DialerRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("dialer_rules")
      .select("delay_seconds, max_retries, post_call_whatsapp_template")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setRules(data as DialerRules);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    if (!rules) return;
    setSaving(true);
    const { error } = await supabase
      .from("dialer_rules")
      .update({ ...rules, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      showToast(`Failed to save: ${error.message}`, "error");
      return;
    }
    showToast("Auto-dialer rules saved.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="border-b border-line pb-4">
        <h2 className="flex items-center gap-2 font-display text-base text-text">
          <Timer className="h-5 w-5 text-gold" /> Lead Auto-Dialer & Fallback Rules
        </h2>
        <p className="text-xs text-text-soft">
          Configuration only — no dialer is connected yet. Once a telephony provider above is wired to a real webhook
          receiver, these values decide how it behaves.
        </p>
      </div>

      {loading || !rules ? (
        <p className="text-sm text-text-soft">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Dial delay after lead submission (seconds)</Label>
              <Input
                type="number"
                value={rules.delay_seconds}
                onChange={(e) => setRules({ ...rules, delay_seconds: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max retry attempts</Label>
              <Input
                type="number"
                value={rules.max_retries}
                onChange={(e) => setRules({ ...rules, max_retries: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Post-call WhatsApp template</Label>
            <Textarea
              rows={3}
              value={rules.post_call_whatsapp_template}
              onChange={(e) => setRules({ ...rules, post_call_whatsapp_template: e.target.value })}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-text-soft">
              Use <code>{"{{name}}"}</code> and <code>{"{{summary}}"}</code> as placeholders — the webhook handler
              fills these in before dispatching to {"{"}"wa.me/919033132791"{"}"}.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-line pt-4">
        <Button onClick={() => void handleSave()} disabled={saving || loading}>
          {saving ? "Saving…" : "Save Rules"}
        </Button>
      </div>
    </div>
  );
}
