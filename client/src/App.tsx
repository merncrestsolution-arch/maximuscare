import { Switch, Route, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import type { OverviewContext } from "@shared/branchAccess";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { UpdateAvailableNotification } from "@/components/update-available-notification";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { BranchProvider, useBranch } from "@/context/branch-context";
import { DataProvider } from "@/context/data-context";
import { BrandingProvider } from "@/context/branding-context";
import BranchSelectPage from "@/pages/auth/branch-select";

import AppLayout from "@/components/layout/app-layout";
import LoginPage from "@/pages/auth/login";
import Dashboard from "@/pages/dashboard/home";
import PatientsList from "@/pages/patients/list";
import PatientProfile from "@/pages/patients/profile";
import PatientEditPage from "@/pages/patients/edit";
import NewVisit from "@/pages/visits/new";
import AttendancePage from "@/pages/attendance/index";
import PhysioSummaryPage from "@/pages/physio-summary";
import ProfilePage from "@/pages/profile";
import StaffListPage from "@/pages/staff/list";
import StaffProfilePage from "@/pages/staff/profile";
import StaffEditPage from "@/pages/staff/edit";
import EditVisit from "@/pages/visits/edit";
import InPatientsList from "@/pages/inpatients/list";
import AddInPatient from "@/pages/inpatients/add";
import InPatientProfile from "@/pages/inpatients/profile";
import AddInPatientSession from "@/pages/inpatients/session-add";
import DischargeInPatient from "@/pages/inpatients/discharge";
import EditInPatient from "@/pages/inpatients/edit";
import AddExpensePage from "@/pages/expenses/add";
import EditExpensePage from "@/pages/expenses/edit";
import AppointmentsListPage from "@/pages/appointments/list";
import BookAppointmentPage from "@/pages/appointments/book";
import EditAppointmentPage from "@/pages/appointments/edit";
import NotFound from "@/pages/not-found";
import { LoginStyleSplash } from "@/components/auth/login-style-splash";
import TherapistPatientSummaryPage from "@/pages/reports/therapist-patient-summary";
import BranchDashboardsPage from "@/pages/reports/branch-dashboards";
import ReportsHubPage from "@/pages/reports/index";
import RevenueReportPage from "@/pages/reports/revenue";
import IncentiveReportPage from "@/pages/reports/incentive";
import AttendanceReportPage from "@/pages/reports/attendance-report";
import ExpenseReportPage from "@/pages/reports/expense-report";
import UnpaidVisitsPage from "@/pages/reports/unpaid-visits";
import StaffReportPage from "@/pages/reports/staff-report";
import SettingsPage from "@/pages/settings/index";
import AuditLogPage from "@/pages/audit/index";
import ExpensesListPage from "@/pages/expenses/list";
import TasksPage from "@/pages/tasks/index";
import SalaryHubPage from "@/pages/salary/index";
import SalaryHistoryPage from "@/pages/salary/history";
import SalaryGeneratePage from "@/pages/salary/generate";
import SalaryApprovalPage from "@/pages/salary/approval";
import SalaryFinesPage from "@/pages/salary/fines";
import SalaryDeductionsPage from "@/pages/salary/deductions";
import SalaryOtPage from "@/pages/salary/ot";
import PatientDashboardPage from "@/pages/patients/dashboard";
import HomeVisitsPage from "@/pages/patients/home-visits";
import PatientExportPage from "@/pages/patients/export";
import SessionReportPage from "@/pages/reports/session-report";
import NotificationsPage from "@/pages/notifications/index";
import MaximusOverviewPage from "@/pages/overview/maximus-overview";
import NexusOverviewPage from "@/pages/overview/nexus-overview";

function ProtectedRoute({ component: Component, requireBranch = true, allowWithoutBranch = false, ...rest }: any) {
  const { user } = useAuth();
  const { requiresBranchSelection, selectedBranchId, selectedContext, isLoading: branchLoading } = useBranch();

  if (!user) {
    return <Redirect to="/auth/login" />;
  }

  if (!allowWithoutBranch && !branchLoading && requiresBranchSelection) {
    return <Redirect to="/auth/branch-select" />;
  }

  if (!allowWithoutBranch && !branchLoading && requireBranch && !selectedBranchId) {
    return <Redirect to="/auth/branch-select" />;
  }

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function OverviewRoute({ component: Component, context, ...rest }: { component: any; context: OverviewContext }) {
  const { user } = useAuth();
  const { isLoading, canAccessMaximusOverview, canAccessNexusOverview } = useBranch();

  const canAccess =
    context === "maximus-overview" ? canAccessMaximusOverview : canAccessNexusOverview;

  if (!user) return <Redirect to="/auth/login" />;
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }
  if (!canAccess) return <Redirect to="/auth/branch-select" />;

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function BranchSelectRoute() {
  const { user } = useAuth();
  const { requiresBranchSelection, selectedContext, isLoading } = useBranch();

  if (!user) return <Redirect to="/auth/login" />;
  if (!isLoading && !requiresBranchSelection) {
    if (selectedContext === "maximus-overview") return <Redirect to="/maximus-overview" />;
    if (selectedContext === "nexus-overview") return <Redirect to="/nexus-overview" />;
    return <Redirect to="/dashboard" />;
  }

  return <BranchSelectPage />;
}

function AppRoutes() {
  const { isLoading } = useAuth();

  return (
    <>
      {isLoading ? <LoginStyleSplash message="Loading…" /> : <Router />}
      <Toaster />
      <UpdateAvailableNotification />
    </>
  );
}

function Router() {
  return (
    <Switch>
      {/* Auth Route */}
      <Route path="/auth/login" component={LoginPage} />
      <Route path="/auth/branch-select" component={BranchSelectRoute} />

      {/* Protected Routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/patients">
        <ProtectedRoute component={PatientsList} />
      </Route>
      <Route path="/patients/export">
        <ProtectedRoute component={PatientExportPage} />
      </Route>
      <Route path="/patients/dashboard">
        <ProtectedRoute component={PatientDashboardPage} />
      </Route>
      <Route path="/patients/home-visits">
        <ProtectedRoute component={HomeVisitsPage} />
      </Route>
      <Route path="/patients/new">
        <ProtectedRoute component={PatientEditPage} />
      </Route>
      <Route path="/patients/:id/edit">
        <ProtectedRoute component={PatientEditPage} />
      </Route>
      <Route path="/patients/:id">
        <ProtectedRoute component={PatientProfile} />
      </Route>
      <Route path="/visits/new">
        <ProtectedRoute component={NewVisit} />
      </Route>
      <Route path="/visits/edit/:id">
        <ProtectedRoute component={EditVisit} />
      </Route>
      <Route path="/attendance">
        <ProtectedRoute component={AttendancePage} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={ReportsHubPage} />
      </Route>
      <Route path="/reports/revenue">
        <ProtectedRoute component={RevenueReportPage} />
      </Route>
      <Route path="/reports/incentive">
        <ProtectedRoute component={IncentiveReportPage} />
      </Route>
      <Route path="/reports/attendance">
        <ProtectedRoute component={AttendanceReportPage} />
      </Route>
      <Route path="/reports/expenses">
        <ProtectedRoute component={ExpenseReportPage} />
      </Route>
      <Route path="/reports/unpaid">
        <ProtectedRoute component={UnpaidVisitsPage} />
      </Route>
      <Route path="/reports/sessions">
        <ProtectedRoute component={SessionReportPage} />
      </Route>
      <Route path="/physio-summary">
        <ProtectedRoute component={PhysioSummaryPage} />
      </Route>
      <Route path="/therapist-summary">
        <ProtectedRoute component={TherapistPatientSummaryPage} />
      </Route>
      <Route path="/branch-dashboards">
        <ProtectedRoute component={BranchDashboardsPage} requireBranch={false} />
      </Route>
      <Route path="/maximus-overview">
        <OverviewRoute component={MaximusOverviewPage} context="maximus-overview" />
      </Route>
      <Route path="/nexus-overview">
        <OverviewRoute component={NexusOverviewPage} context="nexus-overview" />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} allowWithoutBranch />
      </Route>
      <Route path="/audit">
        <ProtectedRoute component={AuditLogPage} allowWithoutBranch />
      </Route>
      <Route path="/tasks">
        <ProtectedRoute component={TasksPage} />
      </Route>
      <Route path="/notifications">
        <ProtectedRoute component={NotificationsPage} allowWithoutBranch />
      </Route>
      <Route path="/salary/history">
        <ProtectedRoute component={SalaryHistoryPage} />
      </Route>
      <Route path="/salary/generate">
        <ProtectedRoute component={SalaryGeneratePage} />
      </Route>
      <Route path="/salary/approval">
        <ProtectedRoute component={SalaryApprovalPage} />
      </Route>
      <Route path="/salary/fines">
        <ProtectedRoute component={SalaryFinesPage} />
      </Route>
      <Route path="/salary/deductions">
        <ProtectedRoute component={SalaryDeductionsPage} />
      </Route>
      <Route path="/salary/ot">
        <ProtectedRoute component={SalaryOtPage} />
      </Route>
      <Route path="/salary">
        <ProtectedRoute component={SalaryHubPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route path="/staff/new">
        <ProtectedRoute component={StaffEditPage} />
      </Route>
      <Route path="/staff/:id/edit">
        <ProtectedRoute component={StaffEditPage} />
      </Route>
      <Route path="/staff">
        <ProtectedRoute component={StaffListPage} />
      </Route>
      <Route path="/staff/:id/report">
        <ProtectedRoute component={StaffReportPage} />
      </Route>
      <Route path="/staff/:id">
        <ProtectedRoute component={StaffProfilePage} />
      </Route>

      {/* In-Patient Routes */}
      <Route path="/inpatients">
        <ProtectedRoute component={InPatientsList} />
      </Route>
      <Route path="/inpatients/new">
        <ProtectedRoute component={AddInPatient} />
      </Route>
      <Route path="/inpatients/:id/session/new">
        <ProtectedRoute component={AddInPatientSession} />
      </Route>
      <Route path="/inpatients/:id/discharge">
        <ProtectedRoute component={DischargeInPatient} />
      </Route>
      <Route path="/inpatients/:id/edit">
        <ProtectedRoute component={EditInPatient} />
      </Route>
      <Route path="/inpatients/:id">
        <ProtectedRoute component={InPatientProfile} />
      </Route>

      {/* Expense Routes */}
      <Route path="/expenses">
        <ProtectedRoute component={ExpensesListPage} />
      </Route>
      <Route path="/expenses/add">
        <ProtectedRoute component={AddExpensePage} />
      </Route>
      <Route path="/expenses/edit/:id">
        <ProtectedRoute component={EditExpensePage} />
      </Route>

      {/* Appointment Routes */}
      <Route path="/appointments">
        <ProtectedRoute component={AppointmentsListPage} />
      </Route>
      <Route path="/appointments/book">
        <ProtectedRoute component={BookAppointmentPage} />
      </Route>
      <Route path="/appointments/edit/:id">
        <ProtectedRoute component={EditAppointmentPage} />
      </Route>

      {/* Root redirect */}
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <AuthProvider>
          <BranchProvider>
            <DataProvider>
              <AppRoutes />
            </DataProvider>
          </BranchProvider>
        </AuthProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}

export default App;
