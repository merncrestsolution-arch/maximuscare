import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canManageSalary, canViewSalary } from "@/lib/permissions";
import { useAuth } from "@/context/auth-context";
import { useSalaryDashboard } from "@/hooks/useData";
import { formatLkr } from "@/lib/reportDatePresets";
import {
  Banknote,
  History,
  FileCheck,
  Calculator,
  AlertTriangle,
  MinusCircle,
  Clock,
  BarChart3,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

function SalaryHubContent() {
  const { user } = useAuth();
  const isMgmt = canManageSalary(user?.role);
  const { data: dashboard } = useSalaryDashboard(isMgmt);

  const links = [
    // Bug 14/15/17: non-management staff get a direct link to their detailed,
    // date-ranged salary breakdown (rendered on their own profile page).
    ...(!isMgmt && user?.id
      ? [{ href: `/staff/${user.id}`, title: "My Salary Detail", desc: "Detailed breakdown with date range", icon: Banknote, mgmt: false }]
      : []),
    { href: "/salary/history", title: "Salary History", desc: "All salary records with filters", icon: History, mgmt: false },
    { href: "/salary/generate", title: "Generate Salary", desc: "Preview and generate monthly payroll", icon: Calculator, mgmt: true },
    { href: "/salary/approval", title: "Salary Approval", desc: "Approve, reject, or mark paid", icon: FileCheck, mgmt: true },
    { href: "/salary/fines", title: "Fine Management", desc: "Create, edit, waive fines", icon: AlertTriangle, mgmt: true },
    { href: "/salary/deductions", title: "Deductions", desc: "Food, transport, advance deductions", icon: MinusCircle, mgmt: true },
    { href: "/salary/ot", title: "OT Management", desc: "Overtime entries (Rs.250/hr)", icon: Clock, mgmt: true },
  ].filter((l) => !l.mgmt || isMgmt);

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex items-center gap-3">
        <Banknote className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Salary Management</h1>
          <p className="text-muted-foreground text-sm">Payroll engine — all calculations automated</p>
        </div>
      </div>

      {isMgmt && dashboard && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Payable</CardTitle></CardHeader>
              <CardContent className="text-xl font-bold">{formatLkr(dashboard.totalPayable)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paid</CardTitle></CardHeader>
              <CardContent className="text-xl font-bold text-green-600">{formatLkr(dashboard.paidSalary)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader>
              <CardContent className="text-xl font-bold text-amber-600">{formatLkr(dashboard.pendingSalary)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Approved</CardTitle></CardHeader>
              <CardContent className="text-xl font-bold">{formatLkr(dashboard.approvedSalary)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Draft / Generated</CardTitle></CardHeader>
              <CardContent className="text-xl font-bold">{formatLkr((dashboard.draftSalary ?? 0) + (dashboard.generatedSalary ?? 0))}</CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Salary Trend</CardTitle></CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.trend ?? []}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatLkr(v)} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Branch Comparison</CardTitle></CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.branchComparison ?? []}>
                    <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatLkr(v)} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <l.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{l.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{l.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SalaryHubPage() {
  return (
    <RoleProtectedRoute allowed={canViewSalary}>
      <SalaryHubContent />
    </RoleProtectedRoute>
  );
}
