/**
 * Permission middleware aliases — use instead of scattered requireRole checks.
 */
import { requirePermission } from "../auth";

export const requireStaffManage = requirePermission("staff.manage");
export const requireStaffView = requirePermission("staff.view");
export const requirePatientsManage = requirePermission("patients.manage");
export const requirePatientsViewAll = requirePermission("patients.view_all");
export const requireVisitsManage = requirePermission("visits.manage");
export const requireVisitsViewAll = requirePermission("visits.view_all");
export const requireAttendanceManage = requirePermission("attendance.manage");
export const requireSalaryManage = requirePermission("salary.manage");
export const requireSalaryApprove = requirePermission("salary.approve");
export const requireReportsView = requirePermission("reports.view");
export const requireReportsExport = requirePermission("reports.export");
export const requireBranchesManage = requirePermission("branches.manage");
export const requireSettingsManage = requirePermission("settings.manage");
export const requireTasksManage = requirePermission("tasks.manage");
export const requireAuditView = requirePermission("audit.view");
export const requireCriticalDelete = requirePermission("critical.delete");
export const requireAppointmentsManage = requirePermission("appointments.manage");
export const requireAppointmentsView = requirePermission("appointments.view");
export const requireExpensesManage = requirePermission("expenses.manage");
export const requireInpatientsManage = requirePermission("inpatients.manage");
export const requireStaffDeactivate = requirePermission("staff.deactivate");
export const requireNotificationsManage = requirePermission("notifications.manage");
