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

export function isCarriedForwardExpense(expense: { description?: string | null }): boolean {
  const desc = String(expense.description || "").toLowerCase();
  return (
    desc.includes(CARRIED_FORWARD_EXPENSE_MARKER) ||
    desc.includes(CARRIED_FORWARD_CREDIT_MARKER) ||
    desc.includes(TRANSFER_BALANCE_MARKER) ||
    desc.includes(TRANSFER_CREDIT_MARKER)
  );
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

/** Bill one branch-stay segment (no deduction; expenses limited to segment dates). */
export function computeBranchStaySegmentBilling(input: {
  admitDate: string;
  endDate: string;
  amountPerDay: number | string;
  careTakerRatePerDay: number | string;
  careTakerDaysOverride?: number | null;
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
    deductionType: null,
    deductionValue: 0,
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
