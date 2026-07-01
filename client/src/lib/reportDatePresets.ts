import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { clinicTodayDate, clinicTodayString } from "./utils";

export type DatePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "currentMonth"
  | "previousMonth"
  | "currentYear"
  | "custom";

export function getDateRangeForPreset(preset: DatePreset, customFrom?: string, customTo?: string) {
  const today = clinicTodayDate();
  const todayStr = clinicTodayString(today);
  switch (preset) {
    case "today":
      return { startDate: todayStr, endDate: todayStr };
    case "yesterday": {
      const y = subDays(today, 1);
      const s = clinicTodayString(y);
      return { startDate: s, endDate: s };
    }
    case "last7":
      return { startDate: clinicTodayString(subDays(today, 6)), endDate: todayStr };
    case "last30":
      return { startDate: clinicTodayString(subDays(today, 29)), endDate: todayStr };
    case "currentMonth":
      return {
        startDate: clinicTodayString(startOfMonth(today)),
        endDate: clinicTodayString(endOfMonth(today)),
      };
    case "previousMonth": {
      const prev = subMonths(today, 1);
      return {
        startDate: clinicTodayString(startOfMonth(prev)),
        endDate: clinicTodayString(endOfMonth(prev)),
      };
    }
    case "currentYear":
      return {
        startDate: clinicTodayString(startOfYear(today)),
        endDate: clinicTodayString(endOfYear(today)),
      };
    case "custom":
    default:
      return {
        startDate: customFrom ?? clinicTodayString(startOfMonth(today)),
        endDate: customTo ?? todayStr,
      };
  }
}

export const DATE_PRESET_LABELS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 Days" },
  { id: "last30", label: "Last 30 Days" },
  { id: "currentMonth", label: "Current Month" },
  { id: "previousMonth", label: "Previous Month" },
  { id: "currentYear", label: "Current Year" },
  { id: "custom", label: "Custom Range" },
];

export function formatLkr(amount: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0 }).format(amount);
}

/**
 * Bug 1: bill/invoice amounts must always show exactly 2 decimal places so the
 * amount column stays aligned. Returns a thousands-separated value WITHOUT the
 * currency symbol (callers that show a "LKR" label prefix it themselves).
 */
export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
