import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAppointment, useUpdateAppointment, usePatients, useStaff } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { EDIT_PAGE_ROOT } from "@/lib/editPageShell";
import { useAuth } from "@/context/auth-context";
import { isManagementRole } from "@/lib/permissions";

export default function EditAppointment() {
  const [, params] = useRoute("/appointments/edit/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  const appointmentId = params?.id || "";
  const { data: appointment, isLoading: loadingAppointment } = useAppointment(appointmentId);
  const { data: patients = [], isLoading: loadingPatients } = usePatients();
  const updateAppointment = useUpdateAppointment();

  const { data: allStaff = [], isLoading: loadingStaff } = useStaff();

  const treatingStaff = allStaff.filter(
    (s: any) => s.role === "Physiotherapist" || s.role === "MD"
  );

  const [formData, setFormData] = useState<{
    appointmentDate: string;
    appointmentTime: string;
    patientId: string;
    treatingStaffId: string;
    status: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    if (appointment && !formData) {
      setFormData({
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        patientId: appointment.patientId,
        treatingStaffId: appointment.treatingStaffId,
        status: appointment.status || "Scheduled",
        notes: appointment.notes || "",
      });
    }
  }, [appointment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

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
      await updateAppointment.mutateAsync({
        id: appointmentId,
        data: {
          appointmentDate: formData.appointmentDate,
          appointmentTime: formData.appointmentTime,
          patientId: formData.patientId,
          patientName: selectedPatient?.name || appointment?.patientName || "",
          treatingStaffId: formData.treatingStaffId,
          treatingStaffName: selectedStaff?.name || appointment?.treatingStaffName || "",
          status: formData.status,
          notes: formData.notes.trim() || null,
        },
      });

      toast({ title: "Appointment updated", description: "Changes saved successfully." });
      setLocation("/appointments");
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update appointment", variant: "destructive" });
    }
  };

  if (authLoading || loadingAppointment || loadingPatients || loadingStaff) {
    return (
      <div className={`${EDIT_PAGE_ROOT} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-black/40" data-testid="loader-edit" />
      </div>
    );
  }

  if (user && !isManagementRole(user.role)) {
    return (
      <div className={`${EDIT_PAGE_ROOT} p-6 text-center space-y-4`}>
        <p className="text-black/80 font-medium">Only Admin or MD can edit appointments.</p>
        <Button onClick={() => setLocation("/appointments")} data-testid="button-back-from-denied">
          Back to Appointments
        </Button>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className={`${EDIT_PAGE_ROOT} p-4`}>
        <p className="text-center text-black/70" data-testid="text-not-found">Appointment not found</p>
        <Button className="mt-4 mx-auto block" onClick={() => setLocation("/appointments")} data-testid="button-back-list">
          Back to Appointments
        </Button>
      </div>
    );
  }

  if (!formData) return null;

  return (
    <div className={`${EDIT_PAGE_ROOT} pb-24 md:pb-8`}>
      <div className="mx-auto max-w-[720px] p-4 pb-20 md:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/appointments")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-black" />
          </Button>
          <h1 className="text-xl font-bold text-black" data-testid="text-page-title">Edit Appointment</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="date" className="text-black font-medium">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.appointmentDate}
              onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
              className="h-12 bg-white border-gray-300 text-black"
              data-testid="input-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time" className="text-black font-medium">Time</Label>
            <Input
              id="time"
              type="time"
              value={formData.appointmentTime}
              onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
              className="h-12 bg-white border-gray-300 text-black"
              data-testid="input-time"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-black font-medium">Patient</Label>
            <Select
              value={formData.patientId}
              onValueChange={(value) => setFormData({ ...formData, patientId: value })}
            >
              <SelectTrigger className="h-12 bg-white border-gray-300 text-black" data-testid="select-patient">
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
            <Label className="text-black font-medium">Treatment By</Label>
            <Select
              value={formData.treatingStaffId}
              onValueChange={(value) => setFormData({ ...formData, treatingStaffId: value })}
            >
              <SelectTrigger className="h-12 bg-white border-gray-300 text-black" data-testid="select-staff">
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
            <Label className="text-black font-medium">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
            >
              <SelectTrigger className="h-12 bg-white border-gray-300 text-black" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Scheduled", "Completed", "Cancelled", "No Show"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-black font-medium">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="bg-white border-gray-300 text-black"
              data-testid="input-notes"
            />
          </div>
        </form>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white p-4 md:static md:z-auto md:border-0 md:bg-white md:p-0 md:pt-6">
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
              disabled={updateAppointment.isPending}
              data-testid="button-submit"
            >
              {updateAppointment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
