import { useEffect, useState } from "react";
import { Link } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewReports } from "@/lib/permissions";
import { useHomeVisits, useStaff } from "@/hooks/useData";
import { homeVisitsApi } from "@/lib/api";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import { ReportDataTable } from "@/components/reports/report-data-table";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import { formatLkr, getDateRangeForPreset, type DatePreset } from "@/lib/reportDatePresets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { BranchSelectField } from "@/components/branch/branch-select-field";
import { useBranchOptions } from "@/hooks/use-branch-options";
import { HOME_VISIT_TYPES, homeVisitTypeLabel } from "@/lib/branches";
import { useBranch } from "@/context/branch-context";

function HomeVisitsContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<DatePreset>("currentMonth");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [open, setOpen] = useState(false);
  const { defaultValue: defaultBranch } = useBranchOptions();
  const { selectedBranchName } = useBranch();
  const [form, setForm] = useState({
    patientId: "",
    staffId: "",
    visitDate: "",
    visitType: "Main",
    branch: defaultBranch || selectedBranchName || "Dehiwala",
    notes: "",
  });

  useEffect(() => {
    const r = getDateRangeForPreset(preset, startDate, endDate);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
  }, [preset]);

  const { data: rows = [], isLoading, error } = useHomeVisits({ startDate, endDate });
  const { data: staffList } = useStaff();

  return (
    <ReportPageShell
      title="Home Visit Management"
      loading={isLoading}
      error={error as Error | null}
      filters={
        <div className="space-y-3">
          <div className="flex gap-2">
            <Link href="/patients"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Patients</Button></Link>
            <Button onClick={() => setOpen(true)}>Add Home Visit</Button>
          </div>
          <ReportDateFilters preset={preset} onPresetChange={setPreset} startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
          <p className="text-xs text-muted-foreground">Rates: Main branch Rs.1,000 · Bandaragama Rs.500</p>
        </div>
      }
    >
      <ReportDataTable
        columns={[
          { key: "visitDate", label: "Date" },
          { key: "patientName", label: "Patient" },
          { key: "staffName", label: "Staff" },
          { key: "visitType", label: "Type" },
          { key: "branch", label: "Branch" },
          { key: "paymentAmount", label: "Payment", render: (r) => formatLkr(Number(r.paymentAmount)) },
          { key: "notes", label: "Notes" },
        ]}
        rows={rows}
        searchKeys={["patientName", "staffName"]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Home Visit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Patient ID</Label><Input value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} placeholder="Patient UUID" /></div>
            <div>
              <Label>Staff</Label>
              <Select value={form.staffId} onValueChange={(v) => setForm({ ...form, staffId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(staffList ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} /></div>
            <div>
              <Label>Type (override)</Label>
              <Select value={form.visitType} onValueChange={(v) => setForm({ ...form, visitType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOME_VISIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{homeVisitTypeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch</Label>
              <BranchSelectField value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} />
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              try {
                await homeVisitsApi.create(form);
                qc.invalidateQueries({ queryKey: ['home-visits'] });
                setOpen(false);
                toast({ title: "Home visit created" });
              } catch (e: any) {
                toast({ title: e.message, variant: "destructive" });
              }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReportPageShell>
  );
}

export default function HomeVisitsPage() {
  return (
    <RoleProtectedRoute allowed={canViewReports}>
      <HomeVisitsContent />
    </RoleProtectedRoute>
  );
}
