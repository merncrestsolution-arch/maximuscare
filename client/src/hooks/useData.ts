import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientApi, visitApi, attendanceApi, staffApi, reportsApi, inPatientApi, expenseApi, revenueApi, incentiveSettingsApi, appointmentApi, staffFinesApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

// Patient hooks
export function usePatients(branch?: string) {
  return useQuery({
    queryKey: ['patients', branch],
    queryFn: () => patientApi.getAll(branch),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: () => patientApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patientApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => patientApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

// Visit hooks
export function useVisits(params?: { patientId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['visits', params],
    queryFn: () => visitApi.getAll(params),
  });
}

export function useVisit(id: string) {
  return useQuery({
    queryKey: ['visits', id],
    queryFn: () => visitApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: visitApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
    },
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => visitApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
    },
  });
}

export function useDeleteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => visitApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
    },
  });
}

// Attendance hooks
export function useAttendance(params?: { staffId?: string; startDate?: string; endDate?: string; month?: string }) {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceApi.getAll(params),
    enabled: params?.staffId === undefined || !!params.staffId,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.refetchQueries({ queryKey: ['attendance'], type: 'all' });
    },
  });
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => attendanceApi.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.refetchQueries({ queryKey: ['attendance'], type: 'all' });
    },
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attendanceApi.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance'] });
      await queryClient.refetchQueries({ queryKey: ['attendance'], type: 'all' });
    },
  });
}

// Staff hooks
export function useStaff() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['staff'],
    queryFn: staffApi.getAll,
    // API returns full list for Admin/MD, or [self] for others — needed for visit staff dropdowns
    enabled: !!user,
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => staffApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

// Reports hooks
export function useVisitStats(params: { startDate: string; endDate: string; staffId?: string }) {
  return useQuery({
    queryKey: ['reports', 'visit-stats', params],
    queryFn: () => reportsApi.getVisitStats(params),
    enabled: !!params.startDate && !!params.endDate,
  });
}

// Staff fines
export function useStaffFines(params: { startDate: string; endDate: string; staffId?: string }, enabled = true) {
  return useQuery({
    queryKey: ['staff-fines', params],
    queryFn: () => staffFinesApi.getAll(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useCreateStaffFine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffFinesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
    },
  });
}

export function useUpdateStaffFine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => staffFinesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
    },
  });
}

export function useDeleteStaffFine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffFinesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
    },
  });
}

/** IP sessions in range; pass staffId (required for non-admin routes). */
export function useInPatientSessionsForStaffRange(
  params: { startDate: string; endDate: string; staffId?: string },
  enabled = true
) {
  return useQuery({
    queryKey: ['inpatients', 'sessions-range', params],
    queryFn: () => inPatientApi.getSessionsByDateRange(params),
    enabled: enabled && !!params.startDate && !!params.endDate && !!params.staffId,
  });
}

export function useAllInPatientSessionsInRange(params: { startDate: string; endDate: string }, enabled: boolean) {
  return useQuery({
    queryKey: ['inpatients', 'sessions-all', params],
    queryFn: () => inPatientApi.getAllSessionsInDateRange(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

// Incentive Settings hooks
export function useIncentiveSettings() {
  return useQuery({
    queryKey: ['incentive-settings'],
    queryFn: incentiveSettingsApi.get,
  });
}

export function useUpdateIncentiveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: incentiveSettingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentive-settings'] });
    },
  });
}

// In-Patient hooks
export function useInPatients(status?: string) {
  return useQuery({
    queryKey: ['inpatients', status],
    queryFn: () => inPatientApi.getAll(status),
  });
}

export function useInPatient(id: string) {
  return useQuery({
    queryKey: ['inpatients', id],
    queryFn: () => inPatientApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inPatientApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
    },
  });
}

export function useUpdateInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => inPatientApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
    },
  });
}

export function useDeleteInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inPatientApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
    },
  });
}

// In-Patient Session hooks
export function useInPatientSessions(admissionId: string) {
  return useQuery({
    queryKey: ['inpatients', admissionId, 'sessions'],
    queryFn: () => inPatientApi.getSessions(admissionId),
    enabled: !!admissionId,
  });
}

export function useNextSessionNumber(admissionId: string, date: string) {
  return useQuery({
    queryKey: ['inpatients', admissionId, 'sessions', 'next-number', date],
    queryFn: () => inPatientApi.getNextSessionNumber(admissionId, date),
    enabled: !!admissionId && !!date,
  });
}

export function useCreateInPatientSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, data }: { admissionId: string; data: any }) => 
      inPatientApi.createSession(admissionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', 'sessions-range'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', 'sessions-all'] });
    },
  });
}

export function useUpdateInPatientSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, sessionId, data }: { admissionId: string; sessionId: string; data: any }) => 
      inPatientApi.updateSession(sessionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', 'sessions-range'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', 'sessions-all'] });
      queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
    },
  });
}

export function useDeleteInPatientSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, sessionId }: { admissionId: string; sessionId: string }) => 
      inPatientApi.deleteSession(sessionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', 'sessions-range'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', 'sessions-all'] });
      queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
    },
  });
}

// In-Patient Discharge hooks
export function useInPatientDischarge(admissionId: string) {
  return useQuery({
    queryKey: ['inpatients', admissionId, 'discharge'],
    queryFn: () => inPatientApi.getDischarge(admissionId),
    enabled: !!admissionId,
    retry: false,
  });
}

export function useCreateInPatientDischarge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, data }: { admissionId: string; data: any }) => 
      inPatientApi.createDischarge(admissionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'discharge'] });
    },
  });
}

export function useUpdateInPatientDischarge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, dischargeId, data }: { admissionId: string; dischargeId: string; data: any }) => 
      inPatientApi.updateDischarge(dischargeId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'discharge'] });
    },
  });
}

// In-Patient Payment hooks
export function useInPatientPayments(admissionId: string) {
  return useQuery({
    queryKey: ['inpatients', admissionId, 'payments'],
    queryFn: () => inPatientApi.getPayments(admissionId),
    enabled: !!admissionId,
  });
}

export function useInPatientPaymentTotal(admissionId: string) {
  return useQuery({
    queryKey: ['inpatients', admissionId, 'payments', 'total'],
    queryFn: () => inPatientApi.getPaymentTotal(admissionId),
    enabled: !!admissionId,
  });
}

export function useCreateInPatientPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, data }: { admissionId: string; data: any }) => 
      inPatientApi.createPayment(admissionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'payments', 'total'] });
    },
  });
}

// In-Patient Extra Expense hooks
export function useInPatientExtraExpenses(admissionId: string) {
  return useQuery({
    queryKey: ['inpatients', admissionId, 'extra-expenses'],
    queryFn: () => inPatientApi.getExtraExpenses(admissionId),
    enabled: !!admissionId,
  });
}

export function useInPatientExtraExpenseTotal(admissionId: string) {
  return useQuery({
    queryKey: ['inpatients', admissionId, 'extra-expenses', 'total'],
    queryFn: () => inPatientApi.getExtraExpenseTotal(admissionId),
    enabled: !!admissionId,
  });
}

export function useCreateInPatientExtraExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, data }: { admissionId: string; data: any }) =>
      inPatientApi.createExtraExpense(admissionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'extra-expenses'] });
    },
  });
}

export function useUpdateInPatientExtraExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, id, data }: { admissionId: string; id: string; data: any }) =>
      inPatientApi.updateExtraExpense(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'extra-expenses'] });
    },
  });
}

export function useDeleteInPatientExtraExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, id }: { admissionId: string; id: string }) =>
      inPatientApi.deleteExtraExpense(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients', variables.admissionId, 'extra-expenses'] });
    },
  });
}

// Expense hooks (MD/Admin only)
export function useExpenses(params?: { startDate?: string; endDate?: string }, enabled: boolean = true) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => expenseApi.getAll(params),
    enabled,
  });
}

// My expenses hook (for staff to view their own expenses)
export function useMyExpenses(enabled: boolean = true) {
  return useQuery({
    queryKey: ['expenses', 'my'],
    queryFn: () => expenseApi.getMy(),
    enabled,
  });
}

export function useExpense(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: () => expenseApi.getOne(id),
    enabled: !!id && enabled,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expenseApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => expenseApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] });
    },
  });
}

// Appointment hooks
export function useAppointments(date?: string) {
  return useQuery({
    queryKey: ['appointments', date],
    queryFn: () => appointmentApi.getAll(date),
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: ['appointments', 'detail', id],
    queryFn: () => appointmentApi.getOne(id),
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appointmentApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => appointmentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appointmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

// Revenue Summary hooks (MD/Admin only)
export function useRevenueSummary(params?: { startDate?: string; endDate?: string }, enabled: boolean = true) {
  return useQuery({
    queryKey: ['revenue-summary', params],
    queryFn: () => revenueApi.getSummary(params),
    enabled,
  });
}
