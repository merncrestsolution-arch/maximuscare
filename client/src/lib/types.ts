import type { MdRoleCapabilities } from "@shared/mdCapabilities";

export type Role = 'Admin' | 'MD' | 'Manager' | 'Receptionist' | 'Physiotherapist' | 'Staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string;
  avatar?: string;
  branch?: string;
  branchIds?: string[];
  mdCapabilities?: MdRoleCapabilities;
  /** Admin-only: per-staff MD/Manager permissions from GET /staff/:id */
  roleCapabilities?: MdRoleCapabilities;
  address?: string;
  nic?: string;
  passportNo?: string;
  phone?: string;
  degree?: string;
  joinDate?: string;
  photoUri?: string;
  isActive?: number | boolean;
  basicSalary?: string;
  salaryDate?: string;
  otherAdjustments?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  role: Role;
  date: string; // ISO Date string YYYY-MM-DD
  status: 'Present' | 'Absent';
  checkInTime?: string; // ISO timestamp
  checkOutTime?: string; // ISO timestamp
  overtimeHours?: number; // manual input (e.g. 2, 1.5)
  branch?: string;
  notes?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  age?: number | null;
  gender: 'Male' | 'Female';
  address: string;
  registeredDate: string;
  branch: string;
  status: 'Active' | 'Inactive' | 'Discharged' | 'Completed' | 'Transferred';
  defaultVisitType: 'Clinic' | 'Home';
  condition?: string;
  patientCode?: string | null;
  fullName?: string | null;
  branchId?: string | null;
  nicOrPassport?: string | null;
  dateOfBirth?: string | null;
  emergencyContact?: string | null;
  referralSource?: string | null;
}

export interface Visit {
  id: string;
  patientId: string;
  sessionNumber: number;
  condition: string;
  treatment: string;
  visitDate: string; // ISO Date YYYY-MM-DD
  startTime: string;
  endTime: string;
  branch: string;
  visitType: 'Clinic' | 'Home';
  status: 'Follow-up' | 'Finished';
  paymentAmount: number;
  paymentStatus: 'Paid' | 'Unpaid';
  paymentMode: 'Cash' | 'Online';
  notes?: string;
  reportImageUri?: string;
  createdByStaffId: string;
  createdByName: string;
  treatingStaffId: string;
  treatingStaffName: string;
  lastUpdatedByStaffId?: string | null;
  lastUpdatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// In-Patient Module Types
export interface InPatientAdmission {
  id: string;
  patientName: string;
  age: number;
  condition: string;
  careTakerName: string;
  careTakerRelationship: string;
  phone: string;
  address: string;
  patientIdNo?: string;
  careTakerIdNo?: string;
  patientId?: string | null;
  patientCode?: string | null;
  packageType: 'AC Room' | 'Non-AC Room';
  admitDate: string;
  amountPerDay: string;
  careTakerRatePerDay: string;
  careTakerDaysOverride?: number | null;
  reportsAttachments?: string[];
  idCopyAttachments?: string[];
  branchId?: string | null;
  status: 'Admitted' | 'Discharged' | 'Transferred';
  admissionSource?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InPatientExtraExpense {
  id: string;
  admissionId: string;
  expenseDate: string;
  category: string;
  amount: string;
  description?: string | null;
  createdByStaffId: string;
  createdByStaffName: string;
  createdAt: string;
  updatedAt: string;
}

export interface InPatientSession {
  id: string;
  admissionId: string;
  patientName: string;
  sessionDate: string;
  treatingStaffId: string;
  treatingStaffName: string;
  sessionNumber: number;
  startTime: string;
  endTime: string;
  treatmentProvided: string;
  improvements?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InPatientPreviousSession extends InPatientSession {
  admissionAdmitDate: string;
  admissionStatus: string;
  priorAdmissionId: string;
}

export interface InPatientPriorEpisode {
  admissionId: string;
  admitDate: string;
  status: string;
  dischargeDate: string | null;
  grandTotal: number | null;
  amountPaid: number;
  pendingBalance: number;
  sessionCount: number;
}

export interface OtherCharge {
  label: string;
  amount: number;
}

export interface InPatientDischarge {
  id: string;
  admissionId: string;
  patientName: string;
  dischargeDate: string;
  daysCount: number;
  amountPerDay: string;
  stayAmount: string;
  otherAmounts?: string; // JSON string of OtherCharge[]
  otherTotal: string;
  grandTotal: string;
  amountPaid: string;
  balance: string;
  paymentStatus: 'Paid' | 'Unpaid';
  paymentMode: 'Cash' | 'Online';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InPatientPayment {
  id: string;
  admissionId: string;
  paymentDate: string;
  amount: string;
  paymentMode: 'Cash' | 'Online';
  notes?: string;
  createdByStaffId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  patientId: string;
  patientName: string;
  patientCode?: string | null;
  treatingStaffId: string;
  treatingStaffName: string;
  status?: string;
  branch?: string | null;
  reminderSent?: number;
  notes?: string | null;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
}
