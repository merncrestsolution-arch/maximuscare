import type { IStorage } from "../storage";
import type { Salary, Staff, StaffDeduction, StaffOtEntry } from "@shared/schema";
import { PAYMENT_METHODS } from "@shared/schema";
import {
  computePayrollForStaff,
  computePayrollReport,
  loadPayrollSettings,
  type PayrollSummary,
} from "./payrollService";
import { computeOtAmount } from "./calculationEngine";
import { normalizeBranchName, getHomeVisitRateTier } from "@shared/branches";
import { clinicDateString } from "../clinicTime";

export interface SalaryPreview {
  staff: {
    id: string;
    name: string;
    email: string;
    role: string;
    branch: string | null;
    basicSalary: string;
    salaryDate: string | null;
    joiningDate: string | null;
    isActive: boolean;
  };
  periodStart: string;
  periodEnd: string;
  summary: PayrollSummary;
  attendanceSummary: { present: number; absent: number };
  visitSummary: { colomboClinic: number; bandaragamaClinic: number; colomboHome: number; bandaragamaHome: number };
  sessionSummary: { count: number };
  deductions: StaffDeduction[];
  otEntries: StaffOtEntry[];
}

export interface SalaryDashboard {
  totalPayable: number;
  paidSalary: number;
  pendingSalary: number;
  approvedSalary: number;
  draftSalary: number;
  generatedSalary: number;
  trend: Array<{ month: string; amount: number }>;
  branchComparison: Array<{ branch: string; amount: number }>;
  topEarners: Array<{ staffId: string; staffName: string; amount: number }>;
  deductionAnalysis: Array<{ category: string; amount: number }>;
}

function salaryMonthKey(periodStart: string): string {
  return `${periodStart.slice(0, 7)}-01`;
}

export function salaryPeriodForDate(dateStr: string): { periodStart: string; periodEnd: string; salaryMonth: string } {
  const [yearRaw, monthRaw] = String(dateStr).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
  const mm = String(safeMonth).padStart(2, "0");
  const lastDay = new Date(safeYear, safeMonth, 0).getDate();
  const periodStart = `${safeYear}-${mm}-01`;
  const periodEnd = `${safeYear}-${mm}-${String(lastDay).padStart(2, "0")}`;
  return { periodStart, periodEnd, salaryMonth: salaryMonthKey(periodStart) };
}

export async function ensureSalaryPeriodRecord(
  storage: IStorage,
  staffId: string,
  periodStart: string,
  periodEnd: string
): Promise<Salary> {
  const salaryMonth = salaryMonthKey(periodStart);
  const existing = await storage.getSalaryByStaffAndMonth(staffId, salaryMonth);
  if (existing) return existing;
  const staff = await storage.getStaff(staffId);
  if (!staff) throw new Error("Staff not found");
  const record = await storage.createSalaryRecord({
    staffId,
    staffName: staff.name,
    salaryMonth,
    periodStart,
    periodEnd,
    basicSalary: staff.basicSalary ?? "0",
    status: "Draft",
  } as any);
  return record;
}

function activeFineAmount(fines: { amount: string; status?: string | null }[]): number {
  return fines
    .filter((f) => String(f.status ?? "active") !== "waived")
    .reduce((a, f) => a + Math.max(0, Number(f.amount) || 0), 0);
}

function sumDeductions(rows: StaffDeduction[]): number {
  return rows.reduce((a, d) => a + Math.max(0, Number(d.amount) || 0), 0);
}

function sumAdjustments(rows: { type: string; amount: string }[], type: "addition" | "decrement" | "fine"): number {
  return rows
    .filter((a) => String(a.type).toLowerCase() === type)
    .reduce((acc, a) => acc + Math.max(0, Number(a.amount) || 0), 0);
}

function sumOtEntries(rows: StaffOtEntry[], otPerHour: number): { hours: number; amount: number } {
  const hours = rows.reduce((a, o) => a + Math.max(0, Number(o.hours) || 0), 0);
  return { hours, amount: computeOtAmount(hours, otPerHour) };
}

export async function buildEnhancedPayrollSummary(
  storage: IStorage,
  staff: Staff,
  rangeFrom: string,
  rangeTo: string
): Promise<PayrollSummary> {
  const settings = await loadPayrollSettings(storage);
  const visits = await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  const attendance = await storage.getAttendanceByDateRange(rangeFrom, rangeTo);
  const ipSessions = await storage.getAllInPatientSessionsInDateRange(rangeFrom, rangeTo);
  const fines = await storage.getStaffFinesByStaffAndDateRange(staff.id, rangeFrom, rangeTo);
  const deductions = await storage.getStaffDeductionsByStaffAndRange(staff.id, rangeFrom, rangeTo);
  const otEntries = await storage.getStaffOtEntriesByStaffAndRange(staff.id, rangeFrom, rangeTo);
  const adjustments = await storage.getStaffSalaryAdjustmentsByStaffAndRange(staff.id, rangeFrom, rangeTo);

  const base = computePayrollForStaff(staff, visits, attendance, ipSessions, fines, rangeFrom, rangeTo, settings);
  const staffDeductionsTotal = sumDeductions(deductions);
  const otExtra = sumOtEntries(otEntries, settings.otPerHour);
  const additionsTotal = sumAdjustments(adjustments, "addition");
  const decrementsTotal = sumAdjustments(adjustments, "decrement");
  const fineAdjustmentsTotal = sumAdjustments(adjustments, "fine");

  const otherAdjustments = Number(staff.otherAdjustments || 0);
  const otherDeductions =
    staffDeductionsTotal + decrementsTotal + (otherAdjustments < 0 ? Math.abs(otherAdjustments) : 0);
  const otherCredits = otherAdjustments > 0 ? otherAdjustments : 0;

  const totalOt = base.totalOt + otExtra.hours;
  const otIncome = base.otIncome + otExtra.amount;
  const finesTotal = base.finesTotal + fineAdjustmentsTotal;
  const finalSalary = Math.max(
    0,
    base.basicSalary +
      base.incentiveTotal +
      base.homeIncome +
      otIncome +
      additionsTotal -
      finesTotal -
      base.extraHolidayDeduction -
      otherDeductions +
      otherCredits
  );

  return {
    ...base,
    totalOt,
    otIncome,
    finesTotal,
    staffDeductionsTotal,
    otEntriesAmount: otExtra.amount,
    additionsTotal,
    decrementsTotal,
    otherAdjustments,
    finalSalary,
  } as PayrollSummary & { staffDeductionsTotal: number; otEntriesAmount: number };
}

export async function previewSalary(
  storage: IStorage,
  staffId: string,
  periodStart: string,
  periodEnd: string
): Promise<SalaryPreview | null> {
  const staff = await storage.getStaff(staffId);
  if (!staff) return null;

  const summary = await buildEnhancedPayrollSummary(storage, staff, periodStart, periodEnd);
  const deductions = await storage.getStaffDeductionsByStaffAndRange(staffId, periodStart, periodEnd);
  const otEntries = await storage.getStaffOtEntriesByStaffAndRange(staffId, periodStart, periodEnd);

  return {
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      branch: staff.branch,
      basicSalary: staff.basicSalary,
      salaryDate: staff.salaryDate,
      joiningDate: staff.joiningDate,
      isActive: staff.isActive,
    },
    periodStart,
    periodEnd,
    summary,
    attendanceSummary: { present: summary.presentDays, absent: summary.absentDays },
    visitSummary: {
      colomboClinic: summary.colomboClinic,
      bandaragamaClinic: summary.bandaragamaClinic,
      colomboHome: summary.colomboHome,
      bandaragamaHome: summary.bandaragamaHome,
    },
    sessionSummary: { count: summary.inPatientSessionsCount },
    deductions,
    otEntries,
  };
}

export async function assertNoDuplicateSalary(
  storage: IStorage,
  staffId: string,
  periodStart: string
): Promise<void> {
  const month = salaryMonthKey(periodStart);
  const existing = await storage.getSalaryByStaffAndMonth(staffId, month);
  if (existing && !["Cancelled", "Draft"].includes(existing.status ?? "")) {
    throw new Error(`Salary already generated for ${month.slice(0, 7)} (status: ${existing.status})`);
  }
}

export async function generateSalaryRecord(
  storage: IStorage,
  staffId: string,
  periodStart: string,
  periodEnd: string,
  generatedByStaffId: string,
  generatedByName: string
): Promise<Salary> {
  await assertNoDuplicateSalary(storage, staffId, periodStart);
  const staff = await storage.getStaff(staffId);
  if (!staff) throw new Error("Staff not found");

  const summary = await buildEnhancedPayrollSummary(storage, staff, periodStart, periodEnd);
  if (summary.finalSalary < 0) throw new Error("Final salary cannot be negative");

  const deductionsTotal =
    summary.finesTotal +
    summary.extraHolidayDeduction +
    (summary as any).staffDeductionsTotal +
    (summary as any).decrementsTotal;

  const month = salaryMonthKey(periodStart);
  const existing = await storage.getSalaryByStaffAndMonth(staffId, month);
  const payload = {
    staffId,
    staffName: staff.name,
    salaryMonth: month,
    periodStart,
    periodEnd,
    basicSalary: String(summary.basicSalary),
    incentiveAmount: String(summary.incentiveTotal),
    homeVisitAmount: String(summary.homeIncome),
    otAmount: String(summary.otIncome),
    finesTotal: String(summary.finesTotal),
    extraHolidayDeduction: String(summary.extraHolidayDeduction),
    otherDeductions: String(
      Number((summary as any).staffDeductionsTotal ?? 0) + Number((summary as any).decrementsTotal ?? 0)
    ),
    deductionsTotal: String(deductionsTotal),
    finalSalary: String(summary.finalSalary),
    status: "Generated",
    breakdown: JSON.stringify(summary),
    generatedByStaffId,
    generatedByName,
  } as any;
  const record = existing?.status === "Draft"
    ? await storage.updateSalary(existing.id, payload)
    : await storage.createSalaryRecord(payload);
  if (!record) throw new Error("Failed to generate salary");

  for (const day of summary.incentiveDays) {
    await storage.upsertStaffIncentiveRecord({
      staffId: summary.staffId,
      incentiveDate: day.date,
      clinicVisits: day.colomboClinicVisits,
      inpatientSessions: day.inpatientSessions,
      incentiveCount: day.count,
      incentiveAmount: String(day.incentive),
    } as any);
  }

  return record;
}

export async function generateSalariesBulk(
  storage: IStorage,
  staffIds: string[] | "all",
  periodStart: string,
  periodEnd: string,
  generatedByStaffId: string,
  generatedByName: string,
  /**
   * When provided, "all" is restricted to this set of staff IDs (e.g. the staff of
   * the currently selected branch) so bulk generation never spills across branches.
   */
  allowedStaffIds?: Set<string>
): Promise<{ created: Salary[]; errors: Array<{ staffId: string; error: string }> }> {
  let targets: string[];
  if (staffIds === "all") {
    const allStaff = await storage.getAllStaff();
    targets = allStaff
      .filter((s) => s.role === "Physiotherapist" || s.role === "Staff" || s.role === "Manager")
      .filter((s) => !allowedStaffIds || allowedStaffIds.has(s.id))
      .map((s) => s.id);
  } else {
    targets = allowedStaffIds ? staffIds.filter((id) => allowedStaffIds.has(id)) : staffIds;
  }

  const created: Salary[] = [];
  const errors: Array<{ staffId: string; error: string }> = [];

  for (const staffId of targets) {
    try {
      const record = await generateSalaryRecord(
        storage,
        staffId,
        periodStart,
        periodEnd,
        generatedByStaffId,
        generatedByName
      );
      created.push(record);
    } catch (e: any) {
      errors.push({ staffId, error: e.message || "Failed" });
    }
  }

  return { created, errors };
}

export async function approveSalary(
  storage: IStorage,
  salaryId: string,
  approvedByStaffId: string,
  approvedByName: string
): Promise<Salary> {
  const salary = await storage.getSalary(salaryId);
  if (!salary) throw new Error("Salary record not found");
  if (salary.status !== "Generated") throw new Error(`Cannot approve salary in status: ${salary.status}`);

  const updated = await storage.updateSalary(salaryId, {
    status: "Approved",
    approvedByStaffId,
    approvedByName,
    approvedAt: new Date(),
  } as any);
  if (!updated) throw new Error("Failed to approve salary");
  return updated;
}

export async function rejectSalary(
  storage: IStorage,
  salaryId: string,
  reason: string
): Promise<Salary> {
  const salary = await storage.getSalary(salaryId);
  if (!salary) throw new Error("Salary record not found");
  if (!["Generated", "Approved"].includes(salary.status)) {
    throw new Error(`Cannot reject salary in status: ${salary.status}`);
  }

  const updated = await storage.updateSalary(salaryId, {
    status: "Cancelled",
    rejectedReason: reason,
  } as any);
  if (!updated) throw new Error("Failed to reject salary");
  return updated;
}

export async function returnSalaryForReview(
  storage: IStorage,
  salaryId: string,
  reason: string
): Promise<Salary> {
  const salary = await storage.getSalary(salaryId);
  if (!salary) throw new Error("Salary record not found");
  if (salary.status !== "Approved") throw new Error("Only approved salaries can be returned for review");

  const updated = await storage.updateSalary(salaryId, {
    status: "Generated",
    approvedByStaffId: null,
    approvedByName: null,
    approvedAt: null,
    rejectedReason: reason,
  } as any);
  if (!updated) throw new Error("Failed to return salary for review");
  return updated;
}

export async function markSalaryPaid(
  storage: IStorage,
  salaryId: string,
  payment: {
    paymentMethod: string;
    paymentReference?: string;
    paymentRemarks?: string;
    paidByStaffId: string;
  }
): Promise<Salary> {
  const salary = await storage.getSalary(salaryId);
  if (!salary) throw new Error("Salary record not found");
  if (salary.status === "Paid") throw new Error("Salary already marked as paid");
  if (salary.status !== "Approved") throw new Error("Only approved salaries can be marked paid");
  if (!PAYMENT_METHODS.includes(payment.paymentMethod as (typeof PAYMENT_METHODS)[number])) {
    throw new Error("Invalid payment method");
  }

  const updated = await storage.updateSalary(salaryId, {
    status: "Paid",
    paidAt: new Date(),
    paymentMethod: payment.paymentMethod,
    paymentReference: payment.paymentReference ?? null,
    paymentRemarks: payment.paymentRemarks ?? null,
    paidByStaffId: payment.paidByStaffId,
  } as any);
  if (!updated) throw new Error("Failed to mark salary paid");
  return updated;
}

export async function getSalaryDashboardData(
  storage: IStorage,
  /** When provided, all dashboard figures are scoped to these staff (selected branch). */
  allowedStaffIds?: Set<string>
): Promise<SalaryDashboard> {
  const allRecords = await storage.getAllSalaries();
  const records = allowedStaffIds
    ? allRecords.filter((r) => allowedStaffIds.has(r.staffId))
    : allRecords;
  const active = records.filter((r) => r.status !== "Cancelled");

  const sumStatus = (status: string) =>
    active.filter((r) => r.status === status).reduce((a, r) => a + Number(r.finalSalary || 0), 0);

  const paidSalary = sumStatus("Paid");
  const approvedSalary = sumStatus("Approved");
  const draftSalary = sumStatus("Draft");
  const generatedSalary = sumStatus("Generated");
  const pendingSalary = approvedSalary + generatedSalary;
  const totalPayable = active.reduce((a, r) => a + Number(r.finalSalary || 0), 0);

  const monthMap = new Map<string, number>();
  for (const r of active) {
    const m = String(r.salaryMonth).slice(0, 7);
    monthMap.set(m, (monthMap.get(m) ?? 0) + Number(r.finalSalary || 0));
  }
  const trend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, amount]) => ({ month, amount }));

  const branchMap = new Map<string, number>();
  const staffList = await storage.getAllStaff();
  const staffBranch = new Map(staffList.map((s) => [s.id, s.branch || "Unassigned"]));
  for (const r of active) {
    const branch = staffBranch.get(r.staffId) || "Unassigned";
    branchMap.set(branch, (branchMap.get(branch) ?? 0) + Number(r.finalSalary || 0));
  }
  const branchComparison = Array.from(branchMap.entries()).map(([branch, amount]) => ({ branch, amount }));

  const earnerMap = new Map<string, { staffName: string; amount: number }>();
  for (const r of active) {
    const cur = earnerMap.get(r.staffId) ?? { staffName: r.staffName || "", amount: 0 };
    cur.amount += Number(r.finalSalary || 0);
    if (r.staffName) cur.staffName = r.staffName;
    earnerMap.set(r.staffId, cur);
  }
  const topEarners = Array.from(earnerMap.entries())
    .map(([staffId, v]) => ({ staffId, staffName: v.staffName, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const allDeductions = await storage.getAllStaffDeductions();
  const deductions = allowedStaffIds
    ? allDeductions.filter((d) => allowedStaffIds.has(d.staffId))
    : allDeductions;
  const catMap = new Map<string, number>();
  for (const d of deductions) {
    catMap.set(d.category, (catMap.get(d.category) ?? 0) + Number(d.amount || 0));
  }
  const deductionAnalysis = Array.from(catMap.entries()).map(([category, amount]) => ({ category, amount }));

  return {
    totalPayable,
    paidSalary,
    pendingSalary,
    approvedSalary,
    draftSalary,
    generatedSalary,
    trend,
    branchComparison,
    topEarners,
    deductionAnalysis,
  };
}

export async function getSalaryHistory(
  storage: IStorage,
  filters: {
    month?: string;
    year?: string;
    branch?: string;
    staffId?: string;
    status?: string;
  }
): Promise<Salary[]> {
  return storage.getSalariesFiltered(filters);
}

// ── Bug K: full salary report (Reports page) ──
// A self-contained breakdown driven by the Phase-2 spec data model:
//   finalSalary = basicSalary + homeVisitsTotal + otTotal + additionsTotal
//                 - finesTotal - decrementsTotal
// Home visits are auto-calculated per branch using the Phase-1 flat rates (no
// holiday multiplier); additions/fines/decrements are manual entries stored in
// staff_salary_adjustments.
export interface SalaryReportLine {
  id: string;
  date: string;
  reason: string;
  amount: number;
  source?: "adjustment" | "deduction" | "fine";
  category?: string;
  remarks?: string | null;
}

export interface SalaryReportHomeVisit {
  branchName: string;
  branchId: string | null;
  count: number;
  ratePerVisit: number;
  total: number;
}

export interface SalaryReport {
  staffId: string;
  staffName: string;
  branch: string | null;
  period: { startDate: string; endDate: string };
  basicSalary: number;
  incentiveTotal: number;
  extraHolidayDeduction: number;
  homeVisits: SalaryReportHomeVisit[];
  homeVisitsTotal: number;
  otHours: number;
  otRatePerHour: number;
  otTotal: number;
  additions: SalaryReportLine[];
  additionsTotal: number;
  fines: SalaryReportLine[];
  finesTotal: number;
  decrements: SalaryReportLine[];
  decrementsTotal: number;
  finalSalary: number;
}

/** Shared live net-pay calculation — used by salary report view and generate workflow. */
export async function calculateNetPay(
  storage: IStorage,
  staffId: string,
  startDate: string,
  endDate: string,
): Promise<SalaryReport | null> {
  return buildSalaryReport(storage, staffId, startDate, endDate);
}

export interface SalaryHistoryEntry {
  period: string;
  startDate: string;
  endDate: string;
  basicSalary: number;
  finalSalary: number;
  homeVisitsTotal: number;
  otTotal: number;
  finesTotal: number;
  additionsTotal: number;
  decrementsTotal: number;
}

export async function buildSalaryReport(
  storage: IStorage,
  staffId: string,
  startDate: string,
  endDate: string
): Promise<SalaryReport | null> {
  const staff = await storage.getStaff(staffId);
  if (!staff) return null;

  const settings = await loadPayrollSettings(storage);
  const summary = await buildEnhancedPayrollSummary(storage, staff, startDate, endDate);

  // Map branch names → ids so the response can carry both (the spec's model).
  const branchRows = await storage.getAllBranches();
  const branchIdByName = new Map<string, string>();
  for (const b of branchRows as any[]) {
    const key = normalizeBranchName(b.name ?? b.branchName).toLowerCase();
    if (key) branchIdByName.set(key, String(b.id));
  }

  // Per-branch home visits at the Phase-1 flat rate (Bug A: no holiday rate).
  const homeVisits: SalaryReportHomeVisit[] = summary.visitsByBranch
    .filter((b) => b.home > 0)
    .map((b) => {
      const ratePerVisit =
        getHomeVisitRateTier(b.branch) === "bandaragama" ? settings.homeBandaragama : settings.homeColombo;
      return {
        branchName: b.branch,
        branchId: branchIdByName.get(normalizeBranchName(b.branch).toLowerCase()) ?? null,
        count: b.home,
        ratePerVisit,
        total: b.home * ratePerVisit,
      };
    });
  const homeVisitsTotal = homeVisits.reduce((acc, h) => acc + h.total, 0);

  const otHours = Number(summary.totalOt || 0);
  const otRatePerHour = settings.otPerHour;
  const otTotal = Number(summary.otIncome || 0);

  const adjustments = await storage.getStaffSalaryAdjustmentsByStaffAndRange(staffId, startDate, endDate);
  const staffFines = await storage.getStaffFinesByStaffAndDateRange(staffId, startDate, endDate);
  const staffDeductions = await storage.getStaffDeductionsByStaffAndRange(staffId, startDate, endDate);
  const toLine = (a: { id: string; adjustmentDate: string; reason: string; amount: string }): SalaryReportLine => ({
    id: a.id,
    date: a.adjustmentDate,
    reason: a.reason,
    amount: Number(a.amount) || 0,
    source: "adjustment" as const,
  });
  const additions = adjustments.filter((a) => String(a.type).toLowerCase() === "addition").map(toLine);
  const decrements = adjustments.filter((a) => String(a.type).toLowerCase() === "decrement").map(toLine);
  const fineAdjustments = adjustments
    .filter((a) => String(a.type).toLowerCase() === "fine")
    .map((a) => ({ ...toLine(a), source: "fine" as const }));
  const fines = staffFines
    .filter((f) => String(f.status ?? "active") !== "waived")
    .map((f) => ({
      id: f.id,
      date: f.fineDate,
      reason: f.reason,
      amount: Number(f.amount) || 0,
      source: "fine" as const,
    }))
    .concat(fineAdjustments) as SalaryReportLine[];
  const deductionLines = staffDeductions.map((d) => ({
    id: d.id,
    date: d.deductionDate,
    category: d.category,
    remarks: d.remarks,
    reason: d.remarks ? `${d.category} - ${d.remarks}` : d.category,
    amount: Number(d.amount) || 0,
    source: "deduction" as const,
  }));
  const allDecrements = [...decrements, ...deductionLines];

  const sumLines = (rows: SalaryReportLine[]) => rows.reduce((acc, r) => acc + r.amount, 0);
  const additionsTotal = sumLines(additions);
  const finesTotal = sumLines(fines);
  const decrementsTotal = sumLines(allDecrements);

  const basicSalary = Number(staff.basicSalary || 0);
  const incentiveTotal = Number(summary.incentiveTotal || 0);
  const extraHolidayDeduction = Number(summary.extraHolidayDeduction || 0);
  // Align with buildEnhancedPayrollSummary / generateSalaryRecord — live fines & decrements included.
  const finalSalary = Number(summary.finalSalary ?? 0);

  return {
    staffId: staff.id,
    staffName: staff.name,
    branch: staff.branch,
    period: { startDate, endDate },
    basicSalary,
    incentiveTotal,
    extraHolidayDeduction,
    homeVisits,
    homeVisitsTotal,
    otTotal: otTotal,
    otHours,
    otRatePerHour,
    additions,
    additionsTotal,
    fines,
    finesTotal,
    decrements: allDecrements,
    decrementsTotal,
    finalSalary,
  };
}

function monthRange(year: number, month1to12: number): { startDate: string; endDate: string; label: string } {
  const mm = String(month1to12).padStart(2, "0");
  const lastDay = new Date(year, month1to12, 0).getDate();
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    label: new Date(year, month1to12 - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
  };
}

export async function getSalaryReportHistory(
  storage: IStorage,
  staffId: string,
  monthsBack = 6
): Promise<SalaryHistoryEntry[]> {
  const [yStr, mStr] = clinicDateString().split("-");
  const year = Number(yStr);
  const month = Number(mStr); // current month (1-12)

  const entries: SalaryHistoryEntry[] = [];
  for (let i = 1; i <= monthsBack; i++) {
    let m = month - i;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const { startDate, endDate, label } = monthRange(y, m);
    const report = await buildSalaryReport(storage, staffId, startDate, endDate);
    if (!report) continue;
    entries.push({
      period: label,
      startDate,
      endDate,
      basicSalary: report.basicSalary,
      finalSalary: report.finalSalary,
      homeVisitsTotal: report.homeVisitsTotal,
      otTotal: report.otTotal,
      finesTotal: report.finesTotal,
      additionsTotal: report.additionsTotal,
      decrementsTotal: report.decrementsTotal,
    });
  }
  return entries;
}

export async function getSalaryExportRows(storage: IStorage, filters: Parameters<typeof getSalaryHistory>[1]) {
  const records = await getSalaryHistory(storage, filters);
  const staffList = await storage.getAllStaff();
  const staffMap = new Map(staffList.map((s) => [s.id, s]));

  return records.map((r) => {
    const s = staffMap.get(r.staffId);
    return {
      employeeId: r.staffId,
      employeeName: r.staffName || s?.name || "",
      branch: s?.branch || "",
      basicSalary: Number(r.basicSalary),
      incentive: Number(r.incentiveAmount),
      homeVisit: Number(r.homeVisitAmount),
      ot: Number(r.otAmount),
      fines: Number(r.finesTotal),
      deductions: Number(r.deductionsTotal),
      finalSalary: Number(r.finalSalary),
      status: r.status,
      month: String(r.salaryMonth).slice(0, 7),
    };
  });
}
