import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClinicSettings, useUpdateClinicSettings, useIncentiveSettings, useUpdateIncentiveSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ScrollText, ChevronRight, Database } from "lucide-react";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { useAuth } from "@/context/auth-context";
import { canManageSettings, canViewAuditLogs } from "@/lib/permissions";
import { SaveStatus } from "@/components/ui/save-status";
import { useSavedIndicator } from "@/hooks/useSavedIndicator";
import { AppAboutCard } from "@/components/app-about-card";

function SettingsContent() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { data: clinic, isLoading } = useClinicSettings();
  const { data: incentive } = useIncentiveSettings();
  const updateClinic = useUpdateClinicSettings();
  const updateIncentive = useUpdateIncentiveSettings();
  const clinicSaved = useSavedIndicator(updateClinic.isSuccess);
  const incentiveSaved = useSavedIndicator(updateIncentive.isSuccess);

  const [clinicForm, setClinicForm] = useState({
    autoFineAmount: "500",
    homeRateColombo: "1000",
    homeRateBandaragama: "500",
    otRatePerHour: "250",
    extraHolidayDeduction: "1500",
    freeAbsentDays: "4",
  });
  const [incForm, setIncForm] = useState({
    incentiveEnabled: "true",
    minPatientsForIncentive: "5",
    incentivePerPatient: "100",
    clinicLocationScope: "Colombo",
  });

  useEffect(() => {
    if (clinic) {
      setClinicForm({
        autoFineAmount: String(clinic.autoFineAmount ?? "500"),
        homeRateColombo: String(clinic.homeRateColombo ?? "1000"),
        homeRateBandaragama: String(clinic.homeRateBandaragama ?? "500"),
        otRatePerHour: String(clinic.otRatePerHour ?? "250"),
        extraHolidayDeduction: String(clinic.extraHolidayDeduction ?? "1500"),
        freeAbsentDays: String(clinic.freeAbsentDays ?? "4"),
      });
    }
  }, [clinic]);

  useEffect(() => {
    if (incentive) {
      setIncForm({
        incentiveEnabled: String(incentive.incentiveEnabled ?? "true"),
        minPatientsForIncentive: String(incentive.minPatientsForIncentive ?? "5"),
        incentivePerPatient: String(incentive.incentivePerPatient ?? "100"),
        clinicLocationScope: incentive.clinicLocationScope ?? "Colombo",
      });
    }
  }, [incentive]);

  const saveClinic = async () => {
    try {
      await updateClinic.mutateAsync({
        autoFineAmount: clinicForm.autoFineAmount,
        homeRateColombo: clinicForm.homeRateColombo,
        homeRateBandaragama: clinicForm.homeRateBandaragama,
        otRatePerHour: clinicForm.otRatePerHour,
        extraHolidayDeduction: clinicForm.extraHolidayDeduction,
        freeAbsentDays: Number(clinicForm.freeAbsentDays),
      });
      await refreshUser();
      toast({ title: "Clinic settings saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const saveIncentive = async () => {
    try {
      await updateIncentive.mutateAsync({
        incentiveEnabled: incForm.incentiveEnabled,
        minPatientsForIncentive: Number(incForm.minPatientsForIncentive),
        incentivePerPatient: Number(incForm.incentivePerPatient),
        clinicLocationScope: incForm.clinicLocationScope,
      });
      toast({ title: "Incentive settings saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Settings</h1>

      {canViewAuditLogs(user?.role) && (
        <Card>
          <CardHeader>
            <CardTitle>Audit &amp; Monitoring</CardTitle>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => setLocation("/audit")}
              className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background px-4 py-3 text-left transition-colors hover:bg-muted"
            >
              <ScrollText className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Activity Log</div>
                <div className="text-sm text-muted-foreground">
                  System-wide audit trail — logins, edits, deletions and payments
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setLocation("/settings/data-health")}
              className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background px-4 py-3 text-left transition-colors hover:bg-muted mt-3"
            >
              <Database className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Patient Data Health</div>
                <div className="text-sm text-muted-foreground">
                  ID/QR migration status and batch upgrade for old patient records
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payroll &amp; Fine Rates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {[
            ["autoFineAmount", "Auto-fine amount (LKR)"],
            ["homeRateColombo", "Main branch home visit rate (Dehiwala/Neuro/Nexus)"],
            ["homeRateBandaragama", "Bandaragama home visit rate"],
            ["otRatePerHour", "OT rate per hour"],
            ["extraHolidayDeduction", "Extra holiday deduction"],
            ["freeAbsentDays", "Free absent days before deduction"],
          ].map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Input
                value={(clinicForm as any)[key]}
                onChange={(e) => setClinicForm({ ...clinicForm, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <SaveStatus isSaving={updateClinic.isPending} saved={clinicSaved} />
            <Button onClick={saveClinic} disabled={updateClinic.isPending}>
              {updateClinic.isPending ? "Saving..." : "Save clinic rates"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incentive Rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-1">
            <Label>Enabled (true/false)</Label>
            <Input
              value={incForm.incentiveEnabled}
              onChange={(e) => setIncForm({ ...incForm, incentiveEnabled: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Min patients per day</Label>
            <Input
              value={incForm.minPatientsForIncentive}
              onChange={(e) => setIncForm({ ...incForm, minPatientsForIncentive: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>LKR per patient</Label>
            <Input
              value={incForm.incentivePerPatient}
              onChange={(e) => setIncForm({ ...incForm, incentivePerPatient: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Incentive branch scope (Dehiwala / Bandaragama / All)</Label>
            <Input
              value={incForm.clinicLocationScope}
              onChange={(e) => setIncForm({ ...incForm, clinicLocationScope: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <SaveStatus isSaving={updateIncentive.isPending} saved={incentiveSaved} />
            <Button onClick={saveIncentive} disabled={updateIncentive.isPending}>
              {updateIncentive.isPending ? "Saving..." : "Save incentive rules"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AppAboutCard />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RoleProtectedRoute allowed={canManageSettings}>
      <SettingsContent />
    </RoleProtectedRoute>
  );
}
