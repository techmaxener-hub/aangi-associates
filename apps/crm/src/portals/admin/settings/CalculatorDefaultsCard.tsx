import { useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useToast } from "../../../components/ui/toast";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

interface Config {
  self_consumption_pct: number;
  income_growth_pct: number;
  discount_rate_pct: number;
  edu_inflation_pct: number;
  edu_return_pct: number;
  sip_return_pct: number;
  retirement_inflation_pct: number;
  pre_retirement_return_pct: number;
  post_retirement_return_pct: number;
  default_retirement_age: number;
  default_life_expectancy: number;
}

const FIELD_LABELS: Record<keyof Config, string> = {
  self_consumption_pct: "Self-Consumption (%)",
  income_growth_pct: "Income Growth (%)",
  discount_rate_pct: "Discount Rate (%)",
  edu_inflation_pct: "Education Inflation (%)",
  edu_return_pct: "Education Fund Return (%)",
  sip_return_pct: "SIP Delay Calc Return (%)",
  retirement_inflation_pct: "Retirement Inflation (%)",
  pre_retirement_return_pct: "Pre-Retirement Return (%)",
  post_retirement_return_pct: "Post-Retirement Return (%)",
  default_retirement_age: "Default Retirement Age",
  default_life_expectancy: "Default Life Expectancy",
};

export function CalculatorDefaultsCard() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("calculator_config")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
        } else {
          setConfig(data as Config);
        }
        setLoading(false);
      });
  }, []);

  function update(key: keyof Config, value: string) {
    if (!config) return;
    setConfig({ ...config, [key]: Number(value) });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("calculator_config")
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      showToast(`Failed to save: ${error.message}`, "error");
      return;
    }
    showToast("Calculator defaults saved — the public website reads these live.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="border-b border-line pb-4">
        <h2 className="flex items-center gap-2 font-display text-base text-text">
          <Calculator className="h-5 w-5 text-gold" /> Calculator Default Assumptions
        </h2>
        <p className="text-xs text-text-soft">
          The public site's 4 calculators read these values on page load via the anon key (public, read-only) instead
          of hardcoded constants.
        </p>
      </div>

      {loading || !config ? (
        <p className="text-sm text-text-soft">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {(Object.keys(FIELD_LABELS) as (keyof Config)[]).map((key) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{FIELD_LABELS[key]}</Label>
              <Input id={key} type="number" step="0.5" value={config[key]} onChange={(e) => update(key, e.target.value)} />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end border-t border-line pt-4">
        <Button onClick={() => void handleSave()} disabled={saving || loading}>
          {saving ? "Saving…" : "Save Defaults"}
        </Button>
      </div>
    </div>
  );
}
