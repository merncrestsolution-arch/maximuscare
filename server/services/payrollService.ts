import type { IStorage } from "../storage";
import type {
  Staff,
  Visit,
  Attendance,
  InPatientSession,
  StaffFine,
  StaffSalaryAdjustment,
  StaffDeduction,
} from "@shared/schema";
import { normalizeBranchName } from "@shared/branches";
import { isClinicalRole } from "@shared/roles";
import {
  DEFAULT_RATES,
  type CalculationRates,
  inDateRange,
  visitMatchesStaff,
  sessionMatchesStaff,
  computeDailyIncentivesForRange,
  computeHomeVisitBreakdown,
  computeOtAmount,
  dedupeAttendanceByDate,
  computeExtraHolidayCount,
  computeExtraHolidayDeduction,
  computeFinesTotal,
  computeFinalSalary,
  computeMonthlyIncentiveAmount,
  normalizeVisitType,
} from "./calculationEngine";

export const PAYROLL_RATES = DEFAULT_RATES;

export interface PayrollSettings extends CalculationRates {
  incentiveEnabled: boolean;
  clinicLocationScope: string;
  autoFineAmount: number;
}

export interface IncentiveDay {
  date: string;
  colomboClinicVisits: number;
  inpatientSessions: number;
  count: number;
  incentive: number;
}

export interface BranchVisitBreakdown {
  branch: string;
  clinic: number;
  home: number;
  total: number;
}

export interface PayrollSummary {
  staffId: string;
  name: string;
  basicSalary: number;
  otherAdjustments: number;
  colomboHome: number;
  colomboClinic: number;
  bandaragamaHome: number;
  bandaragamaClinic: number;
  /** Per-branch visit counts across every branch the therapist worked in (incl. Neuro, Nexus). */
  visitsByBranch: BranchVisitBreakdown[];
  totalClinicVisits: number;
  totalHomeVisits: number;
  presentDays: number;
  absentDays: number;
  totalOt: number;
  homeIncome: number;
  otIncome: number;
  incentiveTotal: number;
  incentiveDays: IncentiveDay[];
  incentiveCount: number;
  extraHolidays: number;
  extraHolidayDeduction: number;
  finesTotal: number;
  additionsTotal?: number;
  decrementsTotal?: number;
  inPatientSessionsCount: number;
  finalSalary: number;
  staffDeductionsTotal?: number;
  otEntriesAmount?: number;
}

export async function loadPayrollSettings(storage: IStorage): Promise<PayrollSettings> {
  const incentive = await storage.getIncentiveSettings();
  const clinic = await storage.getClinicSettings();
  return {
    incentiveEnabled: String(incentive?.incentiveEnabled ?? "true").toLowerCase() === "true",
    incentiveMinCount: incentive?.minPatientsForIncentive ?? DEFAULT_RATES.incentiveMinCount,
    incentivePerCount: incentive?.incentivePerPatient ?? DEFAULT_RATES.incentivePerCount,
    clinicLocationScope: incentive?.clinicLocationScope ?? "Colombo",
    autoFineAmount: Number(clinic?.autoFineAmount ?? DEFAULT_RATES.autoFineAmount),
    homeColombo: Number(clinic?.homeRateColombo ?? DEFAULT_RATES.homeColombo),
    homeBandaragama: Number(clinic?.homeRateBandaragama ?? DEFAULT_RATES.homeBandaragama),
    otPerHour: Number(clinic?.otRatePerHour ?? DEFAULT_RATES.otPerHour),
    extraHolidayDeduction: Number(clinic?.extraHolidayDeduction ?? DEFAULT_RATES.extraHolidayDeduction),
    freeAbsentDays: clinic?.freeAbsentDays ?? DEFAULT_RATES.freeAbsentDays,
  };
}

function scopeMatchesVisit(scope: string, branch: string): boolean {
  if (scope === "All") return true;
  return branch === scope;
}

export function computePayrollForStaff(
  staff: Staff,
  visits: Visit[],
  attendance: Attendance[],
  ipSessions: InPatientSession[],
  fines: StaffFine[],
  rangeFrom: string,
  rangeTo: string,
  settings: PayrollSettings
): PayrollSummary {
  const physioVisits = visits.filter(
    (v) => visitMatchesStaff(v, staff.id, staff.name) && inDateRange(v.visitDate, rangeFrom, rangeTo)
  );

  // Compare on normalized branch names so legacy labels (e.g. "Colombo" -> "Dehiwala")
  // match the stored value.
  const colomboClinic = physioVisits.filter(
    (v) =>
      normalizeBranchName(v.branch) === "Dehiwala" &&
      normalizeVisitType((v as { visitType?: string; type?: string }).visitType ?? (v as any).type) === "clinic"
  ).length;
  const bandaragamaClinic = physioVisits.filter(
    (v) =>
      normalizeBranchName(v.branch) === "Bandaragama" &&
      normalizeVisitType((v as { visitType?: string; type?: string }).visitType ?? (v as any).type) === "clinic"
  ).length;

  // Dynamic per-branch breakdown so cases from EVERY branch the therapist
  // worked in (Dehiwala, Bandaragama, Neuro, Nexus, …) are represented, not
  // just the four hardcoded Colombo/Bandaragama buckets.
  const branchMap = new Map<string, { clinic: number; home: number }>();
  for (const v of physioVisits) {
    const branch = normalizeBranchName(v.branch) || "Unknown";
    const entry = branchMap.get(branch) ?? { clinic: 0, home: 0 };
    if (normalizeVisitType((v as { visitType?: string; type?: string }).visitType ?? (v as any).type) === "home") {
      entry.home += 1;
    }
    else entry.clinic += 1;
    branchMap.set(branch, entry);
  }
  const visitsByBranch: BranchVisitBreakdown[] = Array.from(branchMap.entries())
    .map(([branch, c]) => ({ branch, clinic: c.clinic, home: c.home, total: c.clinic + c.home }))
    .sort((a, b) => a.branch.localeCompare(b.branch));
  const totalClinicVisits = visitsByBranch.reduce((sum, b) => sum + b.clinic, 0);
  const totalHomeVisits = visitsByBranch.reduce((sum, b) => sum + b.home, 0);

  const rangeAttendance = attendance.filter(
    (a) => a.staffId === staff.id && inDateRange(a.date, rangeFrom, rangeTo)
  );
  const deduped = dedupeAttendanceByDate(rangeAttendance);
  const presentDays = deduped.filter((a) => a.status === "Present").length;
  const absentDays = deduped.filter((a) => a.status === "Absent").length;

  const totalOt = deduped
    .filter((a) => a.status === "Present")
    .reduce((acc, a) => {
      const val = Number(a.overtimeHours);
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);

  const scopedClinicVisits = physioVisits.filter(
    (v) =>
      normalizeVisitType((v as { visitType?: string; type?: string }).visitType ?? (v as any).type) === "clinic" &&
      scopeMatchesVisit(settings.clinicLocationScope, v.branch)
  );

  const ipForStaff = ipSessions.filter(
    (s) => sessionMatchesStaff(s, staff.id, staff.name) && inDateRange(s.sessionDate, rangeFrom, rangeTo)
  );

  const colomboClinicByDay: Record<string, number> = {};
  for (const v of scopedClinicVisits) {
    colomboClinicByDay[v.visitDate] = (colomboClinicByDay[v.visitDate] || 0) + 1;
  }
  const ipByDay: Record<string, number> = {};
  for (const s of ipForStaff) {
    ipByDay[s.sessionDate] = (ipByDay[s.sessionDate] || 0) + 1;
  }

  const dailyIncentives = computeDailyIncentivesForRange(
    colomboClinicByDay,
    ipByDay,
    rangeFrom,
    rangeTo,
    settings,
    settings.incentiveEnabled
  );

  const incentiveDays: IncentiveDay[] = dailyIncentives.map((d) => ({
    date: d.date,
    colomboClinicVisits: d.colomboClinicVisits,
    inpatientSessions: d.inpatientSessions,
    count: d.count,
    incentive: d.amount,
  }));
  const incentiveTotal = computeMonthlyIncentiveAmount(dailyIncentives.map((d) => d.amount));
  const incentiveCount = dailyIncentives.reduce((acc, d) => acc + d.count, 0);

  const homeVisits = physioVisits.filter(
    (v) => normalizeVisitType((v as { visitType?: string; type?: string }).visitType ?? (v as any).type) === "home"
  );
  const homeBreakdown = computeHomeVisitBreakdown(homeVisits, settings);

  const otIncome = computeOtAmount(totalOt, settings.otPerHour);
  const extraHolidays = computeExtraHolidayCount(absentDays, settings.freeAbsentDays);
  const extraHolidayDeduction = computeExtraHolidayDeduction(extraHolidays, settings.extraHolidayDeduction);
  const basicSalary = Number(staff.basicSalary || 0);
  const otherAdjustments = Number(staff.otherAdjustments || 0);
  const staffFines = fines.filter((f) => f.staffId === staff.id);
  const finesTotal = computeFinesTotal(staffFines);

  const base = computeFinalSalary({
    basicSalary,
    incentiveAmount: incentiveTotal,
    homeVisitIncome: homeBreakdown.income,
    otAmount: otIncome,
    finesTotal,
    extraHolidayDeduction,
    otherDeductions: otherAdjustments < 0 ? Math.abs(otherAdjustments) : 0,
  });
  const finalSalary = Math.max(0, base.finalSalary + (otherAdjustments > 0 ? otherAdjustments : 0));

  return {
    staffId: staff.id,
    name: staff.name,
    basicSalary,
    otherAdjustments,
    colomboHome: homeBreakdown.colomboVisits,
    colomboClinic,
    bandaragamaHome: homeBreakdown.bandaragamaVisits,
    bandaragamaClinic,
    visitsByBranch,
    totalClinicVisits,
    totalHomeVisits,
    presentDays,
    absentDays,
    totalOt,
    homeIncome: homeBreakdown.income,
    otIncome,
    incentiveTotal,
    incentiveDays,
    incentiveCount,
    extraHolidays,
    extraHolidayDeduction,
    finesTotal,
    inPatientSessionsCount: ipForStaff.length,
    finalSalary,
  };
}

function sumAdjustments(rows: StaffSalaryAdjustment[], type: "addition" | "decrement" | "fine"): number {
  return rows
    .filter((r) => r.type === type)
    .reduce((acc, r) => acc + Math.max(0, Number(r.amount) || 0), 0);
}

function sumDeductions(rows: StaffDeduction[]): number {
  return rows.reduce((acc, r) => acc + Math.max(0, Number(r.amount) || 0), 0);
}

export async function computePayrollReport(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  staffIds?: string[]
): Promise<{ settings: PayrollSettings; summaries: PayrollSummary[] }> {
  const settings = await loadPayrollSettings(storage);
  const allStaff = await storage.getAllStaff();
  const targets = allStaff.filter((s) => {
    if (!isClinicalRole(s.role)) return false;
    if (staffIds?.length && !staffIds.includes(s.id)) return false;
    return true;
  });

  const visits = await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  const attendance = await storage.getAttendanceByDateRange(rangeFrom, rangeTo);
  const ipSessions = await storage.getAllInPatientSessionsInDateRange(rangeFrom, rangeTo);
  const fines = await storage.getStaffFinesByDateRange(rangeFrom, rangeTo);
  const adjustments = await storage.getStaffSalaryAdjustmentsByDateRange(rangeFrom, rangeTo);
  const deductions = await storage.getStaffDeductionsByDateRange(rangeFrom, rangeTo);

  const adjustmentsByStaff = new Map<string, StaffSalaryAdjustment[]>();
  for (const adj of adjustments) {
    const list = adjustmentsByStaff.get(adj.staffId) ?? [];
    list.push(adj);
    adjustmentsByStaff.set(adj.staffId, list);
  }
  const deductionsByStaff = new Map<string, StaffDeduction[]>();
  for (const row of deductions) {
    const list = deductionsByStaff.get(row.staffId) ?? [];
    list.push(row);
    deductionsByStaff.set(row.staffId, list);
  }

  const summaries = targets.map((s) => {
    const base = computePayrollForStaff(s, visits, attendance, ipSessions, fines, rangeFrom, rangeTo, settings);
    const staffAdjustments = adjustmentsByStaff.get(s.id) ?? [];
    const staffDeductions = deductionsByStaff.get(s.id) ?? [];
    const additionsTotal = sumAdjustments(staffAdjustments, "addition");
    const decrementsTotal = sumAdjustments(staffAdjustments, "decrement");
    const fineAdjustmentsTotal = sumAdjustments(staffAdjustments, "fine");
    const staffDeductionsTotal = sumDeductions(staffDeductions);
    const otherAdjustments = Number(base.otherAdjustments || 0);
    const otherCredits = otherAdjustments > 0 ? otherAdjustments : 0;
    const otherDeductions = (otherAdjustments < 0 ? Math.abs(otherAdjustments) : 0) + staffDeductionsTotal + decrementsTotal;
    const finesTotal = base.finesTotal + fineAdjustmentsTotal;
    const finalSalary = Math.max(
      0,
      base.basicSalary +
        base.incentiveTotal +
        base.homeIncome +
        base.otIncome +
        additionsTotal +
        otherCredits -
        finesTotal -
        base.extraHolidayDeduction -
        otherDeductions
    );
    return {
      ...base,
      additionsTotal,
      decrementsTotal,
      staffDeductionsTotal,
      finesTotal,
      finalSalary,
    };
  });

  return { settings, summaries };
}

/** Persist immutable salary snapshot + daily incentive rows (Part 2/3 policy). */
export async function persistPayrollSnapshotRecords(
  storage: IStorage,
  summary: PayrollSummary,
  periodStart: string
): Promise<void> {
  const deductionsTotal =
    summary.finesTotal +
    summary.extraHolidayDeduction +
    Math.max(0, -summary.otherAdjustments) +
    Number(summary.staffDeductionsTotal ?? 0) +
    Number(summary.decrementsTotal ?? 0);

  await storage.createSalaryRecord({
    staffId: summary.staffId,
    salaryMonth: periodStart.slice(0, 7) + "-01",
    basicSalary: String(summary.basicSalary),
    incentiveAmount: String(summary.incentiveTotal),
    homeVisitAmount: String(summary.homeIncome),
    otAmount: String(summary.otIncome),
    finesTotal: String(summary.finesTotal),
    deductionsTotal: String(deductionsTotal),
    finalSalary: String(summary.finalSalary),
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
}
