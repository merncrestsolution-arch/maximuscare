import type { InPatientPayment } from "@shared/schema";
import type { IStorage } from "../storage";
import { clinicDateString } from "../clinicTime";
import {
  buildAdmissionBillingView,
  finalizeAdmissionBillingView,
  type CurrentBillingPaymentLine,
  type PreviousBillingLine,
} from "@shared/admissionBillingView";
import {
  computeAdmissionBillingBreakdown,
  getPaymentsForCurrentStay,
  isCarriedForwardExpense,
  resolveSegmentDeductionFields,
  sumPaymentAmounts,
} from "@shared/inpatientBilling";
import { getPriorInPatientEpisodes } from "./inPatientAdmissionService";
import {
  filterExcludedPriorEpisodes,
  getExcludedPriorBillingSourceIds,
} from "./inPatientPriorBillingExclusions";

function toPaymentLine(payment: InPatientPayment): CurrentBillingPaymentLine {
  return {
    id: payment.id,
    paymentDate: String(payment.paymentDate),
    createdAt: payment.createdAt ? String(payment.createdAt) : null,
    paymentMode: payment.paymentMode,
    amount: parseFloat(String(payment.amount)) || 0,
    notes: payment.notes ?? null,
  };
}

function episodeToPreviousLine(
  episode: Awaited<ReturnType<typeof getPriorInPatientEpisodes>>[number],
): PreviousBillingLine {
  const breakdown = episode.breakdown;
  return {
    sourceId: episode.admissionId,
    sourceLabel:
      episode.episodeType === "transfer"
        ? `${episode.branchName ?? "Previous branch"} stay`
        : `Admission ${episode.admitDate}`,
    episodeType: episode.episodeType === "transfer" ? "transfer" : "readmit",
    admitDate: episode.admitDate,
    dischargeDate: episode.dischargeDate ?? null,
    branchName: episode.branchName ?? null,
    grandTotal: episode.grandTotal ?? 0,
    amountPaid: episode.amountPaid,
    deductionAmount: breakdown?.deductionAmount ?? 0,
    deductionReason: breakdown?.deductionReason ?? null,
    pendingBalance: episode.pendingBalance,
    appliedFromCurrentPayments: 0,
    remainingPending: episode.pendingBalance,
  };
}

/**
 * Canonical billing calculation for Billing Summary and Discharge Summary.
 *
 * Previous billing: live pending from ALL prior readmit admissions + ALL closed transfer segments.
 * Current billing: charges/payments scoped to the active stay segment only.
 * Payments on the current stay apply to total previous pending first, then current charges.
 */
export async function calculateAdmissionBilling(
  storage: IStorage,
  admissionId: string,
  options?: { asOfDate?: string },
) {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return null;

  const endDate = options?.asOfDate?.split("T")[0] || clinicDateString();
  const [payments, extraExpenses, transfers, priorEpisodesRaw, discharge, excludedSourceIds] =
    await Promise.all([
    storage.getInPatientPaymentsByAdmission(admissionId),
    storage.getInPatientExtraExpensesByAdmission(admissionId),
    storage.getPatientTransferLogsByAdmission(admissionId),
    getPriorInPatientEpisodes(storage, admissionId),
    storage.getInPatientDischargeByAdmission(admissionId),
    getExcludedPriorBillingSourceIds(storage, admissionId),
  ]);

  const priorEpisodes = filterExcludedPriorEpisodes(priorEpisodesRaw, excludedSourceIds);

  const transferLogsAsc = [...transfers].sort((left, right) =>
    String(left.transferDate).localeCompare(String(right.transferDate)),
  );
  const hasTransferHistory = transferLogsAsc.length > 0;
  const billingSegmentStartDate = hasTransferHistory
    ? String(transferLogsAsc[transferLogsAsc.length - 1].transferDate).split("T")[0]
    : admission.admitDate;

  const previousLines: PreviousBillingLine[] = priorEpisodes.map(episodeToPreviousLine);

  const currentSegmentExpenses = extraExpenses.filter((expense) => {
    if (isCarriedForwardExpense(expense)) return false;
    if (!hasTransferHistory) return true;
    const day = String(expense.expenseDate).split("T")[0];
    return day >= billingSegmentStartDate;
  });

  const admissionDeductionSource = {
    admitDate: admission.admitDate,
    deductionType: (admission as { deductionType?: "fixed" | "percentage" | null }).deductionType ?? null,
    deductionValue: (admission as { deductionValue?: string | null }).deductionValue ?? null,
    deductionReason: (admission as { deductionReason?: string | null }).deductionReason ?? null,
    deductionAppliedAt: (admission as { deductionAppliedAt?: Date | string | null }).deductionAppliedAt ?? null,
    currentDeductionType: (admission as { currentDeductionType?: "fixed" | "percentage" | null }).currentDeductionType,
    currentDeductionValue: (admission as { currentDeductionValue?: string | null }).currentDeductionValue,
    currentDeductionReason: (admission as { currentDeductionReason?: string | null }).currentDeductionReason,
  };
  const transferDates = transferLogsAsc.map((transfer) => ({ transferDate: String(transfer.transferDate) }));
  const currentSegmentDeduction = resolveSegmentDeductionFields(
    admissionDeductionSource,
    transferDates,
    "current",
  );

  const billingEndDate = discharge?.dischargeDate
    ? String(discharge.dischargeDate).split("T")[0]
    : endDate;

  const currentBreakdown = computeAdmissionBillingBreakdown({
    admitDate: billingSegmentStartDate,
    endDate: billingEndDate,
    amountPerDay: admission.amountPerDay,
    careTakerRatePerDay: admission.careTakerRatePerDay,
    careTakerDaysOverride: admission.careTakerDaysOverride,
    deductionType: currentSegmentDeduction.deductionType,
    deductionValue: currentSegmentDeduction.deductionValue,
    extraExpenses: currentSegmentExpenses,
  });

  const currentStayPayments = hasTransferHistory
    ? getPaymentsForCurrentStay(payments, transferLogsAsc)
    : payments;
  const paymentLines = currentStayPayments.map(toPaymentLine);
  const paymentsTotalForAllocation = sumPaymentAmounts(currentStayPayments);

  const view = buildAdmissionBillingView({
    previousLines,
    currentBreakdown,
    currentPayments: paymentLines,
    paymentsTotalForAllocation,
  });

  return finalizeAdmissionBillingView(view, {
    segmentStartDate: billingSegmentStartDate,
    endDate: billingEndDate,
    deductionType: currentSegmentDeduction.deductionType,
    deductionValue:
      currentSegmentDeduction.deductionValue > 0 ? currentSegmentDeduction.deductionValue : null,
    deductionReason: currentSegmentDeduction.deductionReason,
  });
}

export type { AdmissionBillingView } from "@shared/admissionBillingView";
