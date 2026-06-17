import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewReports } from "@/lib/permissions";
import { usePatientDashboard } from "@/hooks/useData";
import { formatLkr } from "@/lib/reportDatePresets";
import { Users, UserCheck, UserX, UserPlus, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function PatientDashboardContent() {
  const { data, isLoading, error } = usePatientDashboard();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-8 text-destructive">Failed to load dashboard</div>;

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/patients"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Patients</Button></Link>
        <h1 className="text-2xl font-bold">Patient Dashboard</h1>
        <Link href="/patients/export"><Button variant="outline" size="sm">Export Excel/PDF</Button></Link>
        <Link href="/reports/sessions"><Button variant="outline" size="sm">Session Report</Button></Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2"><Users className="h-4 w-4" /><CardTitle className="text-sm">Total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{data?.totalPatients ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2"><UserCheck className="h-4 w-4 text-green-600" /><CardTitle className="text-sm">Active</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{data?.activePatients ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2"><UserX className="h-4 w-4" /><CardTitle className="text-sm">Inactive</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{data?.inactivePatients ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><CardTitle className="text-sm">New This Month</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{data?.newPatientsThisMonth ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-600" /><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{formatLkr(data?.outstandingPayments ?? 0)}</CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Branch Distribution</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.branchDistribution ?? []}>
                <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top Therapists (by patients)</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(data?.topTherapists ?? []).map((t: any) => (
                <li key={t.therapistId} className="flex justify-between border-b pb-1">
                  <span>{t.therapistName}</span>
                  <span className="font-medium">{t.patientCount}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PatientDashboardPage() {
  return (
    <RoleProtectedRoute allowed={canViewReports}>
      <PatientDashboardContent />
    </RoleProtectedRoute>
  );
}
