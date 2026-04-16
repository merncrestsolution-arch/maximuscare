import { useMemo, useState } from "react";
import { format, isAfter, isBefore } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { useVisits, useAttendance, useStaff, useIncentiveSettings, useUpdateIncentiveSettings } from "@/hooks/useData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { isVisitForStaff } from "@/lib/visitAccess";

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

export default function PhysioSummaryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { logoUri } = useBranding();
  const { toast } = useToast();

  const today = new Date();
  const [rangeFrom, setRangeFrom] = useState(format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd"));
  const [rangeTo, setRangeTo] = useState(format(new Date(today.getFullYear(), today.getMonth() + 1, 0), "yyyy-MM-dd"));

  const { data: staff = [], isLoading: loadingStaff, error: staffError } = useStaff();
  const { data: visits = [], isLoading: loadingVisits, error: visitsError } = useVisits();
  const { data: attendance = [], isLoading: loadingAttendance, error: attendanceError } = useAttendance();
  const { data: incentiveSettings } = useIncentiveSettings();
  const updateIncentiveSettings = useUpdateIncentiveSettings();

  const role = (user?.role || "").toLowerCase();
  const isManagement = role === "admin" || role === "md";

  const incEnabled = incentiveSettings?.incentiveEnabled === "true";
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
    const all = (staff || []).filter((s) => (s.role || "").toLowerCase() === "physiotherapist");
    if (isManagement) return all;
    return all.filter((s) => s.id === user.id);
  }, [isManagement, staff, user]);

  const summaries = useMemo(() => {
    if (!physios.length) return [];
    const safeVisits = visits || [];
    const safeAttendance = attendance || [];

    return physios.map((p) => {
      try {
        const physioVisits = safeVisits.filter(
          (v) => isVisitForStaff(v, p) && clampDate(v.visitDate, rangeFrom, rangeTo)
        );

        const colomboHome = physioVisits.filter((v) => v.branch === "Colombo" && v.visitType === "Home").length;
        const colomboClinic = physioVisits.filter((v) => v.branch === "Colombo" && v.visitType === "Clinic").length;
        const bandaragamaHome = physioVisits.filter((v) => v.branch === "Bandaragama" && v.visitType === "Home").length;
        const bandaragamaClinic = physioVisits.filter((v) => v.branch === "Bandaragama" && v.visitType === "Clinic").length;

        const rangeAttendance = safeAttendance.filter(
          (a) => a.staffId === p.id && clampDate(a.date, rangeFrom, rangeTo)
        );

        const uniqueDates = new Map<string, any>();
        for (const a of rangeAttendance) {
          const existing = uniqueDates.get(a.date);
          if (!existing || (a.id && existing.id && a.id > existing.id)) {
            uniqueDates.set(a.date, a);
          }
        }
        const deduped = Array.from(uniqueDates.values());

        const presentDays = deduped.filter((a) => a.status === "Present").length;
        const absentDays = deduped.filter((a) => a.status === "Absent").length;

        const physioAttendance = deduped.filter((a) => a.status === "Present");
        const totalOt = sum(
          physioAttendance
            .map((a) => {
              const val = Number(a.overtimeHours);
              return Number.isFinite(val) ? val : 0;
            })
        );

        const matchingVisits = incEnabled
          ? physioVisits.filter((v) => {
              if (incScope === "Colombo") return v.branch === "Colombo";
              if (incScope === "Bandaragama") return v.branch === "Bandaragama";
              return true;
            })
          : [];

        const clinicByDay: Record<string, number> = {};
        for (const v of matchingVisits) {
          clinicByDay[v.visitDate] = (clinicByDay[v.visitDate] || 0) + 1;
        }

        const incentiveDays = Object.entries(clinicByDay)
          .map(([date, count]) => ({ date, count, incentive: count >= incMinPatients ? count * incPerPatient : 0 }))
          .filter((d) => d.incentive > 0)
          .sort((a, b) => (a.date < b.date ? -1 : 1));

        const incentiveTotal = sum(incentiveDays.map((d) => d.incentive));

        return {
          id: p.id,
          name: p.name,
          totalOt,
          incentiveTotal,
          incentiveDays,
          colomboHome,
          colomboClinic,
          bandaragamaHome,
          bandaragamaClinic,
          presentDays,
          absentDays,
          error: null,
        };
      } catch {
        return {
          id: p.id,
          name: p.name,
          totalOt: 0,
          incentiveTotal: 0,
          incentiveDays: [],
          colomboHome: 0,
          colomboClinic: 0,
          bandaragamaHome: 0,
          bandaragamaClinic: 0,
          presentDays: 0,
          absentDays: 0,
          error: "Failed to calculate summary for this physiotherapist.",
        };
      }
    });
  }, [attendance, physios, rangeFrom, rangeTo, visits, incEnabled, incMinPatients, incPerPatient, incScope]);

  if (authLoading || !user || !user.role) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white" data-testid="loading-reports">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  if (loadingStaff || loadingVisits || loadingAttendance) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white" data-testid="loading-reports-data">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading reports...</p>
      </div>
    );
  }

  const hasError = staffError || visitsError || attendanceError;
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
    { key: "incentive", label: "Incentive LKR" },
  ];
  const summaryRows = summaries.map((s) => ({
    physio: s.name,
    presentDays: String(s.presentDays),
    absentDays: String(s.absentDays),
    totalOt: s.totalOt.toFixed(1),
    colomboClinic: String(s.colomboClinic),
    colomboHome: String(s.colomboHome),
    bandaragamaClinic: String(s.bandaragamaClinic),
    bandaragamaHome: String(s.bandaragamaHome),
    incentive: String(s.incentiveTotal),
  }));

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
                {visitsError && <span className="block">Visits: {visitsError.message}</span>}
                {attendanceError && <span className="block">Attendance: {attendanceError.message}</span>}
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
                ? `Incentive rule: ${incScope === "All" ? "All branches" : incScope} visits — if a physiotherapist treats ${incMinPatients}+ patients in a day, incentive = ${incPerPatient} LKR per patient for that day.`
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
          summaries.map((s) => (
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
                      {incEnabled && (
                        <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200" data-testid={`badge-incentive-${s.id}`}>
                          Incentive: {s.incentiveTotal.toLocaleString()} LKR
                        </div>
                      )}
                    </div>
                  </div>
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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4" data-testid={`grid-visits-${s.id}`}>
                  <div className="rounded-xl border border-border/60 bg-white p-3">
                    <div className="text-[11px] text-muted-foreground">Colombo Home</div>
                    <div className="mt-0.5 text-xl font-bold" data-testid={`text-colombo-home-${s.id}`}>{s.colomboHome}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-white p-3">
                    <div className="text-[11px] text-muted-foreground">Colombo Clinic</div>
                    <div className="mt-0.5 text-xl font-bold" data-testid={`text-colombo-clinic-${s.id}`}>{s.colomboClinic}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-white p-3">
                    <div className="text-[11px] text-muted-foreground">Bandaragama Home</div>
                    <div className="mt-0.5 text-xl font-bold" data-testid={`text-bandaragama-home-${s.id}`}>{s.bandaragamaHome}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-white p-3">
                    <div className="text-[11px] text-muted-foreground">Bandaragama Clinic</div>
                    <div className="mt-0.5 text-xl font-bold" data-testid={`text-bandaragama-clinic-${s.id}`}>{s.bandaragamaClinic}</div>
                  </div>
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
                          <div className="hidden sm:block sm:text-right">Clinic Patients</div>
                          <div className="hidden sm:block sm:text-right">Incentive (LKR)</div>
                        </div>
                        {s.incentiveDays.map((d) => (
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
                              <span className="text-muted-foreground sm:hidden">Clinic Patients:</span>
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
