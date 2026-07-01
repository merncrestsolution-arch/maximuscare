/** Per-staff capabilities for MD / Manager / Branch Manager roles. */
export interface MdRoleCapabilities {
  /** May mark Present without GPS capture. */
  locationExempt: boolean;
  /** May view captured check-in GPS for staff. */
  viewAttendanceLocation: boolean;
  /** May view fines for all staff in branch scope. */
  viewAllStaffFines: boolean;
  /** May add/edit/waive fines (otherwise Admin only). */
  manageStaffFines: boolean;
  /** May open the Maximus organization overview workspace (MD only). */
  maximusOverview: boolean;
  /** May open the Nexus organization overview workspace (MD only). */
  nexusOverview: boolean;
}

export const DEFAULT_MD_CAPABILITIES: MdRoleCapabilities = {
  locationExempt: true,
  viewAttendanceLocation: false,
  viewAllStaffFines: true,
  manageStaffFines: false,
  maximusOverview: false,
  nexusOverview: false,
};

export const DEFAULT_MANAGER_CAPABILITIES: MdRoleCapabilities = {
  locationExempt: false,
  viewAttendanceLocation: false,
  viewAllStaffFines: true,
  manageStaffFines: true,
  maximusOverview: false,
  nexusOverview: false,
};

export const CONFIGURABLE_CAPABILITY_ROLES = ["MD", "Manager", "Branch Manager"] as const;

export function roleHasConfigurableCapabilities(role: string | undefined): boolean {
  const r = String(role ?? "").trim();
  return (CONFIGURABLE_CAPABILITY_ROLES as readonly string[]).includes(r);
}

export function defaultCapabilitiesForRole(role: string | undefined): MdRoleCapabilities {
  const r = String(role ?? "").trim();
  if (r === "MD") return { ...DEFAULT_MD_CAPABILITIES };
  if (r === "Manager" || r === "Branch Manager") return { ...DEFAULT_MANAGER_CAPABILITIES };
  return { ...DEFAULT_MD_CAPABILITIES };
}

type SettingsRow = {
  mdLocationExempt?: boolean | number | null;
  mdViewAttendanceLocation?: boolean | number | null;
  mdViewAllStaffFines?: boolean | number | null;
  mdManageStaffFines?: boolean | number | null;
  mdMaximusOverview?: boolean | number | null;
  mdNexusOverview?: boolean | number | null;
};

export type StaffCapabilityRow = {
  role?: string | null;
  capLocationExempt?: boolean | number | null;
  capViewAttendanceLocation?: boolean | number | null;
  capViewAllStaffFines?: boolean | number | null;
  capManageStaffFines?: boolean | number | null;
  capMaximusOverview?: boolean | number | null;
  capNexusOverview?: boolean | number | null;
};

function asBool(value: boolean | number | null | undefined, fallback: boolean): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return fallback;
}

/** @deprecated Legacy clinic-wide MD settings — use per-staff caps instead. */
export function mdCapabilitiesFromSettings(
  settings?: SettingsRow | null,
): MdRoleCapabilities {
  const d = DEFAULT_MD_CAPABILITIES;
  if (!settings) return { ...d };
  return {
    locationExempt: asBool(settings.mdLocationExempt, d.locationExempt),
    viewAttendanceLocation: asBool(settings.mdViewAttendanceLocation, d.viewAttendanceLocation),
    viewAllStaffFines: asBool(settings.mdViewAllStaffFines, d.viewAllStaffFines),
    manageStaffFines: asBool(settings.mdManageStaffFines, d.manageStaffFines),
    maximusOverview: asBool(settings.mdMaximusOverview, d.maximusOverview),
    nexusOverview: asBool(settings.mdNexusOverview, d.nexusOverview),
  };
}

export function mdCapabilitiesFromStaff(staff?: StaffCapabilityRow | null): MdRoleCapabilities {
  const defaults = defaultCapabilitiesForRole(staff?.role ?? undefined);
  if (!staff || !roleHasConfigurableCapabilities(staff.role ?? undefined)) {
    return { ...defaults };
  }
  const hasAny =
    staff.capLocationExempt != null ||
    staff.capViewAttendanceLocation != null ||
    staff.capViewAllStaffFines != null ||
    staff.capManageStaffFines != null ||
    staff.capMaximusOverview != null ||
    staff.capNexusOverview != null;
  if (!hasAny) return { ...defaults };
  return {
    locationExempt: asBool(staff.capLocationExempt, defaults.locationExempt),
    viewAttendanceLocation: asBool(staff.capViewAttendanceLocation, defaults.viewAttendanceLocation),
    viewAllStaffFines: asBool(staff.capViewAllStaffFines, defaults.viewAllStaffFines),
    manageStaffFines: asBool(staff.capManageStaffFines, defaults.manageStaffFines),
    maximusOverview: asBool(staff.capMaximusOverview, defaults.maximusOverview),
    nexusOverview: asBool(staff.capNexusOverview, defaults.nexusOverview),
  };
}

export function staffPatchFromCapabilities(caps: MdRoleCapabilities): StaffCapabilityRow {
  return {
    capLocationExempt: caps.locationExempt,
    capViewAttendanceLocation: caps.viewAttendanceLocation,
    capViewAllStaffFines: caps.viewAllStaffFines,
    capManageStaffFines: caps.manageStaffFines,
    capMaximusOverview: caps.maximusOverview,
    capNexusOverview: caps.nexusOverview,
  };
}

export function parseRoleCapabilitiesInput(raw: unknown): MdRoleCapabilities | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  return {
    locationExempt: Boolean(o.locationExempt),
    viewAttendanceLocation: Boolean(o.viewAttendanceLocation),
    viewAllStaffFines: Boolean(o.viewAllStaffFines),
    manageStaffFines: Boolean(o.manageStaffFines),
    maximusOverview: Boolean(o.maximusOverview),
    nexusOverview: Boolean(o.nexusOverview),
  };
}
