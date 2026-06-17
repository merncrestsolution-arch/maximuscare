import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";

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
  const today = new Date();
  switch (preset) {
    case "today":
      return { startDate: format(today, "yyyy-MM-dd"), endDate: format(today, "yyyy-MM-dd") };
    case "yesterday": {
      const y = subDays(today, 1);
      const s = format(y, "yyyy-MM-dd");
      return { startDate: s, endDate: s };
    }
    case "last7":
      return { startDate: format(subDays(today, 6), "yyyy-MM-dd"), endDate: format(today, "yyyy-MM-dd") };
    case "last30":
      return { startDate: format(subDays(today, 29), "yyyy-MM-dd"), endDate: format(today, "yyyy-MM-dd") };
    case "currentMonth":
      return { startDate: format(startOfMonth(today), "yyyy-MM-dd"), endDate: format(endOfMonth(today), "yyyy-MM-dd") };
    case "previousMonth": {
      const prev = subMonths(today, 1);
      return { startDate: format(startOfMonth(prev), "yyyy-MM-dd"), endDate: format(endOfMonth(prev), "yyyy-MM-dd") };
    }
    case "currentYear":
      return { startDate: format(startOfYear(today), "yyyy-MM-dd"), endDate: format(endOfYear(today), "yyyy-MM-dd") };
    case "custom":
    default:
      return { startDate: customFrom ?? format(startOfMonth(today), "yyyy-MM-dd"), endDate: customTo ?? format(today, "yyyy-MM-dd") };
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
