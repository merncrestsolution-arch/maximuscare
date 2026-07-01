import type { IStorage } from "../storage";
import type { Visit } from "@shared/schema";
import { normalizeBranchName, getHomeVisitRateTier } from "@shared/branches";
import { DEFAULT_RATES, normalizeVisitType } from "./calculationEngine";

// Bug 7: flat per-branch home-visit rate — no holiday rate.
export const HOME_VISIT_RATES = {
  Colombo: DEFAULT_RATES.homeColombo,
  Bandaragama: DEFAULT_RATES.homeBandaragama,
} as const;

export type HomeVisitType = keyof typeof HOME_VISIT_RATES;

export function homeVisitRate(type: HomeVisitType, settings?: { homeColombo?: number; homeBandaragama?: number }): number {
  if (type === "Bandaragama") return settings?.homeBandaragama ?? HOME_VISIT_RATES.Bandaragama;
  return settings?.homeColombo ?? HOME_VISIT_RATES.Colombo;
}

/** Bug 7: home-visit type is determined purely by branch tier — no holiday case. */
export async function detectHomeVisitType(
  _storage: IStorage,
  _staffId: string,
  _visitDate: string,
  branch: string,
  overrideType?: string | null
): Promise<HomeVisitType> {
  if (overrideType && overrideType in HOME_VISIT_RATES) {
    return overrideType as HomeVisitType;
  }
  if (getHomeVisitRateTier(branch) === "bandaragama") return "Bandaragama";
  return "Colombo";
}

export async function syncHomeVisitFromVisit(
  storage: IStorage,
  visit: Visit,
  homeVisitType?: HomeVisitType
): Promise<void> {
  if (normalizeVisitType((visit as { visitType?: string; type?: string }).visitType ?? (visit as any).type) !== "home") {
    return;
  }

  const settings = await storage.getClinicSettings();
  const type = homeVisitType ?? (await detectHomeVisitType(
    storage,
    visit.treatingStaffId,
    visit.visitDate,
    visit.branch,
    (visit as { homeVisitType?: string }).homeVisitType
  ));
  const rate = homeVisitRate(type, {
    homeColombo: Number(settings?.homeRateColombo ?? HOME_VISIT_RATES.Colombo),
    homeBandaragama: Number(settings?.homeRateBandaragama ?? HOME_VISIT_RATES.Bandaragama),
  });

  const patient = await storage.getPatient(visit.patientId);
  await storage.upsertHomeVisitFromVisit({
    staffId: visit.treatingStaffId,
    staffName: visit.treatingStaffName,
    patientId: visit.patientId,
    patientName: patient?.name ?? "",
    visitType: type,
    visitDate: visit.visitDate,
    branch: visit.branch,
    notes: visit.notes ?? undefined,
    visitId: visit.id,
    paymentAmount: String(rate),
  });
}
