// REFERENCE IMPLEMENTATION — NOT DEPLOYED.
//
// This project's serverless backend is Supabase Edge Functions (Deno), not
// Node/Express — there is no Express server anywhere in this codebase, so
// Express code would be dead weight that doesn't fit anything deployable
// here. This is the correct shape for the same job: receive Exotel's call
// webhook, upsert it into public.calls, and (for a completed call with a
// recording) forward a summary to WhatsApp.
//
// To actually deploy this once a real Exotel/Sarvam account exists:
//   supabase functions deploy telephony-webhook --project-ref vdiymedmnrqmosazaaro
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=...
// Then point Exotel's "Passthru Applet" / call-status webhook at:
//   https://vdiymedmnrqmosazaaro.supabase.co/functions/v1/telephony-webhook
//
// Field names below (CallSid, From, To, Status, RecordingUrl,
// DialCallDuration) follow Exotel's commonly documented webhook payload —
// verify against Exotel's current API docs for your account before relying
// on them; Exotel's exact field set can vary by product/flow type.
//
// WhatsApp dispatch note: a wa.me link only opens a chat for a HUMAN to
// send — it cannot be triggered server-side. Sending a message
// automatically from a function requires the WhatsApp Cloud API (Meta),
// using the credentials already stored under the "whatsapp" integration
// in public.integration_settings (see apps/crm's Lead Ingestion Hub) — and
// per WhatsApp Business policy, a business-initiated message like this
// generally requires a pre-approved message template, not free-form text.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

interface ExotelPayload {
  CallSid?: string;
  From?: string;
  To?: string;
  Direction?: string;
  Status?: string; // e.g. "completed", "no-answer", "busy", "failed"
  RecordingUrl?: string;
  DialCallDuration?: string;
}

async function parsePayload(req: Request): Promise<ExotelPayload> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await req.json();
  }
  // Exotel's default webhook content type is form-encoded.
  const form = await req.formData();
  const payload: Record<string, string> = {};
  for (const [key, value] of form.entries()) payload[key] = String(value);
  return payload;
}

async function dispatchWhatsAppSummary(leadPhone: string, summary: string) {
  const { data: waSettings } = await supabase
    .from("integration_settings")
    .select("credentials")
    .eq("provider", "whatsapp")
    .maybeSingle();

  const creds = waSettings?.credentials as
    | { system_token?: string; phone_number_id?: string }
    | undefined;

  if (!creds?.system_token || !creds?.phone_number_id) {
    console.warn("WhatsApp Cloud API not configured — skipping automated dispatch.");
    return;
  }

  // NOTE: sending free-form text like this only works within a 24-hour
  // customer-initiated session window. Outside that window, WhatsApp
  // Business policy requires a pre-approved message template instead —
  // swap the "text" body below for a "template" body per Meta's docs.
  await fetch(`https://graph.facebook.com/v18.0/${creds.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.system_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: leadPhone,
      type: "text",
      text: { body: summary },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = req.method === "GET"
    ? Object.fromEntries(new URL(req.url).searchParams)
    : await parsePayload(req);

  const phone = payload.From || payload.To || "";
  const status = (payload.Status || "logged").toLowerCase();
  const duration = payload.DialCallDuration ? parseInt(payload.DialCallDuration, 10) : null;

  const { error } = await supabase.from("calls").insert({
    lead_name: phone || "Unknown caller",
    phone,
    source_channel: "exotel",
    direction: (payload.Direction || "outbound").toLowerCase().includes("in") ? "inbound" : "outbound",
    duration_seconds: duration,
    status: status === "completed" ? "completed" : status === "no-answer" || status === "busy" ? "missed" : "logged",
    recording_url: payload.RecordingUrl || null,
    notes: payload.CallSid ? `Exotel CallSid: ${payload.CallSid}` : null,
  });

  if (error) {
    console.error("Failed to insert call log:", error.message);
    return new Response("Failed to log call", { status: 500 });
  }

  if (status === "completed" && phone) {
    await dispatchWhatsAppSummary(
      phone,
      `Thanks for speaking with Aangi Associates. We'll follow up shortly with next steps.`,
    );
  }

  return new Response("OK", { status: 200 });
});
