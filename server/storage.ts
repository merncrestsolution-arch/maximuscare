import { eq, and, gte, lte, desc, asc, sql, type SQL } from "drizzle-orm";

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
} from "@shared/schema";

export interface IStorage {
  // Staff methods
  getStaff(id: string): Promise<Staff | undefined>;
  getStaffByEmail(email: string): Promise<Staff | undefined>;
  getAllStaff(): Promise<Staff[]>;
  createStaff(data: InsertStaff): Promise<Staff>;
  updateStaff(id: string, data: UpdateStaff): Promise<Staff | undefined>;
  deleteStaff(id: string): Promise<boolean>;

  // Patient methods
  getPatient(id: string): Promise<Patient | undefined>;
  getAllPatients(): Promise<Patient[]>;
  getPatientsByBranch(branch: string): Promise<Patient[]>;
  createPatient(data: InsertPatient): Promise<Patient>;
  updatePatient(id: string, data: UpdatePatient): Promise<Patient | undefined>;
  deletePatient(id: string): Promise<boolean>;

  // Visit methods
  getVisit(id: string): Promise<Visit | undefined>;
  getAllVisits(): Promise<Visit[]>;
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
  deleteExpense(id: string): Promise<boolean>;
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
    return await db.select().from(staff).orderBy(asc(staff.name));
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

  async deleteStaff(id: string): Promise<boolean> {
    const result = await db.delete(staff).where(eq(staff.id, id)).returning();
    return result.length > 0;
  }

  // Patient methods
  async getPatient(id: string): Promise<Patient | undefined> {
    const result = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    return result[0];
  }

  async getAllPatients(): Promise<Patient[]> {
    return await db.select().from(patients).orderBy(desc(patients.registeredDate));
  }

  async getPatientsByBranch(branch: string): Promise<Patient[]> {
    return await db.select().from(patients).where(eq(patients.branch, branch)).orderBy(desc(patients.registeredDate));
  }

  async createPatient(data: InsertPatient): Promise<Patient> {
    const result = await db.insert(patients).values(data).returning();
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

  /** Deletes patient after removing dependent rows (visits, appointments) so FK constraints succeed. */
  async deletePatient(id: string): Promise<boolean> {
    const existing = await this.getPatient(id);
    if (!existing) return false;
    await db.delete(appointments).where(eq(appointments.patientId, id));
    await db.delete(visits).where(eq(visits.patientId, id));
    const result = await db.delete(patients).where(eq(patients.id, id)).returning();
    return result.length > 0;
  }

  // Visit methods
  async getVisit(id: string): Promise<Visit | undefined> {
    const result = await db.select().from(visits).where(eq(visits.id, id)).limit(1);
    return result[0];
  }

  async getAllVisits(): Promise<Visit[]> {
    return await db.select().from(visits).orderBy(desc(visits.visitDate), desc(visits.createdAt));
  }

  async getVisitsByPatient(patientId: string): Promise<Visit[]> {
    return await db
      .select()
      .from(visits)
      .where(eq(visits.patientId, patientId))
      .orderBy(desc(visits.visitDate), desc(visits.createdAt));
  }

  async getVisitsByDateRange(startDate: string, endDate: string): Promise<Visit[]> {
    return await db
      .select()
      .from(visits)
      .where(and(gte(visits.visitDate, startDate), sql`${visits.visitDate} < ${endDate}`))
      .orderBy(desc(visits.visitDate));
  }

  async getVisitsByStaffAndDateRange(staffId: string, startDate: string, endDate: string): Promise<Visit[]> {
    return await db
      .select()
      .from(visits)
      .where(
        and(
          eq(visits.treatingStaffId, staffId),
          gte(visits.visitDate, startDate),
          sql`${visits.visitDate} < ${endDate}`
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

  async deleteVisit(id: string): Promise<boolean> {
    const result = await db.delete(visits).where(eq(visits.id, id)).returning();
    return result.length > 0;
  }

  // Attendance methods
  async getAttendance(id: string): Promise<Attendance | undefined> {
    const result = await db.select().from(attendance).where(eq(attendance.id, id)).limit(1);
    return result[0];
  }

  async getAllAttendance(): Promise<Attendance[]> {
    return await db.select().from(attendance).orderBy(desc(attendance.date));
  }

  async getAttendanceByStaff(staffId: string): Promise<Attendance[]> {
    return await db
      .select()
      .from(attendance)
      .where(eq(attendance.staffId, staffId))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByDateRange(startDate: string, endDate: string): Promise<Attendance[]> {
    return await db
      .select()
      .from(attendance)
      .where(and(gte(attendance.date, startDate), lte(attendance.date, endDate)))
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
          lte(attendance.date, endDate)
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
        .where(and(eq(attendance.staffId, staffId), eq(attendance.date, normalizedDate)))
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

  async deleteAttendance(id: string): Promise<boolean> {
    const result = await db.delete(attendance).where(eq(attendance.id, id)).returning();
    return result.length > 0;
  }

  async getAttendanceByStaffAndDate(staffId: string, date: string): Promise<Attendance | undefined> {
    const result = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.staffId, staffId), eq(attendance.date, date)))
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
    return await db.select().from(expenses).orderBy(desc(expenses.expenseDate));
  }

  async getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(and(gte(expenses.expenseDate, startDate), sql`${expenses.expenseDate} < ${endDate}`))
      .orderBy(desc(expenses.expenseDate));
  }

  async getExpensesByStaffId(staffId: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(eq(expenses.createdByStaffId, staffId))
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

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning();
    return result.length > 0;
  }

  async getExpenseTotal(startDate?: string, endDate?: string): Promise<number> {
    let query = db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(expenses);
    
    if (startDate && endDate) {
      query = query.where(and(gte(expenses.expenseDate, startDate), sql`${expenses.expenseDate} < ${endDate}`)) as typeof query;
    }
    
    const result = await query;
    return parseFloat(result[0]?.total || '0');
  }

  // Revenue calculation methods
  async getTotalIncome(startDate?: string, endDate?: string): Promise<number> {
    let visitsTotal = 0;
    let inPatientPaymentsTotal = 0;

    if (startDate && endDate) {
      const visitsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(payment_amount), 0)` })
        .from(visits)
        .where(and(
          sql`LOWER(${visits.paymentStatus}) = 'paid'`,
          gte(visits.visitDate, startDate),
          sql`${visits.visitDate} < ${endDate}`
        ));
      visitsTotal = parseFloat(visitsResult[0]?.total || '0');

      const paymentsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(inPatientPayments)
        .where(and(
          gte(inPatientPayments.paymentDate, startDate),
          sql`${inPatientPayments.paymentDate} < ${endDate}`
        ));
      inPatientPaymentsTotal = parseFloat(paymentsResult[0]?.total || '0');
    } else {
      const visitsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(payment_amount), 0)` })
        .from(visits)
        .where(sql`LOWER(${visits.paymentStatus}) = 'paid'`);
      visitsTotal = parseFloat(visitsResult[0]?.total || '0');

      const paymentsResult = await db
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(inPatientPayments);
      inPatientPaymentsTotal = parseFloat(paymentsResult[0]?.total || '0');
    }

    return visitsTotal + inPatientPaymentsTotal;
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
}

export const storage = new DatabaseStorage();
