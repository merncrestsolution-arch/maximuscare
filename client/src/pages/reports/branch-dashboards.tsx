import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBranchStats } from "@/hooks/useData";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewManagementReports } from "@/lib/permissions";

function BranchDashboardsContent() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const { data, isLoading, error } = useBranchStats({ startDate, endDate });

  const chartData = data?.stats ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branch Dashboards</CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-destructive text-center py-8">Failed to load branch stats</p>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {chartData.map((b: any) => (
              <div key={b.branch} className="rounded-lg border p-4 space-y-1 text-sm">
                <div className="font-semibold text-base">{b.branch}</div>
                <div>Clinic visits: {b.clinicVisits}</div>
                <div>Home visits: {b.homeVisits}</div>
                <div>IP sessions: {b.sessions}</div>
                <div>Revenue: LKR {Number(b.revenue ?? 0).toLocaleString()}</div>
                <div>Incentives: LKR {Number(b.incentiveAmount ?? 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="branch" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="clinicVisits" name="Clinic visits" fill="#1873A8" />
              <Bar dataKey="homeVisits" name="Home visits" fill="#16A34A" />
              <Bar dataKey="sessions" name="IP sessions" fill="#F45627" />
              <Bar dataKey="revenue" name="Revenue (LKR)" fill="#105691" />
            </BarChart>
          </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function BranchDashboardsPage() {
  return (
    <RoleProtectedRoute allowed={canViewManagementReports}>
      <BranchDashboardsContent />
    </RoleProtectedRoute>
  );
}
