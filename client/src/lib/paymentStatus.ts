/** Consistent paid / unpaid / partial styling across visit lists and reports. */
import { computeBalanceDue, computeOutstandingAmount } from "@shared/inpatientBilling";

export { computeBalanceDue, computeOutstandingAmount };
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
  return computeBalanceDue(total, paid);
}

export type DueDisplay = {
  label: string;
  value: string;
  colour: string;
  bgColour: string;
  tone: "danger" | "success";
};

/** Display rules for due / credit / settled balances (Phase 1 billing). */
export function getDueDisplay(due: number): DueDisplay {
  if (due > 0) {
    return {
      label: "Due Amount",
      value: `LKR ${due.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`,
      colour: "#DC2626",
      bgColour: "#FEF2F2",
      tone: "danger",
    };
  }
  if (due === 0) {
    return {
      label: "Payment Status",
      value: "Fully Paid",
      colour: "#16A34A",
      bgColour: "#F0FDF4",
      tone: "success",
    };
  }
  return {
    label: "Credit Balance",
    value: `LKR ${Math.abs(due).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`,
    colour: "#16A34A",
    bgColour: "#F0FDF4",
    tone: "success",
  };
}
