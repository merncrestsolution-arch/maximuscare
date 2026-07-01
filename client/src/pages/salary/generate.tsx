import { useEffect, useState } from "react";
import { Link } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canManageSalary } from "@/lib/permissions";
import { useStaff, useSalaryPreview, useGenerateSalary } from "@/hooks/useData";
import { salaryApi } from "@/lib/api";
import { ReportPageShell, ReportSummaryCard } from "@/components/reports/report-page-shell";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import { formatLkr, getDateRangeForPreset, type DatePreset } from "@/lib/reportDatePresets";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

function SalaryGenerateContent() {
  const { toast } = useToast();
  const [preset, setPreset] = useState<DatePreset>("currentMonth");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [staffId, setStaffId] = useState("");
  const [generateAll, setGenerateAll] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(false);

  useEffect(() => {
    const r = getDateRangeForPreset(preset, periodStart, periodEnd);
    setPeriodStart(r.startDate);
    setPeriodEnd(r.endDate);
  }, [preset]);

  const { data: staffList } = useStaff();
  const therapists = (staffList ?? []).filter((s: any) => s.role === "Physiotherapist" || s.role === "Staff" || s.role === "Manager");
  const { data: preview, isLoading, error } = useSalaryPreview(
    { staffId, periodStart, periodEnd },
    previewEnabled && !generateAll && !!staffId
  );
  const generate = useGenerateSalary();

  const s = preview?.summary;
  const staffDeductionsTotal = Number((s as any)?.staffDeductionsTotal ?? 0);
  const decrementsTotal = Number((s as any)?.decrementsTotal ?? 0);
  const otherDeductionsTotal = staffDeductionsTotal + decrementsTotal;

  return (
    <ReportPageShell
      title="Generate Salary"
      loading={isLoading && previewEnabled}
      error={error as Error | null}
      filters={
        <div className="space-y-4">
          <Link href="/salary"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <ReportDateFilters
            preset={preset}
            onPresetChange={setPreset}
            startDate={periodStart}
            endDate={periodEnd}
            onStartDateChange={setPeriodStart}
            onEndDateChange={setPeriodEnd}
          />
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex items-center gap-2">
              <Checkbox id="all" checked={generateAll} onCheckedChange={(v) => setGenerateAll(!!v)} />
              <label htmlFor="all" className="text-sm">Generate for all staff</label>
            </div>
            {!generateAll && (
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {therapists.map((st: any) => (
                    <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!generateAll && staffId && (
              <Button variant="outline" onClick={() => setPreviewEnabled(true)}>Load Preview</Button>
            )}
            <Button
              disabled={generate.isPending || !periodStart || !periodEnd || (!generateAll && !staffId)}
              onClick={async () => {
                try {
                  const res = await generate.mutateAsync(
                    generateAll
                      ? { all: true, periodStart, periodEnd }
                      : { staffId, periodStart, periodEnd }
                  );
                  if (res?.jobId) {
                    toast({ title: "Bulk generation started…" });
                    const poll = async (): Promise<void> => {
                      const job = await salaryApi.getJob(res.jobId);
                      if (job.status === "queued" || job.status === "running") {
                        await new Promise((r) => setTimeout(r, 1500));
                        return poll();
                      }
                      if (job.status === "failed") {
                        throw new Error(job.error || "Generation failed");
                      }
                      const created = job.result?.created?.length ?? 0;
                      toast({ title: `Generated ${created} salaries` });
                      if (job.result?.errors?.length) {
                        toast({ title: `${job.result.errors.length} errors`, variant: "destructive" });
                      }
                    };
                    await poll();
                    return;
                  }
                  const msg = generateAll
                    ? `Generated ${res?.created?.length ?? 0} salaries`
                    : "Salary generated";
                  toast({ title: msg });
                  if (res?.errors?.length) {
                    toast({ title: `${res.errors.length} errors`, variant: "destructive" });
                  }
                } catch (e) {
                  toast({ title: e instanceof Error ? e.message : "Generation failed", variant: "destructive" });
                }
              }}
            >
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Salary"}
            </Button>
          </div>
        </div>
      }
    >
      {preview && s && (
        <div className="space-y-6">
          <div>
            <h2 className="font-semibold text-lg">{preview.staff.name}</h2>
            <p className="text-sm text-muted-foreground">{preview.periodStart} → {preview.periodEnd}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ReportSummaryCard label="Basic Salary" value={formatLkr(s.basicSalary)} />
            <ReportSummaryCard label="Incentive" value={formatLkr(s.incentiveTotal)} />
            <ReportSummaryCard label="Home Visits" value={formatLkr(s.homeIncome)} />
            <ReportSummaryCard label="OT" value={formatLkr(s.otIncome)} />
            <ReportSummaryCard label="Fines" value={formatLkr(s.finesTotal)} />
            <ReportSummaryCard label="Extra Holiday" value={formatLkr(s.extraHolidayDeduction)} />
            <ReportSummaryCard label="Decrements" value={formatLkr(decrementsTotal)} />
            <ReportSummaryCard label="Other Deductions" value={formatLkr(otherDeductionsTotal)} />
            <ReportSummaryCard label="Final Salary" value={formatLkr(s.finalSalary)} />
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">Attendance</h3>
              <p>Present: {preview.attendanceSummary.present}</p>
              <p>Absent: {preview.attendanceSummary.absent}</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">Visits</h3>
              <p>Colombo Clinic: {preview.visitSummary.colomboClinic}</p>
              <p>Bandaragama Clinic: {preview.visitSummary.bandaragamaClinic}</p>
              <p>Home visits: {preview.visitSummary.colomboHome + preview.visitSummary.bandaragamaHome}</p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">Sessions</h3>
              <p>In-patient sessions: {preview.sessionSummary.count}</p>
              <p>Incentive days: {s.incentiveDays?.length ?? 0}</p>
            </div>
          </div>
        </div>
      )}
    </ReportPageShell>
  );
}

export default function SalaryGeneratePage() {
  return (
    <RoleProtectedRoute allowed={canManageSalary}>
      <SalaryGenerateContent />
    </RoleProtectedRoute>
  );
}
