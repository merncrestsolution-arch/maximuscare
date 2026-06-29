import type { IStorage } from "../storage";
import type { Patient, Visit, InPatientSession } from "@shared/schema";
import { nextPatientCode, bumpPatientCode } from "@shared/patientId";
import { computeOutstandingBalance, derivePaymentStatus } from "./calculationEngine";

/** Bug 2/9: patient code MC/<BRANCH>/<DDMM>/<SEQ> — sequence resets per day per branch. */
export async function generatePatientCode(
  storage: IStorage,
  branch: string | null | undefined,
  registeredDate?: string | Date | null,
): Promise<string> {
  const all = await storage.getAllPatients();
  return nextPatientCode(all.map((p) => p.patientCode), branch, registeredDate);
}

export async function generateUniquePatientCode(
  storage: IStorage,
  branch: string | null | undefined,
  registeredDate?: string | Date | null,
): Promise<string> {
  const all = await storage.getAllPatients();
  const codes = all.map((p) => p.patientCode);
  let code = nextPatientCode(codes, branch, registeredDate);
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!(await storage.isPatientCodeTaken(code))) return code;
    code = bumpPatientCode(code);
  }
  throw new Error("Could not generate a unique patient ID. Please try again.");
}

export async function assertNoDuplicatePatient(
  storage: IStorage,
  phone: string | null | undefined,
  nicOrPassport?: string | null,
  excludeId?: string,
  options?: { skipPhoneCheck?: boolean }
): Promise<void> {
  const all = await storage.getAllPatients();
  const normalizedPhone = phone && phone.trim() !== "" ? phone.replace(/\s+/g, "").trim() : null;
  const normalizedNic = nicOrPassport && nicOrPassport.trim() !== "" ? nicOrPassport.trim() : null;

  // Bug 7: the Book Appointment flow allows re-using an existing phone number, so callers
  // can opt out of the phone-duplicate guard while still enforcing the NIC/Passport check.
  if (normalizedPhone && !options?.skipPhoneCheck) {
    for (const p of all) {
      if (excludeId && p.id === excludeId) continue;
      if (p.phone && p.phone.replace(/\s+/g, "").trim() === normalizedPhone) {
        throw new Error("A patient with this phone number already exists.");
      }
    }
  }

  if (normalizedNic) {
    for (const p of all) {
      if (excludeId && p.id === excludeId) continue;
      if (p.nicOrPassport && p.nicOrPassport.trim() === normalizedNic) {
        throw new Error("A patient with this NIC/Passport already exists.");
      }
    }
  }
}

export interface PatientStats {
  totalVisits: number;
  totalSessions: number;
  totalRevenue: number;
  outstandingAmount: number;
  lastVisitDate: string | null;
  assignedTherapistId: string | null;
  assignedTherapistName: string | null;
}

export async function getPatientStats(storage: IStorage, patientId: string): Promise<PatientStats> {
  const patient = await storage.getPatient(patientId);
  const visits = await storage.getVisitsByPatient(patientId);
  const ipSessions = await storage.getInPatientSessionsForPatient(patientId);

  let totalRevenue = 0;
  let outstandingAmount = 0;
  let lastVisitDate: string | null = null;

  for (const v of visits) {
    const amount = Number(v.paymentAmount) || 0;
    const paid = Number((v as { amountPaid?: string }).amountPaid ?? 0) || 0;
    const ps = String(v.paymentStatus).toLowerCase();
    if (ps === "paid") totalRevenue += amount;
    else if (ps === "partially paid") {
      totalRevenue += paid;
      outstandingAmount += computeOutstandingBalance(amount, paid);
    } else if (ps !== "cancelled") {
      outstandingAmount += amount;
    }
    if (!lastVisitDate || v.visitDate > lastVisitDate) lastVisitDate = v.visitDate;
  }

  let assignedTherapistId = patient?.therapistFirstVisitId ?? null;
  let assignedTherapistName: string | null = null;
  if (assignedTherapistId) {
    const staff = await storage.getStaff(assignedTherapistId);
    assignedTherapistName = staff?.name ?? null;
  } else if (visits.length > 0) {
    const first = [...visits].sort((a, b) => a.visitDate.localeCompare(b.visitDate))[0];
    assignedTherapistId = first.treatingStaffId;
    assignedTherapistName = first.treatingStaffName;
  }

  return {
    totalVisits: visits.length,
    totalSessions: ipSessions.length,
    totalRevenue,
    outstandingAmount,
    lastVisitDate,
    assignedTherapistId,
    assignedTherapistName,
  };
}

export interface PatientDashboard {
  totalPatients: number;
  activePatients: number;
  inactivePatients: number;
  newPatientsThisMonth: number;
  outstandingPayments: number;
  topTherapists: Array<{ therapistId: string; therapistName: string; patientCount: number }>;
  branchDistribution: Array<{ branch: string; count: number }>;
}

export async function getPatientDashboard(storage: IStorage): Promise<PatientDashboard> {
  const patients = await storage.getAllPatients();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const activePatients = patients.filter((p) => p.status === "Active").length;
  const inactivePatients = patients.filter((p) => p.status !== "Active").length;
  const newPatientsThisMonth = patients.filter((p) => p.registeredDate >= monthStart).length;

  const unpaid = await storage.getUnpaidVisits();
  let outstandingPayments = 0;
  for (const v of unpaid) {
    const amount = Number(v.paymentAmount) || 0;
    const paid = Number((v as { amountPaid?: string }).amountPaid ?? 0) || 0;
    outstandingPayments += computeOutstandingBalance(amount, paid);
  }

  const therapistMap = new Map<string, { name: string; count: number }>();
  for (const p of patients) {
    if (!p.therapistFirstVisitId) continue;
    const cur = therapistMap.get(p.therapistFirstVisitId) ?? { name: "", count: 0 };
    cur.count += 1;
    therapistMap.set(p.therapistFirstVisitId, cur);
  }
  const staffList = await storage.getAllStaff();
  for (const [id, v] of Array.from(therapistMap.entries())) {
    const s = staffList.find((st) => st.id === id);
    v.name = s?.name ?? id;
  }
  const topTherapists = Array.from(therapistMap.entries())
    .map(([therapistId, v]) => ({ therapistId, therapistName: v.name, patientCount: v.count }))
    .sort((a, b) => b.patientCount - a.patientCount)
    .slice(0, 10);

  const branchMap = new Map<string, number>();
  for (const p of patients) {
    const b = p.branch || "Unassigned";
    branchMap.set(b, (branchMap.get(b) ?? 0) + 1);
  }
  const branchDistribution = Array.from(branchMap.entries()).map(([branch, count]) => ({ branch, count }));

  return {
    totalPatients: patients.length,
    activePatients,
    inactivePatients,
    newPatientsThisMonth,
    outstandingPayments,
    topTherapists,
    branchDistribution,
  };
}

export function getPatientsFiltered(
  patients: Patient[],
  filters: {
    search?: string;
    branch?: string;
    status?: string;
    therapistId?: string;
  }
): Patient[] {
  let rows = [...patients];
  if (filters.branch) rows = rows.filter((p) => p.branch === filters.branch);
  if (filters.status) rows = rows.filter((p) => p.status === filters.status);
  if (filters.therapistId) rows = rows.filter((p) => p.therapistFirstVisitId === filters.therapistId);
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        String(p.patientCode ?? "").toLowerCase().includes(q) ||
        String(p.nicOrPassport ?? "").toLowerCase().includes(q)
    );
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export interface PatientExportRow {
  patientId: string;
  patientCode: string;
  patientName: string;
  phone: string;
  branch: string;
  therapist: string;
  visits: number;
  sessions: number;
  outstandingAmount: number;
  status: string;
}

export async function getPatientExportRows(storage: IStorage): Promise<PatientExportRow[]> {
  const patients = await storage.getAllPatients();
  const staffList = await storage.getAllStaff();
  const staffMap = new Map(staffList.map((s) => [s.id, s.name]));

  const rows: PatientExportRow[] = [];
  for (const p of patients) {
    const stats = await getPatientStats(storage, p.id);
    const therapist =
      (p.therapistFirstVisitId ? staffMap.get(p.therapistFirstVisitId) : null) ??
      stats.assignedTherapistName ??
      "";
    rows.push({
      patientId: p.id,
      patientCode: p.patientCode ?? "",
      patientName: p.name,
      phone: p.phone,
      branch: p.branch,
      therapist,
      visits: stats.totalVisits,
      sessions: stats.totalSessions,
      outstandingAmount: stats.outstandingAmount,
      status: p.status,
    });
  }
  return rows.sort((a, b) => a.patientName.localeCompare(b.patientName));
}
