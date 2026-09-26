import { Mail } from "lucide-react";
import type { IntegrationDef } from "./integrations.config";

export const EMAIL_AUTOMATION: IntegrationDef = {
  id: "email_automation",
  name: "Email Automation",
  category: "Renewal / Welcome / Onboarding",
  icon: Mail,
  color: "var(--gold)",
  fields: [
    { key: "provider", label: "Provider (SMTP / SendGrid / Postmark / Resend)", type: "text" },
    { key: "api_key", label: "API Key / SMTP Password", type: "password" },
    { key: "sender_name", label: "Sender Name", type: "text" },
    { key: "sender_email", label: "Verified From-Address", type: "text" },
  ],
};
