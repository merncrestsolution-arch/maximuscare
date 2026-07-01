import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MdRoleCapabilities } from "@shared/mdCapabilities";
import { roleHasConfigurableCapabilities } from "@shared/mdCapabilities";

const CAPABILITY_FIELDS: Array<{
  key: keyof MdRoleCapabilities;
  label: string;
  desc: string;
  mdOnly?: boolean;
}> = [
  {
    key: "locationExempt",
    label: "Location exempt for Present",
    desc: "Can mark Present without GPS capture",
  },
  {
    key: "viewAttendanceLocation",
    label: "View attendance GPS",
    desc: "Can see captured check-in locations",
  },
  {
    key: "viewAllStaffFines",
    label: "View all staff fines",
    desc: "Can see fines for staff in assigned branches",
  },
  {
    key: "manageStaffFines",
    label: "Manage staff fines",
    desc: "Can add, edit, and waive fines",
  },
  {
    key: "maximusOverview",
    label: "Maximus organization overview",
    desc: "Can open Dehiwala · Bandaragama · Neuro overview",
    mdOnly: true,
  },
  {
    key: "nexusOverview",
    label: "Nexus organization overview",
    desc: "Can open Nexus Physio overview",
    mdOnly: true,
  },
];

interface RoleCapabilitiesSectionProps {
  role: string;
  value: MdRoleCapabilities;
  onChange?: (value: MdRoleCapabilities) => void;
  readOnly?: boolean;
}

export function RoleCapabilitiesSection({
  role,
  value,
  onChange,
  readOnly = false,
}: RoleCapabilitiesSectionProps) {
  if (!roleHasConfigurableCapabilities(role)) return null;

  const roleLabel =
    role === "MD" ? "Managing Director" : role === "Branch Manager" ? "Branch Manager" : "Manager";

  const fields = CAPABILITY_FIELDS.filter((f) => !f.mdOnly || role === "MD");

  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div>
        <h3 className="text-base font-bold text-foreground">{roleLabel} permissions</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {readOnly
            ? "Only Admin can view and change these permissions."
            : "Set what this person can access. Branch access is still controlled by assigned branches."}
        </p>
      </div>
      <div className="grid gap-3">
        {fields.map(({ key, label, desc }) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3"
          >
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor={`cap-${key}`}>{label}</Label>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
            <Switch
              id={`cap-${key}`}
              checked={value[key]}
              disabled={readOnly}
              onCheckedChange={(checked) =>
                onChange?.({ ...value, [key]: checked })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
