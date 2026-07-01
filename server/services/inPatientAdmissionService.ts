import type { InPatientAdmission } from "@shared/schema";
import type { IStorage } from "../storage";
import {
  collectReadmitChainPriorAdmissionIds,
  computeAdmissionBalanceDue,
  computeAdmissionGrandTotal,
  formatReadmitAdmissionSource,
  parseReadmitAdmissionSource,
} from "@shared/inpatientBilling";

export {
  formatReadmitAdmissionSource,
  parseReadmitAdmissionSource,
} from "@shared/inpatientBilling";

/** @deprecated import READMIT_SOURCE_PREFIX from @shared/inpatientBilling */
export { READMIT_SOURCE_PREFIX } from "@shared/inpatientBilling";

/** Outstanding balance from a discharged admission (grand total minus all payments). */
export function priorAdmissionBalanceFromDischarge(
  grandTotal: number | string | null | undefined,
  paymentTotal: number,
): number {
  const grand = parseFloat(String(grandTotal ?? 0)) || 0;
  return computeAdmissionBalanceDue(grand, paymentTotal);
}

/** Live outstanding balance on a discharged admission (matches billing summary, not stale discharge snapshot). */
export async function computePriorAdmissionBalance(
  storage: IStorage,
  admissionId: string,
): Promise<number> {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return 0;

  const discharge = await storage.getInPatientDischargeByAdmission(admissionId);
  if (!discharge) return 0;

  const [paymentTotal, extraExpenses] = await Promise.all([
    storage.getPaymentTotalByAdmission(admissionId),
    storage.getInPatientExtraExpensesByAdmission(admissionId),
  ]);

  const grandTotal = computeAdmissionGrandTotal({
    admitDate: admission.admitDate,
    endDate: discharge.dischargeDate,
    amountPerDay: admission.amountPerDay,
    careTakerRatePerDay: admission.careTakerRatePerDay,
    careTakerDaysOverride: admission.careTakerDaysOverride,
    deductionType: (admission as { deductionType?: "fixed" | "percentage" | null }).deductionType,
    deductionValue: (admission as { deductionValue?: string | null }).deductionValue,
    extraExpenses,
  });

  return computeAdmissionBalanceDue(grandTotal, paymentTotal);
}

export function resolveInPatientAdmissionKey(entry: {
  patientId?: string | null;
  patientCode?: string | null;
  patientName?: string;
  phone?: string;
  patientIdNo?: string | null;
}): string {
  if (entry.patientId) return `patient:${entry.patientId}`;
  if (entry.patientCode) return `code:${entry.patientCode}`;
  const name = String(entry.patientName || "").trim().toLowerCase();
  const phone = String(entry.phone || "").trim();
  const idNo = String(entry.patientIdNo || "").trim();
  return `legacy:${name}|${phone}|${idNo}`;
}

/**
 * Returns negative when `left` is MORE RECENT than `right` (should win as current episode).
 * Uses createdAt first so a re-admission with a backdated admitDate still becomes current.
 */
export function compareAdmissionRecency(left: InPatientAdmission, right: InPatientAdmission): number {
  const leftCreated = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
  const rightCreated = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
  if (leftCreated !== rightCreated) return rightCreated - leftCreated;

  const leftAdmit = left?.admitDate ? new Date(left.admitDate).getTime() : 0;
  const rightAdmit = right?.admitDate ? new Date(right.admitDate).getTime() : 0;
  if (leftAdmit !== rightAdmit) return rightAdmit - leftAdmit;

  return String(right?.id || "").localeCompare(String(left?.id || ""));
}

/** One row per person — the most recently created admission episode. */
export function pickLatestAdmissionsPerPatient(admissions: InPatientAdmission[]): InPatientAdmission[] {
  const latestByKey = new Map<string, InPatientAdmission>();
  for (const entry of admissions) {
    const key = resolveInPatientAdmissionKey(entry);
    const current = latestByKey.get(key);
    if (!current || compareAdmissionRecency(entry, current) < 0) {
      latestByKey.set(key, entry);
    }
  }
  return Array.from(latestByKey.values()).sort(compareAdmissionRecency);
}

export function normalizeAdmissionListStatus(status: string | undefined): string {
  return String(status || "").trim().toLowerCase();
}

/** Filter list views by the CURRENT (latest) admission status per patient. */
export function filterInPatientsByListStatus(
  allAdmissions: InPatientAdmission[],
  statusQuery: string | undefined
): InPatientAdmission[] {
  if (!statusQuery?.trim()) return allAdmissions;

  const tokens = statusQuery
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const normalized = tokens.map((value) => value.toLowerCase());

  if (normalized.includes("all")) return allAdmissions;

  const latestAdmissions = pickLatestAdmissionsPerPatient(allAdmissions);

  if (normalized.includes("active")) {
    return latestAdmissions.filter((entry) => {
      const current = normalizeAdmissionListStatus(entry.status);
      return current === "admitted" || current === "active";
    });
  }

  const allowed = new Set(normalized);
  return latestAdmissions.filter((entry) => allowed.has(normalizeAdmissionListStatus(entry.status)));
}

export function isCurrentlyAdmitted(admission: InPatientAdmission): boolean {
  const st = normalizeAdmissionListStatus(admission.status);
  return st === "admitted" || st === "active";
}

/** All admissions for the same person as `admission` (linked patient or legacy match). */
export async function getRelatedInPatientAdmissions(
  storage: IStorage,
  admission: InPatientAdmission,
): Promise<InPatientAdmission[]> {
  const matches = new Map<string, InPatientAdmission>();
  const add = (entries: InPatientAdmission[]) => {
    for (const entry of entries) matches.set(entry.id, entry);
  };

  if (admission.patientId) {
    add(await storage.getInPatientAdmissionsForPatient(admission.patientId));
  }

  const all = await storage.getAllInPatientAdmissions();

  if (admission.patientCode) {
    for (const entry of all) {
      if (entry.patientCode && entry.patientCode === admission.patientCode) {
        matches.set(entry.id, entry);
      }
    }
  }

  const key = resolveInPatientAdmissionKey(admission);
  for (const entry of all) {
    if (resolveInPatientAdmissionKey(entry) === key) {
      matches.set(entry.id, entry);
    }
  }

  const readmitFromId = parseReadmitAdmissionSource((admission as any).admissionSource);
  if (readmitFromId) {
    const prior = await storage.getInPatientAdmission(readmitFromId);
    if (prior) matches.set(prior.id, prior);
  }

  for (const entry of all) {
    const fromId = parseReadmitAdmissionSource((entry as any).admissionSource);
    if (fromId === admission.id) {
      matches.set(entry.id, entry);
    }
  }

  return Array.from(matches.values());
}

export interface PriorInPatientEpisode {
  admissionId: string;
  admitDate: string;
  status: string;
  dischargeDate: string | null;
  grandTotal: number | null;
  amountPaid: number;
  pendingBalance: number;
  sessionCount: number;
}

/** Prior admission episodes with billing + session counts (read-only; readmit chain only). */
export async function getPriorInPatientEpisodes(
  storage: IStorage,
  admissionId: string,
): Promise<PriorInPatientEpisode[]> {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return [];

  const related = await getRelatedInPatientAdmissions(storage, admission);
  const relatedById = new Map(related.map((entry) => [entry.id, entry]));
  const readmitChainIds = new Set(collectReadmitChainPriorAdmissionIds(admission, relatedById));
  const priorAdmissions = related
    .filter((entry) => entry.id !== admissionId && readmitChainIds.has(entry.id))
    .sort(compareAdmissionRecency);

  const episodes: PriorInPatientEpisode[] = [];
  for (const prior of priorAdmissions) {
    const discharge = await storage.getInPatientDischargeByAdmission(prior.id);
    const [amountPaid, extraExpenses] = await Promise.all([
      storage.getPaymentTotalByAdmission(prior.id),
      storage.getInPatientExtraExpensesByAdmission(prior.id),
    ]);
    const sessions = await storage.getInPatientSessionsByAdmission(prior.id);
    const grandTotal = discharge
      ? computeAdmissionGrandTotal({
          admitDate: prior.admitDate,
          endDate: discharge.dischargeDate,
          amountPerDay: prior.amountPerDay,
          careTakerRatePerDay: prior.careTakerRatePerDay,
          careTakerDaysOverride: prior.careTakerDaysOverride,
          deductionType: (prior as { deductionType?: "fixed" | "percentage" | null }).deductionType,
          deductionValue: (prior as { deductionValue?: string | null }).deductionValue,
          extraExpenses,
        })
      : null;
    episodes.push({
      admissionId: prior.id,
      admitDate: prior.admitDate,
      status: prior.status,
      dischargeDate: discharge?.dischargeDate ?? null,
      grandTotal,
      amountPaid,
      pendingBalance: grandTotal !== null ? computeAdmissionBalanceDue(grandTotal, amountPaid) : 0,
      sessionCount: sessions.length,
    });
  }

  return episodes;
}

/** Sessions from prior admission episodes for the same person (read-only history). */
export async function getPreviousInPatientSessions(storage: IStorage, admissionId: string) {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return [];

  const related = await getRelatedInPatientAdmissions(storage, admission);
  const priorAdmissions = related
    .filter((entry) => entry.id !== admissionId)
    .sort(compareAdmissionRecency);

  const results: Array<
    Awaited<ReturnType<IStorage["getInPatientSessionsByAdmission"]>>[number] & {
      admissionAdmitDate: string;
      admissionStatus: string;
      priorAdmissionId: string;
    }
  > = [];

  for (const prior of priorAdmissions) {
    const sessions = await storage.getInPatientSessionsByAdmission(prior.id);
    for (const session of sessions) {
      results.push({
        ...session,
        admissionAdmitDate: prior.admitDate,
        admissionStatus: prior.status,
        priorAdmissionId: prior.id,
      });
    }
  }

  return results.sort((left, right) => {
    const dateCmp = right.sessionDate.localeCompare(left.sessionDate);
    if (dateCmp !== 0) return dateCmp;
    return left.sessionNumber - right.sessionNumber;
  });
}
