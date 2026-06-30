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
  photoUri: text("photo_uri"),
  profilePhoto: text("profile_photo"),
  employeeCode: text("employee_code"),
  designation: text("designation"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  basicSalary: text("basic_salary").notNull().default("0"),
  salaryDate: text("salary_date"),
  joiningDate: text("joining_date"),
  otherAdjustments: text("other_adjustments").notNull().default("0"),
  deactivatedAt: integer("deactivated_at", { mode: "timestamp" }),
  deactivatedBy: text("deactivated_by"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
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
  age: integer("age"),
  gender: text("gender").notNull(),
  address: text("address").notNull(),
  registeredDate: text("registered_date").notNull(),
  branch: text("branch").notNull(),
  status: text("status").notNull().default("Active"),
  defaultVisitType: text("default_visit_type").notNull(),
  condition: text("condition"),
  patientCode: text("patient_code"),
  fullName: text("full_name"),
  therapistFirstVisitId: text("therapist_first_visit_id"),
  firstVisitDate: text("first_visit_date"),
  branchId: text("branch_id"),
  dateOfBirth: text("date_of_birth"),
  nicOrPassport: text("nic_or_passport"),
  emergencyContact: text("emergency_contact"),
  referralSource: text("referral_source"),
  photoUri: text("photo_uri"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const PATIENT_STATUSES = ["Active", "Inactive", "Completed", "Discharged", "Transferred"] as const;

export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, patientCode: true, createdAt: true, updatedAt: true }).extend({
  age: z.union([z.number().int().min(1, "Age must be at least 1").max(130), z.null()]).optional(),
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
  paymentAmount: text("payment_amount").notNull().default("0"),
  amountPaid: text("amount_paid").notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("Unpaid"),
  paymentMode: text("payment_mode").notNull().default("Cash"),
  visitStatus: text("visit_status").notNull().default("Completed"),
  homeVisitType: text("home_visit_type"),
  notes: text("notes"),
  improvements: text("improvements"),
  reportImageUri: text("report_image_uri"),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  treatingStaffId: text("treating_staff_id").notNull().references(() => staff.id),
  treatingStaffName: text("treating_staff_name").notNull(),
  lastUpdatedByStaffId: text("last_updated_by_staff_id"),
  lastUpdatedByName: text("last_updated_by_name"),
  branchId: text("branch_id"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
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

export const PAYMENT_STATUSES = ["Paid", "Partially Paid", "Unpaid", "Cancelled"] as const;
export const VISIT_STATUSES = ["Scheduled", "Completed", "Cancelled", "No Show"] as const;
export const HOME_VISIT_TYPES = ["Colombo", "Bandaragama", "Holiday"] as const;
export const VISIT_PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online Payment", "Other"] as const;

// Visit payments (outpatient partial payments)
export const visitPayments = sqliteTable("visit_payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  visitId: text("visit_id").notNull().references(() => visits.id),
  amount: text("amount").notNull(),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  paymentReference: text("payment_reference"),
  paymentDate: text("payment_date").notNull(),
  remarks: text("remarks"),
  createdByStaffId: text("created_by_staff_id"),
  createdByName: text("created_by_name"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertVisitPaymentSchema = createInsertSchema(visitPayments).omit({ id: true, createdAt: true }).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});
export type InsertVisitPayment = z.infer<typeof insertVisitPaymentSchema>;
export type VisitPayment = typeof visitPayments.$inferSelect;

// Patient documents
export const patientDocuments = sqliteTable("patient_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().references(() => patients.id),
  fileName: text("file_name").notNull(),
  documentType: text("document_type").notNull(),
  fileUri: text("file_uri").notNull(),
  storageKey: text("storage_key"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  uploadedByStaffId: text("uploaded_by_staff_id"),
  uploadedByName: text("uploaded_by_name"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertPatientDocumentSchema = createInsertSchema(patientDocuments).omit({ id: true, createdAt: true });
export type InsertPatientDocument = z.infer<typeof insertPatientDocumentSchema>;
export type PatientDocument = typeof patientDocuments.$inferSelect;

// Patient notes
export const patientNotes = sqliteTable("patient_notes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id").notNull().references(() => patients.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdByStaffId: text("created_by_staff_id"),
  createdByName: text("created_by_name"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertPatientNoteSchema = createInsertSchema(patientNotes).omit({ id: true, createdAt: true });
export type InsertPatientNote = z.infer<typeof insertPatientNoteSchema>;
export type PatientNote = typeof patientNotes.$inferSelect;

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
  // Bug 6: real GPS coordinates captured from the device at check-in time.
  latitude: text("latitude"),
  longitude: text("longitude"),
  locationLabel: text("location_label"),
  notes: text("notes"),
  attendanceDate: text("attendance_date"),
  remarks: text("remarks"),
  editedBy: text("edited_by"),
  editedAt: integer("edited_at", { mode: "timestamp" }),
  editReason: text("edit_reason"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
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
  // Links an admission back to the patient master record so re-admissions reuse the
  // same human-facing Patient ID (patientCode) instead of generating a new one.
  patientId: text("patient_id"),
  patientCode: text("patient_code"),
  packageType: text("package_type").notNull(),
  admitDate: text("admit_date").notNull(),
  amountPerDay: text("amount_per_day").notNull(),
  careTakerRatePerDay: text("care_taker_rate_per_day").notNull().default("0"),
  careTakerDaysOverride: integer("care_taker_days_override"),
  // Bug 3: optional bill deduction (discount/adjustment) applied against the subtotal.
  // deductionType is "fixed" (LKR) or "percentage"; deductionValue holds the raw figure.
  deductionType: text("deduction_type"),
  deductionValue: text("deduction_value").notNull().default("0"),
  deductionReason: text("deduction_reason"),
  deductionAppliedBy: text("deduction_applied_by"),
  deductionAppliedById: text("deduction_applied_by_id"),
  deductionAppliedAt: integer("deduction_applied_at", { mode: "timestamp" }),
  reportsAttachments: text("reports_attachments"), // JSON string
  idCopyAttachments: text("id_copy_attachments"), // JSON string
  status: text("status").notNull().default("Admitted"),
  // How the admission was created: a fresh admission vs. converting an existing
  // out-patient ("out_patient_transfer") — kept for audit/reporting.
  admissionSource: text("admission_source"),
  branchId: text("branch_id"),
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
  patientId: text("patient_id"),
  branchId: text("branch_id"),
  notes: text("notes"),
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
  // Bug 3: deduction snapshot captured at discharge (applied against the subtotal).
  deductionType: text("deduction_type"),
  deductionValue: text("deduction_value").notNull().default("0"),
  deductionAmount: text("deduction_amount").notNull().default("0"),
  deductionReason: text("deduction_reason"),
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

// Bug 4: audit trail for in-patient branch transfers.
export const patientTransferLogs = sqliteTable("patient_transfer_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  admissionId: text("admission_id").notNull(),
  patientName: text("patient_name"),
  fromBranchId: text("from_branch_id"),
  toBranchId: text("to_branch_id").notNull(),
  transferDate: text("transfer_date").notNull(),
  transferNote: text("transfer_note"),
  transferredByStaffId: text("transferred_by_staff_id"),
  transferredByName: text("transferred_by_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
export type PatientTransferLog = typeof patientTransferLogs.$inferSelect;

// Expenses table
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  expenseDate: text("expense_date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amount: text("amount").notNull(),
  paymentMode: text("payment_mode").notNull(),
  staffId: text("staff_id"),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  remarks: text("remarks"),
  branch: text("branch"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
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
  status: text("status").notNull().default("Scheduled"),
  branch: text("branch"),
  branchId: text("branch_id"),
  reminderSent: integer("reminder_sent").notNull().default(0),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
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
  branchId: text("branch_id"),
  source: text("source").notNull().default("manual"),
  fineType: text("fine_type").notNull().default("Manual Fine"),
  remarks: text("remarks"),
  status: text("status").notNull().default("active"),
  createdByStaffId: text("created_by_staff_id"),
  createdByName: text("created_by_name"),
  updatedByStaffId: text("updated_by_staff_id"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
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

// Branches table
export const branches = sqliteTable("branches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  branchName: text("branch_name"),
  code: text("code"),
  address: text("address"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Staff branch access (multi-branch RBAC)
export const userBranchAccess = sqliteTable("user_branch_access", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type UserBranchAccess = typeof userBranchAccess.$inferSelect;

export const userBranchPermissions = sqliteTable("user_branch_permissions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => staff.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type UserBranchPermission = typeof userBranchPermissions.$inferSelect;

export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, createdAt: true, updatedAt: true });
export const updateBranchSchema = insertBranchSchema.partial();
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type UpdateBranch = z.infer<typeof updateBranchSchema>;
export type Branch = typeof branches.$inferSelect;

// Clinic settings (singleton: rates, auto-fine amount)
export const clinicSettings = sqliteTable("clinic_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  autoFineAmount: text("auto_fine_amount").notNull().default("500"),
  homeRateColombo: text("home_rate_colombo").notNull().default("1000"),
  homeRateBandaragama: text("home_rate_bandaragama").notNull().default("500"),
  holidayHomeRate: text("holiday_home_rate").notNull().default("1500"),
  otRatePerHour: text("ot_rate_per_hour").notNull().default("250"),
  extraHolidayDeduction: text("extra_holiday_deduction").notNull().default("1500"),
  freeAbsentDays: integer("free_absent_days").notNull().default(4),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const updateClinicSettingsSchema = createInsertSchema(clinicSettings).omit({ id: true, updatedAt: true }).partial();
export type UpdateClinicSettings = z.infer<typeof updateClinicSettingsSchema>;
export type ClinicSettings = typeof clinicSettings.$inferSelect;

// Notifications
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  userId: text("user_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  readAt: integer("read_at", { mode: "timestamp" }),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Tasks
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  assignedToStaffId: text("assigned_to_staff_id").notNull().references(() => staff.id),
  assignedToStaffName: text("assigned_to_staff_name").notNull(),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("normal"),
  dueDate: text("due_date"),
  taskType: text("task_type").notNull().default("Individual"),
  assignedBy: text("assigned_by"),
  completionNotes: text("completion_notes"),
  completionFiles: text("completion_files"),
  remarks: text("remarks"),
  reminderSentAt: integer("reminder_sent_at", { mode: "timestamp" }),
  overdueNotifiedAt: integer("overdue_notified_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const updateTaskSchema = insertTaskSchema.partial();
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Audit logs
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
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

// Persistent auth sessions
export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  staffId: text("staff_id").notNull().references(() => staff.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  selectedBranchId: text("selected_branch_id"),
  selectedContext: text("selected_context"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type AuthSession = typeof authSessions.$inferSelect;

// Payroll snapshots
export const payrollSnapshots = sqliteTable("payroll_snapshots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  breakdown: text("breakdown").notNull(),
  finalSalary: text("final_salary").notNull(),
  createdByStaffId: text("created_by_staff_id").notNull().references(() => staff.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertPayrollSnapshotSchema = createInsertSchema(payrollSnapshots).omit({ id: true, createdAt: true });
export type InsertPayrollSnapshot = z.infer<typeof insertPayrollSnapshotSchema>;
export type PayrollSnapshot = typeof payrollSnapshots.$inferSelect;

// Part 2/6 — home_visits
export const homeVisits = sqliteTable("home_visits", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name"),
  patientId: text("patient_id").references(() => patients.id),
  patientName: text("patient_name"),
  visitType: text("visit_type").notNull(),
  visitDate: text("visit_date"),
  visitDateTs: integer("visit_date_ts", { mode: "timestamp" }),
  branch: text("branch"),
  notes: text("notes"),
  visitId: text("visit_id").references(() => visits.id),
  paymentAmount: text("payment_amount").notNull().default("0"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertHomeVisitSchema = createInsertSchema(homeVisits).omit({ id: true, createdAt: true });
export type InsertHomeVisit = z.infer<typeof insertHomeVisitSchema>;
export type HomeVisit = typeof homeVisits.$inferSelect;

// Part 2/5 — salaries (monthly payroll records with workflow)
export const salaries = sqliteTable("salaries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name"),
  salaryMonth: text("salary_month").notNull(),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  basicSalary: text("basic_salary").notNull().default("0"),
  incentiveAmount: text("incentive_amount").notNull().default("0"),
  homeVisitAmount: text("home_visit_amount").notNull().default("0"),
  otAmount: text("ot_amount").notNull().default("0"),
  finesTotal: text("fines_total").notNull().default("0"),
  extraHolidayDeduction: text("extra_holiday_deduction").notNull().default("0"),
  otherDeductions: text("other_deductions").notNull().default("0"),
  deductionsTotal: text("deductions_total").notNull().default("0"),
  finalSalary: text("final_salary").notNull().default("0"),
  status: text("status").notNull().default("Generated"),
  breakdown: text("breakdown"),
  generatedByStaffId: text("generated_by_staff_id"),
  generatedByName: text("generated_by_name"),
  approvedByStaffId: text("approved_by_staff_id"),
  approvedByName: text("approved_by_name"),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  paidByStaffId: text("paid_by_staff_id"),
  paymentRemarks: text("payment_remarks"),
  rejectedReason: text("rejected_reason"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
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

// Part 2 — staff_incentives
export const staffIncentives = sqliteTable("staff_incentives", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  incentiveDate: text("incentive_date").notNull(),
  clinicVisits: integer("clinic_visits").notNull().default(0),
  inpatientSessions: integer("inpatient_sessions").notNull().default(0),
  incentiveCount: integer("incentive_count").notNull().default(0),
  incentiveAmount: text("incentive_amount").notNull().default("0"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertStaffIncentiveSchema = createInsertSchema(staffIncentives).omit({ id: true, createdAt: true });
export type InsertStaffIncentive = z.infer<typeof insertStaffIncentiveSchema>;
export type StaffIncentive = typeof staffIncentives.$inferSelect;

// Part 2 — task_assignments
export const taskAssignments = sqliteTable("task_assignments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").notNull().references(() => tasks.id),
  staffId: text("staff_id").notNull().references(() => staff.id),
  status: text("status").notNull().default("Pending"),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments).omit({ id: true, createdAt: true });
export type InsertTaskAssignment = z.infer<typeof insertTaskAssignmentSchema>;
export type TaskAssignment = typeof taskAssignments.$inferSelect;

// Part 5 — staff deductions
export const staffDeductions = sqliteTable("staff_deductions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  category: text("category").notNull(),
  amount: text("amount").notNull(),
  deductionDate: text("deduction_date").notNull(),
  remarks: text("remarks"),
  createdByStaffId: text("created_by_staff_id"),
  createdByName: text("created_by_name"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
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

// Part 5 — OT entries
export const staffOtEntries = sqliteTable("staff_ot_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  otDate: text("ot_date").notNull(),
  hours: text("hours").notNull(),
  reason: text("reason"),
  approvedByStaffId: text("approved_by_staff_id"),
  approvedByName: text("approved_by_name"),
  amount: text("amount").notNull().default("0"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
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
export const staffSalaryAdjustments = sqliteTable("staff_salary_adjustments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  staffId: text("staff_id").notNull().references(() => staff.id),
  staffName: text("staff_name").notNull(),
  type: text("type").notNull(), // 'addition' | 'decrement'
  amount: text("amount").notNull(),
  adjustmentDate: text("adjustment_date").notNull(),
  reason: text("reason").notNull(),
  createdByStaffId: text("created_by_staff_id"),
  createdByName: text("created_by_name"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedBy: text("deleted_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
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
