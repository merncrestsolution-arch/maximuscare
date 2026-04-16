import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { usePatients, useCreateAppointment } from "@/hooks/useData";
import { staffApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

export default function BookAppointment() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: patients = [], isLoading: loadingPatients } = usePatients();
  const createAppointment = useCreateAppointment();

  const { data: allStaff = [], isLoading: loadingStaff } = useQuery({
    queryKey: ["staff-for-appointments"],
    queryFn: staffApi.getAll,
  });

  const treatingStaff = allStaff.filter(
    (s: any) => s.role === "Physiotherapist" || s.role === "MD"
  );

  const searchParams = new URLSearchParams(window.location.search);
  const dateParam = searchParams.get("date");

  const [formData, setFormData] = useState({
    appointmentDate: dateParam || format(new Date(), "yyyy-MM-dd"),
    appointmentTime: "",
    patientId: "",
    treatingStaffId: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientId) {
      toast({ title: "Error", description: "Please select a patient", variant: "destructive" });
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

    const selectedPatient = patients.find((p: any) => p.id === formData.patientId);
    const selectedStaff = treatingStaff.find((s: any) => s.id === formData.treatingStaffId);

    try {
      await createAppointment.mutateAsync({
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        patientId: formData.patientId,
        patientName: selectedPatient?.name || "",
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
            <Select
              value={formData.patientId}
              onValueChange={(value) => setFormData({ ...formData, patientId: value })}
            >
              <SelectTrigger className="h-12" data-testid="select-patient">
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient: any) => (
                  <SelectItem key={patient.id} value={patient.id} data-testid={`option-patient-${patient.id}`}>
                    {patient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
