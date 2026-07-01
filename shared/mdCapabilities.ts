/** Admin-tunable capabilities for the MD role (stored in clinic_settings). */
export interface MdRoleCapabilities {
  /** MD may mark Present without GPS capture. */
  locationExempt: boolean;
  /** MD may view captured check-in GPS for staff. */
  viewAttendanceLocation: boolean;
  /** MD may view fines for all staff in branch scope. */
  viewAllStaffFines: boolean;
  /** MD may add/edit/waive fines (otherwise Admin only). */
  manageStaffFines: boolean;
  /** MD may open the Maximus organization overview workspace. */
  maximusOverview: boolean;
  /** MD may open the Nexus organization overview workspace. */
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

type SettingsRow = {
  mdLocationExempt?: boolean | number | null;
  mdViewAttendanceLocation?: boolean | number | null;
  mdViewAllStaffFines?: boolean | number | null;
  mdManageStaffFines?: boolean | number | null;
  mdMaximusOverview?: boolean | number | null;
  mdNexusOverview?: boolean | number | null;
};

function asBool(value: boolean | number | null | undefined, fallback: boolean): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return fallback;
}

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
