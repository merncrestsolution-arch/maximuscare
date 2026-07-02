export const CLINIC_TIMEZONE = "Asia/Colombo";

export const CARRIED_FORWARD_EXPENSE_MARKER = "previous admission balance carried forward";
export const CARRIED_FORWARD_CREDIT_MARKER = "previous admission credit carried forward";
export const TRANSFER_BALANCE_MARKER = "previous branch balance carried forward";
export const TRANSFER_CREDIT_MARKER = "previous branch credit carried forward";

/** Net balance: positive = owed, zero = settled, negative = credit/advance. */
export function computeBalanceDue(totalBilled: number | string, totalPaid: number | string): number {
  return (parseFloat(String(totalBilled)) || 0) - (parseFloat(String(totalPaid)) || 0);
}

/** Amount still owed (zero when patient has credit). Use for KPI/report totals only. */
export function computeOutstandingAmount(totalBilled: number | string, totalPaid: number | string): number {
  return Math.max(0, computeBalanceDue(totalBilled, totalPaid));
}

function clinicDateOnly(dateInput: string | Date): string {
  const raw = typeof dateInput === "string" ? dateInput.trim() : "";
  const d =
    typeof dateInput === "string"
      ? new Date(raw.includes("T") ? raw : `${raw.split("T")[0]}T12:00:00+05:30`)
      : dateInput;
  return d.toLocaleDateString("en-CA", { timeZone: CLINIC_TIMEZONE });
}

/** Prefix stored in `admissionSource` when an admission was created via re-admit. */
export const READMIT_SOURCE_PREFIX = "readmit:";

export function formatReadmitAdmissionSource(priorAdmissionId: string): string {
  return `${READMIT_SOURCE_PREFIX}${priorAdmissionId}`;
}

export function parseReadmitAdmissionSource(admissionSource?: string | null): string | null {
  if (!admissionSource?.startsWith(READMIT_SOURCE_PREFIX)) return null;
  const id = admissionSource.slice(READMIT_SOURCE_PREFIX.length).trim();
  return id || null;
}

export function isTransferCarriedForwardExpense(expense: { description?: string | null }): boolean {
  return String(expense.description || "").toLowerCase().includes(TRANSFER_BALANCE_MARKER);
}

export function isTransferCarriedForwardCredit(expense: { description?: string | null }): boolean {
  return String(expense.description || "").toLowerCase().includes(TRANSFER_CREDIT_MARKER);
}

export function isCarriedForwardExpense(expense: { description?: string | null }): boolean {
  const desc = String(expense.description || "").toLowerCase();
  return (
    desc.includes(CARRIED_FORWARD_EXPENSE_MARKER) ||
    desc.includes(CARRIED_FORWARD_CREDIT_MARKER) ||
    desc.includes(TRANSFER_BALANCE_MARKER) ||
    desc.includes(TRANSFER_CREDIT_MARKER)
  );
}

/** Replace stored transfer carry-forward rows with the live pending from prior branch billing. */
export function applyLiveTransferCarriedForward<
  T extends { description?: string | null; amount: string | number; expenseDate?: string },
>(input: {
  expenses: T[];
  transferLogs: Array<{ transferDate: string; fromBranchName?: string | null }>;
  priorTransferPendingBalance: number | null | undefined;
}): T[] {
  const withoutStoredTransfer = input.expenses.filter(
    (expense) => !isTransferCarriedForwardExpense(expense) && !isTransferCarriedForwardCredit(expense),
  );
  const pending = input.priorTransferPendingBalance ?? 0;
  if (!input.transferLogs.length || pending === 0) {
    return withoutStoredTransfer;
  }

  const lastTransfer = input.transferLogs[input.transferLogs.length - 1];
  const transferDate = String(lastTransfer.transferDate).split("T")[0];
  const fromBranch = lastTransfer.fromBranchName ?? "previous branch";
  const marker = pending > 0 ? TRANSFER_BALANCE_MARKER : TRANSFER_CREDIT_MARKER;

  return [
    ...withoutStoredTransfer,
    {
      description: `${marker} (transferred ${transferDate} from ${fromBranch})`,
      amount: String(pending),
      expenseDate: transferDate,
    } as T,
  ];
}

export function isCarriedForwardCredit(expense: { description?: string | null }): boolean {
  return String(expense.description || "").toLowerCase().includes(CARRIED_FORWARD_CREDIT_MARKER);
}

export function sumCarriedForwardAmounts(
  expenses: Array<{ description?: string | null; amount: string | number }> | undefined,
): number {
  return (expenses || [])
    .filter(isCarriedForwardExpense)
    .reduce((sum, expense) => sum + (parseFloat(String(expense.amount)) || 0), 0);
}

/** Allocate payments oldest-segment-first across stay segments (transfer / multi-episode). */
export function allocatePaymentsAcrossSegments(
  segmentGrandTotals: number[],
  paymentTotal: number,
): Array<{ amountPaid: number; pendingBalance: number }> {
  let remaining = paymentTotal;
  return segmentGrandTotals.map((grandTotal) => {
    const normalizedTotal = Math.max(0, grandTotal);
    const amountPaid = Math.min(remaining, normalizedTotal);
    remaining = Math.max(0, remaining - amountPaid);
    return { amountPaid, pendingBalance: grandTotal - amountPaid };
  });
}

/** Payment split across prior branch stays and the active stay after transfer(s). */
export function computeTransferStayPaymentAllocation(input: {
  priorSegmentGrandTotals: number[];
  currentSegmentGrandTotal: number;
  paymentTotal: number;
}) {
  const allocations = allocatePaymentsAcrossSegments(
    [...input.priorSegmentGrandTotals, input.currentSegmentGrandTotal],
    input.paymentTotal,
  );
  const priorAllocations = allocations.slice(0, -1);
  const currentAllocation = allocations[allocations.length - 1] ?? { amountPaid: 0, pendingBalance: 0 };
  const priorSegmentsPaid = priorAllocations.reduce((sum, row) => sum + row.amountPaid, 0);

  return {
    allocations,
    priorSegmentsPaid,
    currentSegmentPaid: currentAllocation.amountPaid,
    currentSegmentPending: currentAllocation.pendingBalance,
  };
}

export type InpatientPaymentLike = {
  paymentDate: string;
  createdAt?: string | Date | null;
};

export type TransferLogLike = {
  transferDate: string;
  createdAt?: string | Date | null;
};

function paymentInstant(payment: InpatientPaymentLike): number {
  if (payment.createdAt) {
    return new Date(payment.createdAt).getTime();
  }
  const day = dateOnly(payment.paymentDate);
  return new Date(`${day}T12:00:00+05:30`).getTime();
}

function transferInstant(transfer: TransferLogLike): number {
  if (transfer.createdAt) {
    return new Date(transfer.createdAt).getTime();
  }
  const day = dateOnly(transfer.transferDate);
  return new Date(`${day}T23:59:59.999+05:30`).getTime();
}

/** Payments recorded after the most recent branch transfer (current stay only). */
export function getPaymentsForCurrentStay<T extends InpatientPaymentLike>(
  payments: T[],
  transferLogsAsc: TransferLogLike[],
): T[] {
  if (transferLogsAsc.length === 0) return [...payments];

  const lastTransfer = transferLogsAsc[transferLogsAsc.length - 1];
  const transferAt = transferInstant(lastTransfer);

  return payments.filter((payment) => paymentInstant(payment) > transferAt);
}

/** Payments recorded before or at the most recent branch transfer (prior stay). */
export function getPaymentsForPriorTransferStays<T extends InpatientPaymentLike>(
  payments: T[],
  transferLogsAsc: TransferLogLike[],
): T[] {
  if (transferLogsAsc.length === 0) return [];

  const current = new Set(getPaymentsForCurrentStay(payments, transferLogsAsc));
  return payments.filter((payment) => !current.has(payment));
}

export function sumPaymentAmounts(payments: Array<{ amount: string | number }>): number {
  return payments.reduce((sum, payment) => sum + (parseFloat(String(payment.amount)) || 0), 0);
}

/** Display label for an in-patient payment (date + time in clinic timezone). */
export function formatInpatientPaymentTimestamp(payment: InpatientPaymentLike): string {
  const raw = payment.createdAt ?? payment.paymentDate;
  const normalized =
    typeof raw === "string" && !raw.includes("T")
      ? `${raw.split("T")[0]}T12:00:00+05:30`
      : raw;
  const date = new Date(normalized);
  return date.toLocaleString("en-GB", {
    timeZone: CLINIC_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function dateOnly(value: string): string {
  return String(value).split("T")[0];
}

function expenseInDateRange(
  expense: { expenseDate: string; description?: string | null },
  startDate: string,
  endDate: string,
): boolean {
  if (isCarriedForwardExpense(expense)) return false;
  const day = dateOnly(expense.expenseDate);
  return day >= startDate && day <= endDate;
}

/**
 * Which branch-stay segment owns the admission-level deduction.
 * Returns the index into prior (closed) transfer segments, or "current" for the active segment.
 */
export function resolveDeductionSegmentIndex(
  deductionAppliedAt: Date | string | null | undefined,
  admitDate: string,
  transfers: Array<{ transferDate: string }>,
): number | "current" {
  if (transfers.length === 0) return "current";

  const appliedDay = deductionAppliedAt ? clinicDateOnly(deductionAppliedAt) : null;
  if (!appliedDay) {
    // Legacy rows without applied-at: attribute to the last closed segment when transfers exist.
    return transfers.length - 1;
  }

  let segmentStart = dateOnly(admitDate);
  for (let index = 0; index < transfers.length; index += 1) {
    const segmentEnd = dateOnly(transfers[index].transferDate);
    if (appliedDay >= segmentStart && appliedDay <= segmentEnd) {
      return index;
    }
    segmentStart = segmentEnd;
  }

  // Deduction applied after transfer still adjusts the closing branch bill, not the new stay.
  return transfers.length - 1;
}

/** Deduction fields for one stay segment (null/zero when the deduction belongs elsewhere). */
export function deductionFieldsForSegment(
  ownerSegment: number | "current",
  targetSegment: number | "current",
  deductionType: "fixed" | "percentage" | null | undefined,
  deductionValue: number | string | null | undefined,
): { deductionType: "fixed" | "percentage" | null; deductionValue: number } {
  const value = parseFloat(String(deductionValue ?? 0)) || 0;
  if (ownerSegment === targetSegment && deductionType && value > 0) {
    return { deductionType, deductionValue: value };
  }
  return { deductionType: null, deductionValue: 0 };
}

/** Bill one branch-stay segment (expenses limited to segment dates; optional segment deduction). */
export function computeBranchStaySegmentBilling(input: {
  admitDate: string;
  endDate: string;
  amountPerDay: number | string;
  careTakerRatePerDay: number | string;
  careTakerDaysOverride?: number | null;
  deductionType?: "fixed" | "percentage" | null;
  deductionValue?: number | string | null;
  extraExpenses?: Array<{ expenseDate: string; amount: string | number; description?: string | null }>;
}): AdmissionBillingBreakdown {
  const segmentExpenses = (input.extraExpenses ?? []).filter((expense) =>
    expenseInDateRange(expense, dateOnly(input.admitDate), dateOnly(input.endDate)),
  );
  return computeAdmissionBillingBreakdown({
    admitDate: input.admitDate,
    endDate: input.endDate,
    amountPerDay: input.amountPerDay,
    careTakerRatePerDay: input.careTakerRatePerDay,
    careTakerDaysOverride: input.careTakerDaysOverride,
    deductionType: input.deductionType ?? null,
    deductionValue: input.deductionValue ?? 0,
    extraExpenses: segmentExpenses,
  });
}

/** Allocate payments to carried-forward prior balance first, then the current episode. */
export function splitReAdmissionPayments(
  paymentTotal: number,
  currentEpisodeGrandTotal: number,
  carriedForwardTotal: number,
) {
  const grandTotal = currentEpisodeGrandTotal + carriedForwardTotal;
  const overpaymentCredit = Math.max(0, paymentTotal - grandTotal);

  // Prior overpayment credit is already deducted from the bill total — no "pay prior first" step.
  if (carriedForwardTotal <= 0) {
    const amountDue = Math.max(0, grandTotal);
    const appliedToBill = Math.min(paymentTotal, amountDue);
    return {
      currentEpisodePaid: appliedToBill,
      priorBalancePaid: 0,
      currentBalanceDue: grandTotal - paymentTotal,
      priorBalanceDue: 0,
      overpaymentCredit,
    };
  }

  const priorBalancePaid = Math.min(paymentTotal, carriedForwardTotal);
  const remainder = Math.max(0, paymentTotal - priorBalancePaid);
  const currentEpisodePaid = Math.min(remainder, Math.max(0, currentEpisodeGrandTotal));
  const currentBalanceDue = currentEpisodeGrandTotal - currentEpisodePaid;
  const priorBalanceDue = carriedForwardTotal - priorBalancePaid;

  return {
    currentEpisodePaid,
    priorBalancePaid,
    currentBalanceDue,
    priorBalanceDue,
    overpaymentCredit,
  };
}

export type DischargeBillLine = {
  description: string;
  quantity: number | string;
  rate: number | null;
  amount: number;
};

/** Line items for the discharge summary bill breakdown table. */
export function buildDischargeBillLines(
  breakdown: AdmissionBillingBreakdown,
  opts: {
    amountPerDay: number;
    careTakerRatePerDay: number;
    packageType?: string | null;
    deductionType?: "fixed" | "percentage" | null;
    deductionValue?: number | null;
  },
): DischargeBillLine[] {
  const lines: DischargeBillLine[] = [
    {
      description: `Room Charges (${opts.packageType || "Daily"})`,
      quantity: breakdown.stayDays,
      rate: opts.amountPerDay,
      amount: breakdown.roomCharges,
    },
  ];

  if (breakdown.caretakerCharges > 0) {
    lines.push({
      description: "Caretaker Charges",
      quantity: breakdown.careTakerDays,
      rate: opts.careTakerRatePerDay,
      amount: breakdown.caretakerCharges,
    });
  }

  if (breakdown.carriedForwardDebt > 0) {
    lines.push({
      description: "Previous Admission Balance",
      quantity: "-",
      rate: null,
      amount: breakdown.carriedForwardDebt,
    });
  }

  if (breakdown.carriedForwardCreditApplied > 0) {
    lines.push({
      description: "Previous Overpayment Credit Applied",
      quantity: "-",
      rate: null,
      amount: -breakdown.carriedForwardCreditApplied,
    });
  }

  if (breakdown.extraExpenseTotal > 0) {
    lines.push({
      description: "Extra Expenses",
      quantity: "-",
      rate: null,
      amount: breakdown.extraExpenseTotal,
    });
  }

  if (breakdown.deductionAmount > 0) {
    const label =
      opts.deductionType === "percentage"
        ? `Deduction (${opts.deductionValue ?? 0}%)`
        : "Deduction";
    lines.push({
      description: label,
      quantity: "-",
      rate: null,
      amount: -breakdown.deductionAmount,
    });
  }

  return lines;
}

export type AdmissionBillingBreakdown = {
  stayDays: number;
  roomCharges: number;
  careTakerDays: number;
  caretakerCharges: number;
  /** Extra expenses for this stay only (excludes carried-forward prior balance). */
  extraExpenseTotal: number;
  /** Prior admission balance brought forward on re-admit (positive = debt, negative = credit). */
  carriedForwardTotal: number;
  /** Prior admission debt carried forward (≥ 0). */
  carriedForwardDebt: number;
  /** Prior overpayment credit auto-deducted from this bill (≥ 0). */
  carriedForwardCreditApplied: number;
  /** Room + caretaker + current extra expenses + carried forward, before deduction. */
  subtotal: number;
  /** Room + caretaker + current extra expenses, before deduction. */
  currentSubtotal: number;
  /** Deduction applies to the current stay only — not carried-forward balance. */
  deductionAmount: number;
  /** Total bill: current stay after deduction + any carried-forward balance. */
  grandTotal: number;
  /** Current stay after deduction (excludes carried forward). */
  currentGrandTotal: number;
};

export function computeAdmissionBillingBreakdown(input: AdmissionBillingInput): AdmissionBillingBreakdown {
  const stayDays = computeStayDays(input.admitDate, input.endDate);
  const amountPerDay = parseFloat(String(input.amountPerDay)) || 0;
  const roomCharges = amountPerDay * stayDays;
  const careTakerRate = parseFloat(String(input.careTakerRatePerDay ?? 0)) || 0;
  const careTakerDays = input.careTakerDaysOverride ?? stayDays;
  const caretakerCharges = careTakerRate * careTakerDays;
  const carriedForwardTotal = sumCarriedForwardAmounts(input.extraExpenses);
  const carriedForwardDebt = Math.max(0, carriedForwardTotal);
  const carriedForwardCreditApplied = Math.max(0, -carriedForwardTotal);
  const extraExpenseTotal = (input.extraExpenses || [])
    .filter((expense) => !isCarriedForwardExpense(expense))
    .reduce((sum, expense) => sum + (parseFloat(String(expense.amount)) || 0), 0);
  const currentSubtotal = roomCharges + caretakerCharges + extraExpenseTotal;
  const subtotal = currentSubtotal + carriedForwardTotal;
  const deductionValue = parseFloat(String(input.deductionValue ?? 0)) || 0;
  const deductionAmount = computeDeductionAmount(currentSubtotal, input.deductionType, deductionValue);
  const currentGrandTotal = Math.max(0, currentSubtotal - deductionAmount);
  const grandTotal = currentGrandTotal + carriedForwardTotal;

  return {
    stayDays,
    roomCharges,
    careTakerDays,
    caretakerCharges,
    extraExpenseTotal,
    carriedForwardTotal,
    carriedForwardDebt,
    carriedForwardCreditApplied,
    subtotal,
    currentSubtotal,
    deductionAmount,
    grandTotal,
    currentGrandTotal,
  };
}

/** Payment allocation and balance due for a live admission bill. */
export function computeAdmissionBalanceSummary(
  breakdown: AdmissionBillingBreakdown,
  paymentTotal: number,
) {
  const paymentSplit = splitReAdmissionPayments(
    paymentTotal,
    breakdown.currentGrandTotal,
    breakdown.carriedForwardTotal,
  );
  const netBalanceDue = computeBalanceDue(breakdown.grandTotal, paymentTotal);
  const overpaymentCredit = Math.max(0, paymentTotal - breakdown.grandTotal);
  const priorPendingForCurrentAdmission =
    breakdown.carriedForwardTotal > 0 ? paymentSplit.priorBalanceDue : 0;
  const totalBalanceDue =
    breakdown.carriedForwardTotal > 0
      ? computeTotalPendingBalance(paymentSplit.currentBalanceDue, priorPendingForCurrentAdmission)
      : netBalanceDue;

  return {
    ...paymentSplit,
    netBalanceDue,
    overpaymentCredit,
    totalBalanceDue,
    priorPendingForCurrentAdmission,
    carriedForwardCreditApplied: breakdown.carriedForwardCreditApplied,
    hasCarriedForwardBalance: breakdown.carriedForwardDebt > 0,
    hasCarriedForwardCredit: breakdown.carriedForwardCreditApplied > 0,
    hasPriorPendingInSummary: priorPendingForCurrentAdmission > 0,
  };
}

/** Net balance across the current episode plus any prior-admission pending balance. */
export function computeTotalPendingBalance(
  currentBalanceDue: number,
  priorPendingBalance: number,
): number {
  return currentBalanceDue + priorPendingBalance;
}

export function computeDeductionAmount(
  subtotal: number,
  deductionType: "fixed" | "percentage" | null | undefined,
  deductionValue: number,
): number {
  if (deductionType === "percentage") {
    return Math.min(subtotal, subtotal * (deductionValue / 100));
  }
  if (deductionType === "fixed") {
    return Math.min(subtotal, deductionValue);
  }
  return 0;
}

/** Inclusive stay days between admit and end (discharge or today) in Sri Lanka timezone. */
export function computeStayDays(admitDate: string, endDate?: string): number {
  const admitLK = clinicDateOnly(admitDate);
  const endLK = clinicDateOnly(endDate ?? new Date());
  const admitMs = new Date(`${admitLK}T12:00:00+05:30`).getTime();
  const endMs = new Date(`${endLK}T12:00:00+05:30`).getTime();
  const days = Math.floor((endMs - admitMs) / 86_400_000) + 1;
  return Math.max(1, days);
}

export type AdmissionBillingInput = {
  admitDate: string;
  endDate: string;
  amountPerDay: string | number;
  careTakerRatePerDay?: string | number | null;
  careTakerDaysOverride?: number | null;
  deductionType?: "fixed" | "percentage" | null;
  deductionValue?: string | number | null;
  extraExpenses?: Array<{ description?: string | null; amount: string | number }>;
};

/** Live grand total for an admission episode (matches the in-patient billing summary). */
export function computeAdmissionGrandTotal(input: AdmissionBillingInput): number {
  return computeAdmissionBillingBreakdown(input).grandTotal;
}

export function computeAdmissionBalanceDue(grandTotal: number, paymentTotal: number): number {
  return computeBalanceDue(grandTotal, paymentTotal);
}

/** Walk the readmit chain from the current admission back through prior episodes. */
export function collectReadmitChainPriorAdmissionIds(
  admission: { admissionSource?: string | null },
  relatedById: Map<string, { admissionSource?: string | null }>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  let cursor: { admissionSource?: string | null } | undefined = admission;

  while (cursor) {
    const priorId = parseReadmitAdmissionSource(cursor.admissionSource);
    if (!priorId || seen.has(priorId)) break;
    seen.add(priorId);
    ids.push(priorId);
    cursor = relatedById.get(priorId);
  }

  return ids;
}
