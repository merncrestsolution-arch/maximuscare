export const CARRIED_FORWARD_EXPENSE_MARKER = "previous admission balance carried forward";

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
  return String(expense.description || "").toLowerCase().includes(CARRIED_FORWARD_EXPENSE_MARKER);
}

export function sumCarriedForwardAmounts(
  expenses: Array<{ description?: string | null; amount: string | number }> | undefined,
): number {
  return (expenses || [])
    .filter(isCarriedForwardExpense)
    .reduce((sum, expense) => sum + (parseFloat(String(expense.amount)) || 0), 0);
}

/** Allocate payments to carried-forward prior balance first, then the current episode. */
export function splitReAdmissionPayments(
  paymentTotal: number,
  currentEpisodeGrandTotal: number,
  carriedForwardTotal: number,
) {
  const priorBalancePaid = Math.min(paymentTotal, Math.max(0, carriedForwardTotal));
  const remainder = Math.max(0, paymentTotal - priorBalancePaid);
  const currentEpisodePaid = Math.min(remainder, Math.max(0, currentEpisodeGrandTotal));
  const currentBalanceDue = Math.max(0, currentEpisodeGrandTotal - currentEpisodePaid);
  const priorBalanceDue = Math.max(0, carriedForwardTotal - priorBalancePaid);

  return {
    currentEpisodePaid,
    priorBalancePaid,
    currentBalanceDue,
    priorBalanceDue,
  };
}

export type AdmissionBillingBreakdown = {
  stayDays: number;
  roomCharges: number;
  careTakerDays: number;
  caretakerCharges: number;
  extraExpenseTotal: number;
  subtotal: number;
  deductionAmount: number;
  grandTotal: number;
};

export function computeAdmissionBillingBreakdown(input: AdmissionBillingInput): AdmissionBillingBreakdown {
  const stayDays = computeStayDays(input.admitDate, input.endDate);
  const amountPerDay = parseFloat(String(input.amountPerDay)) || 0;
  const roomCharges = amountPerDay * stayDays;
  const careTakerRate = parseFloat(String(input.careTakerRatePerDay ?? 0)) || 0;
  const careTakerDays = input.careTakerDaysOverride ?? stayDays;
  const caretakerCharges = careTakerRate * careTakerDays;
  const extraExpenseTotal = (input.extraExpenses || []).reduce(
    (sum, expense) => sum + (parseFloat(String(expense.amount)) || 0),
    0,
  );
  const subtotal = roomCharges + caretakerCharges + extraExpenseTotal;
  const deductionValue = parseFloat(String(input.deductionValue ?? 0)) || 0;
  const deductionAmount = computeDeductionAmount(subtotal, input.deductionType, deductionValue);
  const grandTotal = Math.max(0, subtotal - deductionAmount);

  return {
    stayDays,
    roomCharges,
    careTakerDays,
    caretakerCharges,
    extraExpenseTotal,
    subtotal,
    deductionAmount,
    grandTotal,
  };
}

/** Total still owed across the current episode plus any prior-admission pending balance. */
export function computeTotalPendingBalance(
  currentBalanceDue: number,
  priorPendingBalance: number,
): number {
  return Math.max(0, currentBalanceDue + priorPendingBalance);
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

/** Inclusive stay days between admit and end (discharge or today). */
export function computeStayDays(admitDate: string, endDate: string): number {
  const admit = new Date(admitDate);
  const end = new Date(endDate);
  const ms = end.getTime() - admit.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
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
  return Math.max(0, grandTotal - paymentTotal);
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
