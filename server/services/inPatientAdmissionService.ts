import type { InPatientAdmission } from "@shared/schema";
import type { IStorage } from "../storage";
import { clinicDateString } from "../clinicTime";
import { organizationForBranch } from "@shared/branchAccess";
import {
  collectReadmitChainPriorAdmissionIds,
  computeAdmissionBalanceDue,
  computeAdmissionBillingBreakdown,
  computeAdmissionGrandTotal,
  computeBranchStaySegmentBilling,
  getPaymentsForClosedTransferSegment,
  getSessionsForCurrentStay,
  getSessionsForPriorTransferStays,
  formatReadmitAdmissionSource,
  parseReadmitAdmissionSource,
  resolveDeductionSegmentIndex,
  resolveSegmentDeductionFields,
  sumPaymentAmounts,
  TRANSFER_BALANCE_MARKER,
  TRANSFER_CREDIT_MARKER,
} from "@shared/inpatientBilling";
import {
  filterExcludedPriorEpisodes,
  getExcludedPriorBillingSourceIds,
} from "./inPatientPriorBillingExclusions";

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

/** Legacy name matching is only safe when phone or NIC is present (avoids global name collisions). */
export function isResolvableLegacyAdmissionKey(entry: {
  patientId?: string | null;
  patientCode?: string | null;
  phone?: string | null;
  patientIdNo?: string | null;
}): boolean {
  if (entry.patientId || entry.patientCode) return true;
  return Boolean(String(entry.phone ?? "").trim() || String(entry.patientIdNo ?? "").trim());
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

/** Admissions for the same person as `admission` — scoped to branch; no cross-org bleed. */
export async function getRelatedInPatientAdmissions(
  storage: IStorage,
  admission: InPatientAdmission,
): Promise<InPatientAdmission[]> {
  const matches = new Map<string, InPatientAdmission>();
  matches.set(admission.id, admission);

  const branchId = admission.branchId ?? null;

  const addIfSameBranch = (entry: InPatientAdmission) => {
    if (!branchId || entry.branchId === branchId) {
      matches.set(entry.id, entry);
    }
  };

  if (admission.patientId) {
    const forPatient = await storage.getInPatientAdmissionsForPatient(admission.patientId, branchId);
    for (const entry of forPatient) addIfSameBranch(entry);
  }

  if (admission.patientCode && branchId) {
    const branchAdmissions = await storage.getAllInPatientAdmissions(branchId);
    for (const entry of branchAdmissions) {
      if (entry.patientCode && entry.patientCode === admission.patientCode) {
        addIfSameBranch(entry);
      }
    }
  }

  if (
    !admission.patientId &&
    !admission.patientCode &&
    isResolvableLegacyAdmissionKey(admission) &&
    branchId
  ) {
    const branchAdmissions = await storage.getAllInPatientAdmissions(branchId);
    const key = resolveInPatientAdmissionKey(admission);
    for (const entry of branchAdmissions) {
      if (
        !entry.patientId &&
        !entry.patientCode &&
        isResolvableLegacyAdmissionKey(entry) &&
        resolveInPatientAdmissionKey(entry) === key
      ) {
        matches.set(entry.id, entry);
      }
    }
  }

  const readmitFromId = parseReadmitAdmissionSource((admission as any).admissionSource);
  if (readmitFromId) {
    const prior = await storage.getInPatientAdmission(readmitFromId);
    if (prior) matches.set(prior.id, prior);
  }

  if (branchId) {
    const branchAdmissions = await storage.getAllInPatientAdmissions(branchId);
    for (const entry of branchAdmissions) {
      const fromId = parseReadmitAdmissionSource((entry as any).admissionSource);
      if (fromId === admission.id) {
        matches.set(entry.id, entry);
      }
    }
  }

  return Array.from(matches.values());
}

/** Explicit patientId links within the same org (Maximus vs Nexus) — safe for transfer history. */
export async function getOrgScopedPatientAdmissions(
  storage: IStorage,
  admission: InPatientAdmission,
): Promise<InPatientAdmission[]> {
  if (!admission.patientId) return [];
  const patient = await storage.getPatient(admission.patientId);
  if (!patient) return [];
  const org = organizationForBranch(patient.branch);
  const branches = await storage.getAllBranches();
  const orgBranchIds = new Set(
    branches
      .filter((b) => organizationForBranch(b.branchName ?? b.name) === org)
      .map((b) => b.id),
  );
  const linked = await storage.getInPatientAdmissionsForPatient(admission.patientId);
  return linked.filter((a) => a.branchId && orgBranchIds.has(a.branchId));
}

/**
 * Prior admission IDs whose sessions belong in "Previous" history after re-admit or transfer.
 * Uses readmit chain + legacy transferred rows + org-scoped discharged episodes for linked patients.
 */
export function collectPriorAdmissionIdsForSessionHistory(
  admission: InPatientAdmission,
  related: InPatientAdmission[],
  orgLinked: InPatientAdmission[] = [],
  allPatientLinked: InPatientAdmission[] = [],
): Set<string> {
  const byId = new Map<string, InPatientAdmission>();
  for (const entry of [...related, ...orgLinked, ...allPatientLinked]) {
    byId.set(entry.id, entry);
  }

  const ids = new Set<string>();
  for (const id of collectReadmitChainPriorAdmissionIds(admission, byId)) {
    ids.add(id);
  }

  const directPrior = parseReadmitAdmissionSource(admission.admissionSource);
  if (directPrior) ids.add(directPrior);

  if (admission.patientId) {
    for (const entry of allPatientLinked) {
      if (entry.id === admission.id) continue;
      if (entry.patientId !== admission.patientId) continue;
      if (normalizeAdmissionListStatus(entry.status) === "transferred") {
        ids.add(entry.id);
      }
    }
  }

  if (directPrior && admission.patientId) {
    for (const entry of orgLinked) {
      if (entry.id === admission.id) continue;
      if (entry.patientId !== admission.patientId) continue;
      const st = normalizeAdmissionListStatus(entry.status);
      if (st === "discharged" || st === "transferred") {
        ids.add(entry.id);
      }
    }
  }

  return ids;
}

async function loadSessionsForPriorAdmissions(
  storage: IStorage,
  priorAdmissions: InPatientAdmission[],
) {
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

async function loadTransferPriorSessionsOnSameAdmission(
  storage: IStorage,
  admission: InPatientAdmission,
  transfersAsc: Array<{ id: string; transferDate: string; createdAt?: Date | string | null }>,
) {
  if (transfersAsc.length === 0) return [];

  const allSessions = await storage.getInPatientSessionsByAdmission(admission.id);
  const priorSessions = getSessionsForPriorTransferStays(allSessions, transfersAsc);
  const priorSegments = buildTransferStaySegments(admission.admitDate, transfersAsc);

  return priorSessions.map((session) => {
    const day = String(session.sessionDate).split("T")[0];
    const segment =
      priorSegments.find((entry) => day >= entry.startDate && day <= entry.endDate) ??
      priorSegments[priorSegments.length - 1];

    return {
      ...session,
      admissionAdmitDate: segment?.startDate ?? admission.admitDate,
      admissionStatus: "Transferred",
      priorAdmissionId: `transfer:${segment?.transferLogId ?? transfersAsc[transfersAsc.length - 1].id}`,
    };
  });
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
  episodeType?: "readmit" | "transfer";
  branchId?: string | null;
  branchName?: string | null;
  breakdown: {
    stayDays: number;
    roomCharges: number;
    careTakerDays: number;
    caretakerCharges: number;
    extraExpenseTotal: number;
    subtotal: number;
    deductionAmount: number;
    deductionType: string | null;
    deductionValue: number | null;
    deductionReason: string | null;
    amountPerDay: number;
    careTakerRatePerDay: number;
  } | null;
}

type TransferStaySegment = {
  startDate: string;
  endDate: string;
  branchId: string | null;
  transferLogId: string;
};

function buildTransferStaySegments(
  admitDate: string,
  transfers: Array<{ id: string; transferDate: string; fromBranchId?: string | null }>,
): TransferStaySegment[] {
  const segments: TransferStaySegment[] = [];
  let startDate = admitDate;
  for (const transfer of transfers) {
    segments.push({
      startDate,
      endDate: transfer.transferDate,
      branchId: transfer.fromBranchId ?? null,
      transferLogId: transfer.id,
    });
    startDate = transfer.transferDate;
  }
  return segments;
}

function resolveBranchLabel(
  branchId: string | null | undefined,
  branchNameById: Map<string, string>,
): string | null {
  if (!branchId) return null;
  return branchNameById.get(branchId) ?? null;
}

function admissionTransferDeductionContext(admission: InPatientAdmission, transfers: Array<{ transferDate: string }>) {
  const deductionType = (admission as { deductionType?: "fixed" | "percentage" | null }).deductionType ?? null;
  const deductionValue =
    parseFloat(String((admission as { deductionValue?: string | null }).deductionValue ?? 0)) || 0;
  const deductionReason = (admission as { deductionReason?: string | null }).deductionReason ?? null;
  const deductionAppliedAt = (admission as { deductionAppliedAt?: Date | string | null }).deductionAppliedAt ?? null;
  const ownerSegment = resolveDeductionSegmentIndex(deductionAppliedAt, admission.admitDate, transfers);
  const admissionDeductionSource = {
    admitDate: admission.admitDate,
    deductionType,
    deductionValue,
    deductionReason,
    deductionAppliedAt,
    currentDeductionType: (admission as { currentDeductionType?: "fixed" | "percentage" | null }).currentDeductionType,
    currentDeductionValue: (admission as { currentDeductionValue?: string | null }).currentDeductionValue,
    currentDeductionReason: (admission as { currentDeductionReason?: string | null }).currentDeductionReason,
  };

  const segmentDeduction = (targetSegment: number | "current") => {
    const fields = resolveSegmentDeductionFields(admissionDeductionSource, transfers, targetSegment);
    return {
      deductionType: fields.deductionType,
      deductionValue: fields.deductionValue,
    };
  };

  return { deductionType, deductionValue, deductionReason, ownerSegment, segmentDeduction };
}

/** Prior branch-stay bills from transfer logs on the same admission (Option B transfers). */
export async function getTransferPriorBillingEpisodes(
  storage: IStorage,
  admissionId: string,
): Promise<PriorInPatientEpisode[]> {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return [];

  const transfers = await storage.getPatientTransferLogsByAdmission(admissionId);
  if (transfers.length === 0) return [];

  const transfersAsc = [...transfers].sort((left, right) =>
    String(left.transferDate).localeCompare(String(right.transferDate)),
  );

  const [payments, extraExpenses, sessions, branches, discharge] = await Promise.all([
    storage.getInPatientPaymentsByAdmission(admissionId),
    storage.getInPatientExtraExpensesByAdmission(admissionId),
    storage.getInPatientSessionsByAdmission(admissionId),
    storage.getAllBranches(),
    storage.getInPatientDischargeByAdmission(admissionId),
  ]);
  const branchNameById = new Map(
    branches.map((branch) => [branch.id, branch.branchName ?? branch.name ?? "Unknown"]),
  );

  const priorSegments = buildTransferStaySegments(admission.admitDate, transfersAsc);
  const { deductionType, deductionValue, deductionReason, segmentDeduction } =
    admissionTransferDeductionContext(admission, transfersAsc);

  const segmentBillingInput = (segment: TransferStaySegment, targetSegment: number | "current") => {
    const deduction = segmentDeduction(targetSegment);
    return {
      admitDate: segment.startDate,
      endDate: segment.endDate,
      amountPerDay: admission.amountPerDay,
      careTakerRatePerDay: admission.careTakerRatePerDay,
      careTakerDaysOverride: admission.careTakerDaysOverride,
      extraExpenses,
      ...deduction,
    };
  };

  const episodes: PriorInPatientEpisode[] = [];
  for (let index = 0; index < priorSegments.length; index += 1) {
    const segment = priorSegments[index];
    const breakdown = computeBranchStaySegmentBilling(segmentBillingInput(segment, index));
    const segmentPayments = getPaymentsForClosedTransferSegment(payments, transfersAsc, index);
    const segmentAmountPaid = sumPaymentAmounts(segmentPayments);
    const sessionCount = sessions.filter((session) => {
      const day = String(session.sessionDate).split("T")[0];
      return day >= segment.startDate && day <= segment.endDate;
    }).length;
    const segmentDeductionFields = segmentDeduction(index);
    const segmentReason = resolveSegmentDeductionFields(
      {
        admitDate: admission.admitDate,
        deductionType,
        deductionValue,
        deductionReason,
        deductionAppliedAt: (admission as { deductionAppliedAt?: Date | string | null }).deductionAppliedAt ?? null,
        currentDeductionType: (admission as { currentDeductionType?: "fixed" | "percentage" | null }).currentDeductionType,
        currentDeductionValue: (admission as { currentDeductionValue?: string | null }).currentDeductionValue,
        currentDeductionReason: (admission as { currentDeductionReason?: string | null }).currentDeductionReason,
      },
      transfersAsc,
      index,
    ).deductionReason;

    episodes.push({
      admissionId: `transfer:${segment.transferLogId}`,
      admitDate: segment.startDate,
      status: "Transferred",
      dischargeDate: segment.endDate,
      grandTotal: breakdown.grandTotal,
      amountPaid: segmentAmountPaid,
      pendingBalance: breakdown.grandTotal - segmentAmountPaid,
      sessionCount,
      episodeType: "transfer",
      branchId: segment.branchId,
      branchName: resolveBranchLabel(segment.branchId, branchNameById),
      breakdown: {
        stayDays: breakdown.stayDays,
        roomCharges: breakdown.roomCharges,
        careTakerDays: breakdown.careTakerDays,
        caretakerCharges: breakdown.caretakerCharges,
        extraExpenseTotal: breakdown.extraExpenseTotal,
        subtotal: breakdown.subtotal,
        deductionAmount: breakdown.deductionAmount,
        deductionType: segmentDeductionFields.deductionType,
        deductionValue: segmentDeductionFields.deductionValue > 0 ? segmentDeductionFields.deductionValue : null,
        deductionReason: breakdown.deductionAmount > 0 ? segmentReason : null,
        amountPerDay: parseFloat(String(admission.amountPerDay)) || 0,
        careTakerRatePerDay: parseFloat(String(admission.careTakerRatePerDay ?? 0)) || 0,
      },
    });
  }

  return episodes.sort((left, right) => right.admitDate.localeCompare(left.admitDate));
}

/** Pending balance for the branch stay that ends on `transferDate` (used when transferring). */
export async function computeTransferSegmentPendingBalance(
  storage: IStorage,
  admission: InPatientAdmission,
  transferDate: string,
  transfersIncludingCurrent: Array<{ id: string; transferDate: string; fromBranchId?: string | null }>,
): Promise<number> {
  const [payments, extraExpenses] = await Promise.all([
    storage.getInPatientPaymentsByAdmission(admission.id),
    storage.getInPatientExtraExpensesByAdmission(admission.id),
  ]);
  const transfersAsc = [...transfersIncludingCurrent].sort((left, right) =>
    String(left.transferDate).localeCompare(String(right.transferDate)),
  );
  const priorSegments = buildTransferStaySegments(admission.admitDate, transfersAsc);
  const closedSegment = priorSegments[priorSegments.length - 1];
  if (!closedSegment || closedSegment.endDate !== transferDate) {
    return 0;
  }

  const closedIndex = priorSegments.length - 1;
  const { segmentDeduction } = admissionTransferDeductionContext(admission, transfersAsc);
  const breakdown = computeBranchStaySegmentBilling({
    admitDate: closedSegment.startDate,
    endDate: closedSegment.endDate,
    amountPerDay: admission.amountPerDay,
    careTakerRatePerDay: admission.careTakerRatePerDay,
    careTakerDaysOverride: admission.careTakerDaysOverride,
    extraExpenses,
    ...segmentDeduction(closedIndex),
  });
  const segmentPayments = getPaymentsForClosedTransferSegment(payments, transfersAsc, closedIndex);
  return breakdown.grandTotal - sumPaymentAmounts(segmentPayments);
}

export function formatTransferBalanceDescription(transferDate: string, fromBranchName: string): string {
  return `${TRANSFER_BALANCE_MARKER} (transferred ${transferDate} from ${fromBranchName})`;
}

export function formatTransferCreditDescription(transferDate: string, fromBranchName: string): string {
  return `${TRANSFER_CREDIT_MARKER} (transferred ${transferDate} from ${fromBranchName})`;
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
    const billingInput = discharge
      ? {
          admitDate: prior.admitDate,
          endDate: discharge.dischargeDate,
          amountPerDay: prior.amountPerDay,
          careTakerRatePerDay: prior.careTakerRatePerDay,
          careTakerDaysOverride: prior.careTakerDaysOverride,
          deductionType: (prior as { deductionType?: "fixed" | "percentage" | null }).deductionType,
          deductionValue: (prior as { deductionValue?: string | null }).deductionValue,
          extraExpenses,
        }
      : null;
    const breakdown = billingInput ? computeAdmissionBillingBreakdown(billingInput) : null;
    const grandTotal = breakdown?.grandTotal ?? null;
    episodes.push({
      admissionId: prior.id,
      admitDate: prior.admitDate,
      status: prior.status,
      dischargeDate: discharge?.dischargeDate ?? null,
      grandTotal,
      amountPaid,
      pendingBalance: grandTotal !== null ? computeAdmissionBalanceDue(grandTotal, amountPaid) : 0,
      sessionCount: sessions.length,
      breakdown: breakdown
        ? {
            stayDays: breakdown.stayDays,
            roomCharges: breakdown.roomCharges,
            careTakerDays: breakdown.careTakerDays,
            caretakerCharges: breakdown.caretakerCharges,
            extraExpenseTotal: breakdown.extraExpenseTotal,
            subtotal: breakdown.subtotal,
            deductionAmount: breakdown.deductionAmount,
            deductionType: (prior as { deductionType?: string | null }).deductionType ?? null,
            deductionValue: parseFloat(String((prior as { deductionValue?: string | null }).deductionValue ?? 0)) || null,
            deductionReason: (prior as { deductionReason?: string | null }).deductionReason ?? null,
            amountPerDay: parseFloat(String(prior.amountPerDay)) || 0,
            careTakerRatePerDay: parseFloat(String(prior.careTakerRatePerDay ?? 0)) || 0,
          }
        : null,
    });
  }

  const transferEpisodes = await getTransferPriorBillingEpisodes(storage, admissionId);
  const excludedSourceIds = await getExcludedPriorBillingSourceIds(storage, admissionId);
  return filterExcludedPriorEpisodes([...transferEpisodes, ...episodes], excludedSourceIds);
}

/**
 * Bug 4 — transfer investigation (2026-07):
 * The legacy transfer handler CREATED a new InPatient admission and set the old row to
 * status "Transferred", leaving sessions on the old admissionId. Going forward, transfer
 * updates the SAME admission's branchId (Option B). This helper merges sessions from
 * legacy transferred source rows so the current admission view shows the full history.
 */
export async function getInPatientSessionsForAdmissionView(
  storage: IStorage,
  admissionId: string,
) {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return [];

  const primary = await storage.getInPatientSessionsByAdmission(admissionId);
  const related = await getRelatedInPatientAdmissions(storage, admission);
  const orgLinked = await getOrgScopedPatientAdmissions(storage, admission);
  const allPatientLinked = admission.patientId
    ? await storage.getInPatientAdmissionsForPatient(admission.patientId)
    : [];
  const priorIds = collectPriorAdmissionIdsForSessionHistory(
    admission,
    related,
    orgLinked,
    allPatientLinked,
  );
  const legacyTransferred = [...related, ...orgLinked, ...allPatientLinked].filter(
    (entry) =>
      entry.id !== admissionId &&
      priorIds.has(entry.id) &&
      normalizeAdmissionListStatus(entry.status) === "transferred",
  );

  const merged = [...primary];
  const seen = new Set(primary.map((session) => session.id));
  for (const prior of legacyTransferred) {
    const rows = await storage.getInPatientSessionsByAdmission(prior.id);
    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }
  }

  const transfers = await storage.getPatientTransferLogsByAdmission(admissionId);
  const transfersAsc = [...transfers].sort((left, right) =>
    String(left.transferDate).localeCompare(String(right.transferDate)),
  );
  const currentSessions = getSessionsForCurrentStay(merged, transfersAsc);

  return currentSessions.sort((left, right) => {
    const dateCmp = right.sessionDate.localeCompare(left.sessionDate);
    if (dateCmp !== 0) return dateCmp;
    return left.sessionNumber - right.sessionNumber;
  });
}

/** Sessions from prior admission episodes (re-admit chain, transfers, linked patient history). */
export async function getPreviousInPatientSessions(storage: IStorage, admissionId: string) {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return [];

  const related = await getRelatedInPatientAdmissions(storage, admission);
  const orgLinked = await getOrgScopedPatientAdmissions(storage, admission);
  const allPatientLinked = admission.patientId
    ? await storage.getInPatientAdmissionsForPatient(admission.patientId)
    : [];
  const priorIds = collectPriorAdmissionIdsForSessionHistory(
    admission,
    related,
    orgLinked,
    allPatientLinked,
  );
  const byId = new Map([...related, ...orgLinked, ...allPatientLinked].map((entry) => [entry.id, entry]));

  const priorAdmissions = [...priorIds]
    .map((id) => byId.get(id))
    .filter((entry): entry is InPatientAdmission => Boolean(entry))
    .sort(compareAdmissionRecency);

  const legacyPrior = await loadSessionsForPriorAdmissions(storage, priorAdmissions);
  const transfers = await storage.getPatientTransferLogsByAdmission(admissionId);
  const transfersAsc = [...transfers].sort((left, right) =>
    String(left.transferDate).localeCompare(String(right.transferDate)),
  );
  const transferPrior = await loadTransferPriorSessionsOnSameAdmission(storage, admission, transfersAsc);

  return [...legacyPrior, ...transferPrior].sort((left, right) => {
    const dateCmp = right.sessionDate.localeCompare(left.sessionDate);
    if (dateCmp !== 0) return dateCmp;
    return left.sessionNumber - right.sessionNumber;
  });
}

/** Resolve display branch for each session (session branchId, else parent admission branch). */
export async function enrichInPatientSessionsWithBranchName<
  T extends { admissionId: string; branchId?: string | null },
>(storage: IStorage, sessions: T[]): Promise<Array<T & { branchName: string }>> {
  if (sessions.length === 0) return [];

  const branches = await storage.getAllBranches();
  const branchNameById = new Map(
    branches.map((branch) => [branch.id, branch.branchName ?? branch.name ?? "Unknown"]),
  );

  const admissionIds = [...new Set(sessions.map((session) => session.admissionId))];
  const admissionBranchById = new Map<string, string | null>();
  await Promise.all(
    admissionIds.map(async (admissionId) => {
      const admission = await storage.getInPatientAdmission(admissionId);
      admissionBranchById.set(admissionId, admission?.branchId ?? null);
    }),
  );

  return sessions.map((session) => {
    const branchId = session.branchId ?? admissionBranchById.get(session.admissionId) ?? null;
    const branchName = branchId ? (branchNameById.get(branchId) ?? "Unknown") : "Unknown";
    return { ...session, branchName };
  });
}
