/**
 * Part 4 — centralized report DTOs. All values derived from calculationEngine / payrollService.
 */
import type { IStorage } from "../storage";
import type { Staff, Visit, Attendance, InPatientSession, StaffFine, Expense } from "@shared/schema";
// StaffFine, Expense used in interfaces
import { clinicDateString } from "../clinicTime";
import { loadPayrollSettings, computePayrollForStaff, computePayrollReport, type PayrollSummary } from "./payrollService";
import {
  computeExpenseBreakdown,
  computeRevenueBreakdown,
  summarizeAttendance,
  isPaidPaymentStatus,
  inDateRange,
  getVisitCollectedRevenue,
  getVisitOutstandingBalance,
} from "./calculationEngine";
import { ENTERPRISE_BRANCHES, normalizeBranchName } from "@shared/branches";

export interface RevenueReport {
  rangeFrom: string;
  rangeTo: string;
  totalRevenue: number;
  paidRevenue: number;
  unpaidRevenue: number;
  outstandingBalance: number;
  breakdown: { clinic: number; home: number; sessions: number };
  byBranch: { branch: string; revenue: number }[];
  dailyTrend: { date: string; revenue: number }[];
}

export interface IncentiveReportRow {
  staffId: string;
  staffName: string;
  clinicVisits: number;
  sessions: number;
  incentiveCount: number;
  incentiveAmount: number;
}

export interface AttendanceReport {
  rangeFrom: string;
  rangeTo: string;
  summary: { present: number; absent: number; leave: number; holiday: number; extraHolidays: number };
  attendancePercent: number;
  byStaff: { staffId: string; staffName: string; present: number; absent: number; leave: number; holiday: number }[];
  records: Attendance[];
}

export interface ExpenseReport {
  rangeFrom: string;
  rangeTo: string;
  total: number;
  byCategory: Record<string, number>;
  items: Expense[];
}

export interface UnpaidVisitRow {
  visitId: string;
  patientId: string;
  patientName: string;
  visitDate: string;
  amount: number;
  outstandingBalance: number;
  branch: string;
  therapistId: string;
  therapistName: string;
  paymentStatus: string;
}

export interface StaffReport {
  staff: Staff;
  rangeFrom: string;
  rangeTo: string;
  payroll: PayrollSummary;
  visits: Visit[];
  sessions: InPatientSession[];
  homeVisits: Visit[];
  fines: StaffFine[];
  attendance: Attendance[];
}

export interface DashboardCharts {
  revenueTrend: { date: string; revenue: number }[];
  attendanceTrend: { date: string; present: number; absent: number; leave: number; holiday: number }[];
  visitAnalytics: { date: string; clinic: number; home: number; sessions: number }[];
  branchRevenue: { branch: string; revenue: number }[];
  topIncentiveStaff: { staffName: string; incentiveCount: number; incentiveAmount: number }[];
}

function groupRevenueByDay(visits: Visit[]): { date: string; revenue: number }[] {
  const byDay = new Map<string, number>();
  for (const v of visits) {
    if (!isPaidPaymentStatus(v.paymentStatus)) continue;
    const amt = Number(v.paymentAmount) || 0;
    byDay.set(v.visitDate, (byDay.get(v.visitDate) ?? 0) + amt);
  }
  return Array.from(byDay.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function computeRevenueReport(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  branchFilter?: string | null
): Promise<RevenueReport> {
  let visits = await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  if (branchFilter) visits = filterVisitsByBranch(visits, branchFilter);
  let unpaidVisits = await storage.getUnpaidVisits();
  if (branchFilter) unpaidVisits = applyBranchFilter(unpaidVisits, branchFilter);

  const paidVisits = visits.filter((v) => isPaidPaymentStatus(v.paymentStatus));
  const unpaidInRange = visits.filter((v) => !isPaidPaymentStatus(v.paymentStatus));
  const paidRevenue = visits.reduce((a, v) => a + getVisitCollectedRevenue(v), 0);
  const unpaidRevenue = unpaidInRange.reduce((a, v) => a + getVisitOutstandingBalance(v), 0);
  const outstandingBalance = unpaidVisits.reduce((a, v) => a + getVisitOutstandingBalance(v), 0);
  const totalRevenue = branchFilter
    ? visits.reduce((a, v) => a + getVisitCollectedRevenue(v), 0)
    : await storage.getTotalIncome(rangeFrom, rangeTo);

  const breakdown = computeRevenueBreakdown(visits, [], []);
  const branchNames = branchFilter
    ? [branchFilter]
    : ENTERPRISE_BRANCHES.map((b) => b.shortName);
  const byBranch = branchNames.map((branch) => ({
    branch,
    revenue: filterVisitsByBranch(visits, branch)
      .filter((v) => isPaidPaymentStatus(v.paymentStatus))
      .reduce((a, v) => a + (Number(v.paymentAmount) || 0), 0),
  }));

  return {
    rangeFrom,
    rangeTo,
    totalRevenue,
    paidRevenue,
    unpaidRevenue,
    outstandingBalance,
    breakdown: { clinic: breakdown.clinicVisits, home: breakdown.homeVisits, sessions: breakdown.inpatientSessions },
    byBranch,
    dailyTrend: groupRevenueByDay(visits),
  };
}

function filterVisitsByBranch(visits: Visit[], branch: string) {
  const target = normalizeBranchName(branch).toLowerCase();
  return visits.filter((v) => normalizeBranchName(v.branch).toLowerCase() === target);
}

function applyBranchFilter<T extends { branch?: string | null }>(items: T[], branchFilter?: string | null): T[] {
  if (!branchFilter) return items;
  const target = normalizeBranchName(branchFilter).toLowerCase();
  return items.filter((item) => normalizeBranchName(item.branch).toLowerCase() === target);
}

/**
 * Branch-scopes in-patient sessions. Sessions carry a `branchId` (no branch
 * text), so resolve each session's branch via its branchId, then fall back to
 * the treating staff member's branch for legacy rows that predate attribution.
 */
async function filterSessionsByBranch(
  storage: IStorage,
  sessions: InPatientSession[],
  branchFilter?: string | null
): Promise<InPatientSession[]> {
  if (!branchFilter) return sessions;
  const target = normalizeBranchName(branchFilter).toLowerCase();
  const branches = await storage.getAllBranches();
  const branchIdToShort = new Map<string, string>();
  for (const b of branches) {
    const short = normalizeBranchName((b as any).branchName ?? b.name).toLowerCase();
    if (short) branchIdToShort.set(b.id, short);
  }
  const staffList = await storage.getAllStaff();
  const staffBranchById = new Map(
    staffList.map((s) => [s.id, normalizeBranchName(s.branch).toLowerCase()])
  );
  return sessions.filter((s) => {
    const fromId = (s as any).branchId ? branchIdToShort.get((s as any).branchId) ?? "" : "";
    const fromStaff = staffBranchById.get(s.treatingStaffId) ?? "";
    return (fromId || fromStaff) === target;
  });
}

export async function computeIncentiveReport(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  staffId?: string
): Promise<IncentiveReportRow[]> {
  const { summaries } = await computePayrollReport(storage, rangeFrom, rangeTo, staffId ? [staffId] : undefined);
  return summaries
    .map((s) => ({
      staffId: s.staffId,
      staffName: s.name,
      clinicVisits: s.colomboClinic + s.bandaragamaClinic,
      sessions: s.inPatientSessionsCount,
      incentiveCount: s.incentiveCount,
      incentiveAmount: s.incentiveTotal,
    }))
    .sort((a, b) => b.incentiveAmount - a.incentiveAmount);
}

export async function computeAttendanceReport(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  staffId?: string,
  branchFilter?: string | null
): Promise<AttendanceReport> {
  let attendance = staffId
    ? await storage.getAttendanceByStaff(staffId).then((rows) =>
        rows.filter((a) => inDateRange(a.date, rangeFrom, rangeTo))
      )
    : await storage.getAttendanceByDateRange(rangeFrom, rangeTo);
  if (branchFilter) {
    attendance = applyBranchFilter(attendance, branchFilter);
  }

  const summary = summarizeAttendance(attendance);
  const settings = await loadPayrollSettings(storage);
  const allStaff = await storage.getAllStaff();
  const targets = staffId ? allStaff.filter((s) => s.id === staffId) : allStaff;

  let extraHolidays = 0;
  const byStaff = targets.map((s) => {
    const rows = attendance.filter((a) => a.staffId === s.id);
    const sSum = summarizeAttendance(rows);
    const absent = sSum.absent;
    const extra = Math.max(0, absent - settings.freeAbsentDays);
    extraHolidays += extra;
    return {
      staffId: s.id,
      staffName: s.name,
      present: sSum.present,
      absent: sSum.absent,
      leave: sSum.leave,
      holiday: sSum.holiday,
    };
  });

  const totalDays = summary.present + summary.absent + summary.leave + summary.holiday;
  const attendancePercent = totalDays > 0 ? Math.round((summary.present / totalDays) * 100) : 0;

  return {
    rangeFrom,
    rangeTo,
    summary: { ...summary, extraHolidays },
    attendancePercent,
    byStaff: byStaff.filter((s) => s.present + s.absent + s.leave + s.holiday > 0),
    records: attendance,
  };
}

export async function computeExpenseReport(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  branchFilter?: string | null
): Promise<ExpenseReport> {
  let items = await storage.getExpensesByDateRange(rangeFrom, rangeTo);
  if (branchFilter) items = applyBranchFilter(items, branchFilter);
  const { total, byCategory } = computeExpenseBreakdown(items);
  return { rangeFrom, rangeTo, total, byCategory, items };
}

export async function computeUnpaidReport(
  storage: IStorage,
  staffId?: string,
  branchFilter?: string | null
): Promise<UnpaidVisitRow[]> {
  let visits = await storage.getUnpaidVisits(staffId);
  if (branchFilter) visits = filterVisitsByBranch(visits, branchFilter);
  const patients = await storage.getAllPatients();
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  return visits.map((v) => {
    const patient = patientMap.get(v.patientId);
    const amount = Number(v.paymentAmount) || 0;
    const paid = Number((v as { amountPaid?: string }).amountPaid ?? 0) || 0;
    const outstandingBalance = Math.max(0, amount - paid);
    return {
      visitId: v.id,
      patientId: v.patientId,
      patientName: patient?.fullName ?? patient?.name ?? "Unknown",
      visitDate: v.visitDate,
      amount,
      outstandingBalance,
      branch: v.branch,
      therapistId: v.treatingStaffId,
      therapistName: v.treatingStaffName,
      paymentStatus: v.paymentStatus,
    };
  });
}

export interface SessionReportRow {
  type: "Outpatient" | "In-Patient";
  date: string;
  sessionNumber: number;
  staffName: string;
  branch?: string;
  patientOrAdmission: string;
  treatment?: string;
}

export interface SessionReport {
  startDate: string;
  endDate: string;
  rows: SessionReportRow[];
  summary: {
    totalOutpatient: number;
    totalInpatient: number;
    total: number;
    byTherapist: Array<{ staffName: string; count: number }>;
    byBranch: Array<{ branch: string; count: number }>;
  };
}

export async function computeSessionReport(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  staffId?: string
): Promise<SessionReport> {
  let visits = await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  if (staffId) {
    visits = visits.filter((v) => v.treatingStaffId === staffId || v.createdByStaffId === staffId);
  }

  const ipSessions = staffId
    ? await storage.getInPatientSessionsByStaffAndDateRange(staffId, rangeFrom, rangeTo)
    : await storage.getAllInPatientSessionsInDateRange(rangeFrom, rangeTo);

  const patients = await storage.getAllPatients();
  const patientMap = new Map(patients.map((p) => [p.id, p.name]));
  const admissions = await storage.getAllInPatientAdmissions();
  const admissionMap = new Map(admissions.map((a) => [a.id, a.patientName]));

  const outpatientRows: SessionReportRow[] = visits.map((v) => ({
    type: "Outpatient",
    date: v.visitDate,
    sessionNumber: v.sessionNumber,
    staffName: v.treatingStaffName,
    branch: v.branch,
    patientOrAdmission: patientMap.get(v.patientId) ?? v.patientId,
    treatment: v.treatment,
  }));

  const inpatientRows: SessionReportRow[] = ipSessions.map((s) => ({
    type: "In-Patient",
    date: s.sessionDate,
    sessionNumber: s.sessionNumber,
    staffName: s.treatingStaffName,
    patientOrAdmission: admissionMap.get(s.admissionId) ?? s.admissionId,
    treatment: s.treatmentProvided ?? s.notes ?? "",
  }));

  const rows = [...outpatientRows, ...inpatientRows].sort((a, b) => b.date.localeCompare(a.date));

  const therapistMap = new Map<string, number>();
  const branchMap = new Map<string, number>();
  for (const r of rows) {
    therapistMap.set(r.staffName, (therapistMap.get(r.staffName) ?? 0) + 1);
    if (r.branch) branchMap.set(r.branch, (branchMap.get(r.branch) ?? 0) + 1);
  }

  return {
    startDate: rangeFrom,
    endDate: rangeTo,
    rows,
    summary: {
      totalOutpatient: outpatientRows.length,
      totalInpatient: inpatientRows.length,
      total: rows.length,
      byTherapist: Array.from(therapistMap.entries())
        .map(([staffName, count]) => ({ staffName, count }))
        .sort((a, b) => b.count - a.count),
      byBranch: Array.from(branchMap.entries())
        .map(([branch, count]) => ({ branch, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

export async function computeStaffReport(
  storage: IStorage,
  staffId: string,
  rangeFrom: string,
  rangeTo: string
): Promise<StaffReport | null> {
  const staff = await storage.getStaff(staffId);
  if (!staff) return null;

  const visits = await storage.getVisitsByStaffAndDateRange(staffId, rangeFrom, rangeTo);
  const sessions = await storage.getInPatientSessionsByStaffAndDateRange(staffId, rangeFrom, rangeTo);
  const attendance = await storage.getAttendanceByStaff(staffId).then((rows) =>
    rows.filter((a) => inDateRange(a.date, rangeFrom, rangeTo))
  );
  const fines = await storage.getStaffFinesByStaffAndDateRange(staffId, rangeFrom, rangeTo);
  const settings = await loadPayrollSettings(storage);
  const payroll = computePayrollForStaff(staff, visits, attendance, sessions, fines, rangeFrom, rangeTo, settings);

  return {
    staff,
    rangeFrom,
    rangeTo,
    payroll,
    visits,
    sessions,
    homeVisits: visits.filter((v) => v.visitType === "Home"),
    fines,
    attendance,
  };
}

export async function computeDashboardCharts(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  branchFilter?: string | null
): Promise<DashboardCharts> {
  let visits = await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  let ipSessions = await storage.getAllInPatientSessionsInDateRange(rangeFrom, rangeTo);
  let attendance = await storage.getAttendanceByDateRange(rangeFrom, rangeTo);
  if (branchFilter) {
    visits = filterVisitsByBranch(visits, branchFilter);
    attendance = applyBranchFilter(attendance, branchFilter);
  }
  const incentiveRows = await computeIncentiveReport(storage, rangeFrom, rangeTo);

  const revenueTrend = groupRevenueByDay(visits);

  const attByDay = new Map<string, Attendance[]>();
  for (const a of attendance) {
    if (!attByDay.has(a.date)) attByDay.set(a.date, []);
    attByDay.get(a.date)!.push(a);
  }
  const attendanceTrend = Array.from(attByDay.entries())
    .map(([date, rows]) => {
      const s = summarizeAttendance(rows);
      return { date, present: s.present, absent: s.absent, leave: s.leave, holiday: s.holiday };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const visitByDay = new Map<string, { clinic: number; home: number; sessions: number }>();
  for (const v of visits) {
    if (!visitByDay.has(v.visitDate)) visitByDay.set(v.visitDate, { clinic: 0, home: 0, sessions: 0 });
    const row = visitByDay.get(v.visitDate)!;
    if (v.visitType === "Home") row.home++;
    else row.clinic++;
  }
  for (const s of ipSessions) {
    if (!visitByDay.has(s.sessionDate)) visitByDay.set(s.sessionDate, { clinic: 0, home: 0, sessions: 0 });
    visitByDay.get(s.sessionDate)!.sessions++;
  }
  const visitAnalytics = Array.from(visitByDay.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const allVisits = branchFilter
    ? visits
    : await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  const branchRevenue = ENTERPRISE_BRANCHES.map((b) => ({
    branch: b.shortName,
    revenue: filterVisitsByBranch(allVisits, b.shortName)
      .filter((v) => isPaidPaymentStatus(v.paymentStatus))
      .reduce((a, v) => a + (Number(v.paymentAmount) || 0), 0),
  }));

  const topIncentiveStaff = incentiveRows
    .filter((r) => r.incentiveCount > 0)
    .slice(0, 10)
    .map((r) => ({
      staffName: r.staffName,
      incentiveCount: r.incentiveCount,
      incentiveAmount: r.incentiveAmount,
    }));

  return { revenueTrend, attendanceTrend, visitAnalytics, branchRevenue, topIncentiveStaff };
}

/** Extended KPI fields for Part 4 dashboard cards. */
export async function computeExtendedDashboardKpis(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  staffFilter?: string[],
  branchFilter?: string | null
) {
  const today = clinicDateString();
  let visits = await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  if (branchFilter) visits = filterVisitsByBranch(visits, branchFilter);
  const todayVisitsList = visits.filter((v) => v.visitDate === today);
  let ipSessions = await storage.getAllInPatientSessionsInDateRange(rangeFrom, rangeTo);
  if (branchFilter) ipSessions = await filterSessionsByBranch(storage, ipSessions, branchFilter);
  const todaySessions = ipSessions.filter((s) => s.sessionDate === today).length;
  const todayHomeVisits = todayVisitsList.filter((v) => v.visitType === "Home").length;
  const todayClinicVisits = todayVisitsList.filter((v) => v.visitType === "Clinic").length;

  const unpaid = await computeUnpaidReport(storage, staffFilter?.[0]);
  const scopedUnpaid = branchFilter
    ? unpaid.filter((r) => normalizeBranchName(r.branch).toLowerCase() === normalizeBranchName(branchFilter).toLowerCase())
    : unpaid;
  const outstandingAmount = scopedUnpaid.reduce((a, r) => a + (r.outstandingBalance ?? r.amount), 0);
  const outstandingPatients = new Set(scopedUnpaid.map((r) => r.patientId)).size;

  let todayAttendance = await storage.getAttendanceByDateRange(today, today);
  if (branchFilter) todayAttendance = applyBranchFilter(todayAttendance, branchFilter);
  const todayAttendanceSummary = summarizeAttendance(todayAttendance);

  const todayPaidVisitRevenue = todayVisitsList.reduce((a, v) => a + getVisitCollectedRevenue(v), 0);

  return {
    todayClinicVisits,
    todayHomeVisits,
    todaySessions,
    todayRevenue: todayPaidVisitRevenue,
    todayAttendance: todayAttendanceSummary,
    outstandingAmount,
    outstandingPatients,
  };
}
