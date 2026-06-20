import type { IStorage } from "../storage";
import type { Visit } from "@shared/schema";
import { normalizeBranchName, getHomeVisitRateTier } from "@shared/branches";
import { DEFAULT_RATES } from "./calculationEngine";

export const HOME_VISIT_RATES = {
  Colombo: DEFAULT_RATES.homeColombo,
  Bandaragama: DEFAULT_RATES.homeBandaragama,
  Holiday: DEFAULT_RATES.holidayHome,
} as const;

export type HomeVisitType = keyof typeof HOME_VISIT_RATES;

export function homeVisitRate(type: HomeVisitType, settings?: { homeColombo?: number; homeBandaragama?: number; holidayHome?: number }): number {
  if (type === "Holiday") return settings?.holidayHome ?? HOME_VISIT_RATES.Holiday;
  if (type === "Bandaragama") return settings?.homeBandaragama ?? HOME_VISIT_RATES.Bandaragama;
  return settings?.homeColombo ?? HOME_VISIT_RATES.Colombo;
}

/** If staff was absent on visit date, home visit is Holiday type (Rs.1500). */
export async function detectHomeVisitType(
  storage: IStorage,
  staffId: string,
  visitDate: string,
  branch: string,
  overrideType?: string | null
): Promise<HomeVisitType> {
  if (overrideType && overrideType in HOME_VISIT_RATES) {
    return overrideType as HomeVisitType;
  }
  const attendance = await storage.getAttendanceByStaffAndDate(staffId, visitDate);
  if (attendance?.status === "Absent") return "Holiday";
  if (getHomeVisitRateTier(branch) === "bandaragama") return "Bandaragama";
  return "Colombo";
}

export async function syncHomeVisitFromVisit(
  storage: IStorage,
  visit: Visit,
  homeVisitType?: HomeVisitType
): Promise<void> {
  if (visit.visitType !== "Home") return;

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
    holidayHome: Number(settings?.holidayHomeRate ?? HOME_VISIT_RATES.Holiday),
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
