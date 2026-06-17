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

function activeFineAmount(fines: { amount: string; status?: string | null }[]): number {
  return fines
    .filter((f) => String(f.status ?? "active") !== "waived")
    .reduce((a, f) => a + Math.max(0, Number(f.amount) || 0), 0);
}

function sumDeductions(rows: StaffDeduction[]): number {
  return rows.reduce((a, d) => a + Math.max(0, Number(d.amount) || 0), 0);
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

  const base = computePayrollForStaff(staff, visits, attendance, ipSessions, fines, rangeFrom, rangeTo, settings);
  const staffDeductionsTotal = sumDeductions(deductions);
  const otExtra = sumOtEntries(otEntries, settings.otPerHour);

  const otherAdjustments = Number(staff.otherAdjustments || 0);
  const otherDeductions =
    staffDeductionsTotal + (otherAdjustments < 0 ? Math.abs(otherAdjustments) : 0);
  const otherCredits = otherAdjustments > 0 ? otherAdjustments : 0;

  const totalOt = base.totalOt + otExtra.hours;
  const otIncome = base.otIncome + otExtra.amount;
  const finalSalary = Math.max(
    0,
    base.basicSalary +
      base.incentiveTotal +
      base.homeIncome +
      otIncome -
      base.finesTotal -
      base.extraHolidayDeduction -
      otherDeductions +
      otherCredits
  );

  return {
    ...base,
    totalOt,
    otIncome,
    staffDeductionsTotal,
    otEntriesAmount: otExtra.amount,
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
  if (existing && existing.status !== "Cancelled") {
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
    summary.finesTotal + summary.extraHolidayDeduction + (summary as any).staffDeductionsTotal;

  const record = await storage.createSalaryRecord({
    staffId,
    staffName: staff.name,
    salaryMonth: salaryMonthKey(periodStart),
    periodStart,
    periodEnd,
    basicSalary: String(summary.basicSalary),
    incentiveAmount: String(summary.incentiveTotal),
    homeVisitAmount: String(summary.homeIncome),
    otAmount: String(summary.otIncome),
    finesTotal: String(summary.finesTotal),
    extraHolidayDeduction: String(summary.extraHolidayDeduction),
    otherDeductions: String((summary as any).staffDeductionsTotal ?? 0),
    deductionsTotal: String(deductionsTotal),
    finalSalary: String(summary.finalSalary),
    status: "Generated",
    breakdown: JSON.stringify(summary),
    generatedByStaffId,
    generatedByName,
  } as any);

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
  generatedByName: string
): Promise<{ created: Salary[]; errors: Array<{ staffId: string; error: string }> }> {
  let targets: string[];
  if (staffIds === "all") {
    const allStaff = await storage.getAllStaff();
    targets = allStaff
      .filter((s) => s.role === "Physiotherapist" || s.role === "Staff")
      .map((s) => s.id);
  } else {
    targets = staffIds;
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

export async function getSalaryDashboardData(storage: IStorage): Promise<SalaryDashboard> {
  const records = await storage.getAllSalaries();
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

  const deductions = await storage.getAllStaffDeductions();
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
