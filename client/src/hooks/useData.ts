import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientApi, visitApi, attendanceApi, attendanceApiExtended, staffApi, reportsApi, inPatientApi, expenseApi, revenueApi, incentiveSettingsApi, appointmentApi, staffFinesApi, payrollApi, salaryApi, patientsApiExtended, visitPaymentsApi, homeVisitsApi, clinicSettingsApi, branchesApi, notificationsApi, tasksApi, reportsApiExtended, auditApi, adminApi, unwrapPaginatedList } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { useBranch } from '@/context/branch-context';
import {
  invalidateAppointmentQueries,
  invalidateAttendanceQueries,
  invalidateClinicSettingsQueries,
  invalidateExpenseQueries,
  invalidateInPatientQueries,
  invalidateNotificationQueries,
  invalidatePatientQueries,
  invalidateReportsQueries,
  invalidateSalaryPayrollQueries,
  invalidateStaffQueries,
  invalidateTaskQueries,
  invalidateVisitQueries,
} from '@/lib/queryInvalidation';

export { invalidateSalaryPayrollQueries } from '@/lib/queryInvalidation';

// Patient hooks
export function usePatients(params?: {
  branch?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { selectedBranchId, selectedBranchName } = useBranch();
  return useQuery({
    queryKey: ['patients', params, selectedBranchId, selectedBranchName],
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
    onSuccess: () => invalidatePatientQueries(queryClient),
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => patientApi.update(id, data),
    onSuccess: (_data, variables) => invalidatePatientQueries(queryClient, variables.id),
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientApi.delete(id),
    onSuccess: () => {
      void invalidatePatientQueries(queryClient);
      void invalidateVisitQueries(queryClient);
      void invalidateAppointmentQueries(queryClient);
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
  const { selectedBranchId, selectedBranchName } = useBranch();
  return useQuery({
    queryKey: ['visits', params, selectedBranchId, selectedBranchName],
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
    onSuccess: (_data, variables) => invalidateVisitQueries(queryClient, variables.patientId),
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => visitApi.update(id, data),
    onSuccess: (_data, variables) => invalidateVisitQueries(queryClient, variables.data?.patientId),
  });
}

export function useDeleteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => visitApi.delete(id),
    onSuccess: () => invalidateVisitQueries(queryClient),
  });
}

// Attendance hooks
export function useAttendance(params?: { staffId?: string; startDate?: string; endDate?: string; month?: string }) {
  const { selectedBranchId, selectedBranchName } = useBranch();
  return useQuery({
    queryKey: ['attendance', params, selectedBranchId, selectedBranchName],
    queryFn: () => attendanceApi.getAll(params),
    enabled: params?.staffId === undefined || !!params.staffId,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.create,
    onSuccess: async () => {
      await invalidateAttendanceQueries(queryClient);
      await queryClient.refetchQueries({ queryKey: ['attendance'], type: 'active' });
    },
  });
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => attendanceApi.update(id, data),
    onSuccess: async () => {
      await invalidateAttendanceQueries(queryClient);
      await queryClient.refetchQueries({ queryKey: ['attendance'], type: 'active' });
    },
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attendanceApi.delete(id),
    onSuccess: async () => {
      await invalidateAttendanceQueries(queryClient);
      await queryClient.refetchQueries({ queryKey: ['attendance'], type: 'active' });
    },
  });
}

// Staff hooks
export function useStaff(params?: { includeInactive?: boolean }) {
  const { user } = useAuth();
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['staff', params, selectedBranchId, selectedBranchName, selectedContext],
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
    onSuccess: () => invalidateStaffQueries(queryClient),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => staffApi.update(id, data),
    onSuccess: (_data, variables) => {
      void invalidateStaffQueries(queryClient, variables.id);
      void invalidateSalaryPayrollQueries(queryClient);
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffApi.delete,
    onSuccess: () => invalidateStaffQueries(queryClient),
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
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['staff-fines', params, selectedBranchId, selectedBranchName, selectedContext],
    queryFn: () => staffFinesApi.getAll(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}

export function useCreateStaffFine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffFinesApi.create,
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
  });
}

export function useUpdateStaffFine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => staffFinesApi.update(id, data),
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
  });
}

export function useDeleteStaffFine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffFinesApi.delete,
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
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
      void invalidateClinicSettingsQueries(queryClient);
      void invalidateSalaryPayrollQueries(queryClient);
      void invalidateReportsQueries(queryClient);
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
    onSuccess: () => invalidateInPatientQueries(queryClient),
  });
}

export function useUpdateInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => inPatientApi.update(id, data),
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.id),
  });
}

export function useDeleteInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inPatientApi.delete,
    onSuccess: () => invalidateInPatientQueries(queryClient),
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
      void invalidateInPatientQueries(queryClient);
      void invalidatePatientQueries(queryClient);
    },
  });
}

export function useUpdateInPatientAdmitDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, admitDate }: { id: string; admitDate: string }) =>
      inPatientApi.updateAdmitDate(id, admitDate),
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.id),
  });
}

export function useSetInPatientDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: { deductionType: "fixed" | "percentage" | null; deductionValue: number; deductionReason?: string | null };
    }) => inPatientApi.setDeduction(id, data),
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.id),
  });
}

export function useTransferInPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; targetBranchId: string; transferDate?: string; transferNote?: string }) =>
      inPatientApi.transfer(id, data),
    onSuccess: (_res, vars) => invalidateInPatientQueries(queryClient, vars.id),
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
    onSuccess: (_data, variables) => {
      void invalidateInPatientQueries(queryClient, variables.admissionId);
      void invalidateSalaryPayrollQueries(queryClient);
    },
  });
}

export function useUpdateInPatientSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, sessionId, data }: { admissionId: string; sessionId: string; data: any }) => 
      inPatientApi.updateSession(sessionId, data),
    onSuccess: (_data, variables) => {
      void invalidateInPatientQueries(queryClient, variables.admissionId);
      void invalidateSalaryPayrollQueries(queryClient);
    },
  });
}

export function useDeleteInPatientSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, sessionId }: { admissionId: string; sessionId: string }) => 
      inPatientApi.deleteSession(sessionId),
    onSuccess: (_data, variables) => {
      void invalidateInPatientQueries(queryClient, variables.admissionId);
      void invalidateSalaryPayrollQueries(queryClient);
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
    onSuccess: (_data, variables) => {
      void invalidateInPatientQueries(queryClient, variables.admissionId);
      void invalidatePatientQueries(queryClient);
    },
  });
}

export function useUpdateInPatientDischarge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, dischargeId, data }: { admissionId: string; dischargeId: string; data: any }) => 
      inPatientApi.updateDischarge(dischargeId, data),
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.admissionId),
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
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.admissionId),
  });
}

export function useUpdateInPatientPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, paymentId, data }: { admissionId: string; paymentId: string; data: any }) =>
      inPatientApi.updatePayment(paymentId, data),
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.admissionId),
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
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.admissionId),
  });
}

export function useUpdateInPatientExtraExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, id, data }: { admissionId: string; id: string; data: any }) =>
      inPatientApi.updateExtraExpense(id, data),
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.admissionId),
  });
}

export function useDeleteInPatientExtraExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, id }: { admissionId: string; id: string }) =>
      inPatientApi.deleteExtraExpense(id),
    onSuccess: (_data, variables) => invalidateInPatientQueries(queryClient, variables.admissionId),
  });
}

// Expense hooks (MD/Admin only)
export function useExpenses(params?: { startDate?: string; endDate?: string }, enabled: boolean = true) {
  const { selectedBranchId, selectedBranchName } = useBranch();
  return useQuery({
    queryKey: ['expenses', params, selectedBranchId, selectedBranchName],
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
    onSuccess: () => invalidateExpenseQueries(queryClient),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => expenseApi.update(id, data),
    onSuccess: () => invalidateExpenseQueries(queryClient),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseApi.delete(id),
    onSuccess: () => invalidateExpenseQueries(queryClient),
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
    onSuccess: () => invalidateAppointmentQueries(queryClient),
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => appointmentApi.update(id, data),
    onSuccess: () => invalidateAppointmentQueries(queryClient),
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appointmentApi.delete(id),
    onSuccess: () => invalidateAppointmentQueries(queryClient),
  });
}

// Revenue Summary hooks (MD/Admin only)
export function useRevenueSummary(params?: { startDate?: string; endDate?: string }, enabled: boolean = true) {
  const { selectedBranchId, selectedBranchName } = useBranch();
  return useQuery({
    queryKey: ['revenue-summary', params, selectedBranchId, selectedBranchName],
    queryFn: () => revenueApi.getSummary(params),
    enabled,
  });
}

export function usePayrollReport(params: { startDate: string; endDate: string; staffId?: string }, enabled = true) {
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['payroll-report', params, selectedBranchId, selectedBranchName, selectedContext],
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
      invalidateClinicSettingsQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["auth-me-branch"] });
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
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['staff-directory', params, selectedBranchId, selectedBranchName, selectedContext],
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
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });
}

export function useBroadcastNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; message: string; type?: string; branch?: string }) =>
      notificationsApi.broadcast(data),
    onSuccess: () => invalidateNotificationQueries(queryClient),
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
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => invalidateNotificationQueries(queryClient),
  });
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.clearAll(),
    onSuccess: () => invalidateNotificationQueries(queryClient),
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
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tasksApi.update(id, data),
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => invalidateTaskQueries(queryClient),
  });
}

export function useDashboardKpis(params: { startDate: string; endDate: string }, enabled = true) {
  const { selectedBranchId, selectedBranchName } = useBranch();
  return useQuery({
    queryKey: ['dashboard-kpis', params, selectedBranchId, selectedBranchName],
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
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['salary-dashboard', selectedBranchId, selectedBranchName, selectedContext],
    queryFn: () => salaryApi.dashboard(),
    enabled,
  });
}

export function useSalaryHistory(params?: { month?: string; year?: string; branch?: string; staffId?: string; status?: string }) {
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['salary-history', params, selectedBranchId, selectedBranchName, selectedContext],
    queryFn: () => salaryApi.history(params),
  });
}

export function useSalaryPreview(params: { staffId: string; periodStart: string; periodEnd: string }, enabled = false) {
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['salary-preview', params, selectedBranchId, selectedBranchName, selectedContext],
    queryFn: () => salaryApi.preview(params),
    enabled: enabled && !!params.staffId && !!params.periodStart && !!params.periodEnd,
  });
}

export function useGenerateSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryApi.generate,
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
  });
}

export function useSalaryApprovalActions() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateSalaryPayrollQueries(queryClient);
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
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['salary-report', staffId, params, selectedBranchId, selectedBranchName, selectedContext],
    queryFn: () => salaryApi.report(staffId, params),
    enabled: enabled && !!staffId && !!params.startDate && !!params.endDate,
  });
}

export function useSalaryReportHistory(staffId: string, months?: number, enabled = true) {
  const { selectedBranchId, selectedBranchName, selectedContext } = useBranch();
  return useQuery({
    queryKey: ['salary-report-history', staffId, months, selectedBranchId, selectedBranchName, selectedContext],
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
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
  });
}

export function useAddSalaryAddition() {
  return useSalaryAdjustmentMutation(salaryApi.addAddition);
}

export function useAddSalaryDecrement() {
  return useSalaryAdjustmentMutation(salaryApi.addDecrement);
}

export function useUpdateSalaryDecrement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { staffId: string; adjustmentId: string; date?: string; reason?: string; amount?: number }) =>
      salaryApi.updateDecrement(data.staffId, data.adjustmentId, {
        date: data.date,
        reason: data.reason,
        amount: data.amount,
      }),
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
  });
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
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
  });
}

export function useUpdateStaffDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { category?: string; amount?: number; deductionDate?: string; remarks?: string | null } }) =>
      salaryApi.deductions.update(id, data),
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
  });
}

export function useCreateStaffOt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salaryApi.ot.create,
    onSuccess: () => invalidateSalaryPayrollQueries(queryClient),
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
  const { selectedBranchId, selectedBranchName } = useBranch();
  return useQuery({
    queryKey: ['patient-export', selectedBranchId, selectedBranchName],
    queryFn: () => patientsApiExtended.export(),
    enabled,
  });
}

export function usePatientDataHealth(enabled = true) {
  return useQuery({
    queryKey: ['admin-data-health'],
    queryFn: () => adminApi.dataHealth(),
    enabled,
  });
}

export function useRunPatientDataBackfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { batchSize?: number; limit?: number }) => adminApi.runDataHealthBackfill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-data-health'] });
    },
  });
}

export function useSessionReport(params: { startDate: string; endDate: string; staffId?: string }, enabled = true) {
  return useQuery({
    queryKey: ['session-report', params],
    queryFn: () => reportsApiExtended.sessions(params),
    enabled: enabled && !!params.startDate && !!params.endDate,
  });
}
