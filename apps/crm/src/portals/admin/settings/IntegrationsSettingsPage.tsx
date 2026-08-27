import { useState, type ReactNode } from "react";
import { UserPlus, UploadCloud, Code, Calculator } from "lucide-react";
import { PortalLayout } from "../../PortalLayout";
import { adminNavItems } from "../nav";
import { INTEGRATIONS } from "./integrations.config";
import { EMAIL_AUTOMATION } from "./automation.config";
import { IntegrationCard } from "./IntegrationCard";
import { ManualLeadEntry } from "./ManualLeadEntry";
import { BulkLeadUpload } from "./BulkLeadUpload";
import { WebformEmbed } from "./WebformEmbed";
import { CalculatorDefaultsCard } from "./CalculatorDefaultsCard";

type Selection = "single-entry" | "bulk-entry" | "webform" | (string & {});

export function IntegrationsSettingsPage() {
  const [selected, setSelected] = useState<Selection>("meta");

  return (
    <PortalLayout title="Lead Ingestion & Integration Hub" navItems={adminNavItems}>
      <div className="grid grid-cols-[260px_1fr] gap-6">
        <nav className="space-y-6">
          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-soft">
              Lead Input & Ingestion
            </p>
            <div className="space-y-1">
              <SubNavButton
                active={selected === "single-entry"}
                onClick={() => setSelected("single-entry")}
                icon={<UserPlus className="h-4 w-4 text-gold" />}
                label="Manual Single Lead"
              />
              <SubNavButton
                active={selected === "bulk-entry"}
                onClick={() => setSelected("bulk-entry")}
                icon={<UploadCloud className="h-4 w-4 text-gold" />}
                label="Bulk CSV Import"
              />
              <SubNavButton
                active={selected === "webform"}
                onClick={() => setSelected("webform")}
                icon={<Code className="h-4 w-4 text-gold" />}
                label="Webforms & Calculators"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-soft">
              API & Webhook Sources ({INTEGRATIONS.length})
            </p>
            <div className="space-y-1">
              {INTEGRATIONS.map((item) => (
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
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-soft">Automation & Config</p>
            <div className="space-y-1">
              <SubNavButton
                active={selected === EMAIL_AUTOMATION.id}
                onClick={() => setSelected(EMAIL_AUTOMATION.id)}
                icon={<EMAIL_AUTOMATION.icon className="h-4 w-4" style={{ color: EMAIL_AUTOMATION.color }} />}
                label={EMAIL_AUTOMATION.name}
              />
              <SubNavButton
                active={selected === "calculator-defaults"}
                onClick={() => setSelected("calculator-defaults")}
                icon={<Calculator className="h-4 w-4 text-gold" />}
                label="Calculator Defaults"
              />
            </div>
          </div>
        </nav>

        <div>
          {selected === "single-entry" && <ManualLeadEntry />}
          {selected === "bulk-entry" && <BulkLeadUpload />}
          {selected === "webform" && <WebformEmbed />}
          {selected === EMAIL_AUTOMATION.id && <IntegrationCard def={EMAIL_AUTOMATION} />}
          {selected === "calculator-defaults" && <CalculatorDefaultsCard />}
          {!["single-entry", "bulk-entry", "webform", EMAIL_AUTOMATION.id, "calculator-defaults"].includes(selected) &&
            (() => {
              const def = INTEGRATIONS.find((i) => i.id === selected);
              return def ? <IntegrationCard def={def} /> : null;
            })()}
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
