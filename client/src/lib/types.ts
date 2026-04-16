export type Role = 'Admin' | 'MD' | 'Receptionist' | 'Physiotherapist' | 'Staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string;
  avatar?: string;
  branch?: 'Colombo' | 'Bandaragama' | 'Both';
  address?: string;
  nic?: string;
  passportNo?: string;
  phone?: string;
  degree?: string;
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
  age: number;
  gender: 'Male' | 'Female';
  address: string;
  registeredDate: string;
  branch: 'Colombo' | 'Bandaragama';
  status: 'Active' | 'Discharged';
  defaultVisitType: 'Clinic' | 'Home';
  condition?: string;
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
  branch: 'Colombo' | 'Bandaragama';
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
  packageType: 'AC Room' | 'Non-AC Room';
  admitDate: string;
  amountPerDay: string;
  careTakerRatePerDay: string;
  careTakerDaysOverride?: number | null;
  reportsAttachments?: string[];
  idCopyAttachments?: string[];
  status: 'Admitted' | 'Discharged';
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
  treatingStaffId: string;
  treatingStaffName: string;
  notes?: string | null;
  createdByStaffId: string;
  createdAt: string;
  updatedAt: string;
}
