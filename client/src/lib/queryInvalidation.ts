import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Invalidate and immediately refetch all active queries matching each key prefix. */
export async function invalidateActive(queryClient: QueryClient, ...keys: QueryKey[]) {
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: "active" }))
  );
}

export function invalidatePatientQueries(queryClient: QueryClient, patientId?: string) {
  const keys: QueryKey[] = [["patients"], ["patient-dashboard"]];
  if (patientId) {
    keys.push(["patients", patientId], ["patient-stats", patientId], ["patient-history", patientId]);
  }
  return invalidateActive(queryClient, ...keys);
}

export function invalidateVisitQueries(queryClient: QueryClient, patientId?: string) {
  const keys: QueryKey[] = [
    ["visits"],
    ["patient-dashboard"],
    ["reports"],
    ["staff-fines"],
    ["unpaid-report"],
    ["dashboard-kpis"],
  ];
  if (patientId) {
    keys.push(["patient-stats", patientId], ["patient-history", patientId]);
  } else {
    keys.push(["patient-stats"], ["patient-history"]);
  }
  return invalidateActive(queryClient, ...keys);
}

export function invalidateInPatientQueries(queryClient: QueryClient, admissionId?: string) {
  const keys: QueryKey[] = [["inpatients"], ["dashboard-kpis"], ["patients"]];
  if (admissionId) {
    keys.push(
      ["inpatients", admissionId],
      ["inpatients", admissionId, "sessions"],
      ["inpatients", admissionId, "sessions", "previous"],
      ["inpatients", admissionId, "prior-episodes"],
      ["inpatients", admissionId, "discharge"],
      ["inpatients", admissionId, "discharge-summary"],
      ["inpatients", admissionId, "payments"],
      ["inpatients", admissionId, "payments", "total"],
      ["inpatients", admissionId, "extra-expenses"],
      ["inpatients", admissionId, "extra-expenses", "total"],
      ["inpatient-transfers", admissionId]
    );
  }
  keys.push(["inpatients", "sessions-range"], ["inpatients", "sessions-all"]);
  return invalidateActive(queryClient, ...keys);
}

export function invalidateAttendanceQueries(queryClient: QueryClient) {
  return invalidateActive(
    queryClient,
    ["attendance"],
    ["attendance-dashboard"],
    ["attendance-report"],
    ["dashboard-kpis"],
    ["staff-fines"],
    ["salary-report"],
    ["payroll-report"]
  );
}

export function invalidateReportsQueries(queryClient: QueryClient) {
  return invalidateActive(
    queryClient,
    ["reports"],
    ["revenue-report"],
    ["revenue-summary"],
    ["expense-report"],
    ["dashboard-kpis"],
    ["branch-stats"],
    ["unpaid-report"],
    ["therapist-patient-report"]
  );
}

export function invalidateSalaryPayrollQueries(queryClient: QueryClient) {
  return invalidateActive(
    queryClient,
    ["salary-report"],
    ["salary-report-history"],
    ["salary-detail"],
    ["payroll-report"],
    ["salary-preview"],
    ["salary-dashboard"],
    ["salary-history"],
    ["staff-fines"],
    ["staff-deductions"],
    ["staff-ot"]
  );
}

export function invalidateStaffQueries(queryClient: QueryClient, staffId?: string) {
  const keys: QueryKey[] = [["staff"], ["staff-directory"], ["treating-staff"]];
  if (staffId) keys.push(["staff", staffId], ["staff-stats", staffId]);
  return invalidateActive(queryClient, ...keys);
}

export function invalidateExpenseQueries(queryClient: QueryClient) {
  return invalidateActive(
    queryClient,
    ["expenses"],
    ["revenue-summary"],
    ["expense-report"],
    ["dashboard-kpis"]
  );
}

export function invalidateAppointmentQueries(queryClient: QueryClient) {
  return invalidateActive(queryClient, ["appointments"]);
}

export function invalidateTaskQueries(queryClient: QueryClient) {
  return invalidateActive(queryClient, ["tasks"], ["task-dashboard"]);
}

export function invalidateNotificationQueries(queryClient: QueryClient) {
  return invalidateActive(queryClient, ["notifications"], ["notifications-unread-count"]);
}

export function invalidateClinicSettingsQueries(queryClient: QueryClient) {
  return invalidateActive(queryClient, ["clinic-settings"], ["incentive-settings"], ["payroll-report"]);
}
