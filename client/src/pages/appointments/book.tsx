import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { usePatients, useCreateAppointment, useCreatePatient, useTreatingStaff } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Search, UserPlus, Check } from "lucide-react";
import { TreatingStaffCombobox } from "@/components/staff/treating-staff-combobox";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { useBranch } from "@/context/branch-context";
import { useBranchOptions } from "@/hooks/use-branch-options";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type PatientPick =
  | { kind: "existing"; id: string; name: string }
  | { kind: "new"; name: string }
  | null;

export default function BookAppointment() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { selectedBranchName } = useBranch();
  const { defaultValue: defaultBranch } = useBranchOptions();
  const { toast } = useToast();
  // Show patients from every branch the user can access (not just the selected
  // branch) so an appointment can be booked for any registered patient.
  const { data: patients = [], isLoading: loadingPatients } = usePatients({ branch: "all" });
  const createAppointment = useCreateAppointment();
  const createPatient = useCreatePatient();

  const { data: allStaff = [], isLoading: loadingStaff } = useTreatingStaff();

  const searchParams = new URLSearchParams(window.location.search);
  const dateParam = searchParams.get("date");

  const [patientSearch, setPatientSearch] = useState("");
  const [patientPick, setPatientPick] = useState<PatientPick>(null);

  const [formData, setFormData] = useState({
    appointmentDate: dateParam || format(new Date(), "yyyy-MM-dd"),
    appointmentTime: "",
    treatingStaffId: "",
    notes: "",
  });

  const sortedPatients = useMemo(
    () =>
      [...(patients as any[])].sort((a, b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""))
      ),
    [patients]
  );

  const filteredPatients = useMemo(() => {
    const raw = patientSearch.trim().toLowerCase();
    // Empty search → show the full registered patient list (the container scrolls).
    if (!raw) return sortedPatients;
    // Tokenized matching: every whitespace-separated term must match somewhere in
    // the haystack. Lets "joh sil" match "John Silva", and supports Patient ID,
    // registration number (patientCode), first/last/full name, and mobile number.
    const terms = raw.split(/\s+/).filter(Boolean);
    return sortedPatients.filter((p) => {
      const haystack = [
        p.name,
        p.fullName,
        p.phone,
        p.mobile,
        p.patientCode,
        p.registrationNumber,
        p.regNo,
        p.nicOrPassport,
        p.nic,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [sortedPatients, patientSearch]);

  const exactMatch = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return undefined;
    return (patients as any[]).find(
      (p) =>
        String(p.name ?? "").toLowerCase() === q ||
        String(p.fullName ?? "").toLowerCase() === q ||
        String(p.patientCode ?? "").toLowerCase() === q
    );
  }, [patients, patientSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientPick) {
      toast({ title: "Error", description: "Select a patient or create a quick entry", variant: "destructive" });
      return;
    }
    if (!formData.treatingStaffId) {
      toast({ title: "Error", description: "Please select treating staff", variant: "destructive" });
      return;
    }
    if (!formData.appointmentTime) {
      toast({ title: "Error", description: "Please select a time", variant: "destructive" });
      return;
    }

    const selectedStaff = (allStaff as any[]).find((s: any) => s.id === formData.treatingStaffId);

    try {
      let patientId: string;
      let patientName: string;

      if (patientPick.kind === "new") {
        const branch = selectedBranchName || user?.branch || defaultBranch || "Dehiwala";
        const created = await createPatient.mutateAsync({
          name: patientPick.name.trim(),
          phone: "0000000000",
          age: null,
          gender: "Male" as const,
          address: "Pending — update in Patients",
          registeredDate: format(new Date(), "yyyy-MM-dd"),
          branch,
          status: "Active" as const,
          defaultVisitType: "Clinic" as const,
        });
        patientId = created.id;
        patientName = created.name;
      } else {
        patientId = patientPick.id;
        patientName = patientPick.name;
      }

      await createAppointment.mutateAsync({
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        patientId,
        patientName,
        treatingStaffId: formData.treatingStaffId,
        treatingStaffName: selectedStaff?.name || "",
        branch: selectedBranchName || defaultBranch || "Dehiwala",
        notes: formData.notes.trim() || null,
        createdByStaffId: user?.id || "",
      });

      toast({ title: "Appointment booked", description: "The appointment has been successfully created." });
      setLocation("/appointments");
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to book appointment", variant: "destructive" });
    }
  };

  if (loadingPatients || loadingStaff) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-book" />
      </div>
    );
  }

  const showQuickCreate = patientSearch.trim().length >= 2 && !exactMatch;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[720px] p-4 pb-20 md:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/appointments")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Book Appointment</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.appointmentDate}
              onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
              className="h-12"
              data-testid="input-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={formData.appointmentTime}
              onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
              className="h-12"
              data-testid="input-time"
            />
          </div>

          <div className="space-y-3">
            <Label>Patient</Label>
            <div className="rounded-xl border-2 border-border bg-muted/20 p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, ID, or NIC…"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="h-12 pl-9 bg-white"
                  data-testid="input-patient-search"
                />
              </div>

              {patientPick && (
                <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    Selected: {patientPick.kind === "new" ? `New patient — ${patientPick.name}` : patientPick.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-8 text-xs"
                    onClick={() => setPatientPick(null)}
                  >
                    Clear
                  </Button>
                </div>
              )}

              <ScrollArea className="h-[220px] rounded-lg border bg-white">
                <div className="p-1 space-y-1">
                  {filteredPatients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8 px-3">
                      {patientSearch.trim()
                        ? "No matching patients found. Type at least 2 characters to quick-create a new patient."
                        : "No patients registered yet."}
                    </p>
                  ) : (
                    filteredPatients.map((patient: any) => {
                      const selected =
                        patientPick?.kind === "existing" && patientPick.id === patient.id;
                      return (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => {
                            setPatientPick({ kind: "existing", id: patient.id, name: patient.name });
                            setPatientSearch(patient.name);
                          }}
                          className={cn(
                            "w-full text-left rounded-lg px-3 py-3 transition-colors border",
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-transparent hover:bg-muted/60"
                          )}
                          data-testid={`option-patient-${patient.id}`}
                        >
                          <div className="font-semibold text-foreground">{patient.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {[patient.phone, patient.branch, patient.patientCode].filter(Boolean).join(" · ")}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {showQuickCreate ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 justify-start gap-2 border-dashed"
                  onClick={() => setPatientPick({ kind: "new", name: patientSearch.trim() })}
                  data-testid="option-patient-quick-create"
                >
                  <UserPlus className="h-4 w-4" />
                  Quick create patient: {patientSearch.trim()}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Treatment By</Label>
            <TreatingStaffCombobox
              staff={allStaff as any[]}
              value={formData.treatingStaffId}
              onChange={(value) => setFormData({ ...formData, treatingStaffId: value })}
              placeholder="Select treating staff"
              className="h-12"
              data-testid="select-staff"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              data-testid="input-notes"
            />
          </div>
        </form>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-white p-4 md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:pt-6">
          <div className="mx-auto flex max-w-[720px] gap-3 md:justify-end">
            <Button
              variant="outline"
              className="h-12 flex-1 md:h-10 md:flex-none md:min-w-[7rem] md:text-sm"
              onClick={() => setLocation("/appointments")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              className="h-12 flex-1 md:h-10 md:flex-none md:min-w-[8rem] md:text-sm"
              onClick={handleSubmit}
              disabled={createAppointment.isPending}
              data-testid="button-submit"
            >
              {createAppointment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Book Appointment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
