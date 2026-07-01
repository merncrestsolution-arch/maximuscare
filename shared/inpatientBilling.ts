export const CARRIED_FORWARD_EXPENSE_MARKER = "previous admission balance carried forward";

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

/** Allocate payments to the current episode first, then to carried-forward prior balance. */
export function splitReAdmissionPayments(
  paymentTotal: number,
  currentEpisodeGrandTotal: number,
  carriedForwardTotal: number,
) {
  const currentEpisodePaid = Math.min(paymentTotal, Math.max(0, currentEpisodeGrandTotal));
  const priorBalancePaid = Math.min(
    carriedForwardTotal,
    Math.max(0, paymentTotal - currentEpisodeGrandTotal),
  );
  const currentBalanceDue = Math.max(0, currentEpisodeGrandTotal - currentEpisodePaid);
  const priorBalanceDue = Math.max(0, carriedForwardTotal - priorBalancePaid);

  return {
    currentEpisodePaid,
    priorBalancePaid,
    currentBalanceDue,
    priorBalanceDue,
  };
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
