import { eq, and, or, gte, lte, desc, asc, sql, isNull, ne, like, inArray, type SQL } from "drizzle-orm";

function parseJsonArrays<T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): T {
  const out = { ...row };
  for (const k of keys) {
    const v = out[k];
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        (out as any)[k] = Array.isArray(parsed) ? parsed : v;
      } catch {
        /* keep as-is */
      }
    }
    /* if v is already array (PostgreSQL), leave it */
  }
  return out;
}
import { db, schema } from "./db";
import { isStrictlyBeforeNoon } from "./clinicTime";

/** Same check as server/db.ts — raw SQL below must run on the active driver. */
const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgresql");

async function runDeleteSql(q: SQL) {
  if (usePostgres) await (db as { execute: (x: SQL) => Promise<unknown> }).execute(q);
  else await db.run(q);
}

const {
  staff,
  patients,
  visits,
  attendance,
  inPatientAdmissions,
  inPatientSessions,
  inPatientDischarges,
  inPatientPayments,
  inPatientExtraExpenses,
  expenses,
  incentiveSettings,
  appointments,
  staffFines,
  branches,
  clinicSettings,
  notifications,
  tasks,
  taskAssignments,
  auditLogs,
  authSessions,
  payrollSnapshots,
  salaries,
  staffIncentives,
  staffDeductions,
  staffOtEntries,
  visitPayments,
  patientDocuments,
  patientNotes,
  homeVisits,
  userBranchAccess,
  userBranchPermissions,
} = schema;

import type {
  Staff,
  InsertStaff,
  UpdateStaff,
  Patient,
  InsertPatient,
  UpdatePatient,
  Visit,
  InsertVisit,
  UpdateVisit,
  Attendance,
  InsertAttendance,
  UpdateAttendance,
  InPatientAdmission,
  InsertInPatientAdmission,
  UpdateInPatientAdmission,
  InPatientSession,
  InsertInPatientSession,
  UpdateInPatientSession,
  InPatientDischarge,
  InsertInPatientDischarge,
  UpdateInPatientDischarge,
  InPatientPayment,
  InsertInPatientPayment,
  Expense,
  InsertExpense,
  UpdateExpense,
  InPatientExtraExpense,
  InsertInPatientExtraExpense,
  UpdateInPatientExtraExpense,
  IncentiveSettings,
  UpdateIncentiveSettings,
  Appointment,
  InsertAppointment,
  UpdateAppointment,
  StaffFine,
  InsertStaffFine,
  UpdateStaffFine,
  Branch,
  InsertBranch,
  UpdateBranch,
  ClinicSettings,
  UpdateClinicSettings,
  Notification,
  InsertNotification,
  Task,
  InsertTask,
  UpdateTask,
  InsertTaskAssignment,
  AuditLog,
  InsertAuditLog,
  AuthSession,
  PayrollSnapshot,
  InsertPayrollSnapshot,
  Salary,
  InsertSalary,
  UpdateSalary,
  StaffIncentive,
  StaffDeduction,
  InsertStaffDeduction,
  UpdateStaffDeduction,
  StaffOtEntry,
  InsertStaffOtEntry,
  UpdateStaffOtEntry,
  VisitPayment,
  InsertVisitPayment,
  PatientDocument,
  InsertPatientDocument,
  PatientNote,
  InsertPatientNote,
  HomeVisit,
  InsertHomeVisit,
  InsertStaffIncentive,
} from "@shared/schema";

export interface IStorage {
  // Staff methods
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffByEmail(email: string): Promise<Staff | undefined>;
  getAllStaff(): Promise<Staff[]>;
  getActiveStaff(): Promise<Staff[]>;
  createStaff(data: InsertStaff): Promise<Staff>;
  updateStaff(id: string, data: UpdateStaff): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;

  // Patient methods
  getPatient(id: string): Promise<Patient | undefined>;
  getAllPatients(): Promise<Patient[]>;
  getPatientsPaginated(filters: {
    branch?: string;
    search?: string;
    status?: string;
    patientIds?: string[];
    page: number;
    limit: number;
  }): Promise<{ data: Patient[]; total: number }>;
  getVisitsPaginated(filters: {
    patientId?: string;
    startDate?: string;
    endDate?: string;
    branch?: string;
    staffId?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Visit[]; total: number }>;
  getAttendancePaginated(filters: {
    staffId?: string;
    startDate?: string;
    endDate?: string;
    month?: string;
    branch?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Attendance[]; total: number }>;
  getSalariesPaginated(
    filters: {
      month?: string;
      year?: string;
      branch?: string;
      staffId?: string;
      status?: string;
    },
    page: number,
    limit: number
  ): Promise<{ data: Salary[]; total: number }>;
  createRefreshToken(data: {
    staffId: string;
    sessionId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  getValidRefreshToken(tokenHash: string): Promise<{ id: string; staffId: string; sessionId: string } | undefined>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeRefreshTokensForSession(sessionId: string): Promise<void>;
  purgeExpiredRefreshTokens(): Promise<void>;
  getPatientsByBranch(branch: string): Promise<Patient[]>;
  createPatient(data: InsertPatient): Promise<Patient>;
  updatePatient(id: string, data: UpdatePatient): Promise<Patient | undefined>;
  deletePatient(id: string): Promise<boolean>;

  // Visit methods
  getVisit(id: string): Promise<Visit | undefined>;
  getAllVisits(): Promise<Visit[]>;
  getUnpaidVisits(staffId?: string): Promise<Visit[]>;
  getVisitsByPatient(patientId: string): Promise<Visit[]>;
  getVisitsByDateRange(startDate: string, endDate: string): Promise<Visit[]>;
  getVisitsByStaffAndDateRange(staffId: string, startDate: string, endDate: string): Promise<Visit[]>;
  createVisit(data: InsertVisit): Promise<Visit>;
  updateVisit(id: string, data: UpdateVisit): Promise<Visit | undefined>;
  deleteVisit(id: string): Promise<boolean>;

  // Attendance methods
  getAttendance(id: string): Promise<Attendance | undefined>;
  getAllAttendance(): Promise<Attendance[]>;
  getAttendanceByStaff(staffId: string): Promise<Attendance[]>;
  getAttendanceByDateRange(startDate: string, endDate: string): Promise<Attendance[]>;
  getAttendanceByStaffAndMonth(staffId: string, month: string): Promise<Attendance[]>;
  createAttendance(data: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, data: UpdateAttendance): Promise<Attendance | undefined>;
  deleteAttendance(id: string): Promise<boolean>;
  getAttendanceByStaffAndDate(staffId: string, date: string): Promise<Attendance | undefined>;

  // In-Patient Admission methods
  getInPatientAdmission(id: string): Promise<InPatientAdmission | undefined>;
  getAllInPatientAdmissions(): Promise<InPatientAdmission[]>;
  getInPatientAdmissionsByStatus(status: string): Promise<InPatientAdmission[]>;
  createInPatientAdmission(data: InsertInPatientAdmission): Promise<InPatientAdmission>;
  updateInPatientAdmission(id: string, data: UpdateInPatientAdmission): Promise<InPatientAdmission | undefined>;
  deleteInPatientAdmission(id: string): Promise<boolean>;

  // In-Patient Session methods
  getInPatientSession(id: string): Promise<InPatientSession | undefined>;
  getAllInPatientSessions(): Promise<InPatientSession[]>;
  getInPatientSessionsByAdmission(admissionId: string): Promise<InPatientSession[]>;
  getSessionCountForDate(admissionId: string, date: string): Promise<number>;
  createInPatientSession(data: InsertInPatientSession): Promise<InPatientSession>;
  updateInPatientSession(id: string, data: UpdateInPatientSession): Promise<InPatientSession | undefined>;
  deleteInPatientSession(id: string): Promise<boolean>;

  // In-Patient Discharge methods
  getInPatientDischarge(id: string): Promise<InPatientDischarge | undefined>;
  getInPatientDischargeByAdmission(admissionId: string): Promise<InPatientDischarge | undefined>;
  createInPatientDischarge(data: InsertInPatientDischarge): Promise<InPatientDischarge>;
  updateInPatientDischarge(id: string, data: UpdateInPatientDischarge): Promise<InPatientDischarge | undefined>;

  // In-Patient Payment methods
  getInPatientPaymentsByAdmission(admissionId: string): Promise<InPatientPayment[]>;
  getPaymentTotalByAdmission(admissionId: string): Promise<number>;
  createInPatientPayment(data: InsertInPatientPayment): Promise<InPatientPayment>;

  // In-Patient Extra Expense methods
  getInPatientExtraExpensesByAdmission(admissionId: string): Promise<InPatientExtraExpense[]>;
  getInPatientExtraExpense(id: string): Promise<InPatientExtraExpense | undefined>;
  createInPatientExtraExpense(data: InsertInPatientExtraExpense): Promise<InPatientExtraExpense>;
  updateInPatientExtraExpense(id: string, data: UpdateInPatientExtraExpense): Promise<InPatientExtraExpense | undefined>;
  deleteInPatientExtraExpense(id: string): Promise<boolean>;
  getExtraExpenseTotalByAdmission(admissionId: string): Promise<number>;

  // Expense methods
  getExpense(id: string): Promise<Expense | undefined>;
  getAllExpenses(): Promise<Expense[]>;
  getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]>;
  getExpensesByStaffId(staffId: string): Promise<Expense[]>;
  createExpense(data: InsertExpense): Promise<Expense>;
  updateExpense(id: string, data: UpdateExpense): Promise<Expense | undefined>;
  deleteExpense(id: string, deletedBy?: string): Promise<boolean>;
  getExpenseTotal(startDate?: string, endDate?: string): Promise<number>;

  // Revenue calculation methods
  getTotalIncome(startDate?: string, endDate?: string): Promise<number>;

  // Incentive Settings methods
  getIncentiveSettings(): Promise<IncentiveSettings | undefined>;
  updateIncentiveSettings(data: UpdateIncentiveSettings): Promise<IncentiveSettings>;

  // Appointment methods
  getAppointment(id: string): Promise<Appointment | undefined>;
  getAppointmentsByDate(date: string): Promise<Appointment[]>;
  getAllAppointments(): Promise<Appointment[]>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, data: UpdateAppointment): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<boolean>;

  // Staff fines
  getStaffFinesByDateRange(startDate: string, endDate: string): Promise<StaffFine[]>;
  getStaffFinesByStaffAndDateRange(staffId: string, startDate: string, endDate: string): Promise<StaffFine[]>;
  getStaffFine(id: string): Promise<StaffFine | undefined>;
  createStaffFine(data: InsertStaffFine): Promise<StaffFine>;
  updateStaffFine(id: string, data: UpdateStaffFine): Promise<StaffFine | undefined>;
  deleteStaffFine(id: string, deletedBy?: string): Promise<boolean>;
  staffHasVisitOrIpSessionBeforeNoon(staffId: string, day: string): Promise<boolean>;
  deleteAutoFineForStaffDate(staffId: string, fineDate: string): Promise<void>;
  ensureAutoFineForStaffDate(staffId: string, staffName: string, fineDate: string): Promise<void>;
  getInPatientSessionsByStaffAndDateRange(staffId: string, startDate: string, endDate: string): Promise<InPatientSession[]>;
  getAllInPatientSessionsInDateRange(startDate: string, endDate: string): Promise<InPatientSession[]>;
  getVisitsForStaffMember(staffId: string): Promise<Visit[]>;
  getPatientIdsForStaff(staffId: string): Promise<string[]>;

  getClinicSettings(): Promise<ClinicSettings | undefined>;
  updateClinicSettings(data: UpdateClinicSettings): Promise<ClinicSettings>;
  getAutoFineAmount(): Promise<string>;

  getAllBranches(): Promise<Branch[]>;
  createBranch(data: InsertBranch): Promise<Branch>;
  updateBranch(id: string, data: UpdateBranch): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<boolean>;
  seedDefaultBranches(): Promise<void>;
  seedEnterpriseBranches(): Promise<void>;
  getUserBranchAccess(staffId: string): Promise<{ branchId: string; isDefault: boolean }[]>;
  getUserBranchPermissions(staffId: string): Promise<{ branchId: string }[]>;
  setUserBranchPermissions(staffId: string, branchIds: string[]): Promise<void>;
  syncStaffBranchAccess(staffId: string, branchIds: string[]): Promise<void>;
  setUserDefaultBranch(staffId: string, branchId: string): Promise<void>;

  getNotificationsByStaff(
    staffId: string,
    opts?: { unreadOnly?: boolean; archived?: boolean; includeDeleted?: boolean },
  ): Promise<Notification[]>;
  getUnreadNotificationCount(staffId: string): Promise<number>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string, staffId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(staffId: string): Promise<void>;
  archiveNotification(id: string, staffId: string): Promise<Notification | undefined>;
  softDeleteNotification(id: string, staffId: string): Promise<boolean>;

  getAllTasks(status?: string): Promise<Task[]>;
  getTasksByAssignee(staffId: string, status?: string): Promise<Task[]>;
  getTasksForStaff(staffId: string, status?: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: string, data: UpdateTask): Promise<Task | undefined>;
  deleteTask(id: string, deletedBy?: string): Promise<boolean>;
  createTaskAssignment(data: InsertTaskAssignment): Promise<void>;

  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(params: { entityType?: string; module?: string; limit: number }): Promise<AuditLog[]>;

  createAuthSession(data: { id: string; staffId: string; email: string; role: string; expiresAt: Date; selectedBranchId?: string | null }): Promise<AuthSession>;
  getAuthSession(id: string): Promise<AuthSession | undefined>;
  updateAuthSessionBranch(sessionId: string, branchId: string | null): Promise<void>;
  updateAuthSessionContext(sessionId: string, context: string | null): Promise<void>;
  clearAuthSessionSelection(sessionId: string): Promise<void>;
  deleteAuthSession(id: string): Promise<void>;
  deleteExpiredAuthSessions(): Promise<void>;

  createPayrollSnapshot(data: InsertPayrollSnapshot): Promise<PayrollSnapshot>;
  getPayrollSnapshotsByStaff(staffId: string): Promise<PayrollSnapshot[]>;

  createSalaryRecord(data: InsertSalary): Promise<Salary>;
  getSalary(id: string): Promise<Salary | undefined>;
  updateSalary(id: string, data: UpdateSalary): Promise<Salary | undefined>;
  getSalariesByStaff(staffId: string): Promise<Salary[]>;
  getSalaryByStaffAndMonth(staffId: string, salaryMonth: string): Promise<Salary | undefined>;
  getSalariesFiltered(filters: {
    month?: string;
    year?: string;
    branch?: string;
    staffId?: string;
    status?: string;
  }): Promise<Salary[]>;
  getAllSalaries(): Promise<Salary[]>;
  upsertStaffIncentiveRecord(data: InsertStaffIncentive): Promise<StaffIncentive>;

  createStaffDeduction(data: InsertStaffDeduction): Promise<StaffDeduction>;
  updateStaffDeduction(id: string, data: UpdateStaffDeduction): Promise<StaffDeduction | undefined>;
  deleteStaffDeduction(id: string, deletedBy?: string): Promise<boolean>;
  getStaffDeductionsByStaffAndRange(staffId: string, startDate: string, endDate: string): Promise<StaffDeduction[]>;
  getAllStaffDeductions(): Promise<StaffDeduction[]>;

  createStaffOtEntry(data: InsertStaffOtEntry & { amount?: string }): Promise<StaffOtEntry>;
  updateStaffOtEntry(id: string, data: UpdateStaffOtEntry): Promise<StaffOtEntry | undefined>;
  deleteStaffOtEntry(id: string, deletedBy?: string): Promise<boolean>;
  getStaffOtEntriesByStaffAndRange(staffId: string, startDate: string, endDate: string): Promise<StaffOtEntry[]>;
  getAllStaffOtEntries(): Promise<StaffOtEntry[]>;

  createVisitPayment(data: InsertVisitPayment): Promise<VisitPayment>;
  getVisitPaymentsByVisit(visitId: string): Promise<VisitPayment[]>;

  createPatientDocument(data: InsertPatientDocument): Promise<PatientDocument>;
  getPatientDocument(id: string): Promise<PatientDocument | undefined>;
  getPatientDocuments(patientId: string): Promise<PatientDocument[]>;
  updatePatientDocumentUri(id: string, fileUri: string): Promise<PatientDocument | undefined>;
  deletePatientDocument(id: string): Promise<boolean>;

  createPatientNote(data: InsertPatientNote): Promise<PatientNote>;
  getPatientNotes(patientId: string): Promise<PatientNote[]>;
  deletePatientNote(id: string): Promise<boolean>;

  getInPatientSessionsForPatient(patientId: string): Promise<InPatientSession[]>;
  getHomeVisitsFiltered(filters: {
    startDate?: string;
    endDate?: string;
    branch?: string;
    staffId?: string;
    visitType?: string;
  }): Promise<HomeVisit[]>;
  getHomeVisit(id: string): Promise<HomeVisit | undefined>;
  upsertHomeVisitFromVisit(data: InsertHomeVisit & { visitId: string }): Promise<HomeVisit>;
  createHomeVisit(data: InsertHomeVisit): Promise<HomeVisit>;
  updateHomeVisit(id: string, data: Partial<InsertHomeVisit>): Promise<HomeVisit | undefined>;
  deleteHomeVisit(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Staff methods
  async getStaff(id: string): Promise<Staff | undefined> {
    const result = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
    return result[0];
  }

  async getStaffByEmail(email: string): Promise<Staff | undefined> {
    const result = await db.select().from(staff).where(eq(staff.email, email)).limit(1);
    return result[0];
  }

  async getAllStaff(): Promise<Staff[]> {
    return await db
      .select()
      .from(staff)
      .where(isNull(staff.deletedAt))
      .orderBy(asc(staff.name));
  }

  async getActiveStaff(): Promise<Staff[]> {
    const all = await this.getAllStaff();
    return all.filter((s) => s.isActive !== false && (s.isActive as unknown) !== 0);
  }

  async createStaff(data: InsertStaff): Promise<Staff> {
    const result = await db.insert(staff).values(data).returning();
    return result[0];
  }

  async updateStaff(id: string, data: UpdateStaff): Promise<Staff | undefined> {
    const result = await db
      .update(staff)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(staff.id, id))
      .returning();
    return result[0];
  }

  async deleteStaff(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db
      .update(staff)
      .set({
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: deletedBy ?? null,
        deletedAt: new Date(),
        deletedBy: deletedBy ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(staff.id, id))
      .returning();
    return result.length > 0;
  }

  // Patient methods
  async getPatient(id: string): Promise<Patient | undefined> {
    const result = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
      .limit(1);
    return result[0];
  }

  async getAllPatients(): Promise<Patient[]> {
    return await db
      .select()
      .from(patients)
      .where(isNull(patients.deletedAt))
      .orderBy(asc(patients.fullName), asc(patients.name));
  }

  async getPatientsByBranch(branch: string): Promise<Patient[]> {
    return await db
      .select()
      .from(patients)
      .where(and(eq(patients.branch, branch), isNull(patients.deletedAt)))
      .orderBy(asc(patients.fullName), asc(patients.name));
  }

  async getPatientsPaginated(filters: {
    branch?: string;
    search?: string;
    status?: string;
    patientIds?: string[];
    page: number;
    limit: number;
  }): Promise<{ data: Patient[]; total: number }> {
    const conditions: SQL[] = [isNull(patients.deletedAt)];
    if (filters.branch) conditions.push(eq(patients.branch, filters.branch));
    if (filters.status) conditions.push(eq(patients.status, filters.status));
    if (filters.patientIds?.length) conditions.push(inArray(patients.id, filters.patientIds));
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          like(patients.name, q),
          like(patients.fullName, q),
          like(patients.phone, q),
          like(patients.patientCode, q)
        )!
      );
    }
    const where = and(...conditions);
    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(patients)
      .where(where);
    const total = Number(countRow[0]?.count ?? 0);
    const offset = (filters.page - 1) * filters.limit;
    const data = await db
      .select()
      .from(patients)
      .where(where)
      .orderBy(asc(patients.fullName), asc(patients.name))
      .limit(filters.limit)
      .offset(offset);
    return { data, total };
  }

  async getVisitsPaginated(filters: {
    patientId?: string;
    startDate?: string;
    endDate?: string;
    branch?: string;
    staffId?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Visit[]; total: number }> {
    const conditions: SQL[] = [isNull(visits.deletedAt)];
    if (filters.patientId) conditions.push(eq(visits.patientId, filters.patientId));
    if (filters.branch) conditions.push(eq(visits.branch, filters.branch));
    if (filters.startDate && filters.endDate) {
      conditions.push(gte(visits.visitDate, filters.startDate));
      conditions.push(lte(visits.visitDate, filters.endDate));
    }
    if (filters.staffId) {
      conditions.push(
        or(eq(visits.treatingStaffId, filters.staffId), eq(visits.createdByStaffId, filters.staffId))!
      );
    }
    const where = and(...conditions);
    const countRow = await db.select({ count: sql<number>`count(*)` }).from(visits).where(where);
    const total = Number(countRow[0]?.count ?? 0);
    const offset = (filters.page - 1) * filters.limit;
    const data = await db
      .select()
      .from(visits)
      .where(where)
      .orderBy(desc(visits.visitDate))
      .limit(filters.limit)
      .offset(offset);
    return { data, total };
  }

  async getAttendancePaginated(filters: {
    staffId?: string;
    startDate?: string;
    endDate?: string;
    month?: string;
    branch?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Attendance[]; total: number }> {
    const conditions: SQL[] = [isNull(attendance.deletedAt)];
    if (filters.staffId) conditions.push(eq(attendance.staffId, filters.staffId));
    if (filters.branch) conditions.push(eq(attendance.branch, filters.branch));
    if (filters.month) conditions.push(like(attendance.date, `${filters.month}%`));
    if (filters.startDate && filters.endDate) {
      conditions.push(gte(attendance.date, filters.startDate));
      conditions.push(lte(attendance.date, filters.endDate));
    }
    const where = and(...conditions);
    const countRow = await db.select({ count: sql<number>`count(*)` }).from(attendance).where(where);
    const total = Number(countRow[0]?.count ?? 0);
    const offset = (filters.page - 1) * filters.limit;
    const data = await db
      .select()
      .from(attendance)
      .where(where)
      .orderBy(desc(attendance.date))
      .limit(filters.limit)
      .offset(offset);
    return { data, total };
  }

  async getSalariesPaginated(
    filters: {
      month?: string;
      year?: string;
      branch?: string;
      staffId?: string;
      status?: string;
    },
    page: number,
    limit: number
  ): Promise<{ data: Salary[]; total: number }> {
    const all = await this.getSalariesFiltered(filters);
    const total = all.length;
    const offset = (page - 1) * limit;
    return { data: all.slice(offset, offset + limit), total };
  }

  async createRefreshToken(data: {
    staffId: string;
    sessionId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const id = crypto.randomUUID();
    const expires = usePostgres ? data.expiresAt.toISOString() : String(data.expiresAt.getTime());
    const created = usePostgres ? new Date().toISOString() : String(Date.now());
    await db.run(
      sql.raw(
        `INSERT INTO refresh_tokens (id, staff_id, session_id, token_hash, expires_at, created_at) VALUES ('${id}', '${data.staffId}', '${data.sessionId}', '${data.tokenHash}', ${usePostgres ? `'${expires}'` : expires}, ${usePostgres ? `'${created}'` : created})`
      )
    );
  }

  async getValidRefreshToken(
    tokenHash: string
  ): Promise<{ id: string; staffId: string; sessionId: string } | undefined> {
    const now = usePostgres ? new Date().toISOString() : String(Date.now());
    const result = await db.run(
      sql.raw(
        usePostgres
          ? `SELECT id, staff_id, session_id FROM refresh_tokens WHERE token_hash = '${tokenHash}' AND revoked_at IS NULL AND expires_at > '${now}' LIMIT 1`
          : `SELECT id, staff_id, session_id FROM refresh_tokens WHERE token_hash = '${tokenHash}' AND revoked_at IS NULL AND expires_at > ${now} LIMIT 1`
      )
    );
    const row = (result as { rows?: { id: string; staff_id: string; session_id: string }[] }).rows?.[0];
    if (!row) return undefined;
    return { id: row.id, staffId: row.staff_id, sessionId: row.session_id };
  }

  async revokeRefreshToken(id: string): Promise<void> {
    const revoked = usePostgres ? new Date().toISOString() : String(Date.now());
    await db.run(
      sql.raw(
        usePostgres
          ? `UPDATE refresh_tokens SET revoked_at = '${revoked}' WHERE id = '${id}'`
          : `UPDATE refresh_tokens SET revoked_at = ${revoked} WHERE id = '${id}'`
      )
    );
  }

  async revokeRefreshTokensForSession(sessionId: string): Promise<void> {
    const revoked = usePostgres ? new Date().toISOString() : String(Date.now());
    await db.run(
      sql.raw(
        usePostgres
          ? `UPDATE refresh_tokens SET revoked_at = '${revoked}' WHERE session_id = '${sessionId}' AND revoked_at IS NULL`
          : `UPDATE refresh_tokens SET revoked_at = ${revoked} WHERE session_id = '${sessionId}' AND revoked_at IS NULL`
      )
    );
  }

  async purgeExpiredRefreshTokens(): Promise<void> {
    const now = usePostgres ? new Date().toISOString() : String(Date.now());
    await db.run(
      sql.raw(
        usePostgres
          ? `DELETE FROM refresh_tokens WHERE expires_at < '${now}' OR revoked_at IS NOT NULL`
          : `DELETE FROM refresh_tokens WHERE expires_at < ${now} OR revoked_at IS NOT NULL`
      )
    );
  }

  async createPatient(data: InsertPatient): Promise<Patient> {
    const payload = {
      ...data,
      fullName: (data as any).fullName ?? data.name,
    };
    const result = await db.insert(patients).values(payload as any).returning();
    return result[0];
  }

  async updatePatient(id: string, data: UpdatePatient): Promise<Patient | undefined> {
    const result = await db
      .update(patients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(patients.id, id))
      .returning();
    return result[0];
  }

  /** Soft-delete patient — preserves visits and history per Part 2 policy. */
  async deletePatient(id: string, deletedBy?: string): Promise<boolean> {
    const existing = await this.getPatient(id);
    if (!existing) return false;
    const result = await db
      .update(patients)
      .set({ deletedAt: new Date(), deletedBy: deletedBy ?? null, status: "Inactive", updatedAt: new Date() } as any)
      .where(eq(patients.id, id))
      .returning();
    return result.length > 0;
  }

  // Visit methods
  async getVisit(id: string): Promise<Visit | undefined> {
    const result = await db
      .select()
      .from(visits)
      .where(and(eq(visits.id, id), isNull(visits.deletedAt)))
      .limit(1);
    return result[0];
  }

  async getAllVisits(): Promise<Visit[]> {
    return await db
      .select()
      .from(visits)
      .where(isNull(visits.deletedAt))
      .orderBy(desc(visits.visitDate), desc(visits.createdAt));
  }

  /** Unpaid / partially paid visits remain visible regardless of month/date filters. */
  async getUnpaidVisits(staffId?: string): Promise<Visit[]> {
    const conditions = [
      isNull(visits.deletedAt),
      sql`LOWER(${visits.paymentStatus}) NOT IN ('paid', 'cancelled')`,
    ];
    if (staffId) {
      conditions.push(or(eq(visits.treatingStaffId, staffId), eq(visits.createdByStaffId, staffId))!);
    }
    return await db
      .select()
      .from(visits)
      .where(and(...conditions))
      .orderBy(desc(visits.visitDate), desc(visits.createdAt));
  }

  async getVisitsByPatient(patientId: string): Promise<Visit[]> {
    return await db
      .select()
      .from(visits)
      .where(and(eq(visits.patientId, patientId), isNull(visits.deletedAt)))
      .orderBy(desc(visits.visitDate), desc(visits.createdAt));
  }

  async getVisitsByDateRange(startDate: string, endDate: string): Promise<Visit[]> {
    return await db
      .select()
      .from(visits)
      .where(and(gte(visits.visitDate, startDate), lte(visits.visitDate, endDate), isNull(visits.deletedAt)))
      .orderBy(desc(visits.visitDate));
  }

  async getVisitsByStaffAndDateRange(staffId: string, startDate: string, endDate: string): Promise<Visit[]> {
    const targetStaff = await this.getStaff(staffId);
    const normalizedName = targetStaff?.name?.trim().toLowerCase();
    const staffMatch = normalizedName
      ? or(
          eq(visits.treatingStaffId, staffId),
          sql`LOWER(TRIM(${visits.treatingStaffName})) = ${normalizedName}`
        )
      : eq(visits.treatingStaffId, staffId);

    return await db
      .select()
      .from(visits)
      .where(
        and(
          staffMatch,
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate),
          isNull(visits.deletedAt)
        )
      )
      .orderBy(desc(visits.visitDate));
  }

  async createVisit(data: InsertVisit): Promise<Visit> {
    const result = await db.insert(visits).values(data).returning();
    return result[0];
  }

  async updateVisit(id: string, data: UpdateVisit): Promise<Visit | undefined> {
    const result = await db
      .update(visits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(visits.id, id))
      .returning();
    return result[0];
  }

  async deleteVisit(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db
      .update(visits)
      .set({ deletedAt: new Date(), deletedBy: deletedBy ?? null, updatedAt: new Date() } as any)
      .where(eq(visits.id, id))
      .returning();
    return result.length > 0;
  }

  // Attendance methods
  async getAttendance(id: string): Promise<Attendance | undefined> {
    const result = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.id, id), isNull(attendance.deletedAt)))
      .limit(1);
    return result[0];
  }

  async getAllAttendance(): Promise<Attendance[]> {
    return await db
      .select()
      .from(attendance)
      .where(isNull(attendance.deletedAt))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByStaff(staffId: string): Promise<Attendance[]> {
    return await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.staffId, staffId), isNull(attendance.deletedAt)))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByDateRange(startDate: string, endDate: string): Promise<Attendance[]> {
    return await db
      .select()
      .from(attendance)
      .where(and(gte(attendance.date, startDate), lte(attendance.date, endDate), isNull(attendance.deletedAt)))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByStaffAndMonth(staffId: string, month: string): Promise<Attendance[]> {
    // month format: YYYY-MM
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;
    return await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.staffId, staffId),
          gte(attendance.date, startDate),
          lte(attendance.date, endDate),
          isNull(attendance.deletedAt)
        )
      )
      .orderBy(asc(attendance.date));
  }

  async createAttendance(data: InsertAttendance): Promise<Attendance> {
    const staffId = data.staffId;
    const rawDate = data.date;
    const normalizedDate = rawDate ? rawDate.split('T')[0] : new Date().toISOString().split('T')[0];

    if (staffId) {
      const existing = await db
        .select()
        .from(attendance)
        .where(
          and(eq(attendance.staffId, staffId), eq(attendance.date, normalizedDate), isNull(attendance.deletedAt))
        )
        .limit(1);

      if (existing.length > 0) {
        const updateData: Record<string, any> = { status: data.status, updatedAt: new Date() };
        if (data.checkInTime) updateData.checkInTime = data.checkInTime;
        if (data.staffName) updateData.staffName = data.staffName;
        if (data.role) updateData.role = data.role;

        const updated = await db
          .update(attendance)
          .set(updateData)
          .where(eq(attendance.id, existing[0].id))
          .returning();
        return updated[0];
      }
    }

    const insertData = { ...data, date: normalizedDate } as any;
    const result = await db.insert(attendance).values(insertData).returning();
    return result[0];
  }

  async updateAttendance(id: string, data: UpdateAttendance): Promise<Attendance | undefined> {
    const cleaned = Object.fromEntries(
      Object.entries(data as Record<string, unknown>).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>;
    const result = await db
      .update(attendance)
      .set({ ...cleaned, updatedAt: new Date() } as UpdateAttendance)
      .where(eq(attendance.id, id))
      .returning();
    return result[0];
  }

  async deleteAttendance(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db
      .update(attendance)
      .set({ deletedAt: new Date(), deletedBy: deletedBy ?? null, updatedAt: new Date() } as any)
      .where(eq(attendance.id, id))
      .returning();
    return result.length > 0;
  }

  async getAttendanceByStaffAndDate(staffId: string, date: string): Promise<Attendance | undefined> {
    const result = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.staffId, staffId), eq(attendance.date, date), isNull(attendance.deletedAt)))
      .limit(1);
    return result[0];
  }

  // In-Patient Admission methods
  async getInPatientAdmission(id: string): Promise<InPatientAdmission | undefined> {
    const result = await db.select().from(inPatientAdmissions).where(eq(inPatientAdmissions.id, id)).limit(1);
    return result[0] ? (parseJsonArrays(result[0] as any, ["reportsAttachments", "idCopyAttachments"]) as InPatientAdmission) : undefined;
  }

  async getAllInPatientAdmissions(): Promise<InPatientAdmission[]> {
    const rows = await db.select().from(inPatientAdmissions).orderBy(desc(inPatientAdmissions.admitDate));
    return rows.map((r: any) =>
      parseJsonArrays(r as any, ["reportsAttachments", "idCopyAttachments"]) as InPatientAdmission
    );
  }

  async getInPatientAdmissionsByStatus(status: string): Promise<InPatientAdmission[]> {
    const rows = await db.select().from(inPatientAdmissions).where(eq(inPatientAdmissions.status, status)).orderBy(desc(inPatientAdmissions.admitDate));
    return rows.map((r: any) =>
      parseJsonArrays(r as any, ["reportsAttachments", "idCopyAttachments"]) as InPatientAdmission
    );
  }

  async createInPatientAdmission(data: InsertInPatientAdmission): Promise<InPatientAdmission> {
    const result = await db.insert(inPatientAdmissions).values(data).returning();
    return parseJsonArrays(result[0] as any, ["reportsAttachments", "idCopyAttachments"]) as InPatientAdmission;
  }

  async updateInPatientAdmission(id: string, data: UpdateInPatientAdmission): Promise<InPatientAdmission | undefined> {
    const result = await db
      .update(inPatientAdmissions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inPatientAdmissions.id, id))
      .returning();
    return result[0] ? (parseJsonArrays(result[0] as any, ["reportsAttachments", "idCopyAttachments"]) as InPatientAdmission) : undefined;
  }

  async deleteInPatientAdmission(id: string): Promise<boolean> {
    const existing = await this.getInPatientAdmission(id);
    if (!existing) return false;
    // Explicit SQL deletes by admission_id — avoids ORM/driver edge cases that still hit FK on admission row.
    await runDeleteSql(sql`DELETE FROM in_patient_extra_expenses WHERE admission_id = ${id}`);
    await runDeleteSql(sql`DELETE FROM in_patient_payments WHERE admission_id = ${id}`);
    await runDeleteSql(sql`DELETE FROM in_patient_discharges WHERE admission_id = ${id}`);
    await runDeleteSql(sql`DELETE FROM in_patient_sessions WHERE admission_id = ${id}`);
    const result = await db.delete(inPatientAdmissions).where(eq(inPatientAdmissions.id, id)).returning();
    return result.length > 0;
  }

  // In-Patient Session methods
  async getInPatientSession(id: string): Promise<InPatientSession | undefined> {
    const result = await db.select().from(inPatientSessions).where(eq(inPatientSessions.id, id)).limit(1);
    return result[0] ? (parseJsonArrays(result[0] as any, ["attachments"]) as InPatientSession) : undefined;
  }

  async getAllInPatientSessions(): Promise<InPatientSession[]> {
    const rows = await db.select().from(inPatientSessions).orderBy(desc(inPatientSessions.sessionDate));
    return rows.map((r: any) => parseJsonArrays(r as any, ["attachments"]) as InPatientSession);
  }

  async getInPatientSessionsByAdmission(admissionId: string): Promise<InPatientSession[]> {
    const rows = await db.select().from(inPatientSessions).where(eq(inPatientSessions.admissionId, admissionId)).orderBy(asc(inPatientSessions.sessionDate), asc(inPatientSessions.sessionNumber));
    return rows.map((r: any) => parseJsonArrays(r as any, ["attachments"]) as InPatientSession);
  }

  async getSessionCountForDate(admissionId: string, date: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(inPatientSessions)
      .where(and(eq(inPatientSessions.admissionId, admissionId), eq(inPatientSessions.sessionDate, date)));
    return result[0]?.count || 0;
  }

  async createInPatientSession(data: InsertInPatientSession): Promise<InPatientSession> {
    const result = await db.insert(inPatientSessions).values(data).returning();
    return parseJsonArrays(result[0] as any, ["attachments"]) as InPatientSession;
  }

  async updateInPatientSession(id: string, data: UpdateInPatientSession): Promise<InPatientSession | undefined> {
    const result = await db
      .update(inPatientSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inPatientSessions.id, id))
      .returning();
    return result[0] ? (parseJsonArrays(result[0] as any, ["attachments"]) as InPatientSession) : undefined;
  }

  async deleteInPatientSession(id: string): Promise<boolean> {
    const result = await db.delete(inPatientSessions).where(eq(inPatientSessions.id, id)).returning();
    return result.length > 0;
  }

  // In-Patient Discharge methods
  async getInPatientDischarge(id: string): Promise<InPatientDischarge | undefined> {
    const result = await db.select().from(inPatientDischarges).where(eq(inPatientDischarges.id, id)).limit(1);
    return result[0];
  }

  async getInPatientDischargeByAdmission(admissionId: string): Promise<InPatientDischarge | undefined> {
    const result = await db.select().from(inPatientDischarges).where(eq(inPatientDischarges.admissionId, admissionId)).limit(1);
    return result[0];
  }

  async createInPatientDischarge(data: InsertInPatientDischarge): Promise<InPatientDischarge> {
    const result = await db.insert(inPatientDischarges).values(data).returning();
    return result[0];
  }

  async updateInPatientDischarge(id: string, data: UpdateInPatientDischarge): Promise<InPatientDischarge | undefined> {
    const result = await db
      .update(inPatientDischarges)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inPatientDischarges.id, id))
      .returning();
    return result[0];
  }

  // In-Patient Payment methods
  async getInPatientPaymentsByAdmission(admissionId: string): Promise<InPatientPayment[]> {
    return await db.select().from(inPatientPayments).where(eq(inPatientPayments.admissionId, admissionId)).orderBy(desc(inPatientPayments.paymentDate));
  }

  async getPaymentTotalByAdmission(admissionId: string): Promise<number> {
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(inPatientPayments)
      .where(eq(inPatientPayments.admissionId, admissionId));
    return parseFloat(result[0]?.total || '0');
  }

  async createInPatientPayment(data: InsertInPatientPayment): Promise<InPatientPayment> {
    const result = await db.insert(inPatientPayments).values(data).returning();
    return result[0];
  }

  // In-Patient Extra Expense methods
  async getInPatientExtraExpensesByAdmission(admissionId: string): Promise<InPatientExtraExpense[]> {
    return await db
      .select()
      .from(inPatientExtraExpenses)
      .where(eq(inPatientExtraExpenses.admissionId, admissionId))
      .orderBy(desc(inPatientExtraExpenses.expenseDate));
  }

  async getInPatientExtraExpense(id: string): Promise<InPatientExtraExpense | undefined> {
    const result = await db.select().from(inPatientExtraExpenses).where(eq(inPatientExtraExpenses.id, id)).limit(1);
    return result[0];
  }

  async createInPatientExtraExpense(data: InsertInPatientExtraExpense): Promise<InPatientExtraExpense> {
    const result = await db.insert(inPatientExtraExpenses).values(data).returning();
    return result[0];
  }

  async updateInPatientExtraExpense(id: string, data: UpdateInPatientExtraExpense): Promise<InPatientExtraExpense | undefined> {
    const result = await db
      .update(inPatientExtraExpenses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inPatientExtraExpenses.id, id))
      .returning();
    return result[0];
  }

  async deleteInPatientExtraExpense(id: string): Promise<boolean> {
    const result = await db.delete(inPatientExtraExpenses).where(eq(inPatientExtraExpenses.id, id)).returning();
    return result.length > 0;
  }

  async getExtraExpenseTotalByAdmission(admissionId: string): Promise<number> {
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(${inPatientExtraExpenses.amount} AS REAL)), 0)` })
      .from(inPatientExtraExpenses)
      .where(eq(inPatientExtraExpenses.admissionId, admissionId));
    return parseFloat(result[0]?.total || '0');
  }

  // Expense methods
  async getExpense(id: string): Promise<Expense | undefined> {
    const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    return result[0];
  }

  async getAllExpenses(): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(isNull(expenses.deletedAt))
      .orderBy(desc(expenses.expenseDate));
  }

  async getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(
        and(gte(expenses.expenseDate, startDate), lte(expenses.expenseDate, endDate), isNull(expenses.deletedAt))
      )
      .orderBy(desc(expenses.expenseDate));
  }

  async getExpensesByStaffId(staffId: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.createdByStaffId, staffId), isNull(expenses.deletedAt)))
      .orderBy(desc(expenses.expenseDate));
  }

  async createExpense(data: InsertExpense): Promise<Expense> {
    const result = await db.insert(expenses).values(data).returning();
    return result[0];
  }

  async updateExpense(id: string, data: UpdateExpense): Promise<Expense | undefined> {
    const result = await db
      .update(expenses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    return result[0];
  }

  async deleteExpense(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db
      .update(expenses)
      .set({ deletedAt: new Date(), deletedBy: deletedBy ?? null, updatedAt: new Date() } as any)
      .where(eq(expenses.id, id))
      .returning();
    return result.length > 0;
  }

  async getExpenseTotal(startDate?: string, endDate?: string): Promise<number> {
    const conditions = [isNull(expenses.deletedAt)];
    if (startDate && endDate) {
      conditions.push(gte(expenses.expenseDate, startDate), lte(expenses.expenseDate, endDate));
    }
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(expenses)
      .where(and(...conditions));
    return parseFloat(result[0]?.total || "0");
  }

  // Revenue calculation methods
  async getTotalIncome(startDate?: string, endDate?: string): Promise<number> {
    let visitsTotal = 0;
    let inPatientPaymentsTotal = 0;

    if (startDate && endDate) {
      const visitsResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(
            CASE
              WHEN LOWER(${visits.paymentStatus}) = 'paid' THEN ${visits.paymentAmount}
              WHEN LOWER(${visits.paymentStatus}) = 'partially paid' THEN ${visits.amountPaid}
              ELSE 0
            END
          ), 0)`,
        })
        .from(visits)
        .where(and(
          sql`LOWER(${visits.paymentStatus}) IN ('paid', 'partially paid')`,
          gte(visits.visitDate, startDate),
          lte(visits.visitDate, endDate),
          isNull(visits.deletedAt)
        ));
      visitsTotal = parseFloat(visitsResult[0]?.total || '0');

      const paymentsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(inPatientPayments)
        .where(and(
          gte(inPatientPayments.paymentDate, startDate),
          lte(inPatientPayments.paymentDate, endDate)
        ));
      inPatientPaymentsTotal = parseFloat(paymentsResult[0]?.total || '0');
    } else {
      const visitsResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(
            CASE
              WHEN LOWER(${visits.paymentStatus}) = 'paid' THEN ${visits.paymentAmount}
              WHEN LOWER(${visits.paymentStatus}) = 'partially paid' THEN ${visits.amountPaid}
              ELSE 0
            END
          ), 0)`,
        })
        .from(visits)
        .where(and(sql`LOWER(${visits.paymentStatus}) IN ('paid', 'partially paid')`, isNull(visits.deletedAt)));
      visitsTotal = parseFloat(visitsResult[0]?.total || '0');

      const paymentsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(inPatientPayments);
      inPatientPaymentsTotal = parseFloat(paymentsResult[0]?.total || '0');
    }

    let dischargeTotal = 0;
    if (startDate && endDate) {
      const dischargeResult = await db
        .select({ total: sql<string>`COALESCE(SUM(amount_paid), 0)` })
        .from(inPatientDischarges)
        .where(and(
          gte(inPatientDischarges.dischargeDate, startDate),
          lte(inPatientDischarges.dischargeDate, endDate)
        ));
      dischargeTotal = parseFloat(dischargeResult[0]?.total || "0");
    } else {
      const dischargeResult = await db
        .select({ total: sql<string>`COALESCE(SUM(amount_paid), 0)` })
        .from(inPatientDischarges);
      dischargeTotal = parseFloat(dischargeResult[0]?.total || "0");
    }

    return visitsTotal + inPatientPaymentsTotal + dischargeTotal;
  }

  async getIncentiveSettings(): Promise<IncentiveSettings | undefined> {
    const result = await db.select().from(incentiveSettings).limit(1);
    return result[0];
  }

  async updateIncentiveSettings(data: UpdateIncentiveSettings): Promise<IncentiveSettings> {
    const existing = await this.getIncentiveSettings();
    if (existing) {
      const result = await db
        .update(incentiveSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(incentiveSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const id = crypto.randomUUID();
      const result = await db
        .insert(incentiveSettings)
        .values({ id, ...data } as any)
        .returning();
      return result[0];
    }
  }

  // Appointment methods
  async getAppointment(id: string): Promise<Appointment | undefined> {
    const result = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    return result[0];
  }

  async getAppointmentsByDate(date: string): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.appointmentDate, date))
      .orderBy(asc(appointments.appointmentTime));
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return await db.select().from(appointments).orderBy(desc(appointments.appointmentDate), asc(appointments.appointmentTime));
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const result = await db.insert(appointments).values(data).returning();
    return result[0];
  }

  async updateAppointment(id: string, data: UpdateAppointment): Promise<Appointment | undefined> {
    const result = await db
      .update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return result[0];
  }

  async deleteAppointment(id: string): Promise<boolean> {
    const result = await db.delete(appointments).where(eq(appointments.id, id)).returning();
    return result.length > 0;
  }

  // --- Staff fines (manual + automatic) ---

  async getStaffFinesByDateRange(startDate: string, endDate: string): Promise<StaffFine[]> {
    return await db
      .select()
      .from(staffFines)
      .where(
        and(gte(staffFines.fineDate, startDate), lte(staffFines.fineDate, endDate), isNull(staffFines.deletedAt))
      )
      .orderBy(desc(staffFines.fineDate));
  }

  async getStaffFinesByStaffAndDateRange(staffId: string, startDate: string, endDate: string): Promise<StaffFine[]> {
    return await db
      .select()
      .from(staffFines)
      .where(
        and(
          eq(staffFines.staffId, staffId),
          gte(staffFines.fineDate, startDate),
          lte(staffFines.fineDate, endDate),
          isNull(staffFines.deletedAt)
        )
      )
      .orderBy(desc(staffFines.fineDate));
  }

  async getStaffFine(id: string): Promise<StaffFine | undefined> {
    const result = await db.select().from(staffFines).where(eq(staffFines.id, id)).limit(1);
    return result[0];
  }

  async createStaffFine(data: InsertStaffFine): Promise<StaffFine> {
    const result = await db.insert(staffFines).values(data as any).returning();
    return result[0];
  }

  async updateStaffFine(id: string, data: UpdateStaffFine): Promise<StaffFine | undefined> {
    const result = await db
      .update(staffFines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(staffFines.id, id))
      .returning();
    return result[0];
  }

  async deleteStaffFine(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db
      .update(staffFines)
      .set({
        deletedAt: new Date(),
        deletedBy: deletedBy ?? null,
        updatedByStaffId: deletedBy ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(staffFines.id, id))
      .returning();
    return result.length > 0;
  }

  async staffHasVisitOrIpSessionBeforeNoon(staffId: string, day: string): Promise<boolean> {
    const dayVisits = await db
      .select()
      .from(visits)
      .where(and(eq(visits.treatingStaffId, staffId), eq(visits.visitDate, day), isNull(visits.deletedAt)));
    for (const v of dayVisits) {
      if (isStrictlyBeforeNoon(String(v.startTime))) return true;
    }
    const dayIp = await db
      .select()
      .from(inPatientSessions)
      .where(and(eq(inPatientSessions.treatingStaffId, staffId), eq(inPatientSessions.sessionDate, day)));
    for (const s of dayIp) {
      if (isStrictlyBeforeNoon(String(s.startTime))) return true;
    }
    return false;
  }

  async deleteAutoFineForStaffDate(staffId: string, fineDate: string): Promise<void> {
    await db
      .delete(staffFines)
      .where(and(eq(staffFines.staffId, staffId), eq(staffFines.fineDate, fineDate), eq(staffFines.source, "auto_no_session")));
  }

  async getAutoFineAmount(): Promise<string> {
    const settings = await this.getClinicSettings();
    return String(settings?.autoFineAmount ?? "500");
  }

  async ensureAutoFineForStaffDate(staffId: string, staffName: string, fineDate: string): Promise<void> {
    const existing = await db
      .select()
      .from(staffFines)
      .where(
        and(eq(staffFines.staffId, staffId), eq(staffFines.fineDate, fineDate), eq(staffFines.source, "auto_no_session"))
      )
      .limit(1);
    if (existing.length > 0) return;
    const amount = await this.getAutoFineAmount();
    await this.createStaffFine({
      staffId,
      staffName,
      fineDate,
      amount,
      reason: "No activity recorded before 12 PM",
      source: "auto_no_session",
      fineType: "Auto Fine",
      status: "active",
    } as InsertStaffFine);
  }

  async getVisitsForStaffMember(staffId: string): Promise<Visit[]> {
    return await db
      .select()
      .from(visits)
      .where(
        and(
          or(eq(visits.treatingStaffId, staffId), eq(visits.createdByStaffId, staffId)),
          isNull(visits.deletedAt)
        )
      )
      .orderBy(desc(visits.visitDate));
  }

  async getPatientIdsForStaff(staffId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ patientId: visits.patientId })
      .from(visits)
      .where(
        and(
          or(eq(visits.treatingStaffId, staffId), eq(visits.createdByStaffId, staffId)),
          isNull(visits.deletedAt)
        )
      );
    const assigned = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.therapistFirstVisitId, staffId), isNull(patients.deletedAt)));
    const ids = new Set([
      ...rows.map((r: { patientId: string }) => r.patientId),
      ...assigned.map((r: { id: string }) => r.id),
    ]);
    return Array.from(ids);
  }

  async getInPatientSessionsForPatient(patientId: string): Promise<InPatientSession[]> {
    const patient = await this.getPatient(patientId);
    if (!patient) return [];
    const admissions = await this.getAllInPatientAdmissions();
    const related = admissions.filter((a) => a.patientName === patient.name);
    const sessions: InPatientSession[] = [];
    for (const a of related) {
      sessions.push(...(await this.getInPatientSessionsByAdmission(a.id)));
    }
    return sessions;
  }

  async getInPatientSessionsByStaffAndDateRange(
    staffId: string,
    startDate: string,
    endDate: string
  ): Promise<InPatientSession[]> {
    const targetStaff = await this.getStaff(staffId);
    const normalizedName = targetStaff?.name?.trim().toLowerCase();
    const staffMatch = normalizedName
      ? or(
          eq(inPatientSessions.treatingStaffId, staffId),
          sql`LOWER(TRIM(${inPatientSessions.treatingStaffName})) = ${normalizedName}`
        )
      : eq(inPatientSessions.treatingStaffId, staffId);

    const rows = await db
      .select()
      .from(inPatientSessions)
      .where(
        and(
          staffMatch,
          gte(inPatientSessions.sessionDate, startDate),
          lte(inPatientSessions.sessionDate, endDate)
        )
      )
      .orderBy(desc(inPatientSessions.sessionDate), asc(inPatientSessions.sessionNumber));
    return rows.map((r: any) => parseJsonArrays(r as any, ["attachments"]) as InPatientSession);
  }

  async getAllInPatientSessionsInDateRange(startDate: string, endDate: string): Promise<InPatientSession[]> {
    const rows = await db
      .select()
      .from(inPatientSessions)
      .where(
        and(gte(inPatientSessions.sessionDate, startDate), lte(inPatientSessions.sessionDate, endDate))
      )
      .orderBy(desc(inPatientSessions.sessionDate));
    return rows.map((r: any) => parseJsonArrays(r as any, ["attachments"]) as InPatientSession);
  }

  async getClinicSettings(): Promise<ClinicSettings | undefined> {
    const result = await db.select().from(clinicSettings).limit(1);
    return result[0];
  }

  async updateClinicSettings(data: UpdateClinicSettings): Promise<ClinicSettings> {
    const existing = await this.getClinicSettings();
    const normalized = { ...data } as Record<string, unknown>;
    for (const k of ["autoFineAmount", "homeRateColombo", "homeRateBandaragama", "holidayHomeRate", "otRatePerHour", "extraHolidayDeduction"] as const) {
      if (normalized[k] !== undefined) normalized[k] = String(normalized[k]);
    }
    if (existing) {
      const result = await db
        .update(clinicSettings)
        .set({ ...normalized, updatedAt: new Date() })
        .where(eq(clinicSettings.id, existing.id))
        .returning();
      return result[0];
    }
    const id = crypto.randomUUID();
    const result = await db.insert(clinicSettings).values({ id, ...normalized } as any).returning();
    return result[0];
  }

  async getAllBranches(): Promise<Branch[]> {
    return await db.select().from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.name));
  }

  async createBranch(data: InsertBranch): Promise<Branch> {
    const result = await db.insert(branches).values(data).returning();
    return result[0];
  }

  async updateBranch(id: string, data: UpdateBranch): Promise<Branch | undefined> {
    const result = await db
      .update(branches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(branches.id, id))
      .returning();
    return result[0];
  }

  async deleteBranch(id: string): Promise<boolean> {
    const result = await db.delete(branches).where(eq(branches.id, id)).returning();
    return result.length > 0;
  }

  async seedDefaultBranches(): Promise<void> {
    await this.seedEnterpriseBranches();
  }

  async seedEnterpriseBranches(): Promise<void> {
    const { ENTERPRISE_BRANCHES, LEGACY_BRANCH_ALIASES, normalizeBranchName } = await import("@shared/branches");

    for (const b of ENTERPRISE_BRANCHES) {
      const existing = await db.select().from(branches).where(eq(branches.name, b.name)).limit(1);
      if (existing.length > 0) {
        await db
          .update(branches)
          .set({ branchName: b.shortName, code: b.code, isActive: true, updatedAt: new Date() } as any)
          .where(eq(branches.id, existing[0].id));
      } else {
        const colombo = await db.select().from(branches).where(eq(branches.name, "Colombo")).limit(1);
        if (colombo.length > 0 && b.code === "DEHIWALA") {
          await db
            .update(branches)
            .set({ name: b.name, branchName: b.shortName, code: b.code, isActive: true, updatedAt: new Date() } as any)
            .where(eq(branches.id, colombo[0].id));
        } else {
          await db.insert(branches).values({
            name: b.name,
            branchName: b.shortName,
            code: b.code,
            isActive: true,
          } as InsertBranch);
        }
      }
    }

    const allBranches: Branch[] = await db.select().from(branches).where(eq(branches.isActive, true));
    const branchByShort = new Map<string, Branch>(
      allBranches.map((br: Branch) => [normalizeBranchName(br.branchName ?? br.name), br])
    );

    for (const [legacy, modern] of Object.entries(LEGACY_BRANCH_ALIASES)) {
      if (legacy === modern.toLowerCase()) continue;
      const target = branchByShort.get(normalizeBranchName(modern));
      if (!target) continue;
      await db.run(
        sql`UPDATE patients SET branch = ${modern}, branch_id = ${target.id} WHERE LOWER(TRIM(branch)) = ${legacy}`
      );
      await db.run(
        sql`UPDATE visits SET branch = ${modern}, branch_id = ${target.id} WHERE LOWER(TRIM(branch)) = ${legacy}`
      );
      await db.run(sql`UPDATE staff SET branch = ${modern} WHERE LOWER(TRIM(branch)) = ${legacy}`);
      await db.run(sql`UPDATE attendance SET branch = ${modern} WHERE LOWER(TRIM(branch)) = ${legacy}`);
      await db.run(sql`UPDATE home_visits SET branch = ${modern} WHERE LOWER(TRIM(branch)) = ${legacy}`);
    }

    for (const br of allBranches) {
      const short = normalizeBranchName(br.branchName ?? br.name);
      await db.run(
        sql`UPDATE patients SET branch_id = ${br.id} WHERE branch_id IS NULL AND branch = ${short}`
      );
      await db.run(
        sql`UPDATE visits SET branch_id = ${br.id} WHERE branch_id IS NULL AND branch = ${short}`
      );
    }

    const mgmtRoles = ["Admin", "MD"];
    const allStaff = await this.getAllStaff();
    for (const s of allStaff) {
      const existingAccess = await this.getUserBranchAccess(s.id);
      const existingPermissions = await this.getUserBranchPermissions(s.id);
      if (existingAccess.length > 0 && existingPermissions.length > 0) continue;

      let branchIds: string[] = [];
      if (mgmtRoles.includes(s.role)) {
        branchIds = allBranches.map((b: Branch) => b.id);
      } else if (s.role === "Nexus MD") {
        branchIds = allBranches
          .filter((b: Branch) => String(b.code ?? "").toUpperCase() === "NEXUS")
          .map((b: Branch) => b.id);
      } else if (String(s.branch ?? "").toLowerCase() === "both") {
        branchIds = allBranches
          .filter((b: Branch) => {
            const code = String(b.code ?? "").toUpperCase();
            return code === "DEHIWALA" || code === "NEURO";
          })
          .map((b: Branch) => b.id);
      } else if (s.branch) {
        const match = branchByShort.get(normalizeBranchName(s.branch));
        if (match) branchIds = [match.id];
      }
      if (branchIds.length === 0 && allBranches[0]) branchIds = [allBranches[0].id];

      if (existingAccess.length === 0) {
        for (let i = 0; i < branchIds.length; i++) {
          try {
            await db.insert(userBranchAccess).values({
              staffId: s.id,
              branchId: branchIds[i],
              isDefault: i === 0,
            } as any);
          } catch {
            /* duplicate */
          }
        }
      }

      if (existingPermissions.length === 0 && branchIds.length > 0) {
        await this.setUserBranchPermissions(s.id, branchIds);
      }
    }
  }

  async getUserBranchAccess(staffId: string): Promise<{ branchId: string; isDefault: boolean }[]> {
    const rows = await db
      .select({ branchId: userBranchAccess.branchId, isDefault: userBranchAccess.isDefault })
      .from(userBranchAccess)
      .where(eq(userBranchAccess.staffId, staffId));
    return rows.map((r: { branchId: string; isDefault: boolean | number | null }) => ({
      branchId: r.branchId,
      isDefault: !!r.isDefault,
    }));
  }

  async getUserBranchPermissions(staffId: string): Promise<{ branchId: string }[]> {
    const rows = await db
      .select({ branchId: userBranchPermissions.branchId })
      .from(userBranchPermissions)
      .where(eq(userBranchPermissions.userId, staffId));
    return rows;
  }

  async setUserBranchPermissions(staffId: string, branchIds: string[]): Promise<void> {
    await db.delete(userBranchPermissions).where(eq(userBranchPermissions.userId, staffId));
    const unique = [...new Set(branchIds)];
    for (const branchId of unique) {
      await db.insert(userBranchPermissions).values({
        userId: staffId,
        branchId,
      } as any);
    }
  }

  async syncStaffBranchAccess(staffId: string, branchIds: string[]): Promise<void> {
    const unique = Array.from(new Set(branchIds.filter(Boolean)));
    if (unique.length === 0) return;
    await this.setUserBranchPermissions(staffId, unique);
    await db.delete(userBranchAccess).where(eq(userBranchAccess.staffId, staffId));
    for (let i = 0; i < unique.length; i++) {
      await db.insert(userBranchAccess).values({
        staffId,
        branchId: unique[i],
        isDefault: i === 0,
      } as any);
    }
  }

  async setUserDefaultBranch(staffId: string, branchId: string): Promise<void> {
    await db.update(userBranchAccess).set({ isDefault: false } as any).where(eq(userBranchAccess.staffId, staffId));
    const existing = await db
      .select()
      .from(userBranchAccess)
      .where(and(eq(userBranchAccess.staffId, staffId), eq(userBranchAccess.branchId, branchId)))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(userBranchAccess)
        .set({ isDefault: true } as any)
        .where(eq(userBranchAccess.id, existing[0].id));
    } else {
      await db.insert(userBranchAccess).values({ staffId, branchId, isDefault: true } as any);
    }
  }

  async getNotificationsByStaff(
    staffId: string,
    opts: { unreadOnly?: boolean; archived?: boolean; includeDeleted?: boolean } = {},
  ): Promise<Notification[]> {
    const parts: SQL[] = [eq(notifications.staffId, staffId)];
    if (!opts.includeDeleted) parts.push(isNull(notifications.deletedAt));
    if (opts.unreadOnly) parts.push(eq(notifications.isRead, false));
    if (opts.archived === true) {
      parts.push(eq(notifications.isArchived, true));
    } else if (opts.archived === false) {
      parts.push(eq(notifications.isArchived, false));
    }
    return await db
      .select()
      .from(notifications)
      .where(and(...parts))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(staffId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.staffId, staffId),
          eq(notifications.isRead, false),
          isNull(notifications.deletedAt),
          eq(notifications.isArchived, false),
        ),
      );
    return Number(rows[0]?.count ?? 0);
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(data).returning();
    const notification = result[0];
    void import("./realtime/wsHub")
      .then(({ pushNotificationToStaff }) => pushNotificationToStaff(notification.staffId, notification))
      .catch(() => {});
    return notification;
  }

  async markNotificationRead(id: string, staffId: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.staffId, staffId)))
      .returning();
    return result[0];
  }

  async markAllNotificationsRead(staffId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.staffId, staffId), isNull(notifications.deletedAt)));
  }

  async archiveNotification(id: string, staffId: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ isArchived: true })
      .where(and(eq(notifications.id, id), eq(notifications.staffId, staffId)))
      .returning();
    return result[0];
  }

  async softDeleteNotification(id: string, staffId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ deletedAt: new Date(), deletedBy: staffId })
      .where(and(eq(notifications.id, id), eq(notifications.staffId, staffId)))
      .returning();
    return result.length > 0;
  }

  async getAllTasks(status?: string): Promise<Task[]> {
    const base = isNull(tasks.deletedAt);
    if (status) {
      return await db
        .select()
        .from(tasks)
        .where(and(base, eq(tasks.status, status)))
        .orderBy(desc(tasks.createdAt));
    }
    return await db.select().from(tasks).where(base).orderBy(desc(tasks.createdAt));
  }

  async getTasksByAssignee(staffId: string, status?: string): Promise<Task[]> {
    const parts: SQL[] = [eq(tasks.assignedToStaffId, staffId), isNull(tasks.deletedAt)];
    if (status) parts.push(eq(tasks.status, status));
    return await db.select().from(tasks).where(and(...parts)).orderBy(desc(tasks.createdAt));
  }

  async getTasksForStaff(staffId: string, status?: string): Promise<Task[]> {
    const assigned = await this.getTasksByAssignee(staffId, status);
    const assignmentRows = await db
      .select({ taskId: taskAssignments.taskId })
      .from(taskAssignments)
      .where(eq(taskAssignments.staffId, staffId));
    const assignmentTaskIds = assignmentRows.map((r: { taskId: string }) => r.taskId);
    const commonTasks =
      assignmentTaskIds.length > 0
        ? await db
            .select()
            .from(tasks)
            .where(and(isNull(tasks.deletedAt), inArray(tasks.id, assignmentTaskIds)))
        : [];
    const merged = new Map<string, Task>();
    for (const t of [...assigned, ...commonTasks]) merged.set(t.id, t);
    let list = Array.from(merged.values());
    if (status) list = list.filter((t) => t.status === status);
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result[0];
  }

  async createTask(data: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(data).returning();
    return result[0];
  }

  async updateTask(id: string, data: UpdateTask): Promise<Task | undefined> {
    const result = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  async deleteTask(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db
      .update(tasks)
      .set({ deletedAt: new Date(), deletedBy: deletedBy ?? null, updatedAt: new Date() } as any)
      .where(eq(tasks.id, id))
      .returning();
    return result.length > 0;
  }

  async createTaskAssignment(data: InsertTaskAssignment): Promise<void> {
    await db.insert(taskAssignments).values(data);
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(data).returning();
    return result[0];
  }

  async getAuditLogs(params: { entityType?: string; module?: string; limit: number }): Promise<AuditLog[]> {
    const filter = params.module ?? params.entityType;
    if (filter) {
      return await db
        .select()
        .from(auditLogs)
        .where(or(eq(auditLogs.module, filter), eq(auditLogs.entityType, filter)))
        .orderBy(desc(auditLogs.createdAt))
        .limit(params.limit);
    }
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(params.limit);
  }

  async createAuthSession(data: {
    id: string;
    staffId: string;
    email: string;
    role: string;
    expiresAt: Date;
    selectedBranchId?: string | null;
  }): Promise<AuthSession> {
    const result = await db.insert(authSessions).values(data).returning();
    return result[0];
  }

  async getAuthSession(id: string): Promise<AuthSession | undefined> {
    const result = await db.select().from(authSessions).where(eq(authSessions.id, id)).limit(1);
    return result[0];
  }

  async updateAuthSessionBranch(sessionId: string, branchId: string | null): Promise<void> {
    await db
      .update(authSessions)
      .set({ selectedBranchId: branchId, selectedContext: null } as any)
      .where(eq(authSessions.id, sessionId));
  }

  async updateAuthSessionContext(sessionId: string, context: string | null): Promise<void> {
    await db
      .update(authSessions)
      .set({ selectedContext: context, selectedBranchId: null } as any)
      .where(eq(authSessions.id, sessionId));
  }

  async clearAuthSessionSelection(sessionId: string): Promise<void> {
    await db
      .update(authSessions)
      .set({ selectedBranchId: null, selectedContext: null } as any)
      .where(eq(authSessions.id, sessionId));
  }

  async deleteAuthSession(id: string): Promise<void> {
    await db.delete(authSessions).where(eq(authSessions.id, id));
  }

  async deleteExpiredAuthSessions(): Promise<void> {
    await db.delete(authSessions).where(lte(authSessions.expiresAt, new Date()));
  }

  async createPayrollSnapshot(data: InsertPayrollSnapshot): Promise<PayrollSnapshot> {
    const result = await db.insert(payrollSnapshots).values(data).returning();
    return result[0];
  }

  async getPayrollSnapshotsByStaff(staffId: string): Promise<PayrollSnapshot[]> {
    return await db
      .select()
      .from(payrollSnapshots)
      .where(eq(payrollSnapshots.staffId, staffId))
      .orderBy(desc(payrollSnapshots.createdAt));
  }

  async createSalaryRecord(data: InsertSalary): Promise<Salary> {
    const now = new Date();
    const result = await db
      .insert(salaries)
      .values({ ...data, updatedAt: now } as any)
      .returning();
    return result[0];
  }

  async getSalary(id: string): Promise<Salary | undefined> {
    const result = await db.select().from(salaries).where(eq(salaries.id, id)).limit(1);
    return result[0];
  }

  async updateSalary(id: string, data: UpdateSalary): Promise<Salary | undefined> {
    const result = await db
      .update(salaries)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(salaries.id, id))
      .returning();
    return result[0];
  }

  async getSalariesByStaff(staffId: string): Promise<Salary[]> {
    return await db
      .select()
      .from(salaries)
      .where(and(eq(salaries.staffId, staffId), isNull(salaries.deletedAt)))
      .orderBy(desc(salaries.salaryMonth));
  }

  async getSalaryByStaffAndMonth(staffId: string, salaryMonth: string): Promise<Salary | undefined> {
    const result = await db
      .select()
      .from(salaries)
      .where(
        and(
          eq(salaries.staffId, staffId),
          eq(salaries.salaryMonth, salaryMonth),
          isNull(salaries.deletedAt),
          ne(salaries.status, "Cancelled")
        )
      )
      .limit(1);
    return result[0];
  }

  async getAllSalaries(): Promise<Salary[]> {
    return await db
      .select()
      .from(salaries)
      .where(isNull(salaries.deletedAt))
      .orderBy(desc(salaries.salaryMonth));
  }

  async getSalariesFiltered(filters: {
    month?: string;
    year?: string;
    branch?: string;
    staffId?: string;
    status?: string;
  }): Promise<Salary[]> {
    const conditions: SQL[] = [isNull(salaries.deletedAt)];
    if (filters.staffId) conditions.push(eq(salaries.staffId, filters.staffId));
    if (filters.status) conditions.push(eq(salaries.status, filters.status));
    const monthPadded = filters.month ? filters.month.padStart(2, "0") : "";
    if (filters.year && filters.month) {
      conditions.push(like(salaries.salaryMonth, `${filters.year}-${monthPadded}%`));
    } else if (filters.year) {
      conditions.push(like(salaries.salaryMonth, `${filters.year}-%`));
    } else if (filters.month) {
      conditions.push(like(salaries.salaryMonth, `%-${monthPadded}-%`));
    }

    let rows = await db
      .select()
      .from(salaries)
      .where(and(...conditions))
      .orderBy(desc(salaries.salaryMonth));

    if (filters.branch) {
      const staffInBranch = await db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.branch, filters.branch), isNull(staff.deletedAt)));
      const ids = new Set(staffInBranch.map((s: { id: string }) => s.id));
      rows = rows.filter((r: Salary) => ids.has(r.staffId));
    }

    return rows;
  }

  async upsertStaffIncentiveRecord(data: InsertStaffIncentive): Promise<StaffIncentive> {
    const existing = await db
      .select()
      .from(staffIncentives)
      .where(and(eq(staffIncentives.staffId, data.staffId), eq(staffIncentives.incentiveDate, data.incentiveDate)))
      .limit(1);
    if (existing[0]) {
      const result = await db
        .update(staffIncentives)
        .set({
          clinicVisits: data.clinicVisits,
          inpatientSessions: data.inpatientSessions,
          incentiveCount: data.incentiveCount,
          incentiveAmount: data.incentiveAmount,
        } as any)
        .where(eq(staffIncentives.id, existing[0].id))
        .returning();
      return result[0];
    }
    const result = await db.insert(staffIncentives).values(data as any).returning();
    return result[0];
  }

  async createStaffDeduction(data: InsertStaffDeduction): Promise<StaffDeduction> {
    const now = new Date();
    const result = await db
      .insert(staffDeductions)
      .values({ ...data, createdAt: now, updatedAt: now } as any)
      .returning();
    return result[0];
  }

  async updateStaffDeduction(id: string, data: UpdateStaffDeduction): Promise<StaffDeduction | undefined> {
    const result = await db
      .update(staffDeductions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(staffDeductions.id, id))
      .returning();
    return result[0];
  }

  async deleteStaffDeduction(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db
      .update(staffDeductions)
      .set({ deletedAt: new Date(), deletedBy: deletedBy ?? null } as any)
      .where(eq(staffDeductions.id, id))
      .returning();
    return result.length > 0;
  }

  async getStaffDeductionsByStaffAndRange(
    staffId: string,
    startDate: string,
    endDate: string
  ): Promise<StaffDeduction[]> {
    return await db
      .select()
      .from(staffDeductions)
      .where(
        and(
          eq(staffDeductions.staffId, staffId),
          gte(staffDeductions.deductionDate, startDate),
          lte(staffDeductions.deductionDate, endDate),
          isNull(staffDeductions.deletedAt)
        )
      )
      .orderBy(desc(staffDeductions.deductionDate));
  }

  async getAllStaffDeductions(): Promise<StaffDeduction[]> {
    return await db
      .select()
      .from(staffDeductions)
      .where(isNull(staffDeductions.deletedAt))
      .orderBy(desc(staffDeductions.deductionDate));
  }

  async createStaffOtEntry(data: InsertStaffOtEntry & { amount?: string }): Promise<StaffOtEntry> {
    const settings = await this.getClinicSettings();
    const otPerHour = Number(settings?.otRatePerHour ?? 250);
    const hours = Math.max(0, Number(data.hours) || 0);
    const amount = String(data.amount ?? hours * otPerHour);
    const now = new Date();
    const result = await db
      .insert(staffOtEntries)
      .values({ ...data, hours: String(hours), amount, createdAt: now, updatedAt: now } as any)
      .returning();
    return result[0];
  }

  async updateStaffOtEntry(id: string, data: UpdateStaffOtEntry): Promise<StaffOtEntry | undefined> {
    const patch: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.hours != null) {
      const settings = await this.getClinicSettings();
      const otPerHour = Number(settings?.otRatePerHour ?? 250);
      const hours = Math.max(0, Number(data.hours) || 0);
      patch.hours = String(hours);
      patch.amount = String(hours * otPerHour);
    }
    const result = await db
      .update(staffOtEntries)
      .set(patch as any)
      .where(eq(staffOtEntries.id, id))
      .returning();
    return result[0];
  }

  async deleteStaffOtEntry(id: string, deletedBy?: string): Promise<boolean> {
    const result = await db
      .update(staffOtEntries)
      .set({ deletedAt: new Date(), deletedBy: deletedBy ?? null } as any)
      .where(eq(staffOtEntries.id, id))
      .returning();
    return result.length > 0;
  }

  async getStaffOtEntriesByStaffAndRange(
    staffId: string,
    startDate: string,
    endDate: string
  ): Promise<StaffOtEntry[]> {
    return await db
      .select()
      .from(staffOtEntries)
      .where(
        and(
          eq(staffOtEntries.staffId, staffId),
          gte(staffOtEntries.otDate, startDate),
          lte(staffOtEntries.otDate, endDate),
          isNull(staffOtEntries.deletedAt)
        )
      )
      .orderBy(desc(staffOtEntries.otDate));
  }

  async getAllStaffOtEntries(): Promise<StaffOtEntry[]> {
    return await db
      .select()
      .from(staffOtEntries)
      .where(isNull(staffOtEntries.deletedAt))
      .orderBy(desc(staffOtEntries.otDate));
  }

  async createVisitPayment(data: InsertVisitPayment): Promise<VisitPayment> {
    const result = await db.insert(visitPayments).values(data as any).returning();
    return result[0];
  }

  async getVisitPaymentsByVisit(visitId: string): Promise<VisitPayment[]> {
    return await db
      .select()
      .from(visitPayments)
      .where(and(eq(visitPayments.visitId, visitId), isNull(visitPayments.deletedAt)))
      .orderBy(desc(visitPayments.paymentDate));
  }

  async createPatientDocument(data: InsertPatientDocument): Promise<PatientDocument> {
    const result = await db.insert(patientDocuments).values(data as any).returning();
    return result[0];
  }

  async getPatientDocument(id: string): Promise<PatientDocument | undefined> {
    const result = await db
      .select()
      .from(patientDocuments)
      .where(and(eq(patientDocuments.id, id), isNull(patientDocuments.deletedAt)))
      .limit(1);
    return result[0];
  }

  async getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
    return await db
      .select()
      .from(patientDocuments)
      .where(and(eq(patientDocuments.patientId, patientId), isNull(patientDocuments.deletedAt)))
      .orderBy(desc(patientDocuments.createdAt));
  }

  async updatePatientDocumentUri(id: string, fileUri: string): Promise<PatientDocument | undefined> {
    const result = await db
      .update(patientDocuments)
      .set({ fileUri } as any)
      .where(eq(patientDocuments.id, id))
      .returning();
    return result[0];
  }

  async deletePatientDocument(id: string): Promise<boolean> {
    const result = await db
      .update(patientDocuments)
      .set({ deletedAt: new Date() } as any)
      .where(eq(patientDocuments.id, id))
      .returning();
    return result.length > 0;
  }

  async createPatientNote(data: InsertPatientNote): Promise<PatientNote> {
    const result = await db.insert(patientNotes).values(data as any).returning();
    return result[0];
  }

  async getPatientNotes(patientId: string): Promise<PatientNote[]> {
    return await db
      .select()
      .from(patientNotes)
      .where(and(eq(patientNotes.patientId, patientId), isNull(patientNotes.deletedAt)))
      .orderBy(desc(patientNotes.createdAt));
  }

  async deletePatientNote(id: string): Promise<boolean> {
    const result = await db
      .update(patientNotes)
      .set({ deletedAt: new Date() } as any)
      .where(eq(patientNotes.id, id))
      .returning();
    return result.length > 0;
  }

  async getHomeVisitsFiltered(filters: {
    startDate?: string;
    endDate?: string;
    branch?: string;
    staffId?: string;
    visitType?: string;
  }): Promise<HomeVisit[]> {
    const conditions: SQL[] = [isNull(homeVisits.deletedAt)];
    if (filters.staffId) conditions.push(eq(homeVisits.staffId, filters.staffId));
    if (filters.branch) conditions.push(eq(homeVisits.branch, filters.branch));
    if (filters.visitType) conditions.push(eq(homeVisits.visitType, filters.visitType));
    if (filters.startDate) conditions.push(gte(homeVisits.visitDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(homeVisits.visitDate, filters.endDate));

    return await db
      .select()
      .from(homeVisits)
      .where(and(...conditions))
      .orderBy(desc(homeVisits.visitDate));
  }

  async upsertHomeVisitFromVisit(data: InsertHomeVisit & { visitId: string }): Promise<HomeVisit> {
    const existing = await db
      .select()
      .from(homeVisits)
      .where(and(eq(homeVisits.visitId, data.visitId), isNull(homeVisits.deletedAt)))
      .limit(1);
    const now = new Date();
    const payload = {
      ...data,
      visitDateTs: data.visitDate ? new Date(data.visitDate) : now,
      createdAt: now,
    };
    if (existing[0]) {
      const result = await db
        .update(homeVisits)
        .set(payload as any)
        .where(eq(homeVisits.id, existing[0].id))
        .returning();
      return result[0];
    }
    const result = await db.insert(homeVisits).values(payload as any).returning();
    return result[0];
  }

  async createHomeVisit(data: InsertHomeVisit): Promise<HomeVisit> {
    const now = new Date();
    const result = await db
      .insert(homeVisits)
      .values({ ...data, visitDateTs: data.visitDate ? new Date(data.visitDate) : now, createdAt: now } as any)
      .returning();
    return result[0];
  }

  async getHomeVisit(id: string): Promise<HomeVisit | undefined> {
    const result = await db
      .select()
      .from(homeVisits)
      .where(and(eq(homeVisits.id, id), isNull(homeVisits.deletedAt)))
      .limit(1);
    return result[0];
  }

  async updateHomeVisit(id: string, data: Partial<InsertHomeVisit>): Promise<HomeVisit | undefined> {
    const patch: Record<string, unknown> = { ...data };
    if (data.visitDate) patch.visitDateTs = new Date(data.visitDate);
    const result = await db
      .update(homeVisits)
      .set(patch as any)
      .where(and(eq(homeVisits.id, id), isNull(homeVisits.deletedAt)))
      .returning();
    return result[0];
  }

  async deleteHomeVisit(id: string): Promise<boolean> {
    const result = await db
      .update(homeVisits)
      .set({ deletedAt: new Date() } as any)
      .where(and(eq(homeVisits.id, id), isNull(homeVisits.deletedAt)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
