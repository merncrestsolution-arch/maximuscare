import type { IStorage } from "../storage";
import { logAudit } from "./auditService";
import type { PriorBillingExclusionSnapshot } from "./inPatientPriorBillingExclusions";

export type { PriorBillingExclusionSnapshot } from "./inPatientPriorBillingExclusions";

export async function excludePriorBillingEpisode(
  storage: IStorage,
  admissionId: string,
  sourceId: string,
  actor: { staffId: string; name: string; userId?: string },
): Promise<{ exclusion: Awaited<ReturnType<IStorage["createInPatientPriorBillingExclusion"]>> }> {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) throw new Error("Admission not found");

  const existing = await storage.getInPatientPriorBillingExclusion(admissionId, sourceId);
  if (existing) throw new Error("This previous billing record is already excluded");

  const { calculateAdmissionBilling } = await import("./inPatientBillingService");
  const billing = await calculateAdmissionBilling(storage, admissionId);
  const line = billing?.previousBilling.lines.find((entry) => entry.sourceId === sourceId);
  if (!line) throw new Error("Previous billing record not found");

  const snapshot: PriorBillingExclusionSnapshot = {
    sourceId: line.sourceId,
    episodeType: line.episodeType,
    admitDate: line.admitDate,
    dischargeDate: line.dischargeDate,
    branchName: line.branchName,
    grandTotal: line.grandTotal,
    amountPaid: line.amountPaid,
    pendingBalance: line.pendingBalance,
  };

  const exclusion = await storage.createInPatientPriorBillingExclusion({
    admissionId,
    sourceId,
    episodeType: line.episodeType,
    excludedByStaffId: actor.staffId,
    excludedByName: actor.name,
    snapshotJson: JSON.stringify(snapshot),
  });

  await logAudit(storage, {
    userId: actor.userId ?? actor.staffId,
    userName: actor.name,
    module: "inpatient",
    action: "prior_billing.exclude",
    recordId: admissionId,
    oldValue: snapshot,
    newValue: { exclusionId: exclusion.id, excludedAt: exclusion.excludedAt },
  });

  return { exclusion };
}
