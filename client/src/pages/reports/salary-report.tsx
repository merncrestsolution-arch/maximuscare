import { useEffect, useMemo, useState } from "react";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewReportsHub } from "@/lib/permissions";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { useSalaryDetail, useStaffDirectory } from "@/hooks/useData";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDateRangeForPreset, formatMoney, type DatePreset } from "@/lib/reportDatePresets";

const lkr = (n: number) => `LKR ${formatMoney(Number(n) || 0)}`;

function SalaryReportContent() {
  const { user } = useAuth();
  const { logoUri } = useBranding();
  // Staff / Physiotherapists only ever see their own report; the selector is hidden.
  const isSelfOnly = ["Staff", "Physiotherapist"].includes(user?.role ?? "");
  const canPickStaff = !isSelfOnly;

  const [selectedStaffId, setSelectedStaffId] = useState(isSelfOnly ? user?.id ?? "" : "");
  const [preset, setPreset] = useState<DatePreset>("currentMonth");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitted, setSubmitted] = useState<{ staffId: string; startDate: string; endDate: string } | null>(null);

  useEffect(() => {
    const r = getDateRangeForPreset(preset, startDate, endDate);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  // Branch staff list for managers (server scopes /staff/directory to the active branch).
  const { data: staffList = [] } = useStaffDirectory(undefined, canPickStaff);

  const { data, isLoading, error } = useSalaryDetail(
    submitted?.staffId ?? "",
    { startDate: submitted?.startDate ?? "", endDate: submitted?.endDate ?? "" },
    !!submitted?.staffId && !!submitted?.startDate && !!submitted?.endDate
  );

  const handleGenerate = () => {
    const staffId = isSelfOnly ? user?.id ?? "" : selectedStaffId;
    if (!staffId || !startDate || !endDate) return;
    setSubmitted({ staffId, startDate, endDate });
  };

  const pdfRows = useMemo(() => {
    if (!data) return [];
    const hv = data.homeVisits;
    const d = data.deductions;
    return [
      { item: "Basic Salary", amount: lkr(data.basicSalary) },
      { item: `Home Visits — Colombo (Dehiwala/Neuro) (${hv.colomboRegular.count} × ${formatMoney(hv.colomboRegular.rate)})`, amount: lkr(hv.colomboRegular.amount) },
      { item: `Home Visits — Other Branches (${hv.otherBranches.count} × ${formatMoney(hv.otherBranches.rate)})`, amount: lkr(hv.otherBranches.amount) },
      { item: "Home Visits Total", amount: lkr(hv.total) },
      { item: `OT Hours (${data.ot.hours} × ${formatMoney(data.ot.rate)})`, amount: lkr(data.ot.amount) },
      { item: "Additions / Bonuses", amount: lkr(data.additions.amount) },
      { item: "Deduction — Fines", amount: `-${lkr(d.fines.amount)}` },
      { item: `Deduction — Extra Holidays (${d.extraHolidays.days} × ${formatMoney(d.extraHolidays.rate)})`, amount: `-${lkr(d.extraHolidays.amount)}` },
      { item: "Deduction — Other", amount: `-${lkr(d.other.amount)}` },
      { item: "FINAL SALARY", amount: lkr(data.finalSalary) },
    ];
  }, [data]);

  return (
    <ReportPageShell
      title="Salary Report"
      loading={isLoading}
      error={error as Error | null}
      filters={
        <div className="flex flex-col gap-3">
          {canPickStaff && (
            <div className="space-y-1">
              <Label>Staff</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {(staffList as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.role ? ` (${s.role})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <ReportDateFilters
            preset={preset}
            onPresetChange={setPreset}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <div>
            <Button onClick={handleGenerate} disabled={(!isSelfOnly && !selectedStaffId) || !startDate || !endDate}>
              Generate Report
            </Button>
          </div>
        </div>
      }
      actions={
        data ? (
          <StructuredReportActions
            reportTitle={`Salary Report — ${data.staff.name}`}
            fileBaseName={`salary-${data.staff.id}-${submitted?.startDate ?? ""}`}
            columns={[
              { key: "item", label: "Description" },
              { key: "amount", label: "Amount (LKR)" },
            ]}
            rows={pdfRows}
            logoUri={logoUri}
            meta={[
              { label: "Staff", value: data.staff.name },
              { label: "Branch", value: data.staff.branch ?? "—" },
              { label: "Period", value: `${submitted?.startDate} to ${submitted?.endDate}` },
            ]}
          />
        ) : null
      }
    >
      {data && (
        <div className="rounded-lg border border-border/60 bg-white p-4">
          <div className="border-b border-border/60 pb-3 mb-3">
            <div className="text-sm font-bold text-foreground">
              Salary Report — {data.staff.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.staff.branch ?? "—"} · {submitted?.startDate} to {submitted?.endDate}
            </div>
          </div>
          <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "70%" }} />
              <col style={{ width: "30%" }} />
            </colgroup>
            <tbody>
              <tr>
                <td className="py-1 text-left">Basic Salary</td>
                <td className="py-1 text-right font-medium whitespace-nowrap">{lkr(data.basicSalary)}</td>
              </tr>

              <tr className="border-t border-border/60">
                <td className="pt-2 text-left font-semibold" colSpan={2}>Home Visits</td>
              </tr>
              <tr>
                <td className="py-1 text-left text-muted-foreground">Colombo (Dehiwala/Neuro) ({data.homeVisits.colomboRegular.count} × {formatMoney(data.homeVisits.colomboRegular.rate)})</td>
                <td className="py-1 text-right whitespace-nowrap">{lkr(data.homeVisits.colomboRegular.amount)}</td>
              </tr>
              <tr>
                <td className="py-1 text-left text-muted-foreground">Other Branches ({data.homeVisits.otherBranches.count} × {formatMoney(data.homeVisits.otherBranches.rate)})</td>
                <td className="py-1 text-right whitespace-nowrap">{lkr(data.homeVisits.otherBranches.amount)}</td>
              </tr>
              <tr>
                <td className="py-1 text-left font-medium">Home Visits Total</td>
                <td className="py-1 text-right font-medium whitespace-nowrap">{lkr(data.homeVisits.total)}</td>
              </tr>

              <tr className="border-t border-border/60">
                <td className="pt-2 py-1 text-left">OT Hours ({data.ot.hours} × {formatMoney(data.ot.rate)})</td>
                <td className="pt-2 py-1 text-right whitespace-nowrap">{lkr(data.ot.amount)}</td>
              </tr>
              <tr>
                <td className="py-1 text-left">Additions / Bonuses</td>
                <td className="py-1 text-right whitespace-nowrap">{lkr(data.additions.amount)}</td>
              </tr>

              <tr className="border-t border-border/60">
                <td className="pt-2 text-left font-semibold" colSpan={2}>Deductions</td>
              </tr>
              <tr>
                <td className="py-1 text-left text-muted-foreground">Fines</td>
                <td className="py-1 text-right text-red-600 whitespace-nowrap">-{lkr(data.deductions.fines.amount)}</td>
              </tr>
              <tr>
                <td className="py-1 text-left text-muted-foreground">Extra Holidays ({data.deductions.extraHolidays.days} × {formatMoney(data.deductions.extraHolidays.rate)})</td>
                <td className="py-1 text-right text-red-600 whitespace-nowrap">-{lkr(data.deductions.extraHolidays.amount)}</td>
              </tr>
              <tr>
                <td className="py-1 text-left text-muted-foreground">Other Decrements</td>
                <td className="py-1 text-right text-red-600 whitespace-nowrap">-{lkr(data.deductions.other.amount)}</td>
              </tr>

              <tr className="border-t-2 border-border">
                <td className="pt-2 text-left font-bold">FINAL SALARY</td>
                <td className="pt-2 text-right font-bold whitespace-nowrap">{lkr(data.finalSalary)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {!data && !isLoading && (
        <p className="text-muted-foreground text-sm">
          Select {canPickStaff ? "a staff member and " : ""}a date range, then press “Generate Report”.
        </p>
      )}
    </ReportPageShell>
  );
}

export default function SalaryReportPage() {
  return (
    <RoleProtectedRoute allowed={canViewReportsHub}>
      <SalaryReportContent />
    </RoleProtectedRoute>
  );
}
