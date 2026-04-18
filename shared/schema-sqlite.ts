import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Staff table
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(),
  branch: text("branch"),
  address: text("address"),
  nic: text("nic"),
  passportNo: text("passport_no"),
  phone: text("phone"),
  degree: text("degree"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertStaffSchema = createInsertSchema(staff).omit({ id: true, createdAt: true, updatedAt: true });
export const updateStaffSchema = insertStaffSchema.partial().omit({ password: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type UpdateStaff = z.infer<typeof updateStaffSchema>;
export type Staff = typeof staff.$inferSelect;

// Patients table
export const patients = sqliteTable("patients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  address: text("address").notNull(),
  registeredDate: text("registered_date").notNull(),
  branch: text("branch").notNull(),
  status: text("status").notNull().default("Active"),
  defaultVisitType: text("default_visit_type").notNull(),
  condition: text("condition"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  age: z.number().int().min(1, "Age must be at least 1").max(130),
});
export const updatePatientSchema = insertPatientSchema.partial();
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type UpdatePatient = z.infer<typeof updatePatientSchema>;
export type Patient = typeof patients.$inferSelect;

// Visits table
export const visits = sqliteTable("visits", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().references(() => patients.id),
  sessionNumber: integer("session_number").notNull(),
  condition: text("condition").notNull(),
  treatment: text("treatment").notNull(),
  visitDate: text("visit_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  branch: text("branch").notNull(),
  visitType: text("visit_type").notNull(),
  status: text("status").notNull(),
  paymentAmount: text("payment_amount").notNull(),
  paymentStatus: text("payment_status").notNull(),
  paymentMode: text("payment_mode").notNull(),
  notes: text("notes"),
  improvements: text("improvements"),
  reportImageUri: text("report_image_uri"),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  treatingStaffId: text("treating_staff_id").notNull().references(() => staff.id),
  treatingStaffName: text("treating_staff_name").notNull(),
  lastUpdatedByStaffId: text("last_updated_by_staff_id"),
  lastUpdatedByName: text("last_updated_by_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertVisitSchema = createInsertSchema(visits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdatedByStaffId: true,
  lastUpdatedByName: true,
}).extend({
  paymentAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  notes: z.string().nullable().optional(),
  improvements: z.string().nullable().optional(),
  reportImageUri: z.string().nullable().optional(),
});
export const updateVisitSchema = insertVisitSchema.partial();
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type UpdateVisit = z.infer<typeof updateVisitSchema>;
export type Visit = typeof visits.$inferSelect;

// Attendance table
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  role: text("role").notNull(),
  date: text("date").notNull(),
  status: text("status").notNull(),
  checkInTime: integer("check_in_time", { mode: "timestamp" }),
  checkOutTime: integer("check_out_time", { mode: "timestamp" }),
  overtimeHours: text("overtime_hours"),
  branch: text("branch"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  staffId: z.string().optional(),
  staffName: z.string().optional(),
  role: z.string().optional(),
  date: z.string().optional(),
});
export const updateAttendanceSchema = insertAttendanceSchema.partial();
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type UpdateAttendance = z.infer<typeof updateAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

// In-Patient Admission table
export const inPatientAdmissions = sqliteTable("in_patient_admissions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientName: text("patient_name").notNull(),
  age: integer("age").notNull(),
  condition: text("condition").notNull(),
  careTakerName: text("care_taker_name").notNull(),
  careTakerRelationship: text("care_taker_relationship").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  patientIdNo: text("patient_id_no"),
  careTakerIdNo: text("care_taker_id_no"),
  packageType: text("package_type").notNull(),
  admitDate: text("admit_date").notNull(),
  amountPerDay: text("amount_per_day").notNull(),
  careTakerRatePerDay: text("care_taker_rate_per_day").notNull().default("0"),
  careTakerDaysOverride: integer("care_taker_days_override"),
  reportsAttachments: text("reports_attachments"), // JSON string
  idCopyAttachments: text("id_copy_attachments"), // JSON string
  status: text("status").notNull().default("Admitted"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertInPatientAdmissionSchema = createInsertSchema(inPatientAdmissions)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    reportsAttachments: z.union([z.array(z.string()), z.string()]).transform((v) => (Array.isArray(v) ? JSON.stringify(v) : v ?? null)).optional().nullable(),
    idCopyAttachments: z.union([z.array(z.string()), z.string()]).transform((v) => (Array.isArray(v) ? JSON.stringify(v) : v ?? null)).optional().nullable(),
  });
export const updateInPatientAdmissionSchema = insertInPatientAdmissionSchema.partial();
export type InsertInPatientAdmission = z.infer<typeof insertInPatientAdmissionSchema>;
export type UpdateInPatientAdmission = z.infer<typeof updateInPatientAdmissionSchema>;
export type InPatientAdmission = typeof inPatientAdmissions.$inferSelect;

// In-Patient Session table
export const inPatientSessions = sqliteTable("in_patient_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  admissionId: text("admission_id").notNull().references(() => inPatientAdmissions.id),
  patientName: text("patient_name").notNull(),
  sessionDate: text("session_date").notNull(),
  treatingStaffId: text("treating_staff_id").notNull().references(() => staff.id),
  treatingStaffName: text("treating_staff_name").notNull(),
  sessionNumber: integer("session_number").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  treatmentProvided: text("treatment_provided").notNull(),
  improvements: text("improvements"),
  attachments: text("attachments"), // JSON string
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertInPatientSessionSchema = createInsertSchema(inPatientSessions)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    attachments: z.union([z.array(z.string()), z.string()]).optional().transform((v) => (Array.isArray(v) ? JSON.stringify(v) : v ?? null)),
  });
export const updateInPatientSessionSchema = insertInPatientSessionSchema.partial();
export type InsertInPatientSession = z.infer<typeof insertInPatientSessionSchema>;
export type UpdateInPatientSession = z.infer<typeof updateInPatientSessionSchema>;
export type InPatientSession = typeof inPatientSessions.$inferSelect;

// In-Patient Discharge table
export const inPatientDischarges = sqliteTable("in_patient_discharges", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  admissionId: text("admission_id").notNull().references(() => inPatientAdmissions.id),
  patientName: text("patient_name").notNull(),
  dischargeDate: text("discharge_date").notNull(),
  daysCount: integer("days_count").notNull(),
  amountPerDay: text("amount_per_day").notNull(),
  stayAmount: text("stay_amount").notNull(),
  otherAmounts: text("other_amounts"),
  otherTotal: text("other_total").notNull().default("0"),
  grandTotal: text("grand_total").notNull(),
  amountPaid: text("amount_paid").notNull(),
  balance: text("balance").notNull(),
  paymentStatus: text("payment_status").notNull(),
  paymentMode: text("payment_mode").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertInPatientDischargeSchema = createInsertSchema(inPatientDischarges).omit({ id: true, createdAt: true, updatedAt: true });
export const updateInPatientDischargeSchema = insertInPatientDischargeSchema.partial();
export type InsertInPatientDischarge = z.infer<typeof insertInPatientDischargeSchema>;
export type UpdateInPatientDischarge = z.infer<typeof updateInPatientDischargeSchema>;
export type InPatientDischarge = typeof inPatientDischarges.$inferSelect;

// In-Patient Payments table
export const inPatientPayments = sqliteTable("in_patient_payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  admissionId: text("admission_id").notNull().references(() => inPatientAdmissions.id),
  paymentDate: text("payment_date").notNull(),
  amount: text("amount").notNull(),
  paymentMode: text("payment_mode").notNull(),
  notes: text("notes"),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertInPatientPaymentSchema = createInsertSchema(inPatientPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const updateInPatientPaymentSchema = insertInPatientPaymentSchema.partial();
export type InsertInPatientPayment = z.infer<typeof insertInPatientPaymentSchema>;
export type UpdateInPatientPayment = z.infer<typeof updateInPatientPaymentSchema>;
export type InPatientPayment = typeof inPatientPayments.$inferSelect;

// In-Patient Extra Expenses table
export const inPatientExtraExpenses = sqliteTable("in_patient_extra_expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  admissionId: text("admission_id").notNull().references(() => inPatientAdmissions.id),
  expenseDate: text("expense_date").notNull(),
  category: text("category").notNull(),
  amount: text("amount").notNull(),
  description: text("description"),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdByStaffName: text("created_by_staff_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertInPatientExtraExpenseSchema = createInsertSchema(inPatientExtraExpenses).omit({ id: true, createdAt: true, updatedAt: true });
export const updateInPatientExtraExpenseSchema = insertInPatientExtraExpenseSchema.partial();
export type InsertInPatientExtraExpense = z.infer<typeof insertInPatientExtraExpenseSchema>;
export type UpdateInPatientExtraExpense = z.infer<typeof updateInPatientExtraExpenseSchema>;
export type InPatientExtraExpense = typeof inPatientExtraExpenses.$inferSelect;

// Expenses table
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  expenseDate: text("expense_date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amount: text("amount").notNull(),
  paymentMode: text("payment_mode").notNull(),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  description: z.string().nullable().optional(),
});
export const updateExpenseSchema = insertExpenseSchema.partial();
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type UpdateExpense = z.infer<typeof updateExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Incentive Settings table
export const incentiveSettings = sqliteTable("incentive_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  incentiveEnabled: text("incentive_enabled").notNull().default("true"),
  minPatientsForIncentive: integer("min_patients_for_incentive").notNull().default(5),
  incentivePerPatient: integer("incentive_per_patient").notNull().default(100),
  clinicLocationScope: text("clinic_location_scope").notNull().default("Colombo"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertIncentiveSettingsSchema = createInsertSchema(incentiveSettings).omit({ id: true, updatedAt: true });
export const updateIncentiveSettingsSchema = insertIncentiveSettingsSchema.partial();
export type InsertIncentiveSettings = z.infer<typeof insertIncentiveSettingsSchema>;
export type UpdateIncentiveSettings = z.infer<typeof updateIncentiveSettingsSchema>;
export type IncentiveSettings = typeof incentiveSettings.$inferSelect;

// Appointments table
export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  appointmentDate: text("appointment_date").notNull(),
  appointmentTime: text("appointment_time").notNull(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  patientName: text("patient_name").notNull(),
  treatingStaffId: text("treating_staff_id").notNull().references(() => staff.id),
  treatingStaffName: text("treating_staff_name").notNull(),
  notes: text("notes"),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, updatedAt: true });
export const updateAppointmentSchema = insertAppointmentSchema.partial();
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type UpdateAppointment = z.infer<typeof updateAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

// Staff fines (manual + automatic)
export const staffFines = sqliteTable("staff_fines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  fineDate: text("fine_date").notNull(),
  amount: text("amount").notNull().default("500"),
  reason: text("reason").notNull(),
  source: text("source").notNull().default("manual"),
  createdByStaffId: text("created_by_staff_id"),
  createdByName: text("created_by_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertStaffFineSchema = createInsertSchema(staffFines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdByStaffId: true,
  createdByName: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});
export const updateStaffFineSchema = insertStaffFineSchema.partial();
export type InsertStaffFine = z.infer<typeof insertStaffFineSchema>;
export type UpdateStaffFine = z.infer<typeof updateStaffFineSchema>;
export type StaffFine = typeof staffFines.$inferSelect;
