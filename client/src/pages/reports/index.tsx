import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewReports, canViewFinancialSummary, canViewSalary } from "@/lib/permissions";
import { useAuth } from "@/context/auth-context";
import { PageShell } from "@/components/layout/page-shell";
import {
  BarChart3,
  DollarSign,
  Users,
  CalendarCheck,
  Receipt,
  AlertCircle,
  UserCircle,
  Building2,
  Stethoscope,
  ClipboardList,
} from "lucide-react";

function ReportsHubContent() {
  const { user } = useAuth();
  const canSeeFinancialReports = canViewFinancialSummary(user?.role);
  // Salary/incentive figures are financial — visible to financial roles, plus
  // physiotherapists/staff who view their own. Managers are excluded.
  const canSeeSalaryReports = canSeeFinancialReports || canViewSalary(user?.role);

  const reports = [
    { href: "/physio-summary", title: "Salary & Payroll", desc: "Monthly salary, incentives, fines", icon: BarChart3, salary: true },
    { href: "/reports/revenue", title: "Revenue Report", desc: "Paid/unpaid breakdown and trends", icon: DollarSign, mgmt: true },
    { href: "/reports/incentive", title: "Incentive Report", desc: "Staff incentive counts and amounts", icon: Stethoscope, salary: true },
    { href: "/reports/attendance", title: "Attendance Report", desc: "Present, absent, leave, holiday", icon: CalendarCheck },
    { href: "/reports/expenses", title: "Expense Report", desc: "Category-wise expense summary", icon: Receipt, mgmt: true },
    { href: "/reports/unpaid", title: "Unpaid Visits", desc: "Outstanding payments until paid", icon: AlertCircle, mgmt: true },
    { href: "/reports/sessions", title: "Session Report", desc: "Outpatient visits and in-patient sessions", icon: ClipboardList },
    { href: "/patients/export", title: "Patient Export", desc: "Excel/PDF register with outstanding balances", icon: Users, mgmt: true },
    { href: "/therapist-summary", title: "Therapist Summary", desc: "Patients by first-visit therapist", icon: Users, mgmt: true },
    { href: "/branch-dashboards", title: "Branch Dashboards", desc: "Per-branch KPIs and charts", icon: Building2, mgmt: true },
  ].filter((r) => (!r.mgmt || canSeeFinancialReports) && (!r.salary || canSeeSalaryReports));

  return (
    <PageShell title="Reports" description="All values from the centralized calculation engine.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <r.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{r.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {user && (
          <Link href={`/staff/${user.id}/report`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">My Staff Report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Your visits, sessions, attendance, and salary</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </PageShell>
  );
}

export default function ReportsHubPage() {
  return (
    <RoleProtectedRoute allowed={canViewReports}>
      <ReportsHubContent />
    </RoleProtectedRoute>
  );
}
