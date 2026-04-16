import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staff).omit({ id: true, createdAt: true, updatedAt: true });
export const updateStaffSchema = insertStaffSchema.partial().omit({ password: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type UpdateStaff = z.infer<typeof updateStaffSchema>;
export type Staff = typeof staff.$inferSelect;

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  address: text("address").notNull(),
  registeredDate: date("registered_date").notNull(),
  branch: text("branch").notNull(),
  status: text("status").notNull().default("Active"),
  defaultVisitType: text("default_visit_type").notNull(),
  condition: text("condition"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  age: z.number().int().min(1, "Age must be at least 1").max(130),
});
export const updatePatientSchema = insertPatientSchema.partial();
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type UpdatePatient = z.infer<typeof updatePatientSchema>;
export type Patient = typeof patients.$inferSelect;

export const visits = pgTable("visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  sessionNumber: integer("session_number").notNull(),
  condition: text("condition").notNull(),
  treatment: text("treatment").notNull(),
  visitDate: date("visit_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  branch: text("branch").notNull(),
  visitType: text("visit_type").notNull(),
  status: text("status").notNull(),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").notNull(),
  paymentMode: text("payment_mode").notNull(),
  notes: text("notes"),
  improvements: text("improvements"),
  reportImageUri: text("report_image_uri"),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  treatingStaffId: varchar("treating_staff_id").notNull().references(() => staff.id),
  treatingStaffName: text("treating_staff_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVisitSchema = createInsertSchema(visits).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  paymentAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  notes: z.string().nullable().optional(),
  improvements: z.string().nullable().optional(),
  reportImageUri: z.string().nullable().optional(),
});
export const updateVisitSchema = insertVisitSchema.partial();
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type UpdateVisit = z.infer<typeof updateVisitSchema>;
export type Visit = typeof visits.$inferSelect;

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  role: text("role").notNull(),
  date: date("date").notNull(),
  status: text("status").notNull(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  overtimeHours: decimal("overtime_hours", { precision: 4, scale: 2 }),
  branch: text("branch"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

export const inPatientAdmissions = pgTable("in_patient_admissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  admitDate: date("admit_date").notNull(),
  amountPerDay: decimal("amount_per_day", { precision: 10, scale: 2 }).notNull(),
  careTakerRatePerDay: decimal("care_taker_rate_per_day", { precision: 10, scale: 2 }).notNull().default("0"),
  careTakerDaysOverride: integer("care_taker_days_override"),
  reportsAttachments: text("reports_attachments").array(),
  idCopyAttachments: text("id_copy_attachments").array(),
  status: text("status").notNull().default("Admitted"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInPatientAdmissionSchema = createInsertSchema(inPatientAdmissions)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    reportsAttachments: z.union([z.array(z.string()), z.string(), z.null()]).optional().transform((v) => {
      if (v === undefined || v === null || v === "") return undefined;
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v || "[]");
        } catch {
          return [];
        }
      }
      return [];
    }),
    idCopyAttachments: z.union([z.array(z.string()), z.string(), z.null()]).optional().transform((v) => {
      if (v === undefined || v === null || v === "") return undefined;
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v || "[]");
        } catch {
          return [];
        }
      }
      return [];
    }),
  });
export const updateInPatientAdmissionSchema = insertInPatientAdmissionSchema.partial();
export type InsertInPatientAdmission = z.infer<typeof insertInPatientAdmissionSchema>;
export type UpdateInPatientAdmission = z.infer<typeof updateInPatientAdmissionSchema>;
export type InPatientAdmission = typeof inPatientAdmissions.$inferSelect;

export const inPatientSessions = pgTable("in_patient_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionId: varchar("admission_id").notNull().references(() => inPatientAdmissions.id),
  patientName: text("patient_name").notNull(),
  sessionDate: date("session_date").notNull(),
  treatingStaffId: varchar("treating_staff_id").notNull().references(() => staff.id),
  treatingStaffName: text("treating_staff_name").notNull(),
  sessionNumber: integer("session_number").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  treatmentProvided: text("treatment_provided").notNull(),
  improvements: text("improvements"),
  attachments: text("attachments").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInPatientSessionSchema = createInsertSchema(inPatientSessions)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    sessionNumber: z.number().optional(),
    attachments: z.union([z.array(z.string()), z.string()]).optional().transform((v) => {
      if (v === undefined || v === null) return undefined;
      return Array.isArray(v) ? v : (typeof v === "string" ? JSON.parse(v || "[]") : []);
    }),
  });
export const updateInPatientSessionSchema = insertInPatientSessionSchema.partial();
export type InsertInPatientSession = z.infer<typeof insertInPatientSessionSchema>;
export type UpdateInPatientSession = z.infer<typeof updateInPatientSessionSchema>;
export type InPatientSession = typeof inPatientSessions.$inferSelect;

export const inPatientDischarges = pgTable("in_patient_discharges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionId: varchar("admission_id").notNull().references(() => inPatientAdmissions.id),
  patientName: text("patient_name").notNull(),
  dischargeDate: date("discharge_date").notNull(),
  daysCount: integer("days_count").notNull(),
  amountPerDay: decimal("amount_per_day", { precision: 10, scale: 2 }).notNull(),
  stayAmount: decimal("stay_amount", { precision: 10, scale: 2 }).notNull(),
  otherAmounts: text("other_amounts"),
  otherTotal: decimal("other_total", { precision: 10, scale: 2 }).notNull().default("0"),
  grandTotal: decimal("grand_total", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").notNull(),
  paymentMode: text("payment_mode").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInPatientDischargeSchema = createInsertSchema(inPatientDischarges).omit({ id: true, createdAt: true, updatedAt: true });
export const updateInPatientDischargeSchema = insertInPatientDischargeSchema.partial();
export type InsertInPatientDischarge = z.infer<typeof insertInPatientDischargeSchema>;
export type UpdateInPatientDischarge = z.infer<typeof updateInPatientDischargeSchema>;
export type InPatientDischarge = typeof inPatientDischarges.$inferSelect;

export const inPatientPayments = pgTable("in_patient_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionId: varchar("admission_id").notNull().references(() => inPatientAdmissions.id),
  paymentDate: date("payment_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull(),
  notes: text("notes"),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInPatientPaymentSchema = createInsertSchema(inPatientPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const updateInPatientPaymentSchema = insertInPatientPaymentSchema.partial();
export type InsertInPatientPayment = z.infer<typeof insertInPatientPaymentSchema>;
export type UpdateInPatientPayment = z.infer<typeof updateInPatientPaymentSchema>;
export type InPatientPayment = typeof inPatientPayments.$inferSelect;

export const inPatientExtraExpenses = pgTable("in_patient_extra_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionId: varchar("admission_id").notNull().references(() => inPatientAdmissions.id),
  expenseDate: date("expense_date").notNull(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdByStaffName: text("created_by_staff_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInPatientExtraExpenseSchema = createInsertSchema(inPatientExtraExpenses).omit({ id: true, createdAt: true, updatedAt: true });
export const updateInPatientExtraExpenseSchema = insertInPatientExtraExpenseSchema.partial();
export type InsertInPatientExtraExpense = z.infer<typeof insertInPatientExtraExpenseSchema>;
export type UpdateInPatientExtraExpense = z.infer<typeof updateInPatientExtraExpenseSchema>;
export type InPatientExtraExpense = typeof inPatientExtraExpenses.$inferSelect;

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseDate: date("expense_date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull(),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  description: z.string().nullable().optional(),
});
export const updateExpenseSchema = insertExpenseSchema.partial();
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type UpdateExpense = z.infer<typeof updateExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const incentiveSettings = pgTable("incentive_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incentiveEnabled: text("incentive_enabled").notNull().default("true"),
  minPatientsForIncentive: integer("min_patients_for_incentive").notNull().default(5),
  incentivePerPatient: integer("incentive_per_patient").notNull().default(100),
  clinicLocationScope: text("clinic_location_scope").notNull().default("Colombo"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIncentiveSettingsSchema = createInsertSchema(incentiveSettings).omit({ id: true, updatedAt: true });
export const updateIncentiveSettingsSchema = insertIncentiveSettingsSchema.partial();
export type InsertIncentiveSettings = z.infer<typeof insertIncentiveSettingsSchema>;
export type UpdateIncentiveSettings = z.infer<typeof updateIncentiveSettingsSchema>;
export type IncentiveSettings = typeof incentiveSettings.$inferSelect;

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentDate: date("appointment_date").notNull(),
  appointmentTime: text("appointment_time").notNull(),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  patientName: text("patient_name").notNull(),
  treatingStaffId: varchar("treating_staff_id").notNull().references(() => staff.id),
  treatingStaffName: text("treating_staff_name").notNull(),
  notes: text("notes"),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, updatedAt: true });
export const updateAppointmentSchema = insertAppointmentSchema.partial();
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type UpdateAppointment = z.infer<typeof updateAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
