import { Phone, Mic, PhoneCall, Radio } from "lucide-react";
import type { IntegrationDef } from "./integrations.config";

export const EXOTEL_IVR: IntegrationDef = {
  id: "exotel_ivr",
  name: "Exotel Cloud IVR",
  category: "Telephony & SIP Trunk",
  icon: Phone,
  color: "#0EA5E9",
  testLabel: "Test Voice Ping / Diagnostic Call",
  fields: [
    { key: "account_sid", label: "Account SID", type: "text" },
    { key: "api_key", label: "API Key", type: "password" },
    { key: "api_token", label: "API Token", type: "password" },
    { key: "virtual_number", label: "Virtual Caller Number", type: "text" },
    { key: "caller_id", label: "Caller ID (CLI)", type: "text" },
    { key: "ivr_flow_id", label: "IVR Flow ID", type: "text" },
    { key: "auto_record", label: "Auto-Record Calls", type: "toggle" },
    { key: "inbound_ivr_dispatch", label: "Inbound IVR Dispatch", type: "toggle" },
  ],
};

const SARVAM_SYSTEM_PROMPT = `You are the AI voice assistant for Aangi Associates, the insurance and wealth advisory practice led by Jainik Shah, Chief Business Associate Leader with TATA AIA Life Insurance in Ahmedabad. Jainik has 17+ years of experience and advises 1,400+ client families.

Speak in clear, warm Indian English by default, and switch fluently to Hindi or Gujarati if the caller prefers.

You can help callers with: Term Insurance Cover, Family Mediclaim, Child Education Planning, Keyman Insurance for business owners, and Claim Desk support (checking on an existing claim's status).

If the caller has an urgent claim query or asks to speak to Jainik directly, offer to transfer the call immediately.

Never quote specific premium amounts or policy numbers, and never give financial advice — always offer to schedule a callback with an advisor for anything requiring a real quote or personal recommendation.

Keep responses brief and conversational, as in a real phone call.`;

export const SARVAM_AI: IntegrationDef = {
  id: "sarvam_ai",
  name: "Sarvam AI Voice Bot",
  category: "Conversational Voice AI",
  icon: Mic,
  color: "#7C3AED",
  testLabel: "Simulate Live Voice Test Call",
  fields: [
    { key: "api_key", label: "Sarvam API Subscription Key", type: "password" },
    { key: "model_id", label: "Model ID", type: "text" },
    {
      key: "language",
      label: "Default Language",
      type: "select",
      options: ["Auto-Detect", "Indian English", "Hindi", "Gujarati"],
    },
    { key: "system_prompt", label: "System Prompt & Knowledge Base", type: "textarea" },
  ],
};

export const SARVAM_AI_PRESETS = {
  model_id: "sarvam-voice-2.0",
  system_prompt: SARVAM_SYSTEM_PROMPT,
};

export const TELECRM: IntegrationDef = {
  id: "telecrm",
  name: "TeleCRM / Agent Dialer",
  category: "Agent Click-to-Call",
  icon: PhoneCall,
  color: "#059669",
  fields: [
    { key: "api_key", label: "TeleCRM API Key", type: "password" },
    { key: "dialer_number", label: "Click-to-Call Number", type: "text" },
  ],
};

export const SQUADSTACK: IntegrationDef = {
  id: "squadstack",
  name: "SquadStack On-Demand",
  category: "Outsourced Calling Campaigns",
  icon: Radio,
  color: "#DB2777",
  fields: [
    { key: "api_key", label: "SquadStack API Key", type: "password" },
    { key: "campaign_id", label: "Active Campaign ID", type: "text" },
  ],
};

export const TELEPHONY_INTEGRATIONS: IntegrationDef[] = [EXOTEL_IVR, SARVAM_AI, TELECRM, SQUADSTACK];
