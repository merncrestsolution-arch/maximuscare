import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { usePatients, useCreateAppointment, useCreatePatient } from "@/hooks/useData";
import { staffApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ArrowLeft, Loader2, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

type PatientPick =
  | { kind: "existing"; id: string; name: string }
  | { kind: "new"; name: string }
  | null;

export default function BookAppointment() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: patients = [], isLoading: loadingPatients } = usePatients();
  const createAppointment = useCreateAppointment();
  const createPatient = useCreatePatient();

  const { data: allStaff = [], isLoading: loadingStaff } = useQuery({
    queryKey: ["staff-for-appointments"],
    queryFn: staffApi.getAll,
  });

  const treatingStaff = allStaff.filter(
    (s: any) => s.role === "Physiotherapist" || s.role === "MD"
  );

  const searchParams = new URLSearchParams(window.location.search);
  const dateParam = searchParams.get("date");

  const [patientOpen, setPatientOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientPick, setPatientPick] = useState<PatientPick>(null);

  const [formData, setFormData] = useState({
    appointmentDate: dateParam || format(new Date(), "yyyy-MM-dd"),
    appointmentTime: "",
    treatingStaffId: "",
    notes: "",
  });

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients as any[];
    return (patients as any[]).filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, patientSearch]);

  const exactMatch = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return undefined;
    return (patients as any[]).find((p) => p.name.toLowerCase() === q);
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

    const selectedStaff = treatingStaff.find((s: any) => s.id === formData.treatingStaffId);

    try {
      let patientId: string;
      let patientName: string;

      if (patientPick.kind === "new") {
        const branch =
          user?.branch === "Colombo" || user?.branch === "Bandaragama"
            ? user.branch
            : "Colombo";
        const created = await createPatient.mutateAsync({
          name: patientPick.name.trim(),
          phone: "0000000000",
          age: 25,
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

  const showQuickCreate =
    patientSearch.trim().length >= 2 && !exactMatch;

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

          <div className="space-y-2">
            <Label>Patient</Label>
            <p className="text-xs text-muted-foreground">
              Search existing patients or type a new name — if not found, use quick create.
            </p>
            <Popover open={patientOpen} onOpenChange={setPatientOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={patientOpen}
                  className="h-12 w-full justify-between font-normal"
                  data-testid="button-patient-combobox"
                >
                  <span className={cn("truncate", !patientPick && "text-muted-foreground")}>
                    {patientPick
                      ? patientPick.kind === "new"
                        ? `New: ${patientPick.name}`
                        : patientPick.name
                      : "Select or type patient name…"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search name…"
                    value={patientSearch}
                    onValueChange={setPatientSearch}
                    data-testid="input-patient-search"
                  />
                  <CommandList>
                    <CommandEmpty className="py-2 text-sm text-muted-foreground px-2">
                      No matching patient.
                    </CommandEmpty>
                    <CommandGroup heading="Existing patients">
                      {filteredPatients.map((patient: any) => (
                        <CommandItem
                          key={patient.id}
                          value={patient.name}
                          onSelect={() => {
                            setPatientPick({ kind: "existing", id: patient.id, name: patient.name });
                            setPatientSearch(patient.name);
                            setPatientOpen(false);
                          }}
                          data-testid={`option-patient-${patient.id}`}
                        >
                          {patient.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {showQuickCreate ? (
                      <CommandGroup heading="Quick entry">
                        <CommandItem
                          value={`__new__${patientSearch}`}
                          onSelect={() => {
                            setPatientPick({ kind: "new", name: patientSearch.trim() });
                            setPatientOpen(false);
                          }}
                          data-testid="option-patient-quick-create"
                        >
                          Create quick patient: {patientSearch.trim()}
                        </CommandItem>
                      </CommandGroup>
                    ) : null}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Treatment By</Label>
            <Select
              value={formData.treatingStaffId}
              onValueChange={(value) => setFormData({ ...formData, treatingStaffId: value })}
            >
              <SelectTrigger className="h-12" data-testid="select-staff">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {treatingStaff.map((staff: any) => (
                  <SelectItem key={staff.id} value={staff.id} data-testid={`option-staff-${staff.id}`}>
                    {staff.name} ({staff.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
