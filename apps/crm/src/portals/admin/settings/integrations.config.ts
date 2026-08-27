import type { LucideIcon } from "lucide-react";
import {
  MessageCircle,
  Search,
  Building2,
  Phone,
  Boxes,
  Briefcase,
  Star,
  ShieldCheck,
  TrendingUp,
  FileBarChart,
  CalendarClock,
  Zap,
  PhoneCall,
  Users,
} from "lucide-react";

export type FieldType = "text" | "password" | "copy";

export interface IntegrationField {
  key: string;
  label: string;
  type: FieldType;
}

export interface IntegrationDef {
  id: string;
  name: string;
  category: string;
  icon: LucideIcon;
  color: string;
  fields: IntegrationField[];
}

// Real, correctly-formed URL pattern for a future Supabase Edge Function
// webhook receiver — no such function is deployed yet, so this is where one
// *would* live, not a live endpoint. Surfaced with that caveat in the UI.
const webhookUrl = (provider: string) => `https://vdiymedmnrqmosazaaro.supabase.co/functions/v1/leads-${provider}`;

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "meta",
    name: "Meta Lead Ads",
    category: "Social Inbound",
    icon: MessageCircle,
    color: "#1877F2",
    fields: [
      { key: "access_token", label: "Page Access Token", type: "password" },
      { key: "app_secret", label: "Meta App Secret", type: "password" },
      { key: "ad_account_id", label: "Ad Account ID", type: "text" },
      { key: "webhook_url", label: "Leadgen Webhook URL", type: "copy" },
    ],
  },
  {
    id: "google_ads",
    name: "Google Ads Forms",
    category: "Search Intent",
    icon: Search,
    color: "#4285F4",
    fields: [
      { key: "webhook_url", label: "Google Lead Form Webhook URL", type: "copy" },
      { key: "webhook_key", label: "Google Ads Webhook Key", type: "password" },
    ],
  },
  {
    id: "indiamart",
    name: "IndiaMART Lead API",
    category: "B2B Portal",
    icon: Building2,
    color: "#00A699",
    fields: [
      { key: "crm_key", label: "GLUSR_CRM_KEY", type: "password" },
      { key: "mobile", label: "Registered Mobile Number", type: "text" },
    ],
  },
  {
    id: "justdial",
    name: "Justdial Lead API",
    category: "Local Search",
    icon: Phone,
    color: "#FF5722",
    fields: [
      { key: "vendor_token", label: "Justdial Vendor Token", type: "password" },
      { key: "webhook_url", label: "Push Webhook URL", type: "copy" },
    ],
  },
  {
    id: "tradeindia",
    name: "TradeIndia Lead Manager",
    category: "B2B Portal",
    icon: Boxes,
    color: "#3B82F6",
    fields: [
      { key: "user_id", label: "TradeIndia User ID", type: "text" },
      { key: "profile_id", label: "TradeIndia Profile ID", type: "text" },
      { key: "secret_key", label: "TradeIndia Secret Key", type: "password" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Cloud API",
    category: "Chat & Bot Engine",
    icon: MessageCircle,
    color: "#25D366",
    fields: [
      { key: "system_token", label: "Permanent System Access Token", type: "password" },
      { key: "phone_number_id", label: "Phone Number ID", type: "text" },
      { key: "waba_id", label: "WABA Business Account ID", type: "text" },
      { key: "verify_token", label: "Webhook Verify Token", type: "text" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn Lead Gen",
    category: "HNI & Corporate",
    icon: Briefcase,
    color: "#0A66C2",
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "ad_account_urn", label: "Ad Account URN", type: "text" },
    ],
  },
  {
    id: "sulekha",
    name: "Sulekha Business",
    category: "Local Directory",
    icon: Star,
    color: "#F59E0B",
    fields: [
      { key: "partner_id", label: "Sulekha Partner ID", type: "text" },
      { key: "api_token", label: "API Auth Token", type: "password" },
    ],
  },
  {
    id: "policybazaar",
    name: "Policybazaar POSP",
    category: "Comparative Portal",
    icon: ShieldCheck,
    color: "#1E3A8A",
    fields: [
      { key: "posp_code", label: "POSP Broker Partner Code", type: "text" },
      { key: "relay_key", label: "Lead Relay Webhook Key", type: "password" },
    ],
  },
  {
    id: "investwell",
    name: "Investwell Sync",
    category: "Advisor Backoffice",
    icon: TrendingUp,
    color: "#10B981",
    fields: [
      { key: "api_key", label: "Investwell API Key", type: "password" },
      { key: "broker_code", label: "Broker Entity Code", type: "text" },
    ],
  },
  {
    id: "redvision",
    name: "RedVision / Mint Pro",
    category: "Advisor CRM",
    icon: FileBarChart,
    color: "#EF4444",
    fields: [
      { key: "secret_key", label: "RedVision Secret Key", type: "password" },
      { key: "advisor_sync_id", label: "Advisor Sync ID", type: "text" },
    ],
  },
  {
    id: "calendly",
    name: "Calendly Appointments",
    category: "Discovery Calls",
    icon: CalendarClock,
    color: "#006BFF",
    fields: [
      { key: "personal_access_token", label: "Personal Access Token", type: "password" },
      { key: "webhook_url", label: "Booking Event Webhook", type: "copy" },
    ],
  },
  {
    id: "zapier",
    name: "Zapier / Make Webhook",
    category: "Universal Relay",
    icon: Zap,
    color: "#FF4F00",
    fields: [
      { key: "webhook_url", label: "Custom Inbound Webhook URL", type: "copy" },
      { key: "hmac_secret", label: "HMAC Signature Secret", type: "password" },
    ],
  },
  {
    id: "exotel",
    name: "Exotel Telephony IVR",
    category: "Call / Missed Call",
    icon: PhoneCall,
    color: "#0EA5E9",
    fields: [
      { key: "account_sid", label: "Exotel Account SID", type: "text" },
      { key: "api_key", label: "API Key & Token", type: "password" },
      { key: "virtual_number", label: "Virtual Caller Number", type: "text" },
    ],
  },
  {
    id: "bni",
    name: "BNI Referral Bridge",
    category: "Network Referrals",
    icon: Users,
    color: "#DC2626",
    fields: [
      { key: "chapter_email", label: "BNI Chapter Registered Email", type: "text" },
      { key: "ingestion_token", label: "Auto-Forwarding Ingestion Token", type: "password" },
    ],
  },
];

export function defaultCredentials(def: IntegrationDef): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of def.fields) {
    values[field.key] = field.type === "copy" ? webhookUrl(def.id) : "";
  }
  return values;
}
