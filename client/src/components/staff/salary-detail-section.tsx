import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { usePayrollReport, useUpdateStaff } from "@/hooks/useData";
import { useBranding } from "@/context/branding-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil } from "lucide-react";
import { formatLkr } from "@/lib/reportDatePresets";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { useToast } from "@/hooks/use-toast";

type Props = {
  staffId: string;
  staffName: string;
  /** When true (Admin/MD), basic salary & other adjustments become editable inline. */
  canEdit: boolean;
};

/**
 * Bug 14/15/17: full, date-ranged salary breakdown for a staff member.
 * - Date range picker (defaults to the current month) that re-fetches on change (Bug 15).
 * - Detailed line-item breakdown shown on screen and exportable to PDF (Bug 17).
 * - Works for staff (own, read-only) and management (Bug 14); Admin/MD can edit the
 *   basic salary and manual adjustments inline (Bug 17).
 */
export function SalaryDetailSection({ staffId, staffName, canEdit }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logoUri } = useBranding();
  const updateStaff = useUpdateStaff();

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const { data: report, isLoading, error } = usePayrollReport(
    { startDate, endDate, staffId },
    !!staffId && !!startDate && !!endDate
  );
  const s: any = report?.summaries?.[0];

  const [editing, setEditing] = useState(false);
  const [basicDraft, setBasicDraft] = useState("");
  const [adjDraft, setAdjDraft] = useState("");

  const beginEdit = () => {
    setBasicDraft(String(s?.basicSalary ?? 0));
    setAdjDraft(String(s?.otherAdjustments ?? 0));
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      await updateStaff.mutateAsync({
        id: staffId,
        data: { basicSalary: basicDraft, otherAdjustments: adjDraft },
      });
      await queryClient.invalidateQueries({ queryKey: ["payroll-report"] });
      toast({ title: "Salary updated" });
      setEditing(false);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update salary",
        variant: "destructive",
      });
    }
  };

  const otherDecrements =
    Number(s?.staffDeductionsTotal ?? 0) +
    Number(s?.decrementsTotal ?? 0) +
    (Number(s?.otherAdjustments ?? 0) < 0 ? Math.abs(Number(s?.otherAdjustments)) : 0);
  const otherCredits = Number(s?.otherAdjustments ?? 0) > 0 ? Number(s?.otherAdjustments) : 0;

  const rows = useMemo(() => {
    if (!s) return [] as { label: string; calc: string; amount: string }[];
    const out: { label: string; calc: string; amount: string }[] = [
      { label: "Basic Salary", calc: "", amount: formatLkr(s.basicSalary) },
      {
        label: "Incentives",
        calc: `${s.incentiveCount} counts`,
        amount: formatLkr(s.incentiveTotal),
      },
      {
        label: "  └ Inpatient sessions",
        calc: `${s.inPatientSessionsCount} sessions`,
        amount: "",
      },
      {
        label: "  └ Outpatient (clinic) visits",
        calc: `${s.totalClinicVisits} visits`,
        amount: "",
      },
      { label: "Home Visit Income", calc: `${s.totalHomeVisits} visits`, amount: formatLkr(s.homeIncome) },
      { label: "  └ Colombo (Dehiwala/Neuro)", calc: `${s.colomboHome} visits`, amount: "" },
      { label: "  └ Bandaragama / Nexus HV", calc: `${s.bandaragamaHome} visits`, amount: "" },
      { label: "OT Hours", calc: `${s.totalOt} hrs`, amount: formatLkr(s.otIncome) },
      { label: "Extra Holidays", calc: `${s.extraHolidays} days`, amount: `-${formatLkr(s.extraHolidayDeduction)}` },
      { label: "Fines", calc: "", amount: `-${formatLkr(s.finesTotal)}` },
      { label: "Other Decrements", calc: "", amount: `-${formatLkr(otherDecrements)}` },
    ];
    if (Number(s?.additionsTotal ?? 0) > 0) {
      out.push({ label: "Manual Additions", calc: "", amount: formatLkr(s.additionsTotal) });
    }
    if (otherCredits > 0) out.push({ label: "Other Additions", calc: "", amount: formatLkr(otherCredits) });
    out.push({ label: "Final Salary", calc: "", amount: formatLkr(s.finalSalary) });
    return out;
  }, [s, otherDecrements, otherCredits]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Salary Detail</CardTitle>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="salary-start" className="text-xs">From</Label>
            <Input id="salary-start" type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-36" data-testid="input-salary-start" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="salary-end" className="text-xs">To</Label>
            <Input id="salary-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-36" data-testid="input-salary-end" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load salary. {error instanceof Error ? error.message : ""}</p>
        ) : !s ? (
          <p className="text-sm text-muted-foreground py-4">No salary data for this period.</p>
        ) : (
          <>
            {canEdit && (
              <div className="flex justify-end">
                {editing ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Basic Salary</Label>
                      <Input type="number" value={basicDraft} onChange={(e) => setBasicDraft(e.target.value)} className="h-9 w-36" data-testid="input-edit-basic" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Other Adjustment (+/-)</Label>
                      <Input type="number" value={adjDraft} onChange={(e) => setAdjDraft(e.target.value)} className="h-9 w-36" data-testid="input-edit-adjustment" />
                    </div>
                    <Button size="sm" className="h-9" onClick={saveEdit} disabled={updateStaff.isPending} data-testid="button-save-salary">
                      {updateStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-9" onClick={beginEdit} data-testid="button-edit-salary">
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit components
                  </Button>
                )}
              </div>
            )}

            <table className="w-full text-sm border-collapse">
              <tbody>
                {rows.map((r, i) => {
                  const isFinal = r.label === "Final Salary";
                  return (
                    <tr key={i} className={isFinal ? "border-t-2 border-border" : "border-b border-border/40"}>
                      <td className={`py-1.5 text-left align-top ${isFinal ? "font-bold" : r.label.startsWith("  ") ? "text-muted-foreground pl-3" : "font-medium"}`}>{r.label.trim()}</td>
                      <td className="py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap pr-3">{r.calc}</td>
                      <td className={`py-1.5 text-right whitespace-nowrap ${isFinal ? "font-bold text-base" : "font-medium"}`}>{r.amount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="pt-1">
              <StructuredReportActions
                reportTitle={`Salary Report - ${staffName}`}
                fileBaseName={`salary-${staffName}-${startDate}`}
                columns={[
                  { key: "label", label: "Component" },
                  { key: "calc", label: "Calculation" },
                  { key: "amount", label: "Amount LKR" },
                ]}
                rows={rows.map((r) => ({ label: r.label.trim(), calc: r.calc, amount: r.amount }))}
                logoUri={logoUri}
                meta={[
                  { label: "Staff", value: staffName },
                  { label: "Period", value: `${startDate} to ${endDate}` },
                  { label: "Final Salary", value: formatLkr(s.finalSalary) },
                ]}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
