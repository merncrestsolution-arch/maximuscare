import {
  computeAdmissionBillingBreakdown,
  splitReAdmissionPayments,
  type AdmissionBillingBreakdown,
} from "./inpatientBilling";

export type PreviousBillingLine = {
  sourceId: string;
  sourceLabel: string;
  episodeType: "readmit" | "transfer";
  admitDate: string;
  dischargeDate: string | null;
  branchName: string | null;
  grandTotal: number;
  amountPaid: number;
  deductionAmount: number;
  deductionReason: string | null;
  pendingBalance: number;
};

export type CurrentBillingPaymentLine = {
  id: string;
  paymentDate: string;
  createdAt: string | null;
  paymentMode: string;
  amount: number;
  notes?: string | null;
};

export type AdmissionBillingView = {
  previousBilling: {
    applicable: boolean;
    lines: PreviousBillingLine[];
    totalPending: number;
    totalDeduction: number;
  };
  currentBilling: {
    segmentStartDate: string;
    endDate: string;
    stayDays: number;
    roomCharges: number;
    caretakerCharges: number;
    careTakerDays: number;
    otherCharges: number;
    subtotal: number;
    deductionAmount: number;
    deductionType: "fixed" | "percentage" | null;
    deductionValue: number | null;
    deductionReason: string | null;
    chargesTotal: number;
    payments: CurrentBillingPaymentLine[];
    paymentsTotal: number;
  };
  totals: {
    totalBill: number;
    totalPaid: number;
    totalBalanceDue: number;
    priorBalancePaid: number;
    currentBalancePaid: number;
    priorBalanceRemaining: number;
    currentBalanceRemaining: number;
    overpaymentCredit: number;
  };
  /** Raw breakdown for discharge bill lines (current segment only, no carry-forward merge). */
  currentBreakdown: AdmissionBillingBreakdown;
};

export function buildAdmissionBillingView(input: {
  previousLines: PreviousBillingLine[];
  currentBreakdown: AdmissionBillingBreakdown;
  currentPayments: CurrentBillingPaymentLine[];
  paymentsTotalForAllocation: number;
}): AdmissionBillingView {
  const totalPreviousPending = input.previousLines.reduce((sum, line) => sum + line.pendingBalance, 0);
  const totalPreviousDeduction = input.previousLines.reduce((sum, line) => sum + line.deductionAmount, 0);
  const currentChargesTotal = input.currentBreakdown.currentGrandTotal;

  const paymentSplit = splitReAdmissionPayments(
    input.paymentsTotalForAllocation,
    currentChargesTotal,
    totalPreviousPending,
  );

  const totalBill = currentChargesTotal + totalPreviousPending;
  const totalBalanceDue =
    totalPreviousPending > 0
      ? paymentSplit.priorBalanceDue + paymentSplit.currentBalanceDue
      : totalBill - input.paymentsTotalForAllocation;

  return {
    previousBilling: {
      applicable: input.previousLines.length > 0 || totalPreviousPending !== 0,
      lines: input.previousLines,
      totalPending: totalPreviousPending,
      totalDeduction: totalPreviousDeduction,
    },
    currentBilling: {
      segmentStartDate: "",
      endDate: "",
      stayDays: input.currentBreakdown.stayDays,
      roomCharges: input.currentBreakdown.roomCharges,
      caretakerCharges: input.currentBreakdown.caretakerCharges,
      careTakerDays: input.currentBreakdown.careTakerDays,
      otherCharges: input.currentBreakdown.extraExpenseTotal,
      subtotal: input.currentBreakdown.currentSubtotal,
      deductionAmount: input.currentBreakdown.deductionAmount,
      deductionType: null,
      deductionValue: null,
      deductionReason: null,
      chargesTotal: currentChargesTotal,
      payments: input.currentPayments,
      paymentsTotal: input.paymentsTotalForAllocation,
    },
    totals: {
      totalBill,
      totalPaid: input.paymentsTotalForAllocation,
      totalBalanceDue,
      priorBalancePaid: paymentSplit.priorBalancePaid,
      currentBalancePaid: paymentSplit.currentEpisodePaid,
      priorBalanceRemaining: paymentSplit.priorBalanceDue,
      currentBalanceRemaining: paymentSplit.currentBalanceDue,
      overpaymentCredit: paymentSplit.overpaymentCredit,
    },
    currentBreakdown: input.currentBreakdown,
  };
}

/** Merge segment dates and deduction metadata into a billing view after build. */
export function finalizeAdmissionBillingView(
  view: AdmissionBillingView,
  meta: {
    segmentStartDate: string;
    endDate: string;
    deductionType: "fixed" | "percentage" | null;
    deductionValue: number | null;
    deductionReason: string | null;
  },
): AdmissionBillingView {
  return {
    ...view,
    currentBilling: {
      ...view.currentBilling,
      segmentStartDate: meta.segmentStartDate,
      endDate: meta.endDate,
      deductionType: meta.deductionType,
      deductionValue: meta.deductionValue,
      deductionReason: meta.deductionReason,
    },
  };
}

export { computeAdmissionBillingBreakdown };
