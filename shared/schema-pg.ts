import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, date, boolean } from "drizzle-orm/pg-core";
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
  photoUri: text("photo_uri"),
  profilePhoto: text("profile_photo"),
  employeeCode: text("employee_code"),
  designation: text("designation"),
  isActive: boolean("is_active").notNull().default(true),
  basicSalary: decimal("basic_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  salaryDate: date("salary_date"),
  joiningDate: date("joining_date"),
  otherAdjustments: decimal("other_adjustments", { precision: 12, scale: 2 }).notNull().default("0"),
  deactivatedAt: timestamp("deactivated_at"),
  deactivatedBy: varchar("deactivated_by"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  capLocationExempt: boolean("cap_location_exempt"),
  capViewAttendanceLocation: boolean("cap_view_attendance_location"),
  capViewAllStaffFines: boolean("cap_view_all_staff_fines"),
  capManageStaffFines: boolean("cap_manage_staff_fines"),
  capMaximusOverview: boolean("cap_maximus_overview"),
  capNexusOverview: boolean("cap_nexus_overview"),
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
  phone: text("phone"),
  age: integer("age"),
  gender: text("gender").notNull(),
  address: text("address").notNull(),
  registeredDate: date("registered_date").notNull(),
  branch: text("branch").notNull(),
  status: text("status").notNull().default("Active"),
  defaultVisitType: text("default_visit_type").notNull(),
  condition: text("condition").notNull(),
  patientCode: text("patient_code"),
  dataVersion: integer("data_version").notNull().default(2),
  dataMigratedAt: timestamp("data_migrated_at"),
  qrToken: text("qr_token"),
  qrTokenExpiresAt: timestamp("qr_token_expires_at"),
  idCardPdfKey: text("id_card_pdf_key"),
  idCardQrToken: text("id_card_qr_token"),
  idCardGeneratedAt: timestamp("id_card_generated_at"),
  fullName: text("full_name"),
  therapistFirstVisitId: varchar("therapist_first_visit_id"),
  firstVisitDate: date("first_visit_date"),
  branchId: varchar("branch_id"),
  dateOfBirth: date("date_of_birth"),
  nicOrPassport: text("nic_or_passport"),
  emergencyContact: text("emergency_contact"),
  referralSource: text("referral_source"),
  photoUri: text("photo_uri"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const PATIENT_STATUSES = ["Active", "Inactive", "Completed", "Discharged", "Transferred"] as const;

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  patientCode: true,
  dataVersion: true,
  dataMigratedAt: true,
  qrToken: true,
  qrTokenExpiresAt: true,
  idCardPdfKey: true,
  idCardQrToken: true,
  idCardGeneratedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  age: z.union([z.number().int().min(1, "Age must be at least 1").max(130), z.null()]).optional(),
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
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("Unpaid"),
  paymentMode: text("payment_mode").notNull().default("Cash"),
  visitStatus: text("visit_status").notNull().default("Completed"),
  homeVisitType: text("home_visit_type"),
  notes: text("notes"),
  improvements: text("improvements"),
  reportImageUri: text("report_image_uri"),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  treatingStaffId: varchar("treating_staff_id").notNull().references(() => staff.id),
  treatingStaffName: text("treating_staff_name").notNull(),
  lastUpdatedByStaffId: varchar("last_updated_by_staff_id"),
  lastUpdatedByName: text("last_updated_by_name"),
  branchId: varchar("branch_id"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

export const PAYMENT_STATUSES = ["Paid", "Partially Paid", "Unpaid", "Cancelled"] as const;
export const VISIT_STATUSES = ["Scheduled", "Completed", "Cancelled", "No Show"] as const;
export const HOME_VISIT_TYPES = ["Colombo", "Bandaragama", "Holiday"] as const;
export const VISIT_PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online Payment", "Other"] as const;

export const visitPayments = pgTable("visit_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => visits.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  paymentReference: text("payment_reference"),
  paymentDate: date("payment_date").notNull(),
  remarks: text("remarks"),
  createdByStaffId: varchar("created_by_staff_id"),
  createdByName: text("created_by_name"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVisitPaymentSchema = createInsertSchema(visitPayments).omit({ id: true, createdAt: true }).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});
export type InsertVisitPayment = z.infer<typeof insertVisitPaymentSchema>;
export type VisitPayment = typeof visitPayments.$inferSelect;

export const patientDocuments = pgTable("patient_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  fileName: text("file_name").notNull(),
  documentType: text("document_type").notNull(),
  fileUri: text("file_uri").notNull(),
  storageKey: text("storage_key"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  uploadedByStaffId: varchar("uploaded_by_staff_id"),
  uploadedByName: text("uploaded_by_name"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPatientDocumentSchema = createInsertSchema(patientDocuments).omit({ id: true, createdAt: true });
export type InsertPatientDocument = z.infer<typeof insertPatientDocumentSchema>;
export type PatientDocument = typeof patientDocuments.$inferSelect;

export const patientNotes = pgTable("patient_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patients.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdByStaffId: varchar("created_by_staff_id"),
  createdByName: text("created_by_name"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPatientNoteSchema = createInsertSchema(patientNotes).omit({ id: true, createdAt: true });
export type InsertPatientNote = z.infer<typeof insertPatientNoteSchema>;
export type PatientNote = typeof patientNotes.$inferSelect;

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
  // Bug 6: real GPS coordinates captured from the device at check-in time.
  latitude: text("latitude"),
  longitude: text("longitude"),
  locationLabel: text("location_label"),
  notes: text("notes"),
  attendanceDate: date("attendance_date"),
  remarks: text("remarks"),
  editedBy: varchar("edited_by"),
  editedAt: timestamp("edited_at"),
  editReason: text("edit_reason"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  staffId: z.string().optional(),
  staffName: z.string().optional(),
  role: z.string().optional(),
  date: z.string().optional(),
  checkInTime: z.any().optional(),
  checkOutTime: z.any().optional(),
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
  // Links an admission back to the patient master record so re-admissions reuse the
  // same human-facing Patient ID (patientCode) instead of generating a new one.
  patientId: text("patient_id"),
  patientCode: text("patient_code"),
  qrToken: text("qr_token"),
  qrTokenExpiresAt: timestamp("qr_token_expires_at"),
  idCardPdfKey: text("id_card_pdf_key"),
  idCardQrToken: text("id_card_qr_token"),
  idCardGeneratedAt: timestamp("id_card_generated_at"),
  packageType: text("package_type").notNull(),
  admitDate: date("admit_date").notNull(),
  amountPerDay: decimal("amount_per_day", { precision: 10, scale: 2 }).notNull(),
  careTakerRatePerDay: decimal("care_taker_rate_per_day", { precision: 10, scale: 2 }).notNull().default("0"),
  careTakerDaysOverride: integer("care_taker_days_override"),
  // Bug 3: optional bill deduction (discount/adjustment) applied against the subtotal.
  // deductionType is "fixed" (LKR) or "percentage"; deductionValue holds the raw figure.
  deductionType: text("deduction_type"),
  deductionValue: decimal("deduction_value", { precision: 12, scale: 2 }).notNull().default("0"),
  deductionReason: text("deduction_reason"),
  deductionAppliedBy: text("deduction_applied_by"),
  deductionAppliedById: text("deduction_applied_by_id"),
  deductionAppliedAt: timestamp("deduction_applied_at", { mode: "date" }),
  // After a branch transfer, the closing branch stay keeps deduction_* above; the active stay uses these.
  currentDeductionType: text("current_deduction_type"),
  currentDeductionValue: decimal("current_deduction_value", { precision: 12, scale: 2 }).notNull().default("0"),
  currentDeductionReason: text("current_deduction_reason"),
  currentDeductionAppliedBy: text("current_deduction_applied_by"),
  currentDeductionAppliedById: text("current_deduction_applied_by_id"),
  currentDeductionAppliedAt: timestamp("current_deduction_applied_at", { mode: "date" }),
  reportsAttachments: text("reports_attachments").array(),
  idCopyAttachments: text("id_copy_attachments").array(),
  status: text("status").notNull().default("Admitted"),
  // How the admission was created: a fresh admission vs. converting an existing
  // out-patient ("out_patient_transfer") — kept for audit/reporting.
  admissionSource: text("admission_source"),
  branchId: text("branch_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
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
  patientId: varchar("patient_id"),
  branchId: varchar("branch_id"),
  notes: text("notes"),
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
  // Bug 3: deduction snapshot captured at discharge (applied against the subtotal).
  deductionType: text("deduction_type"),
  deductionValue: decimal("deduction_value", { precision: 12, scale: 2 }).notNull().default("0"),
  deductionAmount: decimal("deduction_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  deductionReason: text("deduction_reason"),
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

// Bug 4: audit trail for in-patient branch transfers.
export const patientTransferLogs = pgTable("patient_transfer_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionId: varchar("admission_id").notNull(),
  patientName: text("patient_name"),
  fromBranchId: text("from_branch_id"),
  toBranchId: text("to_branch_id").notNull(),
  transferDate: date("transfer_date").notNull(),
  transferNote: text("transfer_note"),
  transferredByStaffId: varchar("transferred_by_staff_id"),
  transferredByName: text("transferred_by_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type PatientTransferLog = typeof patientTransferLogs.$inferSelect;

/** Admin soft-delete: exclude a prior billing episode from balance calculations. */
export const inPatientPriorBillingExclusions = pgTable("in_patient_prior_billing_exclusions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  admissionId: varchar("admission_id").notNull(),
  sourceId: text("source_id").notNull(),
  episodeType: text("episode_type").notNull(),
  excludedAt: timestamp("excluded_at", { mode: "date" }).notNull().defaultNow(),
  excludedByStaffId: text("excluded_by_staff_id"),
  excludedByName: text("excluded_by_name"),
  snapshotJson: text("snapshot_json"),
});
export type InPatientPriorBillingExclusion = typeof inPatientPriorBillingExclusions.$inferSelect;

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseDate: date("expense_date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMode: text("payment_mode").notNull(),
  staffId: varchar("staff_id"),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  remarks: text("remarks"),
  branch: text("branch"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
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
  status: text("status").notNull().default("Scheduled"),
  branch: text("branch"),
  branchId: varchar("branch_id"),
  reminderSent: boolean("reminder_sent").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
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

export const staffFines = pgTable("staff_fines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  salaryId: varchar("salary_id").references(() => salaries.id),
  staffName: text("staff_name").notNull(),
  fineDate: date("fine_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("500"),
  reason: text("reason").notNull(),
  source: text("source").notNull().default("manual"),
  fineType: text("fine_type").notNull().default("Manual Fine"),
  remarks: text("remarks"),
  status: text("status").notNull().default("active"),
  createdByStaffId: varchar("created_by_staff_id"),
  createdByName: text("created_by_name"),
  updatedByStaffId: varchar("updated_by_staff_id"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

export const branches = pgTable("branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  branchName: text("branch_name"),
  code: text("code"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userBranchAccess = pgTable("user_branch_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UserBranchAccess = typeof userBranchAccess.$inferSelect;

export const userBranchPermissions = pgTable("user_branch_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => staff.id),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserBranchPermission = typeof userBranchPermissions.$inferSelect;

export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, createdAt: true, updatedAt: true });
export const updateBranchSchema = insertBranchSchema.partial();
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type UpdateBranch = z.infer<typeof updateBranchSchema>;
export type Branch = typeof branches.$inferSelect;

export const clinicSettings = pgTable("clinic_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  autoFineAmount: decimal("auto_fine_amount", { precision: 10, scale: 2 }).notNull().default("500"),
  homeRateColombo: decimal("home_rate_colombo", { precision: 10, scale: 2 }).notNull().default("1000"),
  homeRateBandaragama: decimal("home_rate_bandaragama", { precision: 10, scale: 2 }).notNull().default("500"),
  otRatePerHour: decimal("ot_rate_per_hour", { precision: 10, scale: 2 }).notNull().default("250"),
  extraHolidayDeduction: decimal("extra_holiday_deduction", { precision: 10, scale: 2 }).notNull().default("1500"),
  freeAbsentDays: integer("free_absent_days").notNull().default(4),
  mdLocationExempt: boolean("md_location_exempt").notNull().default(true),
  mdViewAttendanceLocation: boolean("md_view_attendance_location").notNull().default(false),
  mdViewAllStaffFines: boolean("md_view_all_staff_fines").notNull().default(true),
  mdManageStaffFines: boolean("md_manage_staff_fines").notNull().default(false),
  mdMaximusOverview: boolean("md_maximus_overview").notNull().default(false),
  mdNexusOverview: boolean("md_nexus_overview").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const updateClinicSettingsSchema = createInsertSchema(clinicSettings).omit({ id: true, updatedAt: true }).partial();
export type UpdateClinicSettings = z.infer<typeof updateClinicSettingsSchema>;
export type ClinicSettings = typeof clinicSettings.$inferSelect;

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  userId: varchar("user_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  readAt: timestamp("read_at"),
  sentAt: timestamp("sent_at"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  assignedToStaffId: varchar("assigned_to_staff_id").notNull().references(() => staff.id),
  assignedToStaffName: text("assigned_to_staff_name").notNull(),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("normal"),
  dueDate: date("due_date"),
  taskType: text("task_type").notNull().default("Individual"),
  assignedBy: varchar("assigned_by"),
  completionNotes: text("completion_notes"),
  completionFiles: text("completion_files"),
  remarks: text("remarks"),
  reminderSentAt: timestamp("reminder_sent_at"),
  overdueNotifiedAt: timestamp("overdue_notified_at"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const updateTaskSchema = insertTaskSchema.partial();
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  module: text("module"),
  action: text("action").notNull(),
  recordId: text("record_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  oldValues: text("old_values"),
  newValues: text("new_values"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled", "Overdue"] as const;
export const TASK_TYPES = ["Individual", "Common"] as const;
export const NOTIFICATION_TYPES = [
  "system",
  "attendance_reminder",
  "task_reminder",
  "task_assignment",
  "salary",
  "fine",
  "report",
] as const;

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const authSessions = pgTable("auth_sessions", {
  id: varchar("id").primaryKey(),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  selectedBranchId: varchar("selected_branch_id"),
  selectedContext: text("selected_context"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuthSession = typeof authSessions.$inferSelect;

export const payrollSnapshots = pgTable("payroll_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  breakdown: text("breakdown").notNull(),
  finalSalary: decimal("final_salary", { precision: 12, scale: 2 }).notNull(),
  createdByStaffId: varchar("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPayrollSnapshotSchema = createInsertSchema(payrollSnapshots).omit({ id: true, createdAt: true });
export type InsertPayrollSnapshot = z.infer<typeof insertPayrollSnapshotSchema>;
export type PayrollSnapshot = typeof payrollSnapshots.$inferSelect;

export const homeVisits = pgTable("home_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name"),
  patientId: varchar("patient_id").references(() => patients.id),
  patientName: text("patient_name"),
  visitType: text("visit_type").notNull(),
  visitDate: date("visit_date"),
  visitDateTs: timestamp("visit_date_ts"),
  branch: text("branch"),
  notes: text("notes"),
  visitId: varchar("visit_id").references(() => visits.id),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertHomeVisitSchema = createInsertSchema(homeVisits).omit({ id: true, createdAt: true });
export type InsertHomeVisit = z.infer<typeof insertHomeVisitSchema>;
export type HomeVisit = typeof homeVisits.$inferSelect;

export const salaries = pgTable("salaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name"),
  salaryMonth: date("salary_month").notNull(),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  basicSalary: decimal("basic_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  incentiveAmount: decimal("incentive_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  homeVisitAmount: decimal("home_visit_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  otAmount: decimal("ot_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  finesTotal: decimal("fines_total", { precision: 12, scale: 2 }).notNull().default("0"),
  extraHolidayDeduction: decimal("extra_holiday_deduction", { precision: 12, scale: 2 }).notNull().default("0"),
  otherDeductions: decimal("other_deductions", { precision: 12, scale: 2 }).notNull().default("0"),
  deductionsTotal: decimal("deductions_total", { precision: 12, scale: 2 }).notNull().default("0"),
  finalSalary: decimal("final_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("Generated"),
  breakdown: text("breakdown"),
  generatedByStaffId: varchar("generated_by_staff_id"),
  generatedByName: text("generated_by_name"),
  approvedByStaffId: varchar("approved_by_staff_id"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  paidByStaffId: varchar("paid_by_staff_id"),
  paymentRemarks: text("payment_remarks"),
  rejectedReason: text("rejected_reason"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertSalarySchema = createInsertSchema(salaries).omit({ id: true, createdAt: true, updatedAt: true });
export const updateSalarySchema = insertSalarySchema.partial();
export type InsertSalary = z.infer<typeof insertSalarySchema>;
export type UpdateSalary = z.infer<typeof updateSalarySchema>;
export type Salary = typeof salaries.$inferSelect;

export const SALARY_STATUSES = ["Draft", "Generated", "Approved", "Paid", "Cancelled"] as const;
export const FINE_TYPES = ["Manual Fine", "Auto Fine", "Attendance Fine", "Disciplinary Fine", "Other Fine"] as const;
export const DEDUCTION_CATEGORIES = [
  "Food Charges",
  "Accommodation Charges",
  "Transport Charges",
  "Advance Payments",
  "Other Deductions",
] as const;
export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Other"] as const;

export const staffIncentives = pgTable("staff_incentives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  incentiveDate: date("incentive_date").notNull(),
  clinicVisits: integer("clinic_visits").notNull().default(0),
  inpatientSessions: integer("inpatient_sessions").notNull().default(0),
  incentiveCount: integer("incentive_count").notNull().default(0),
  incentiveAmount: decimal("incentive_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertStaffIncentiveSchema = createInsertSchema(staffIncentives).omit({ id: true, createdAt: true });
export type InsertStaffIncentive = z.infer<typeof insertStaffIncentiveSchema>;
export type StaffIncentive = typeof staffIncentives.$inferSelect;

export const taskAssignments = pgTable("task_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  status: text("status").notNull().default("Pending"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments).omit({ id: true, createdAt: true });
export type InsertTaskAssignment = z.infer<typeof insertTaskAssignmentSchema>;
export type TaskAssignment = typeof taskAssignments.$inferSelect;

export const staffDeductions = pgTable("staff_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  deductionDate: date("deduction_date").notNull(),
  remarks: text("remarks"),
  createdByStaffId: varchar("created_by_staff_id"),
  createdByName: text("created_by_name"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStaffDeductionSchema = createInsertSchema(staffDeductions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});
export const updateStaffDeductionSchema = insertStaffDeductionSchema.partial();
export type InsertStaffDeduction = z.infer<typeof insertStaffDeductionSchema>;
export type UpdateStaffDeduction = z.infer<typeof updateStaffDeductionSchema>;
export type StaffDeduction = typeof staffDeductions.$inferSelect;

export const staffOtEntries = pgTable("staff_ot_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  otDate: date("ot_date").notNull(),
  hours: decimal("hours", { precision: 6, scale: 2 }).notNull(),
  reason: text("reason"),
  approvedByStaffId: varchar("approved_by_staff_id"),
  approvedByName: text("approved_by_name"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStaffOtEntrySchema = createInsertSchema(staffOtEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  amount: true,
}).extend({
  hours: z.union([z.string(), z.number()]).transform((v) => String(v)),
});
export const updateStaffOtEntrySchema = insertStaffOtEntrySchema.partial();
export type InsertStaffOtEntry = z.infer<typeof insertStaffOtEntrySchema>;
export type UpdateStaffOtEntry = z.infer<typeof updateStaffOtEntrySchema>;
export type StaffOtEntry = typeof staffOtEntries.$inferSelect;

// Staff Salary Adjustments table
export const staffSalaryAdjustments = pgTable("staff_salary_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").notNull().references(() => staff.id),
  salaryId: varchar("salary_id").references(() => salaries.id),
  staffName: text("staff_name").notNull(),
  type: text("type").notNull(), // 'addition' | 'decrement' | 'fine' (legacy)
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  adjustmentDate: date("adjustment_date").notNull(),
  reason: text("reason").notNull(),
  createdByStaffId: varchar("created_by_staff_id"),
  createdByName: text("created_by_name"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStaffSalaryAdjustmentSchema = createInsertSchema(staffSalaryAdjustments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});
export const updateStaffSalaryAdjustmentSchema = insertStaffSalaryAdjustmentSchema.partial();
export type InsertStaffSalaryAdjustment = z.infer<typeof insertStaffSalaryAdjustmentSchema>;
export type UpdateStaffSalaryAdjustment = z.infer<typeof updateStaffSalaryAdjustmentSchema>;
export type StaffSalaryAdjustment = typeof staffSalaryAdjustments.$inferSelect;
