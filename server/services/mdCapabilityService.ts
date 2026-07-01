import type { IStorage } from "../storage";
import {
  mdCapabilitiesFromSettings,
  type MdRoleCapabilities,
} from "@shared/mdCapabilities";

export async function loadMdCapabilities(storage: IStorage): Promise<MdRoleCapabilities> {
  const settings = await storage.getClinicSettings();
  return mdCapabilitiesFromSettings(settings);
}
