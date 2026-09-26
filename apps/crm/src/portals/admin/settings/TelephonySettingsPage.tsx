import { useState, type ReactNode } from "react";
import { PhoneOutgoing, Timer } from "lucide-react";
import { PortalLayout } from "../../PortalLayout";
import { adminNavItems } from "../nav";
import {
  EXOTEL_IVR,
  SARVAM_AI,
  SARVAM_AI_PRESETS,
  TELECRM,
  SQUADSTACK,
  TELEPHONY_INTEGRATIONS,
} from "./telephony.config";
import { IntegrationCard } from "./IntegrationCard";
import { DialerRulesCard } from "./DialerRulesCard";
import { CallLogsDesk } from "./CallLogsDesk";

type Selection = "dialer-rules" | "call-logs" | (string & {});

export function TelephonySettingsPage() {
  const [selected, setSelected] = useState<Selection>(SARVAM_AI.id);

  return (
    <PortalLayout title="Telephony & AI Calling Agents" navItems={adminNavItems}>
      <div className="mb-6 rounded-lg border border-line bg-surface-2 p-3 text-xs text-text-soft">
        <span className="font-semibold text-gold-text">Honest status:</span> credential storage below is real (MySQL,
        admin-only via apps/crm-api). Nothing here can actually place or answer a call yet — that needs a real
        Exotel/Sarvam/ TeleCRM/SquadStack account and a deployed webhook receiver, neither of which exist. "Test"
        buttons simulate a result; the Call Logs Desk is a real table that fills automatically once that receiver ships.
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-6">
        <nav className="space-y-6">
          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-soft">
              Voice & Dialer Providers
            </p>
            <div className="space-y-1">
              {TELEPHONY_INTEGRATIONS.map((item) => (
                <SubNavButton
                  key={item.id}
                  active={selected === item.id}
                  onClick={() => setSelected(item.id)}
                  icon={<item.icon className="h-4 w-4" style={{ color: item.color }} />}
                  label={item.name}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-soft">Rules & Logs</p>
            <div className="space-y-1">
              <SubNavButton
                active={selected === "dialer-rules"}
                onClick={() => setSelected("dialer-rules")}
                icon={<Timer className="h-4 w-4 text-gold" />}
                label="Auto-Dialer & Fallback Rules"
              />
              <SubNavButton
                active={selected === "call-logs"}
                onClick={() => setSelected("call-logs")}
                icon={<PhoneOutgoing className="h-4 w-4 text-gold" />}
                label="Live Call Logs & Recordings"
              />
            </div>
          </div>
        </nav>

        <div>
          {selected === "dialer-rules" && <DialerRulesCard />}
          {selected === "call-logs" && <CallLogsDesk />}
          {selected === EXOTEL_IVR.id && <IntegrationCard def={EXOTEL_IVR} />}
          {selected === SARVAM_AI.id && <IntegrationCard def={SARVAM_AI} presets={SARVAM_AI_PRESETS} />}
          {selected === TELECRM.id && <IntegrationCard def={TELECRM} />}
          {selected === SQUADSTACK.id && <IntegrationCard def={SQUADSTACK} />}
        </div>
      </div>
    </PortalLayout>
  );
}

function SubNavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 truncate rounded-md px-3 py-2 text-left text-xs font-medium transition ${
        active ? "bg-surface-2 text-text" : "text-text-soft hover:bg-surface-2 hover:text-text"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
