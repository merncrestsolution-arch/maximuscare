import type { IStorage } from "../storage";
import {
  mdCapabilitiesFromSettings,
  mdCapabilitiesFromStaff,
  roleHasConfigurableCapabilities,
  type MdRoleCapabilities,
} from "@shared/mdCapabilities";

/** @deprecated Use loadStaffRoleCapabilities for per-user checks. */
export async function loadMdCapabilities(storage: IStorage): Promise<MdRoleCapabilities> {
  const settings = await storage.getClinicSettings();
  return mdCapabilitiesFromSettings(settings);
}

export async function loadStaffRoleCapabilities(
  storage: IStorage,
  staffId: string,
): Promise<MdRoleCapabilities> {
  const staff = await storage.getStaff(staffId);
  if (!staff) {
    const settings = await storage.getClinicSettings();
    return mdCapabilitiesFromSettings(settings);
  }
  return mdCapabilitiesFromStaff(staff);
}

export async function loadRoleCapabilitiesForUser(
  storage: IStorage,
  role: string | undefined,
  staffId: string,
): Promise<MdRoleCapabilities | undefined> {
  if (!roleHasConfigurableCapabilities(role)) return undefined;
  return loadStaffRoleCapabilities(storage, staffId);
}
