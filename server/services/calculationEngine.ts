/**
 * Centralized calculation engine — single source of truth for payroll, revenue,
 * incentives, home visits, OT, fines, expenses, and dashboard KPIs.
 */
import type { Visit, Attendance, InPatientSession, StaffFine, Expense } from "@shared/schema";
import { normalizeBranchName, getHomeVisitRateTier } from "@shared/branches";
import { computeBalanceDue, computeOutstandingAmount } from "@shared/inpatientBilling";

export { computeBalanceDue, computeOutstandingAmount };

export const DEFAULT_RATES = {
  incentiveMinCount: 5,
  incentivePerCount: 100,
  homeColombo: 1000,
  homeBandaragama: 500,
  otPerHour: 250,
  extraHolidayDeduction: 1500,
  freeAbsentDays: 4,
  autoFineAmount: 500,
} as const;

export const BRANCH_REQUIRED_MESSAGE = "Branch selection is required.";

export const ATTENDANCE_STATUSES = ["Present", "Absent", "Leave", "Holiday"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface CalculationRates {
  incentiveMinCount: number;
  incentivePerCount: number;
  homeColombo: number;
  homeBandaragama: number;
  otPerHour: number;
  extraHolidayDeduction: number;
  freeAbsentDays: number;
}

export interface DailyIncentiveResult {
  date: string;
  colomboClinicVisits: number;
  inpatientSessions: number;
  count: number;
  amount: number;
}

export interface HomeVisitBreakdown {
  colomboVisits: number;
  bandaragamaVisits: number;
  income: number;
}

export interface ExpenseBreakdown {
  total: number;
  byCategory: Record<string, number>;
}

export interface SalaryBreakdown {
  basicSalary: number;
  incentiveAmount: number;
  homeVisitIncome: number;
  otAmount: number;
  finesTotal: number;
  extraHolidayDeduction: number;
  otherDeductions: number;
  finalSalary: number;
}

export interface RevenueBreakdown {
  clinicVisits: number;
  homeVisits: number;
  inpatientSessions: number;
  total: number;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  leave: number;
  holiday: number;
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export function inDateRange(dateStr: string, from: string, to: string): boolean {
  return dateStr >= from && dateStr <= to;
}

export function isPaidPaymentStatus(status: string | null | undefined): boolean {
  return String(status ?? "").trim().toLowerCase() === "paid";
}

export function validateAttendanceStatus(
  status: unknown
): { ok: true; status: AttendanceStatus } | { ok: false; message: string } {
  const value = String(status ?? "").trim();
  if (!ATTENDANCE_STATUSES.includes(value as AttendanceStatus)) {
    return { ok: false, message: `Invalid attendance status. Use: ${ATTENDANCE_STATUSES.join(", ")}` };
  }
  return { ok: true, status: value as AttendanceStatus };
}

export function validateBranch(branch: unknown): { ok: true; branch: string } | { ok: false; message: string } {
  const value = String(branch ?? "").trim();
  if (!value) return { ok: false, message: BRANCH_REQUIRED_MESSAGE };
  return { ok: true, branch: value };
}

export const PAYMENT_STATUSES = ["Paid", "Partially Paid", "Unpaid", "Cancelled"] as const;
export const VISIT_STATUSES = ["Scheduled", "Completed", "Cancelled", "No Show"] as const;

export function validatePaymentStatus(status: unknown): { ok: true; status: string } | { ok: false; message: string } {
  const value = String(status ?? "").trim();
  if (!value) return { ok: false, message: "Payment status is required." };
  const match = PAYMENT_STATUSES.find((s) => s.toLowerCase() === value.toLowerCase());
  if (!match) return { ok: false, message: `Invalid payment status. Use: ${PAYMENT_STATUSES.join(", ")}` };
  return { ok: true, status: match };
}

export function validateVisitStatus(status: unknown): { ok: true; status: string } | { ok: false; message: string } {
  const value = String(status ?? "").trim();
  if (!value) return { ok: false, message: "Visit status is required." };
  const match = VISIT_STATUSES.find((s) => s.toLowerCase() === value.toLowerCase());
  if (!match) return { ok: false, message: `Invalid visit status. Use: ${VISIT_STATUSES.join(", ")}` };
  return { ok: true, status: match };
}

export function normalizeVisitType(type: string | null | undefined): "home" | "clinic" | "unknown" {
  const normalized = String(type ?? "").trim().toLowerCase();
  if (normalized.includes("home")) return "home";
  if (normalized.includes("clinic")) return "clinic";
  return "unknown";
}

export function computeOutstandingBalance(totalAmount: number, amountPaid: number): number {
  return computeBalanceDue(totalAmount, amountPaid);
}

export function derivePaymentStatus(totalAmount: number, amountPaid: number): (typeof PAYMENT_STATUSES)[number] {
  const total = Math.max(0, totalAmount);
  const paid = Math.max(0, amountPaid);
  if (total <= 0 && paid <= 0) return "Unpaid";
  if (paid >= total && total > 0) return "Paid";
  if (paid > 0) return "Partially Paid";
  return "Unpaid";
}

export function isRevenueEligibleVisit(visit: Visit): boolean {
  if ((visit as { deletedAt?: unknown }).deletedAt) return false;
  const vs = String((visit as { visitStatus?: string }).visitStatus ?? visit.status ?? "").toLowerCase();
  if (vs === "cancelled") return false;
  const ps = String(visit.paymentStatus ?? "").toLowerCase();
  if (ps === "cancelled") return false;
  return ps === "paid" || ps === "partially paid";
}

/** Collected revenue for a visit (full amount when paid, amount paid when partial). */
export function getVisitCollectedRevenue(visit: Visit): number {
  if (!isRevenueEligibleVisit(visit)) return 0;
  const total = Number(visit.paymentAmount) || 0;
  const paid = Number((visit as { amountPaid?: string | number }).amountPaid) || 0;
  const ps = String(visit.paymentStatus ?? "").toLowerCase();
  if (ps === "partially paid") return paid;
  return total > 0 ? total : paid;
}

/** Outstanding balance for unpaid or partially paid visits. */
export function getVisitOutstandingBalance(visit: Visit): number {
  const ps = String(visit.paymentStatus ?? "").toLowerCase();
  if (ps === "paid" || ps === "cancelled") return 0;
  const total = Number(visit.paymentAmount) || 0;
  const paid = Number((visit as { amountPaid?: string | number }).amountPaid) || 0;
  return computeOutstandingAmount(total, paid);
}

export function validateNonNegative(value: number, label: string): string | null {
  if (!Number.isFinite(value) || value < 0) return `${label} cannot be negative.`;
  return null;
}

/** Daily incentive count = Colombo clinic visits + FLOOR(inpatient sessions ÷ 2). */
export function computeDailyIncentiveCount(colomboClinicVisits: number, inpatientSessions: number): number {
  const clinic = Math.max(0, Math.floor(colomboClinicVisits));
  const ip = Math.max(0, Math.floor(inpatientSessions));
  return clinic + Math.floor(ip / 2);
}

/** Daily incentive amount — zero if count < minimum threshold. */
export function computeDailyIncentiveAmount(
  count: number,
  rates: Pick<CalculationRates, "incentiveMinCount" | "incentivePerCount">
): number {
  if (count < rates.incentiveMinCount) return 0;
  return count * rates.incentivePerCount;
}

/** Sum of daily incentive amounts for a month/period. */
export function computeMonthlyIncentiveAmount(dailyAmounts: number[]): number {
  return sum(dailyAmounts.map((a) => Math.max(0, a)));
}

export function computeDailyIncentivesForRange(
  colomboClinicByDay: Record<string, number>,
  ipSessionsByDay: Record<string, number>,
  rangeFrom: string,
  rangeTo: string,
  rates: CalculationRates,
  enabled = true
): DailyIncentiveResult[] {
  if (!enabled) return [];
  const days = Array.from(
    new Set([...Object.keys(colomboClinicByDay), ...Object.keys(ipSessionsByDay)])
  );
  const results: DailyIncentiveResult[] = [];
  for (const date of days) {
    if (!inDateRange(date, rangeFrom, rangeTo)) continue;
    const colomboClinicVisits = colomboClinicByDay[date] ?? 0;
    const inpatientSessions = ipSessionsByDay[date] ?? 0;
    const count = computeDailyIncentiveCount(colomboClinicVisits, inpatientSessions);
    const amount = computeDailyIncentiveAmount(count, rates);
    if (count > 0) {
      results.push({ date, colomboClinicVisits, inpatientSessions, count, amount });
    }
  }
  return results.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Home visit classification (Bug 7): flat per-branch rate, no holiday case.
 * Colombo "main"-tier branches (Dehiwala, Neuro Unit) → Colombo rate; all others → Bandaragama rate.
 */
export function classifyHomeVisit(branch: string): "Colombo" | "Bandaragama" {
  if (getHomeVisitRateTier(branch) === "bandaragama") return "Bandaragama";
  return "Colombo";
}

export function computeHomeVisitIncome(
  colomboVisits: number,
  bandaragamaVisits: number,
  rates: Pick<CalculationRates, "homeColombo" | "homeBandaragama">
): number {
  return (
    Math.max(0, colomboVisits) * rates.homeColombo +
    Math.max(0, bandaragamaVisits) * rates.homeBandaragama
  );
}

export function computeHomeVisitBreakdown(
  homeVisits: { branch: string; visitDate: string }[],
  rates: Pick<CalculationRates, "homeColombo" | "homeBandaragama">
): HomeVisitBreakdown {
  let colomboVisits = 0;
  let bandaragamaVisits = 0;
  for (const v of homeVisits) {
    // Bug 7: flat home-visit rate by branch tier — no holiday multiplier regardless of day.
    if (getHomeVisitRateTier(v.branch) === "bandaragama") {
      bandaragamaVisits++;
    } else {
      colomboVisits++;
    }
  }
  return {
    colomboVisits,
    bandaragamaVisits,
    income: computeHomeVisitIncome(colomboVisits, bandaragamaVisits, rates),
  };
}

export function computeOtAmount(hours: number, ratePerHour: number): number {
  const h = Math.max(0, Number(hours) || 0);
  return h * ratePerHour;
}

const ATTENDANCE_STATUS_PRIORITY: Record<string, number> = {
  Present: 4,
  Absent: 3,
  Leave: 2,
  Holiday: 1,
};

/** Higher score = preferred row when multiple records exist for the same staff + day. */
export function compareAttendanceRecords(a: Attendance, b: Attendance): number {
  const sa = ATTENDANCE_STATUS_PRIORITY[a.status] ?? 0;
  const sb = ATTENDANCE_STATUS_PRIORITY[b.status] ?? 0;
  if (sa !== sb) return sa - sb;
  const ca = a.checkInTime ? 1 : 0;
  const cb = b.checkInTime ? 1 : 0;
  if (ca !== cb) return ca - cb;
  const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  if (ua !== ub) return ua - ub;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

export function normalizeAttendanceDate(date: string | null | undefined): string {
  return String(date ?? "").split("T")[0];
}

export function dedupeAttendanceByDate(records: Attendance[]): Attendance[] {
  // Key by staff + date so multi-staff datasets (e.g. dashboard charts that group
  // every staff member's records for a day) keep one record *per staff per day*
  // instead of collapsing the whole day to a single record. For single-staff data
  // the staffId is constant, so this is equivalent to deduping by date.
  const unique = new Map<string, Attendance>();
  for (const a of records) {
    const normalizedDate = normalizeAttendanceDate(a.date);
    const key = `${a.staffId ?? ""}|${normalizedDate}`;
    const normalized = normalizedDate === a.date ? a : ({ ...a, date: normalizedDate } as Attendance);
    const existing = unique.get(key);
    if (!existing || compareAttendanceRecords(normalized, existing) > 0) {
      unique.set(key, normalized);
    }
  }
  return Array.from(unique.values());
}

export function summarizeAttendance(records: Attendance[]): AttendanceSummary {
  const deduped = dedupeAttendanceByDate(records);
  return {
    present: deduped.filter((a) => a.status === "Present").length,
    absent: deduped.filter((a) => a.status === "Absent").length,
    leave: deduped.filter((a) => a.status === "Leave").length,
    holiday: deduped.filter((a) => a.status === "Holiday").length,
  };
}

/** Extra holidays = absent days beyond free allowance. */
export function computeExtraHolidayCount(absentDays: number, freeAbsentDays: number): number {
  return Math.max(0, absentDays - freeAbsentDays);
}

export function computeExtraHolidayDeduction(extraHolidays: number, rate: number): number {
  return Math.max(0, extraHolidays) * rate;
}

export function computeFinesTotal(fines: StaffFine[]): number {
  return sum(
    fines
      .filter((f) => String((f as { status?: string }).status ?? "active") !== "waived")
      .map((f) => Math.max(0, Number(f.amount) || 0))
  );
}

export function computeExpenseBreakdown(expenses: Expense[]): ExpenseBreakdown {
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    const cat = String(e.category || "Other").trim() || "Other";
    const amt = Math.max(0, Number(e.amount) || 0);
    byCategory[cat] = (byCategory[cat] ?? 0) + amt;
  }
  return { total: sum(Object.values(byCategory)), byCategory };
}

export function computeFinalSalary(parts: {
  basicSalary: number;
  incentiveAmount: number;
  homeVisitIncome: number;
  otAmount: number;
  finesTotal: number;
  extraHolidayDeduction: number;
  otherDeductions: number;
}): SalaryBreakdown {
  const basicSalary = Math.max(0, parts.basicSalary);
  const incentiveAmount = Math.max(0, parts.incentiveAmount);
  const homeVisitIncome = Math.max(0, parts.homeVisitIncome);
  const otAmount = Math.max(0, parts.otAmount);
  const finesTotal = Math.max(0, parts.finesTotal);
  const extraHolidayDeduction = Math.max(0, parts.extraHolidayDeduction);
  const otherDeductions = Math.max(0, parts.otherDeductions);

  const additions = basicSalary + incentiveAmount + homeVisitIncome + otAmount;
  const deductions = finesTotal + extraHolidayDeduction + otherDeductions;
  const finalSalary = Math.max(0, additions - deductions);

  return {
    basicSalary,
    incentiveAmount,
    homeVisitIncome,
    otAmount,
    finesTotal,
    extraHolidayDeduction,
    otherDeductions,
    finalSalary,
  };
}

/** Revenue from paid, non-deleted clinic/home visits and IP payments. */
export function computeVisitRevenue(visits: Visit[]): number {
  return sum(
    visits
      .filter((v) => isPaidPaymentStatus(v.paymentStatus))
      .map((v) => Math.max(0, Number(v.paymentAmount) || 0))
  );
}

export function computeInPatientPaymentRevenue(amounts: number[]): number {
  return sum(amounts.map((a) => Math.max(0, a)));
}

export function computeRevenueBreakdown(
  visits: Visit[],
  inpatientPayments: number[],
  dischargePayments: number[]
): RevenueBreakdown {
  const paidVisits = visits.filter((v) => isPaidPaymentStatus(v.paymentStatus));
  const clinicVisits = sum(
    paidVisits
      .filter((v) => normalizeVisitType((v as { visitType?: string; type?: string }).visitType ?? (v as any).type) === "clinic")
      .map((v) => Number(v.paymentAmount) || 0)
  );
  const homeVisits = sum(
    paidVisits
      .filter((v) => normalizeVisitType((v as { visitType?: string; type?: string }).visitType ?? (v as any).type) === "home")
      .map((v) => Number(v.paymentAmount) || 0)
  );
  const inpatientSessions = computeInPatientPaymentRevenue([...inpatientPayments, ...dischargePayments]);
  return {
    clinicVisits,
    homeVisits,
    inpatientSessions,
    total: clinicVisits + homeVisits + inpatientSessions,
  };
}

/** Next session number from existing numbers (safe after soft-deletes). */
export function computeNextSessionNumber(existing: number | number[]): number {
  if (typeof existing === "number") {
    return Number.isFinite(existing) ? Math.max(1, Math.floor(existing) + 1) : 1;
  }
  // Ignore null/NaN/non-finite rows so a single corrupt session number can't
  // propagate NaN and break visit creation (Zod rejects NaN on insert).
  const valid = existing
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.max(0, Math.floor(n)));
  if (!valid.length) return 1;
  return Math.max(...valid) + 1;
}

export function visitMatchesStaff(
  v: Visit,
  staffId: string,
  staffName: string
): boolean {
  if (v.treatingStaffId === staffId) return true;
  const name = String(staffName || "").trim().toLowerCase();
  return !!name && String(v.treatingStaffName || "").trim().toLowerCase() === name;
}

export function sessionMatchesStaff(
  s: InPatientSession,
  staffId: string,
  staffName: string
): boolean {
  if (s.treatingStaffId === staffId) return true;
  const name = String(staffName || "").trim().toLowerCase();
  return !!name && String(s.treatingStaffName || "").trim().toLowerCase() === name;
}
