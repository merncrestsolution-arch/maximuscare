import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClinicSettings, useUpdateClinicSettings, useIncentiveSettings, useUpdateIncentiveSettings } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ScrollText, ChevronRight } from "lucide-react";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { useAuth } from "@/context/auth-context";
import { canManageSettings, canViewAuditLogs } from "@/lib/permissions";

function SettingsContent() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: clinic, isLoading } = useClinicSettings();
  const { data: incentive } = useIncentiveSettings();
  const updateClinic = useUpdateClinicSettings();
  const updateIncentive = useUpdateIncentiveSettings();

  const [clinicForm, setClinicForm] = useState({
    autoFineAmount: "500",
    homeRateColombo: "1000",
    homeRateBandaragama: "500",
    holidayHomeRate: "1500",
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
        holidayHomeRate: String(clinic.holidayHomeRate ?? "1500"),
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
        holidayHomeRate: clinicForm.holidayHomeRate,
        otRatePerHour: clinicForm.otRatePerHour,
        extraHolidayDeduction: clinicForm.extraHolidayDeduction,
        freeAbsentDays: Number(clinicForm.freeAbsentDays),
      });
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
            ["holidayHomeRate", "Holiday home visit rate"],
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
          <Button onClick={saveClinic} disabled={updateClinic.isPending}>
            Save clinic rates
          </Button>
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
          <Button onClick={saveIncentive} disabled={updateIncentive.isPending}>
            Save incentive rules
          </Button>
        </CardContent>
      </Card>
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
