import { Code, Copy } from "lucide-react";
import { useToast } from "../../../components/ui/toast";
import { Button } from "../../../components/ui/button";

const SITE_URL = "https://aa.tmarinternational.com";

const linkSnippet = `<a href="${SITE_URL}/calculators.html" target="_blank" rel="noopener"
  style="display:inline-block;padding:0.75rem 1.5rem;border-radius:0.375rem;background:#9c1c30;color:#f6f3ea;font-family:sans-serif;font-weight:600;text-decoration:none;">
  Calculate Your Term Insurance Need →
</a>`;

const scriptSnippet = `<script>
  (function () {
    var a = document.createElement("a");
    a.href = "${SITE_URL}/calculators.html";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Calculate Your Term Insurance Need →";
    a.style.cssText = "display:inline-block;padding:0.75rem 1.5rem;border-radius:0.375rem;background:#9c1c30;color:#f6f3ea;font-family:sans-serif;font-weight:600;text-decoration:none;";
    document.currentScript.parentNode.insertBefore(a, document.currentScript);
  })();
</script>`;

export function WebformEmbed() {
  const { showToast } = useToast();

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="border-b border-line pb-3">
        <h2 className="flex items-center gap-2 font-display text-base text-text">
          <Code className="h-5 w-5 text-gold" /> Calculator & Webform Embed
        </h2>
        <p className="text-xs text-text-soft">
          Both snippets link out to the real, live calculators page at {SITE_URL}/calculators.html — there's no
          chrome-less embeddable iframe widget yet, so this is a styled button, not an inline form.
        </p>
      </div>

      <SnippetBlock label="Link button (plain HTML)" code={linkSnippet} onCopy={() => copy(linkSnippet)} />
      <SnippetBlock
        label="Script tag (auto-inserts the button)"
        code={scriptSnippet}
        onCopy={() => copy(scriptSnippet)}
      />

      <div className="rounded-lg border border-line bg-surface-2 p-3 text-xs text-text-soft">
        <p className="font-semibold text-text">Lead routing today</p>
        <p>
          Visitors land on the real calculators page and use its existing "Discuss this result on WhatsApp" CTA — there
          is no separate CRM ingestion path for this yet. Wiring calculator submissions directly into the `leads` table
          would need a chrome-less embed mode on the calculators page plus a small API call, which isn't built.
        </p>
      </div>
    </div>
  );
}

function SnippetBlock({ label, code, onCopy }: { label: string; code: string; onCopy: () => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-text">{label}</p>
      <div className="relative">
        <pre className="max-h-40 overflow-auto rounded-lg border border-line bg-surface-2 p-3 text-[11px] text-gold-text">
          <code>{code}</code>
        </pre>
        <Button variant="ghost" size="sm" onClick={onCopy} className="absolute right-2 top-2">
          <Copy className="h-3 w-3" /> Copy
        </Button>
      </div>
    </div>
  );
}
