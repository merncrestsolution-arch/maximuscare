import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { DataProvider } from "@/context/data-context";
import { BrandingProvider } from "@/context/branding-context";

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

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null; // Or a loading spinner

  if (!user) {
    return <Redirect to="/auth/login" />;
  }

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Auth Route */}
      <Route path="/auth/login" component={LoginPage} />

      {/* Protected Routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/patients">
        <ProtectedRoute component={PatientsList} />
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
      <Route path="/physio-summary">
        <ProtectedRoute component={PhysioSummaryPage} />
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
          <DataProvider>
            <Router />
            <Toaster />
          </DataProvider>
        </AuthProvider>
      </BrandingProvider>
    </QueryClientProvider>
  );
}

export default App;
