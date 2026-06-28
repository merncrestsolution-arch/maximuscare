import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useInPatient, useNextSessionNumber, useCreateInPatientSession, useTreatingStaff } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getClinicalStaff } from "@/components/staff/treating-staff-combobox";

interface FormData {
  sessionDate: string;
  treatingStaffId: string;
  treatingStaffName: string;
  startTime: string;
  endTime: string;
  treatmentProvided: string;
  improvements: string;
}

export default function AddInPatientSessionPage() {
  const [, params] = useRoute("/inpatients/:id/session/new");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const admissionId = params?.id || "";

  const { data: patient, isLoading: patientLoading } = useInPatient(admissionId);
  const { data: allStaff } = useTreatingStaff();
  const createSession = useCreateInPatientSession();

  const [formData, setFormData] = useState<FormData>({
    sessionDate: format(new Date(), "yyyy-MM-dd"),
    treatingStaffId: user?.id || "",
    treatingStaffName: user?.name || "",
    startTime: "",
    endTime: "",
    treatmentProvided: "",
    improvements: "",
  });

  const { data: nextSessionData } = useNextSessionNumber(admissionId, formData.sessionDate);
  const [errors, setErrors] = useState<{ treatmentProvided?: string }>({});

  // Use the same clinical-staff resolver as the outpatient flow so physiotherapists
  // (which in this clinic are often stored under the "Staff" role) are listed, with a
  // safe fallback that never leaves the picker empty.
  const treatingStaffList = getClinicalStaff((allStaff as any[]) || []);

  useEffect(() => {
    if (user && !formData.treatingStaffId) {
      setFormData(prev => ({
        ...prev,
        treatingStaffId: user.id,
        treatingStaffName: user.name,
      }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.treatingStaffId) {
      toast({ title: "Error", description: "Please select treating physiotherapist", variant: "destructive" });
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      toast({ title: "Error", description: "Start and end time are required", variant: "destructive" });
      return;
    }
    if (!formData.treatmentProvided.trim()) {
      setErrors((prev) => ({ ...prev, treatmentProvided: "Treatment provided is required" }));
      toast({ title: "Error", description: "Treatment provided is required", variant: "destructive" });
      return;
    }

    try {
      await createSession.mutateAsync({
        admissionId,
        data: {
          sessionDate: formData.sessionDate,
          treatingStaffId: formData.treatingStaffId,
          treatingStaffName: formData.treatingStaffName,
          startTime: formData.startTime,
          endTime: formData.endTime,
          treatmentProvided: formData.treatmentProvided,
          improvements: formData.improvements || undefined,
        },
      });
      toast({ title: "Success", description: "Session recorded successfully" });
      setLocation(`/inpatients/${admissionId}`);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to add session",
        variant: "destructive"
      });
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStaffChange = (staffId: string) => {
    const staff = allStaff?.find((s: any) => s.id === staffId);
    if (staff) {
      setFormData(prev => ({
        ...prev,
        treatingStaffId: staff.id,
        treatingStaffName: staff.name,
      }));
    }
  };

  if (patientLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="text-red-600" data-testid="error-message">Patient not found</div>
        <Button className="mt-4" onClick={() => setLocation("/inpatients")}>Back</Button>
      </div>
    );
  }

  if (patient.status === "Discharged") {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-[720px] mx-auto">
          <div className="text-red-600 mb-4" data-testid="error-message">
            Cannot add session. Patient has been discharged.
          </div>
          <Button onClick={() => setLocation(`/inpatients/${admissionId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-[720px] mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation(`/inpatients/${admissionId}`)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="page-title">Add Session</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-patient-name">{patient.patientName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionDate">Session Date *</Label>
              <Input
                id="sessionDate"
                type="date"
                value={formData.sessionDate}
                onChange={(e) => updateField("sessionDate", e.target.value)}
                className="h-12"
                data-testid="input-session-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Session Number</Label>
              <div className="h-12 flex items-center px-3 bg-gray-100 rounded-md font-medium" data-testid="text-session-number">
                #{nextSessionData?.nextSessionNumber || 1}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatingStaff">Treating Physiotherapist *</Label>
            <Select 
              value={formData.treatingStaffId} 
              onValueChange={handleStaffChange}
            >
              <SelectTrigger className="h-12" data-testid="select-treating-staff">
                <SelectValue placeholder="Select physiotherapist" />
              </SelectTrigger>
              <SelectContent>
                {treatingStaffList.map((staff: any) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name} ({staff.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => updateField("startTime", e.target.value)}
                className="h-12"
                data-testid="input-start-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => updateField("endTime", e.target.value)}
                className="h-12"
                data-testid="input-end-time"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatmentProvided">Treatment Provided *</Label>
            <Textarea
              id="treatmentProvided"
              value={formData.treatmentProvided}
              onChange={(e) => {
                updateField("treatmentProvided", e.target.value);
                if (errors.treatmentProvided) setErrors((prev) => ({ ...prev, treatmentProvided: undefined }));
              }}
              placeholder="Describe the treatment provided..."
              rows={3}
              style={{ borderColor: errors.treatmentProvided ? "red" : undefined }}
              aria-invalid={!!errors.treatmentProvided}
              data-testid="input-treatment"
            />
            {errors.treatmentProvided && (
              <p style={{ color: "red", fontSize: "0.75rem", marginTop: "4px" }}>{errors.treatmentProvided}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="improvements">Improvements (Optional)</Label>
            <Textarea
              id="improvements"
              value={formData.improvements}
              onChange={(e) => updateField("improvements", e.target.value)}
              placeholder="Note any improvements observed..."
              rows={2}
              data-testid="input-improvements"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setLocation(`/inpatients/${admissionId}`)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12"
              disabled={createSession.isPending}
              data-testid="button-save"
            >
              {createSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Session
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
