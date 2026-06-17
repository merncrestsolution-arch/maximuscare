import { useState } from "react";
import { Link } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewSalary, canManageSalary } from "@/lib/permissions";
import { useAuth } from "@/context/auth-context";
import { useSalaryHistory } from "@/hooks/useData";
import { useStaff } from "@/hooks/useData";
import { useBranding } from "@/context/branding-context";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import { ReportDataTable } from "@/components/reports/report-data-table";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { formatLkr } from "@/lib/reportDatePresets";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
const STATUS_OPTIONS = ["", "Generated", "Approved", "Paid", "Cancelled"];

function SalaryHistoryContent() {
  const { user } = useAuth();
  const { logoUri } = useBranding();
  const isMgmt = canManageSalary(user?.role);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [staffId, setStaffId] = useState("");
  const { data: staffList } = useStaff({ includeInactive: true });
  const { data: rows = [], isLoading, error } = useSalaryHistory({
    year: year || undefined,
    month: month || undefined,
    status: status || undefined,
    staffId: isMgmt ? staffId || undefined : user?.id,
  });

  const exportRows = rows.map((r: any) => ({
    month: String(r.salaryMonth).slice(0, 7),
    employeeName: r.staffName,
    basicSalary: formatLkr(Number(r.basicSalary)),
    incentive: formatLkr(Number(r.incentiveAmount)),
    ot: formatLkr(Number(r.otAmount)),
    homeVisit: formatLkr(Number(r.homeVisitAmount)),
    deductions: formatLkr(Number(r.deductionsTotal)),
    finalSalary: formatLkr(Number(r.finalSalary)),
    status: r.status,
  }));

  return (
    <ReportPageShell
      title="Salary History"
      loading={isLoading}
      error={error as Error | null}
      filters={
        <div className="flex flex-wrap gap-3 items-end">
          <Link href="/salary"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <div>
            <label className="text-xs text-muted-foreground">Year</label>
            <Input className="w-24" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Month</label>
            <Select value={month || "all"} onValueChange={(v) => setMonth(v === "all" ? "" : v)}>
              <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isMgmt && (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {STATUS_OPTIONS.filter(Boolean).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Staff</label>
                <Select value={staffId || "all"} onValueChange={(v) => setStaffId(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="All staff" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All staff</SelectItem>
                    {(staffList ?? []).filter((s: any) => s.role === "Physiotherapist" || s.role === "Staff").map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      }
      actions={
        isMgmt ? (
          <StructuredReportActions
            reportTitle="Salary History"
            fileBaseName={`salary-history-${year}`}
            columns={[
              { key: "month", label: "Month" },
              { key: "employeeName", label: "Staff" },
              { key: "basicSalary", label: "Basic" },
              { key: "incentive", label: "Incentive" },
              { key: "homeVisit", label: "Home Visit" },
              { key: "ot", label: "OT" },
              { key: "deductions", label: "Deductions" },
              { key: "finalSalary", label: "Final" },
              { key: "status", label: "Status" },
            ]}
            rows={exportRows}
            logoUri={logoUri}
          />
        ) : null
      }
    >
      <ReportDataTable
        columns={[
          { key: "salaryMonth", label: "Month", render: (r) => String(r.salaryMonth).slice(0, 7) },
          { key: "staffName", label: "Staff" },
          { key: "basicSalary", label: "Basic", render: (r) => formatLkr(Number(r.basicSalary)) },
          { key: "incentiveAmount", label: "Incentive", render: (r) => formatLkr(Number(r.incentiveAmount)) },
          { key: "otAmount", label: "OT", render: (r) => formatLkr(Number(r.otAmount)) },
          { key: "homeVisitAmount", label: "Home Visit", render: (r) => formatLkr(Number(r.homeVisitAmount)) },
          { key: "deductionsTotal", label: "Deductions", render: (r) => formatLkr(Number(r.deductionsTotal)) },
          { key: "finalSalary", label: "Final", render: (r) => formatLkr(Number(r.finalSalary)) },
          { key: "status", label: "Status" },
        ]}
        rows={rows}
        searchKeys={["staffName", "status"]}
      />
    </ReportPageShell>
  );
}

export default function SalaryHistoryPage() {
  return (
    <RoleProtectedRoute allowed={canViewSalary}>
      <SalaryHistoryContent />
    </RoleProtectedRoute>
  );
}
