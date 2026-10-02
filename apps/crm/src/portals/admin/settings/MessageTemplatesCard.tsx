import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { useToast } from "../../../components/ui/toast";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { Label } from "../../../components/ui/label";
import { Skeleton } from "../../../components/ui/skeleton";

// Mirrors message_templates.php (GET/PUT, singleton row). Both the daily
// Admin/Staff intimation digest (cron/daily_intimation.php, intimations.php)
// and the dispatch-token redirect (intimation_redirect.php) read these live
// at the moment a human presses "Send" — editing a template here instantly
// changes the wording for every pending item, past or future, since the
// text is never stored per-item.

interface Templates {
  birthday_whatsapp_template: string;
  renewal_whatsapp_template: string;
}

const PLACEHOLDER_HELP: Record<keyof Templates, string> = {
  birthday_whatsapp_template: "Available: {{name}}",
  renewal_whatsapp_template: "Available: {{name}}, {{product}}, {{renewal_date}}, {{days}}",
};

export function MessageTemplatesCard() {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Templates>("/message_templates.php")
      .then((data) => setTemplates(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!templates) return;
    setSaving(true);
    try {
      await api.put("/message_templates.php", templates);
    } catch (err) {
      setSaving(false);
      showToast(`Failed to save: ${err instanceof ApiError ? err.message : "unknown error"}`, "error");
      return;
    }
    setSaving(false);
    showToast("Message templates saved.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="border-b border-line pb-4">
        <h2 className="flex items-center gap-2 font-display text-base text-text">
          <MessageSquareText className="h-5 w-5 text-gold" /> Birthday & Renewal Message Templates
        </h2>
        <p className="text-xs text-text-soft">
          Used to pre-fill the WhatsApp message when an admin/staff member presses "Send via WhatsApp" on an
          Intimations item — nothing is ever sent automatically. Edit the wording here anytime; it applies
          immediately, including to items already in today's digest.
        </p>
      </div>

      {loading || !templates ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="birthday-template">Birthday Wish</Label>
            <Textarea
              id="birthday-template"
              rows={3}
              value={templates.birthday_whatsapp_template}
              onChange={(e) => setTemplates({ ...templates, birthday_whatsapp_template: e.target.value })}
            />
            <p className="text-xs text-text-soft">{PLACEHOLDER_HELP.birthday_whatsapp_template}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renewal-template">Renewal Reminder</Label>
            <Textarea
              id="renewal-template"
              rows={3}
              value={templates.renewal_whatsapp_template}
              onChange={(e) => setTemplates({ ...templates, renewal_whatsapp_template: e.target.value })}
            />
            <p className="text-xs text-text-soft">{PLACEHOLDER_HELP.renewal_whatsapp_template}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-line pt-4">
        <Button onClick={() => void handleSave()} disabled={saving || loading}>
          {saving ? "Saving…" : "Save Templates"}
        </Button>
      </div>
    </div>
  );
}
