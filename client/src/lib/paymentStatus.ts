/** Consistent paid / unpaid styling across visit lists and reports. */
export function isPaidStatus(status: string | undefined | null): boolean {
  return String(status ?? "")
    .trim()
    .toLowerCase() === "paid";
}

export function paymentStatusBadgeClass(status: string | undefined | null): string {
  return isPaidStatus(status)
    ? "bg-emerald-100 text-emerald-800 border border-emerald-200/80"
    : "bg-red-100 text-red-800 border border-red-200/80";
}
