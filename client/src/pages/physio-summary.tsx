import { useMemo, useState } from "react";
import { addDays, format, isAfter, isBefore, parseISO } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import {
  useVisits,
  useAttendance,
  useStaff,
  useIncentiveSettings,
  useUpdateIncentiveSettings,
  useAllInPatientSessionsInRange,
  useInPatientSessionsForStaffRange,
  useStaffFines,
  useCreateStaffFine,
  useUpdateStaffFine,
  useDeleteStaffFine,
  usePayrollReport,
} from "@/hooks/useData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { isVisitForStaff } from "@/lib/visitAccess";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewSalaryReports } from "@/lib/permissions";

function clampDate(dateStr: string, fromStr: string, toStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isBefore(d, from)) return false;
  if (isAfter(d, to)) return false;
  return true;
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function PhysioSummaryContent() {
  const { user, isLoading: authLoading } = useAuth();
  const { logoUri } = useBranding();
  const { toast } = useToast();

  const today = new Date();
  const [rangeFrom, setRangeFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd"));
  const [rangeTo, setRangeTo] = useState(format(new Date(today.getFullYear(), today.getMonth() + 1, 0), "yyyy-MM-dd"));

  const { data: staff = [], isLoading: loadingStaff, error: staffError } = useStaff();
  const { data: payrollReport, isLoading: loadingPayroll, error: payrollError } = usePayrollReport({
    startDate: rangeFrom,
    endDate: rangeTo,
  });
  const { data: incentiveSettings } = useIncentiveSettings();
  const updateIncentiveSettings = useUpdateIncentiveSettings();

  const role = (user?.role || "").toLowerCase();
  const isManagement = role === "admin" || role === "md";

  const endExclusive = useMemo(() => format(addDays(parseISO(rangeTo), 1), "yyyy-MM-dd"), [rangeTo]);

  const { data: ipSessionsAll = [], isLoading: loadingIpAll } = useAllInPatientSessionsInRange(
    { startDate: rangeFrom, endDate: endExclusive },
    isManagement
  );
  const { data: ipSessionsMine = [], isLoading: loadingIpMine } = useInPatientSessionsForStaffRange(
    { startDate: rangeFrom, endDate: endExclusive, staffId: user?.id || "" },
    !isManagement
  );
  const ipSessions = isManagement ? ipSessionsAll : ipSessionsMine;
  const loadingIp = isManagement ? loadingIpAll : loadingIpMine;

  const { data: finesList = [], isLoading: loadingFines } = useStaffFines(
    { startDate: rangeFrom, endDate: endExclusive },
    !!rangeFrom && !!rangeTo
  );

  const createStaffFine = useCreateStaffFine();
  const updateStaffFine = useUpdateStaffFine();
  const deleteStaffFine = useDeleteStaffFine();

  const [fineDialogOpen, setFineDialogOpen] = useState(false);
  const [editingFineId, setEditingFineId] = useState<string | null>(null);
  const [fineForm, setFineForm] = useState({
    staffId: "",
    fineDate: format(new Date(), "yyyy-MM-dd"),
    amount: "500",
    reason: "",
  });

  const incEnabled = String(incentiveSettings?.incentiveEnabled ?? "true").toLowerCase() === "true";
  const incMinPatients = incentiveSettings?.minPatientsForIncentive ?? 5;
  const incPerPatient = incentiveSettings?.incentivePerPatient ?? 100;
  const incScope = incentiveSettings?.clinicLocationScope ?? "Colombo";

  const [editingIncentive, setEditingIncentive] = useState(false);
  const [incForm, setIncForm] = useState({
    enabled: "true",
    minPatients: "5",
    perPatient: "100",
    scope: "Colombo",
  });

  const openIncentiveEdit = () => {
    setIncForm({
      enabled: incEnabled ? "true" : "false",
      minPatients: String(incMinPatients),
      perPatient: String(incPerPatient),
      scope: incScope,
    });
    setEditingIncentive(true);
  };

  const saveIncentiveSettings = async () => {
    try {
      await updateIncentiveSettings.mutateAsync({
        incentiveEnabled: incForm.enabled,
        minPatientsForIncentive: Number(incForm.minPatients),
        incentivePerPatient: Number(incForm.perPatient),
        clinicLocationScope: incForm.scope,
      });
      toast({ title: "Incentive settings saved" });
      setEditingIncentive(false);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to save", variant: "destructive" });
    }
  };

  const physios = useMemo(() => {
    if (!user) return [];
    const all = (staff || []).filter((s) => {
      const r = (s.role || "").toLowerCase();
      return r === "physiotherapist" || r === "staff";
    });
    if (isManagement) return all;
    return all.filter((s) => s.id === user.id);
  }, [isManagement, staff, user]);

  const summaries = useMemo(() => {
    const serverSummaries = payrollReport?.summaries ?? [];
    return serverSummaries.map((s: any) => ({
      ...s,
      id: s.staffId,
      error: null,
    }));
  }, [payrollReport]);

  if (authLoading || !user || !user.role) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white" data-testid="loading-reports">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  if (loadingStaff || loadingPayroll || loadingIp || loadingFines) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white" data-testid="loading-reports-data">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  const hasError = staffError || payrollError;
  const generatedAt = format(new Date(), "dd MMM yyyy hh:mm a");
  const summaryColumns = [
    { key: "physio", label: "Physiotherapist" },
    { key: "presentDays", label: "Present Days" },
    { key: "absentDays", label: "Absent Days" },
    { key: "totalOt", label: "OT Hours" },
    { key: "colomboClinic", label: "Colombo Clinic" },
    { key: "colomboHome", label: "Colombo Home" },
    { key: "bandaragamaClinic", label: "Bandaragama Clinic" },
    { key: "bandaragamaHome", label: "Bandaragama Home" },
    { key: "inPatientSessions", label: "In-Patient Sessions" },
    { key: "incentiveCount", label: "Incentive Count" },
    { key: "fines", label: "Fines LKR" },
    { key: "extraHolidays", label: "Extra Holidays" },
    { key: "basicSalary", label: "Basic Salary LKR" },
    { key: "otherAdjustments", label: "Other Adj. LKR" },
    { key: "finalSalary", label: "Final Salary LKR" },
    { key: "incentive", label: "Incentive LKR" },
  ];
  const summaryRows = summaries.map((s: any) => ({
    physio: s.name,
    presentDays: String(s.presentDays),
    absentDays: String(s.absentDays),
    totalOt: s.totalOt.toFixed(1),
    colomboClinic: String(s.colomboClinic),
    colomboHome: String(s.colomboHome),
    bandaragamaClinic: String(s.bandaragamaClinic),
    bandaragamaHome: String(s.bandaragamaHome),
    inPatientSessions: String(s.inPatientSessionsCount),
    incentiveCount: String(s.incentiveCount),
    fines: String(s.finesTotal),
    extraHolidays: String(s.extraHolidays),
    basicSalary: String(s.basicSalary),
    otherAdjustments: String(s.otherAdjustments),
    finalSalary: String(Math.round(s.finalSalary)),
    incentive: String(s.incentiveTotal),
  }));

  const physioOptions = (staff || []).filter((s: any) => {
    const r = (s.role || "").toLowerCase();
    return r === "physiotherapist" || r === "staff";
  });
  const fineStaffOptions = (staff || []).filter((s: any) => {
    const r = String(s.role || "").toLowerCase();
    return r !== "admin" && r !== "md";
  });

  const openAddFine = () => {
    setEditingFineId(null);
    setFineForm({
      staffId: fineStaffOptions[0]?.id || "",
      fineDate: format(new Date(), "yyyy-MM-dd"),
      amount: "500",
      reason: "",
    });
    setFineDialogOpen(true);
  };

  const openEditFine = (f: any) => {
    setEditingFineId(f.id);
    setFineForm({
      staffId: f.staffId,
      fineDate: f.fineDate,
      amount: String(f.amount),
      reason: f.reason || "",
    });
    setFineDialogOpen(true);
  };

  const saveFine = async () => {
    if (!fineForm.staffId || !fineForm.reason.trim()) {
      toast({ title: "Missing fields", description: "Staff and reason are required.", variant: "destructive" });
      return;
    }
    const st = fineStaffOptions.find((x: any) => x.id === fineForm.staffId);
    try {
      if (editingFineId) {
        await updateStaffFine.mutateAsync({
          id: editingFineId,
          data: {
            staffId: fineForm.staffId,
            staffName: st?.name || "",
            fineDate: fineForm.fineDate,
            amount: fineForm.amount,
            reason: fineForm.reason.trim(),
          },
        });
        toast({ title: "Fine updated" });
      } else {
        await createStaffFine.mutateAsync({
          staffId: fineForm.staffId,
          staffName: st?.name || "",
          fineDate: fineForm.fineDate,
          amount: fineForm.amount || "500",
          reason: fineForm.reason.trim(),
          source: "manual",
          fineType: "Manual Fine",
        });
        toast({ title: "Fine added" });
      }
      setFineDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save fine", variant: "destructive" });
    }
  };

  const removeFine = async (id: string) => {
    try {
      await deleteStaffFine.mutateAsync(id);
      toast({ title: "Fine deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5 pb-24" data-testid="page-physio-summary">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-physio-summary-title">
          Physio Summary
        </h1>
        <p className="text-muted-foreground" data-testid="text-physio-summary-subtitle">
          Date-range totals for visits, overtime, and incentives.
        </p>
      </div>

      <StructuredReportActions
        reportTitle="Physio Summary Report"
        fileBaseName={`physio-summary-data-${rangeFrom}-to-${rangeTo}`}
        columns={summaryColumns}
        rows={summaryRows}
        logoUri={logoUri}
        themeColor="#2563EB"
        meta={[
          { label: "From", value: rangeFrom },
          { label: "To", value: rangeTo },
          { label: "Generated", value: generatedAt },
          { label: "Prepared By", value: user.name },
        ]}
      />

      <div id="physio-summary-report" className="space-y-5 rounded-xl border border-border/60 bg-white p-4">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-3">
            <img src={logoUri} alt="Clinic logo" className="h-12 w-12 rounded-md object-contain" />
            <div>
              <div className="text-base font-bold text-foreground">Maximus Care</div>
              <div className="text-xs text-muted-foreground">Physio Summary Report</div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{rangeFrom}</div>
            <div>to {rangeTo}</div>
            <div>Generated: {generatedAt}</div>
            <div>Prepared by: {user.name}</div>
          </div>
        </div>

        {hasError && (
          <Card className="bg-red-50 border border-red-200">
            <CardContent className="p-4">
              <p className="text-sm text-red-700">
                Some data could not be loaded. Results may be incomplete.
                {staffError && <span className="block">Staff: {staffError.message}</span>}
                {payrollError && <span className="block">Payroll: {(payrollError as Error).message}</span>}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white border border-border/60 shadow-sm" data-testid="card-physio-range">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground" data-testid="label-range-from">
                  From Date
                </div>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="h-11 w-full rounded-md border border-border/60 bg-white px-3 text-base md:text-sm"
                  data-testid="input-range-from"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground" data-testid="label-range-to">
                  To Date
                </div>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="h-11 w-full rounded-md border border-border/60 bg-white px-3 text-base md:text-sm"
                  data-testid="input-range-to"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground" data-testid="hint-physio-summary">
              {incEnabled
                ? `Incentive rule: ${incScope === "All" ? "All branches" : incScope} outpatient visits plus in-patient sessions — when combined daily total is ${incMinPatients}+, incentive = ${incPerPatient} LKR per session for that day.`
                : "Incentives are currently disabled."}
            </div>
          </CardContent>
        </Card>

      {isManagement && (
        <Card className="bg-white border border-border/60 shadow-sm" data-testid="card-incentive-settings">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-foreground">Incentive Settings</div>
              {!editingIncentive && (
                <Button variant="outline" size="sm" onClick={openIncentiveEdit} data-testid="button-edit-incentive">
                  Edit
                </Button>
              )}
            </div>

            {editingIncentive ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">Incentive Enabled</div>
                  <Select value={incForm.enabled} onValueChange={(v) => setIncForm(f => ({ ...f, enabled: v }))}>
                    <SelectTrigger data-testid="select-incentive-enabled"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">On</SelectItem>
                      <SelectItem value="false">Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">Min Patients / Day</div>
                    <Input
                      type="number"
                      min="1"
                      value={incForm.minPatients}
                      onChange={(e) => setIncForm(f => ({ ...f, minPatients: e.target.value }))}
                      data-testid="input-min-patients"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">LKR per Patient</div>
                    <Input
                      type="number"
                      min="1"
                      value={incForm.perPatient}
                      onChange={(e) => setIncForm(f => ({ ...f, perPatient: e.target.value }))}
                      data-testid="input-per-patient"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">Clinic Location Scope</div>
                  <Select value={incForm.scope} onValueChange={(v) => setIncForm(f => ({ ...f, scope: v }))}>
                    <SelectTrigger data-testid="select-incentive-scope"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Colombo">Colombo Only</SelectItem>
                      <SelectItem value="Bandaragama">Bandaragama Only</SelectItem>
                      <SelectItem value="All">All Branches</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveIncentiveSettings} disabled={updateIncentiveSettings.isPending} data-testid="button-save-incentive">
                    {updateIncentiveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingIncentive(false)} data-testid="button-cancel-incentive">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Status:</div>
                <div className="font-medium">{incEnabled ? "Enabled" : "Disabled"}</div>
                <div className="text-muted-foreground">Min Patients:</div>
                <div className="font-medium">{incMinPatients}</div>
                <div className="text-muted-foreground">Per Patient:</div>
                <div className="font-medium">{incPerPatient} LKR</div>
                <div className="text-muted-foreground">Scope:</div>
                <div className="font-medium">{incScope === "All" ? "All Branches" : `${incScope} Only`}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

        <Card className="bg-white border border-border/60 shadow-sm" data-testid="card-staff-fines">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-foreground">Staff fines</div>
                {isManagement ? (
                  <Button size="sm" onClick={openAddFine} data-testid="button-add-fine">
                    <Plus className="h-4 w-4 mr-1" />
                    Add fine
                  </Button>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
                      <th className="p-2">Date</th>
                      <th className="p-2">Staff</th>
                      <th className="p-2 text-right">LKR</th>
                      <th className="p-2">Reason</th>
                      <th className="p-2">Source</th>
                      {isManagement ? <th className="p-2">Created by</th> : null}
                      {isManagement ? <th className="p-2 w-24"> </th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(finesList || []).length === 0 ? (
                      <tr>
                        <td colSpan={isManagement ? 7 : 5} className="p-4 text-center text-muted-foreground">
                          No fines in this date range.
                        </td>
                      </tr>
                    ) : (
                      (finesList || []).map((f: any) => (
                        <tr key={f.id} className="border-t border-border/50">
                          <td className="p-2 whitespace-nowrap">{f.fineDate}</td>
                          <td className="p-2">{f.staffName}</td>
                          <td className="p-2 text-right tabular-nums">{Number(f.amount).toLocaleString()}</td>
                          <td className="p-2 max-w-[200px] truncate" title={f.reason}>
                            {f.reason}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground">{f.source === "auto_no_session" ? "Auto" : "Manual"}</td>
                          {isManagement ? (
                            <td className="p-2 text-xs text-muted-foreground max-w-[120px] truncate" title={f.createdByName || ""}>
                              {f.createdByName || "—"}
                            </td>
                          ) : null}
                          {isManagement ? (
                            <td className="p-2">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditFine(f)} data-testid={`button-edit-fine-${f.id}`}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFine(f.id)} data-testid={`button-delete-fine-${f.id}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        <Dialog open={fineDialogOpen} onOpenChange={setFineDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingFineId ? "Edit fine" : "Add fine"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Staff</Label>
                <Select value={fineForm.staffId} onValueChange={(v) => setFineForm((f) => ({ ...f, staffId: v }))}>
                  <SelectTrigger data-testid="select-fine-staff">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {fineStaffOptions.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={fineForm.fineDate} onChange={(e) => setFineForm((f) => ({ ...f, fineDate: e.target.value }))} data-testid="input-fine-date" />
              </div>
              <div className="space-y-1">
                <Label>Amount (LKR)</Label>
                <Input type="number" min="1" value={fineForm.amount} onChange={(e) => setFineForm((f) => ({ ...f, amount: e.target.value }))} data-testid="input-fine-amount" />
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Textarea value={fineForm.reason} onChange={(e) => setFineForm((f) => ({ ...f, reason: e.target.value }))} rows={3} data-testid="input-fine-reason" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFineDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveFine()} disabled={createStaffFine.isPending || updateStaffFine.isPending} data-testid="button-save-fine">
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-3" data-testid="list-physio-summaries">
        {summaries.length === 0 ? (
          <Card className="bg-white border border-border/60 shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-summaries">
                No physiotherapist data found for the selected date range.
              </p>
            </CardContent>
          </Card>
        ) : (
          summaries.map((s: any) => (
            <Card key={s.id} className="bg-white border border-border/60 shadow-sm" data-testid={`card-physio-${s.id}`}>
              <CardContent className="p-4 space-y-4">
                {s.error ? (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3" data-testid={`error-physio-${s.id}`}>
                    {s.error}
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-foreground" data-testid={`text-physio-name-${s.id}`}>
                      {s.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <div className="px-3 py-1 rounded-full bg-black text-white text-xs font-semibold" data-testid={`badge-ot-${s.id}`}>
                        OT: {s.totalOt.toFixed(1)} hrs
                      </div>
                      <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200" data-testid={`badge-ip-${s.id}`}>
                        In-patient sessions: {s.inPatientSessionsCount}
                      </div>
                      <div className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                        Incentive count: {s.incentiveCount}
                      </div>
                      <div className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-semibold border border-amber-200" data-testid={`badge-fines-${s.id}`}>
                        Fines: {s.finesTotal.toLocaleString()} LKR
                      </div>
                      <div className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                        Extra holidays: {s.extraHolidays}
                      </div>
                      {incEnabled && (
                        <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200" data-testid={`badge-incentive-${s.id}`}>
                          Incentive: {s.incentiveTotal.toLocaleString()} LKR
                        </div>
                      )}
                      <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                        Final salary: {Math.round(s.finalSalary).toLocaleString()} LKR
                      </div>
                    </div>
                  </div>
                  <StructuredReportActions
                    reportTitle={`${s.name} Staff Report`}
                    fileBaseName={`staff-report-${s.name}-${rangeFrom}-to-${rangeTo}`}
                    logoUri={logoUri}
                    themeColor="#2563EB"
                    meta={[
                      { label: "Staff", value: s.name },
                      { label: "From", value: rangeFrom },
                      { label: "To", value: rangeTo },
                      { label: "Generated", value: generatedAt },
                    ]}
                    columns={[
                      { key: "staffName", label: "Staff" },
                      { key: "presentDays", label: "Present Days" },
                      { key: "absentDays", label: "Absent Days" },
                      { key: "totalOt", label: "OT Hours" },
                      { key: "colomboClinic", label: "Colombo Clinic Visits" },
                      { key: "colomboHome", label: "Colombo Home Visits" },
                      { key: "bandaragamaClinic", label: "Bandaragama Clinic Visits" },
                      { key: "bandaragamaHome", label: "Bandaragama Home Visits" },
                      { key: "inPatientSessions", label: "In-patient Sessions" },
                      { key: "incentiveCount", label: "Incentive Count" },
                      { key: "incentiveAmount", label: "Incentive Amount (LKR)" },
                      { key: "holidayHomeVisits", label: "Holiday Home Visits" },
                      { key: "holidayHomeIncome", label: "Holiday Home Income (LKR)" },
                      { key: "finesTotal", label: "Fines (LKR)" },
                      { key: "extraHolidays", label: "Extra Holidays" },
                      { key: "extraHolidayDeduction", label: "Extra Holiday Deduction (LKR)" },
                      { key: "basicSalary", label: "Basic Salary (LKR)" },
                      { key: "otherAdjustments", label: "Other Expenses / Adjustments (LKR)" },
                      { key: "homeIncome", label: "Home Visit Income (LKR)" },
                      { key: "otIncome", label: "OT Income (LKR)" },
                      { key: "finalSalary", label: "Final Salary (LKR)" },
                    ]}
                    rows={[
                      {
                        staffName: s.name,
                        presentDays: s.presentDays,
                        absentDays: s.absentDays,
                        totalOt: s.totalOt.toFixed(1),
                        colomboClinic: s.colomboClinic,
                        colomboHome: s.colomboHome,
                        bandaragamaClinic: s.bandaragamaClinic,
                        bandaragamaHome: s.bandaragamaHome,
                        inPatientSessions: s.inPatientSessionsCount,
                        incentiveCount: s.incentiveCount,
                        incentiveAmount: s.incentiveTotal,
                        holidayHomeVisits: s.holidayHomeVisits,
                        holidayHomeIncome: s.holidayHomeIncome ?? 0,
                        finesTotal: s.finesTotal,
                        extraHolidays: s.extraHolidays,
                        extraHolidayDeduction: s.extraHolidayDeduction,
                        basicSalary: s.basicSalary,
                        otherAdjustments: s.otherAdjustments,
                        homeIncome: s.homeIncome,
                        otIncome: s.otIncome,
                        finalSalary: Math.round(s.finalSalary),
                      },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3" data-testid={`grid-attendance-${s.id}`}>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-[11px] text-emerald-600 font-medium">Present Days</div>
                    <div className="mt-0.5 text-xl font-bold text-emerald-700" data-testid={`text-present-days-${s.id}`}>{s.presentDays}</div>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="text-[11px] text-red-600 font-medium">Absent Days</div>
                    <div className="mt-0.5 text-xl font-bold text-red-700" data-testid={`text-absent-days-${s.id}`}>{s.absentDays}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="text-[11px] text-blue-600 font-medium">Total OT Hours</div>
                  <div className="mt-0.5 text-xl font-bold text-blue-700" data-testid={`text-total-ot-${s.id}`}>{s.totalOt.toFixed(1)}</div>
                </div>

                <div className="space-y-2" data-testid={`grid-visits-${s.id}`}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Visits by branch
                  </div>
                  {(s.visitsByBranch ?? []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-white p-3 text-sm text-muted-foreground">
                      No visits recorded in this range.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {(s.visitsByBranch ?? []).map((b: any) => (
                        <div key={b.branch} className="rounded-xl border border-border/60 bg-white p-3" data-testid={`card-branch-${s.id}-${b.branch}`}>
                          <div className="text-xs font-semibold text-foreground">{b.branch}</div>
                          <div className="mt-1 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Clinic</span>
                            <span className="font-bold tabular-nums">{b.clinic}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Home</span>
                            <span className="font-bold tabular-nums">{b.home}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-1 text-sm">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-bold tabular-nums">{b.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {incEnabled && (
                  <div className="rounded-xl border border-border/60 bg-white p-3" data-testid={`table-incentive-${s.id}`}>
                    <div className="text-sm font-semibold text-foreground" data-testid={`text-incentive-breakdown-title-${s.id}`}>
                      Incentive Breakdown (eligible days)
                    </div>

                    {s.incentiveDays.length === 0 ? (
                      <div className="mt-2 text-sm text-muted-foreground" data-testid={`text-no-incentive-${s.id}`}>
                        No eligible incentive days in this range.
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-1 gap-2 text-[11px] font-semibold text-muted-foreground sm:grid-cols-3 sm:gap-2">
                          <div className="hidden sm:block">Date</div>
                          <div className="hidden sm:block sm:text-right">Sessions (outpatient + in-patient)</div>
                          <div className="hidden sm:block sm:text-right">Incentive (LKR)</div>
                        </div>
                        {s.incentiveDays.map((d: any) => (
                          <div
                            key={d.date}
                            className="grid grid-cols-1 gap-1 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm sm:grid-cols-3 sm:gap-2"
                            data-testid={`row-incentive-${s.id}-${d.date}`}
                          >
                            <div className="flex justify-between sm:block">
                              <span className="text-muted-foreground sm:hidden">Date:</span>
                              <span className="font-medium">{d.date}</span>
                            </div>
                            <div className="flex justify-between sm:block sm:text-right">
                              <span className="text-muted-foreground sm:hidden">Sessions:</span>
                              <span data-testid={`text-incentive-count-${s.id}-${d.date}`}>{d.count}</span>
                            </div>
                            <div className="flex justify-between sm:block sm:text-right">
                              <span className="text-muted-foreground sm:hidden">Incentive (LKR):</span>
                              <span className="font-semibold" data-testid={`text-incentive-amount-${s.id}-${d.date}`}>{d.incentive.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
        </div>
      </div>
    </div>
  );
}

export default function PhysioSummaryPage() {
  return (
    <RoleProtectedRoute allowed={canViewSalaryReports}>
      <PhysioSummaryContent />
    </RoleProtectedRoute>
  );
}
