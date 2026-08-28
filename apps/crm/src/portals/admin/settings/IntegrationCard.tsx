import { useEffect, useState } from "react";
import { Eye, EyeOff, Copy, Activity, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useToast } from "../../../components/ui/toast";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { Badge, type BadgeVariant } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { defaultCredentials, type IntegrationDef } from "./integrations.config";

type Status = "connected" | "disconnected" | "pending";

export function IntegrationCard({ def, presets }: { def: IntegrationDef; presets?: Record<string, string> }) {
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<string, string>>(() => defaultCredentials(def, presets));
  const [status, setStatus] = useState<Status>("disconnected");
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from("integration_settings")
      .select("status, credentials")
      .eq("provider", def.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load integration settings", error);
        } else if (data) {
          setValues({ ...defaultCredentials(def, presets), ...(data.credentials as Record<string, string>) });
          setStatus(data.status as Status);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  function updateField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from("integration_settings").upsert({
      provider: def.id,
      category: def.category,
      display_name: def.name,
      status: "connected",
      credentials: values,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);

    if (error) {
      showToast(`Failed to save ${def.name}: ${error.message}`, "error");
      return;
    }

    setStatus("connected");
    showToast(`${def.name} credentials saved and channel activated.`);
  }

  function handleTest() {
    setTesting(true);
    window.setTimeout(() => {
      setTesting(false);
      showToast(`${def.name}: 200 OK — ping successful (simulated).`);
    }, 900);
  }

  function copyValue(value: string) {
    void navigator.clipboard.writeText(value);
    showToast("Copied to clipboard.");
  }

  const Icon = def.icon;

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-line bg-surface-2 p-2.5" style={{ color: def.color }}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-display text-base text-text">
              {def.name}
              <span className="rounded border border-line bg-surface-2 px-2 py-0.5 text-[10px] font-normal text-text-soft">
                {def.category}
              </span>
            </h2>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {def.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              {field.type === "toggle" ? (
                <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 p-3 text-sm">
                  <span className="text-text">{field.label}</span>
                  <input
                    type="checkbox"
                    checked={values[field.key] === "true"}
                    onChange={(e) => updateField(field.key, e.target.checked ? "true" : "false")}
                    className="h-4 w-4 rounded border-line-strong"
                  />
                </label>
              ) : (
                <>
                  <Label htmlFor={`${def.id}-${field.key}`}>{field.label}</Label>
                  {field.type === "select" ? (
                    <Select
                      id={`${def.id}-${field.key}`}
                      value={values[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                    >
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      id={`${def.id}-${field.key}`}
                      rows={6}
                      value={values[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="font-mono text-xs"
                    />
                  ) : (
                    <div className="relative flex items-center">
                      <Input
                        id={`${def.id}-${field.key}`}
                        type={field.type === "password" && !visibleFields[field.key] ? "password" : "text"}
                        readOnly={field.type === "copy"}
                        value={values[field.key] ?? ""}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        className="pr-10 font-mono text-xs"
                      />
                      {field.type === "password" && (
                        <button
                          type="button"
                          onClick={() => setVisibleFields((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                          className="absolute right-2 text-text-soft hover:text-text"
                          aria-label={visibleFields[field.key] ? "Hide value" : "Show value"}
                        >
                          {visibleFields[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                      {field.type === "copy" && (
                        <button
                          type="button"
                          onClick={() => copyValue(values[field.key] ?? "")}
                          className="absolute right-2 flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-1 text-[11px] text-gold-text"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      )}
                    </div>
                  )}
                  {field.type === "copy" && (
                    <p className="text-[11px] text-text-soft">
                      Points to where a Supabase Edge Function receiver would live — not deployed yet, so this URL isn't
                      live until that function ships.
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={handleTest} disabled={testing || loading}>
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5 text-gold" />}
          {def.testLabel ?? "Test Connection"}
        </Button>
        <Button onClick={() => void handleSave()} disabled={saving || loading}>
          {saving ? "Saving…" : "Save & Activate"}
        </Button>
      </div>
    </div>
  );
}

const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  connected: "success",
  disconnected: "neutral",
  pending: "warning",
};
const STATUS_LABEL: Record<Status, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  pending: "Pending",
};

function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
