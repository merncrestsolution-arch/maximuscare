import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientApi, visitApi, attendanceApi, attendanceApiExtended, staffApi, reportsApi, inPatientApi, expenseApi, revenueApi, incentiveSettingsApi, appointmentApi, staffFinesApi, payrollApi, salaryApi, patientsApiExtended, visitPaymentsApi, homeVisitsApi, clinicSettingsApi, branchesApi, notificationsApi, tasksApi, reportsApiExtended, auditApi, unwrapPaginatedList } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useBranch } from '@/context/branch-context';

// Patient hooks
export function usePatients(params?: {
  branch?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['patients', params],
    queryFn: () => patientApi.getAll(params).then(unwrapPaginatedList),
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

export function usePatientLookup() {
  return useMutation({
    mutationFn: (params: { phone?: string; nic?: string }) => patientApi.lookup(params),
  });
}

export function usePatientQrToken(id: string, enabled = true) {
  return useQuery({
    queryKey: ['patient-qr-token', id],
    queryFn: () => patientApi.qrToken(id),
    enabled: !!id && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useScanPatient() {
  return useMutation({
    mutationFn: (token: string) => patientApi.scan(token),
  });
}

export function usePatientHistory(id: string) {
  return useQuery({
    queryKey: ['patient-history', id],
    queryFn: () => patientApi.history(id),
    enabled: !!id,
  });
}

// Visit hooks
export function useVisits(params?: { patientId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['visits', params],
    queryFn: () => visitApi.getAll(params),
    enabled: params?.patientId === undefined || !!params.patientId,
  });
}

export function useUnpaidVisits(enabled = true) {
  return useQuery({
    queryKey: ['visits', 'unpaid'],
    queryFn: () => visitApi.getUnpaid(),
    enabled,
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
      await queryClient.invalidateQueries({ queryKey: ['attendance-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
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
      await queryClient.invalidateQueries({ queryKey: ['attendance-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
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
      await queryClient.invalidateQueries({ queryKey: ['attendance-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      await queryClient.invalidateQueries({ queryKey: ['staff-fines'] });
      await queryClient.refetchQueries({ queryKey: ['attendance'], type: 'all' });
    },
  });
}

// Staff hooks
export function useStaff(params?: { includeInactive?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['staff', params],
    queryFn: () => staffApi.getAll(params),
    // API returns full list for Admin/MD, or [self] for others — needed for visit staff dropdowns
    enabled: !!user,
  });
}

/**
 * Branch/organization-scoped clinical staff for "Treating Staff" / "Treating
 * Physiotherapist" dropdowns (Add Visit, Add Session, Appointment). Unlike
 * `useStaff` (which returns only [self] for non-management roles), this returns
 * the full clinical roster for the active branch context so any clinician can
 * pick the treating staff. Re-fetches automatically when the branch changes.
 */
export function useTreatingStaff() {
  const { user } = useAuth();
  const { selectedBranchId, selectedBranchName } = useBranch();
  return useQuery({
    queryKey: ['treating-staff', selectedBranchId, selectedBranchName],
    queryFn: () => staffApi.treatingOptions(),
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

export function useAllInPatientSessionsInRange(
  params: { startDate: string; endDate: string; branch?: string },
  enabled: boolean
) {
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

export function useInPatientQrToken(id: string, enabled = true) {
  return useQuery({
    queryKey: ['inpatient-qr-token', id],
    queryFn: () => inPatientApi.qrToken(id),
    enabled: !!id && enabled,
    staleTime: 5 * 60 * 1000,
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

export function useReadmitInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (arg: string | { admissionId: string; admitDate?: string }) => {
      const admissionId = typeof arg === "string" ? arg : arg.admissionId;
      const admitDate = typeof arg === "string" ? undefined : arg.admitDate;
      return inPatientApi.readmit(admissionId, admitDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
    },
  });
}

export function useUpdateInPatientAdmitDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, admitDate }: { id: string; admitDate: string }) =>
      inPatientApi.updateAdmitDate(id, admitDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
    },
  });
}

export function useTransferInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; targetBranchId: string; transferDate?: string; transferNote?: string }) =>
      inPatientApi.transfer(id, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['inpatients'] });
      queryClient.invalidateQueries({ queryKey: ['inpatient-transfers', vars.id] });
    },
  });
}

export function useInPatientTransfers(id: string) {
  return useQuery({
    queryKey: ['inpatient-transfers', id],
    queryFn: () => inPatientApi.getTransfers(id),
    enabled: !!id,
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
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
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
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
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

export function usePayrollReport(params: { startDate: string; endDate: string; staffId?: string }, enabled = true) {
  return useQuery({
    queryKey: ['payroll-report', params],
    queryFn: () => payrollApi.getReport(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useClinicSettings(enabled = true) {
  return useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => clinicSettingsApi.get(),
    enabled,
  });
}

export function useUpdateClinicSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clinicSettingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-report'] });
    },
  });
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => branchesApi.getAll(),
  });
}

export function useNotifications(opts?: { unreadOnly?: boolean; archived?: boolean }) {
  return useQuery({
    queryKey: ['notifications', opts],
    queryFn: () => notificationsApi.getAll(opts),
    refetchInterval: 30000,
  });
}

export function useAuditLogs(params?: { entityType?: string; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditApi.getAll(params),
    enabled,
    refetchInterval: 30000,
  });
}

export function useStaffDirectory(params?: Record<string, string | boolean>, enabled = true) {
  return useQuery({
    queryKey: ['staff-directory', params],
    queryFn: () => staffApi.directory(params),
    enabled,
  });
}

export function useStaffStats(staffId: string, params?: { startDate?: string; endDate?: string }, enabled = true) {
  return useQuery({
    queryKey: ['staff-stats', staffId, params],
    queryFn: () => staffApi.stats(staffId, params),
    enabled: enabled && !!staffId,
  });
}

export function useAttendanceDashboard(date?: string) {
  return useQuery({
    queryKey: ['attendance-dashboard', date],
    queryFn: () => attendanceApiExtended.dashboard(date),
  });
}

export function useTaskDashboard(all?: boolean) {
  return useQuery({
    queryKey: ['task-dashboard', all],
    queryFn: () => tasksApi.dashboard(all),
  });
}

export function useArchiveNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useBroadcastNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; message: string; type?: string; branch?: string }) =>
      notificationsApi.broadcast(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useTasks(params?: { status?: string; all?: boolean }, enabled = true) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasksApi.getAll(params),
    enabled,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-dashboard'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tasksApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDashboardKpis(params: { startDate: string; endDate: string }, enabled = true) {
  return useQuery({
    queryKey: ['dashboard-kpis', params],
    queryFn: () => reportsApiExtended.dashboardKpis(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useBranchStats(params: { startDate: string; endDate: string }, enabled = true) {
  return useQuery({
    queryKey: ['branch-stats', params],
    queryFn: () => reportsApiExtended.branchStats(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useTherapistPatientReport(enabled = true) {
  return useQuery({
    queryKey: ['therapist-patient-report'],
    queryFn: () => reportsApiExtended.therapistPatients(),
    enabled,
  });
}

export function useRevenueReport(params: { startDate: string; endDate: string }, enabled = true) {
  return useQuery({
    queryKey: ['revenue-report', params],
    queryFn: () => reportsApiExtended.revenue(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useIncentiveReport(params: { startDate: string; endDate: string; staffId?: string }, enabled = true) {
  return useQuery({
    queryKey: ['incentive-report', params],
    queryFn: () => reportsApiExtended.incentive(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useAttendanceReport(params: { startDate: string; endDate: string; staffId?: string }, enabled = true) {
  return useQuery({
    queryKey: ['attendance-report', params],
    queryFn: () => reportsApiExtended.attendance(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useExpenseReport(params: { startDate: string; endDate: string }, enabled = true) {
  return useQuery({
    queryKey: ['expense-report', params],
    queryFn: () => reportsApiExtended.expenses(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useUnpaidReport(enabled = true) {
  return useQuery({
    queryKey: ['unpaid-report'],
    queryFn: () => reportsApiExtended.unpaid(),
    enabled,
  });
}

export function useStaffReport(
  params: { staffId: string; startDate: string; endDate: string },
  enabled = true
) {
  return useQuery({
    queryKey: ['staff-report', params],
    queryFn: () => reportsApiExtended.staffReport(params.staffId, { startDate: params.startDate, endDate: params.endDate }),
    enabled: enabled && !!params.staffId && !!params.startDate && !!params.endDate,
  });
}

export function useSalaryDashboard(enabled = true) {
  return useQuery({
    queryKey: ['salary-dashboard'],
    queryFn: () => salaryApi.dashboard(),
    enabled,
  });
}

export function useSalaryHistory(params?: { month?: string; year?: string; branch?: string; staffId?: string; status?: string }) {
  return useQuery({
    queryKey: ['salary-history', params],
    queryFn: () => salaryApi.history(params),
  });
}

export function useSalaryPreview(params: { staffId: string; periodStart: string; periodEnd: string }, enabled = false) {
  return useQuery({
    queryKey: ['salary-preview', params],
    queryFn: () => salaryApi.preview(params),
    enabled: enabled && !!params.staffId && !!params.periodStart && !!params.periodEnd,
  });
}

export function useGenerateSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryApi.generate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-history'] });
      queryClient.invalidateQueries({ queryKey: ['salary-dashboard'] });
    },
  });
}

export function useSalaryApprovalActions() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['salary-history'] });
    queryClient.invalidateQueries({ queryKey: ['salary-dashboard'] });
  };
  return {
    approve: useMutation({ mutationFn: salaryApi.approve, onSuccess: invalidate }),
    reject: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => salaryApi.reject(id, reason), onSuccess: invalidate }),
    returnForReview: useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => salaryApi.returnForReview(id, reason), onSuccess: invalidate }),
    markPaid: useMutation({
      mutationFn: ({ id, ...data }: { id: string; paymentMethod: string; paymentReference?: string; paymentRemarks?: string }) =>
        salaryApi.markPaid(id, data),
      onSuccess: invalidate,
    }),
  };
}

// Bug 6: full salary breakdown for the Reports page salary section.
export function useSalaryDetail(
  staffId: string,
  params: { startDate: string; endDate: string },
  enabled = true
) {
  return useQuery({
    queryKey: ['salary-detail', staffId, params],
    queryFn: () => salaryApi.detail(staffId, params),
    enabled,
  });
}

// Bug K: full salary report + history for the Reports page salary section.
export function useSalaryReport(
  staffId: string,
  params: { startDate: string; endDate: string },
  enabled = true
) {
  return useQuery({
    queryKey: ['salary-report', staffId, params],
    queryFn: () => salaryApi.report(staffId, params),
    enabled: enabled && !!staffId && !!params.startDate && !!params.endDate,
  });
}

export function useSalaryReportHistory(staffId: string, months?: number, enabled = true) {
  return useQuery({
    queryKey: ['salary-report-history', staffId, months],
    queryFn: () => salaryApi.reportHistory(staffId, months),
    enabled: enabled && !!staffId,
  });
}

type SalaryAdjustmentInput = { staffId: string; date: string; reason: string; amount: number };

function useSalaryAdjustmentMutation(
  fn: (staffId: string, data: { date: string; reason: string; amount: number }) => Promise<any>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, ...data }: SalaryAdjustmentInput) => fn(staffId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-report'] });
      queryClient.invalidateQueries({ queryKey: ['salary-report-history'] });
    },
  });
}

export function useAddSalaryAddition() {
  return useSalaryAdjustmentMutation(salaryApi.addAddition);
}

export function useAddSalaryDecrement() {
  return useSalaryAdjustmentMutation(salaryApi.addDecrement);
}

export function useAddSalaryFine() {
  return useSalaryAdjustmentMutation(salaryApi.addFine);
}

export function useStaffDeductions(params?: { staffId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['staff-deductions', params],
    queryFn: () => salaryApi.deductions.list(params),
  });
}

export function useStaffOtEntries(params?: { staffId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['staff-ot', params],
    queryFn: () => salaryApi.ot.list(params),
  });
}

export function useCreateStaffDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryApi.deductions.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-deductions'] }),
  });
}

export function useCreateStaffOt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryApi.ot.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-ot'] }),
  });
}

export function usePatientDashboard(enabled = true) {
  return useQuery({
    queryKey: ['patient-dashboard'],
    queryFn: () => patientsApiExtended.dashboard(),
    enabled,
  });
}

export function usePatientStats(patientId: string) {
  return useQuery({
    queryKey: ['patient-stats', patientId],
    queryFn: () => patientsApiExtended.stats(patientId),
    enabled: !!patientId,
  });
}

export function usePatientDocuments(patientId: string) {
  return useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: () => patientsApiExtended.documents.list(patientId),
    enabled: !!patientId,
  });
}

export function usePatientNotes(patientId: string) {
  return useQuery({
    queryKey: ['patient-notes', patientId],
    queryFn: () => patientsApiExtended.notes.list(patientId),
    enabled: !!patientId,
  });
}

export function useCollectVisitPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, ...data }: { visitId: string; amount: number; paymentMethod: string; paymentDate: string; paymentReference?: string; remarks?: string }) =>
      visitPaymentsApi.collect(visitId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['unpaid-report'] });
      queryClient.invalidateQueries({ queryKey: ['patient-stats'] });
      queryClient.invalidateQueries({ queryKey: ['patient-export'] });
    },
  });
}

export function useHomeVisits(params?: { startDate?: string; endDate?: string; branch?: string; staffId?: string; visitType?: string }) {
  return useQuery({
    queryKey: ['home-visits', params],
    queryFn: () => homeVisitsApi.list(params),
  });
}

export function useCreatePatientNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, ...data }: { patientId: string; title: string; description: string }) =>
      patientsApiExtended.notes.create(patientId, data),
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['patient-notes', v.patientId] }),
  });
}

export function useCreatePatientDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, ...data }: { patientId: string; fileName: string; documentType: string; contentBase64: string }) =>
      patientsApiExtended.documents.upload(patientId, data),
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['patient-documents', v.patientId] }),
  });
}

export function usePatientExport(enabled = true) {
  return useQuery({
    queryKey: ['patient-export'],
    queryFn: () => patientsApiExtended.export(),
    enabled,
  });
}

export function useSessionReport(params: { startDate: string; endDate: string; staffId?: string }, enabled = true) {
  return useQuery({
    queryKey: ['session-report', params],
    queryFn: () => reportsApiExtended.sessions(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}
