import type { IStorage } from "../storage";
import type { Staff, Visit } from "@shared/schema";
import { normalizeBranchName } from "@shared/branches";
import { clinicDateString } from "../clinicTime";
import { isClinicalRole } from "@shared/roles";
import { loadPayrollSettings, computePayrollForStaff } from "./payrollService";
import {
  computeExpenseBreakdown,
  summarizeAttendance,
  isPaidPaymentStatus,
  visitMatchesStaff,
  getVisitCollectedRevenue,
} from "./calculationEngine";
import { computeExtendedDashboardKpis, computeDashboardCharts, type DashboardCharts } from "./reportService";

export interface DashboardKpis {
  date: string;
  rangeFrom: string;
  rangeTo: string;
  todayVisits: number;
  todayClinicVisits: number;
  todayHomeVisits: number;
  todaySessions: number;
  inpatientSessionCount: number;
  todayRevenue: number;
  attendance: { present: number; absent: number; leave: number; holiday: number };
  todayAttendance: { present: number; absent: number; leave: number; holiday: number };
  incentiveCountToday: number;
  incentiveAmountToday: number;
  homeVisitIncomeToday: number;
  salaryLiability: number;
  outstandingAmount: number;
  outstandingPatients: number;
  revenue: { total: number };
  expenses: { total: number; byCategory: Record<string, number> };
  charts: DashboardCharts;
}

export interface BranchDashboardStat {
  branch: string;
  clinicVisits: number;
  homeVisits: number;
  sessions: number;
  revenue: number;
  attendance: { present: number; absent: number; leave: number; holiday: number };
  incentiveAmount: number;
}

function filterVisitsByBranch(visits: Visit[], branch: string | string[]) {
  const targets = Array.isArray(branch)
    ? new Set(branch.map((b) => normalizeBranchName(b).toLowerCase()))
    : new Set([normalizeBranchName(branch).toLowerCase()]);
  return visits.filter((v) => targets.has(normalizeBranchName(v.branch).toLowerCase()));
}

function filterByBranchName<T extends { branch?: string | null }>(items: T[], branchName?: string | string[] | null): T[] {
  if (!branchName) return items;
  const targets = Array.isArray(branchName)
    ? new Set(branchName.map((b) => normalizeBranchName(b).toLowerCase()))
    : new Set([normalizeBranchName(branchName).toLowerCase()]);
  return items.filter((item) => targets.has(normalizeBranchName(item.branch ?? "").toLowerCase()));
}

export async function computeDashboardKpis(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string,
  staffFilter?: string[],
  branchFilter?: string | string[] | null
): Promise<DashboardKpis> {
  const today = clinicDateString();
  let visits = await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  if (branchFilter) visits = filterVisitsByBranch(visits, branchFilter);
  const todayVisits = visits.filter((v) => v.visitDate === today);
  let ipSessions = await storage.getAllInPatientSessionsInDateRange(rangeFrom, rangeTo);
  if (branchFilter && (Array.isArray(branchFilter) ? branchFilter.length > 0 : true)) {
    const branches = await storage.getAllBranches();
    const targets = new Set(
      Array.isArray(branchFilter)
        ? branchFilter.map((b) => normalizeBranchName(b).toLowerCase())
        : [normalizeBranchName(branchFilter).toLowerCase()]
    );
    const matchingBranchIds = new Set(
      branches
        .filter((b) => targets.has(normalizeBranchName(b.name).toLowerCase()))
        .map((b) => b.id)
    );
    const branchStaffIds = new Set(
      (await storage.getAllStaff())
        .filter((s) => targets.has(normalizeBranchName(s.branch ?? "").toLowerCase()))
        .map((s) => s.id)
    );
    // A session's own branchId / treating staff branch is often missing or differs
    // (staff can treat in-patients at a branch other than their home branch), which
    // dropped valid sessions from the count/chart. Match by the parent ADMISSION's
    // branch too so every in-patient session is attributed to the right branch.
    const admissionBranchById = new Map(
      (await storage.getAllInPatientAdmissions()).map((a) => [a.id, a.branchId]),
    );
    ipSessions = ipSessions.filter((s) => {
      const admissionBranch = admissionBranchById.get(s.admissionId);
      return (
        (s.branchId && matchingBranchIds.has(s.branchId)) ||
        (admissionBranch && matchingBranchIds.has(admissionBranch)) ||
        branchStaffIds.has(s.treatingStaffId)
      );
    });
  }
  const todaySessions = ipSessions.filter((s) => s.sessionDate === today).length;

  // Collected revenue (paid in full + partial amount paid) plus in-patient
  // income. getTotalIncome already folds in in-patient payments/discharges and
  // branch-scopes them, so use it for both scoped and unscoped views.
  const totalRevenue = await storage.getTotalIncome(rangeFrom, rangeTo, branchFilter ?? null);
  let attendance = await storage.getAttendanceByDateRange(rangeFrom, rangeTo);
  if (branchFilter) attendance = filterByBranchName(attendance, branchFilter);
  const attendanceSummary = summarizeAttendance(attendance);

  const settings = await loadPayrollSettings(storage);
  const allStaff = await storage.getAllStaff();
  const targets = allStaff.filter((s) => {
    const r = s.role;
    if (r !== "Physiotherapist" && r !== "Staff") return false;
    if (staffFilter?.length && !staffFilter.includes(s.id)) return false;
    return true;
  });

  const fines = await storage.getStaffFinesByDateRange(rangeFrom, rangeTo);
  let incentiveCountToday = 0;
  let incentiveAmountToday = 0;
  let homeVisitIncomeToday = 0;
  let salaryLiability = 0;

  for (const staff of targets) {
    const summary = computePayrollForStaff(
      staff,
      visits,
      attendance,
      ipSessions,
      fines,
      rangeFrom,
      rangeTo,
      settings
    );
    salaryLiability += summary.finalSalary;
    const todayIncentive = summary.incentiveDays.find((d) => d.date === today);
    if (todayIncentive) {
      incentiveCountToday += todayIncentive.count;
      incentiveAmountToday += todayIncentive.incentive;
    }
  }

  const todayHomeVisits = visits.filter((v) => v.visitDate === today && v.visitType === "Home");
  homeVisitIncomeToday = todayHomeVisits.reduce((acc, v) => acc + getVisitCollectedRevenue(v), 0);
  console.log("[HomeVisitDiagnostics] today:", today, "visits count:", todayHomeVisits.length, "revenue:", homeVisitIncomeToday, "visits:", todayHomeVisits.map(v => ({ id: v.id, date: v.visitDate, type: v.visitType, amount: v.paymentAmount, paid: v.amountPaid, status: v.paymentStatus })));

  let expensesList = await storage.getExpensesByDateRange(rangeFrom, rangeTo);
  // Scope by the expense's own branch column (consistent with /api/expenses and
  // getExpenseTotal). Previously this filtered by the creator's branch, which
  // misattributed expenses logged for a different branch.
  if (branchFilter) {
    expensesList = filterByBranchName(expensesList, branchFilter);
  }
  const expenses = computeExpenseBreakdown(expensesList);

  const extended = await computeExtendedDashboardKpis(storage, rangeFrom, rangeTo, staffFilter, branchFilter);
  const charts = await computeDashboardCharts(storage, rangeFrom, rangeTo, branchFilter);

  return {
    date: today,
    rangeFrom,
    rangeTo,
    todayVisits: todayVisits.length,
    todayClinicVisits: extended.todayClinicVisits,
    todayHomeVisits: extended.todayHomeVisits,
    todaySessions: extended.todaySessions,
    inpatientSessionCount: ipSessions.length,
    todayRevenue: extended.todayRevenue,
    attendance: attendanceSummary,
    todayAttendance: extended.todayAttendance,
    incentiveCountToday,
    incentiveAmountToday,
    homeVisitIncomeToday,
    salaryLiability,
    outstandingAmount: extended.outstandingAmount,
    outstandingPatients: extended.outstandingPatients,
    revenue: { total: totalRevenue },
    expenses,
    charts,
  };
}

export async function computeBranchDashboardStats(
  storage: IStorage,
  rangeFrom: string,
  rangeTo: string
): Promise<BranchDashboardStat[]> {
  const visits = await storage.getVisitsByDateRange(rangeFrom, rangeTo);
  const ipSessions = await storage.getAllInPatientSessionsInDateRange(rangeFrom, rangeTo);
  const attendance = await storage.getAttendanceByDateRange(rangeFrom, rangeTo);
  const settings = await loadPayrollSettings(storage);
  const staffDirectory = await storage.getAllStaff();
  const allStaff = staffDirectory.filter((st) => isClinicalRole(st.role));
  const fines = await storage.getStaffFinesByDateRange(rangeFrom, rangeTo);
  const branches = await storage.getAllBranches();

  return Promise.all(branches.map(async (branch) => {
    const branchId = branch.id;
    const branchName = branch.name;

    const branchVisits = visits.filter(v => v.branchId === branchId);
    const clinicVisits = branchVisits.filter((v) => v.visitType === "Clinic").length;
    const homeVisits = branchVisits.filter((v) => v.visitType === "Home").length;
    const branchStaffIds = new Set(
      staffDirectory
        .filter((s) => s.branch === branchName)
        .map((s) => s.id)
    );
    const sessions = ipSessions.filter((s) => s.branchId === branchId || branchStaffIds.has(s.treatingStaffId)).length;

    // Only fully paid visits count towards branch revenue in this overview
    const revenue = branchVisits
      .filter((v) => isPaidPaymentStatus(v.paymentStatus))
      .reduce((acc, v) => acc + (Number(v.paymentAmount) || 0), 0);
    const attendanceSummary = summarizeAttendance(
      attendance.filter((a) => branchStaffIds.has(a.staffId))
    );

    let incentiveAmount = 0;
    for (const staff of allStaff) {
      const staffVisits = branchVisits.filter((v) => visitMatchesStaff(v, staff.id, staff.name));
      if (staffVisits.length === 0) continue;
      const summary = computePayrollForStaff(
        staff,
        staffVisits,
        attendance.filter((a) => a.staffId === staff.id),
        ipSessions.filter((s) => s.treatingStaffId === staff.id),
        fines.filter((f) => f.staffId === staff.id),
        rangeFrom,
        rangeTo,
        settings
      );
      incentiveAmount += summary.incentiveTotal;
    }

    return {
      branch: branchName,
      clinicVisits,
      homeVisits,
      sessions,
      revenue,
      attendance: attendanceSummary,
      incentiveAmount,
    };
  }));
}

export function assignPatientsToFirstVisitTherapist(
  visits: Visit[],
  patients: { id: string; name: string; fullName?: string | null; therapistFirstVisitId?: string | null }[],
  staff: Staff[]
): { therapistId: string; therapistName: string; patients: { id: string; name: string; visitCount: number }[] }[] {
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const staffMap = new Map(staff.map((s) => [s.id, s]));
  const visitsByPatient = new Map<string, Visit[]>();

  for (const v of visits) {
    if (!visitsByPatient.has(v.patientId)) visitsByPatient.set(v.patientId, []);
    visitsByPatient.get(v.patientId)!.push(v);
  }

  const byTherapist = new Map<
    string,
    { therapistId: string; therapistName: string; patients: { id: string; name: string; visitCount: number }[] }
  >();

  for (const [patientId, pVisits] of Array.from(visitsByPatient.entries())) {
    const patient = patientMap.get(patientId);
    if (!patient) continue;

    const sorted = [...pVisits].sort((a, b) => {
      const d = a.visitDate.localeCompare(b.visitDate);
      if (d !== 0) return d;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
    const first = sorted[0];
    const therapistId = patient.therapistFirstVisitId ?? first?.treatingStaffId;
    if (!therapistId) continue;

    const therapist = staffMap.get(therapistId);
    if (!byTherapist.has(therapistId)) {
      byTherapist.set(therapistId, {
        therapistId,
        therapistName: therapist?.name ?? first?.treatingStaffName ?? "Unknown",
        patients: [],
      });
    }
    byTherapist.get(therapistId)!.patients.push({
      id: patient.id,
      name: patient.fullName ?? patient.name,
      visitCount: pVisits.length,
    });
  }

  return Array.from(byTherapist.values())
    .map((t) => ({
      ...t,
      patients: t.patients.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.therapistName.localeCompare(b.therapistName));
}
