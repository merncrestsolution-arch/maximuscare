/** Consistent paid / unpaid / partial styling across visit lists and reports. */
export function isPaidStatus(status: string | undefined | null): boolean {
  return String(status ?? "")
    .trim()
    .toLowerCase() === "paid";
}

export function isPartiallyPaidStatus(status: string | undefined | null): boolean {
  return String(status ?? "")
    .trim()
    .toLowerCase() === "partially paid";
}

export function isUnpaidLikeStatus(status: string | undefined | null): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "unpaid" || s === "partially paid";
}

export function paymentStatusBadgeClass(status: string | undefined | null): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "paid") return "bg-emerald-100 text-emerald-800 border border-emerald-200/80";
  if (s === "partially paid") return "bg-amber-100 text-amber-900 border border-amber-200/80";
  if (s === "cancelled") return "bg-gray-100 text-gray-700 border border-gray-200/80";
  return "bg-red-100 text-red-800 border border-red-200/80";
}

export function computeOutstanding(total: number, paid: number): number {
  return Math.max(0, total - Math.max(0, paid));
}
