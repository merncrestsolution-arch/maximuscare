import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { usePatient, useCreatePatient, useUpdatePatient } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, BedDouble } from "lucide-react";
import { Link } from "wouter";
import type { Patient } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { EDIT_PAGE_ROOT } from "@/lib/editPageShell";
import { BranchSelectField } from "@/components/branch/branch-select-field";
import { useBranchOptions } from "@/hooks/use-branch-options";

const DEFAULT_PATIENT: Omit<Patient, "id"> = {
  name: "",
  phone: "",
  age: 0,
  gender: "Male",
  address: "",
  registeredDate: format(new Date(), "yyyy-MM-dd"),
  branch: "",
  status: "Active",
  defaultVisitType: "Clinic",
  condition: "",
};

export default function PatientEditPage() {
  const [match, params] = useRoute("/patients/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { defaultValue: defaultBranch } = useBranchOptions();

  const patientId = match ? params?.id : undefined;
  const isEdit = !!patientId && patientId !== "new";

  const { data: existingPatient, isLoading, error } = usePatient(patientId || "");
  const createPatient = useCreatePatient();
  const updatePatientMutation = useUpdatePatient();

  const [formData, setFormData] = useState<Patient | Omit<Patient, "id">>(
    isEdit && existingPatient ? { ...existingPatient } : { ...DEFAULT_PATIENT }
  );

  useEffect(() => {
    if (isEdit) {
      if (!existingPatient) return;
      setFormData({ ...existingPatient });
    } else {
      setFormData({ ...DEFAULT_PATIENT, branch: defaultBranch, registeredDate: format(new Date(), "yyyy-MM-dd") });
    }
  }, [isEdit, existingPatient]);

  if (isEdit && isLoading) {
    return (
      <div className={`${EDIT_PAGE_ROOT} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isEdit && error) {
    return (
      <div className={EDIT_PAGE_ROOT}>
        <div className="max-w-[720px] mx-auto p-4 pt-6">
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load patient: {error instanceof Error ? error.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
          <Button className="mt-4 h-12" onClick={() => setLocation("/patients")}>Back</Button>
        </div>
      </div>
    );
  }

  if (isEdit && !existingPatient) {
    return (
      <div className={EDIT_PAGE_ROOT}>
        <div className="max-w-[720px] mx-auto p-4 pt-6">
          <div className="text-base font-semibold text-black">Patient not found.</div>
          <Button className="mt-4 h-12" onClick={() => setLocation("/patients")}>Back</Button>
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    if (isEdit) setLocation(`/patients/${patientId}`);
    else setLocation("/patients");
  };

  const handleSave = async () => {
    const rawAge = (formData as any).age;
    const age =
      rawAge === "" || rawAge === 0 || rawAge === null || rawAge === undefined
        ? null
        : Number(rawAge);
    if (age !== null && (!Number.isFinite(age) || age < 1)) {
      toast({
        title: "Invalid age",
        description: "Please enter a valid age (1 or above), or leave blank.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isEdit) {
        await updatePatientMutation.mutateAsync({ 
          id: patientId!, 
          data: { ...(formData as Patient), age },
        });
        toast({
          title: "Success",
          description: "Patient updated successfully",
        });
        setLocation(`/patients/${patientId}`);
      } else {
        await createPatient.mutateAsync({ ...(formData as Omit<Patient, "id">), age });
        toast({
          title: "Success",
          description: "Patient created successfully",
        });
        setLocation("/patients");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save patient",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={`${EDIT_PAGE_ROOT} pb-28 md:pb-10`}>
      <div className="max-w-[720px] mx-auto">
        <div className="flex items-center gap-2 sticky top-0 z-20 border-b border-gray-200 bg-white py-3 safe-top">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="-ml-2 h-11 w-11"
            data-testid="button-back-patient-edit"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-black truncate" data-testid="text-title-patient-edit">
              {isEdit ? "Edit Patient" : "Add New Patient"}
            </h1>
            <p className="text-sm text-black/70" data-testid="text-subtitle-patient-edit">
              {isEdit ? "Update patient demographics and details" : "Register a new patient to the system"}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-8">
          {!isEdit && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <BedDouble className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-black">In-patient admission</p>
                <p className="text-xs text-black/70">
                  Out-patient registration is below. For a hospital admission, use the in-patient form instead.
                </p>
              </div>
              <Button asChild variant="secondary" className="shrink-0 w-full sm:w-auto" data-testid="button-goto-inpatient-new">
                <Link href="/inpatients/new">Register In-Patient</Link>
              </Button>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-base font-bold text-black" data-testid="text-section-patient-details">
              Patient Details
            </h3>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-black">Full Name</Label>
              <Input
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={(formData as any).name}
                onChange={(e) => setFormData({ ...(formData as any), name: e.target.value })}
                placeholder="e.g. John Doe"
                data-testid="input-patient-name"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Phone</Label>
                <Input
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={(formData as any).phone}
                  onChange={(e) => setFormData({ ...(formData as any), phone: e.target.value })}
                  placeholder="077..."
                  data-testid="input-patient-phone"
                  required
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Gender</Label>
                <Select
                  value={(formData as any).gender}
                  onValueChange={(v) => setFormData({ ...(formData as any), gender: v })}
                >
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-patient-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">NIC / Passport (optional)</Label>
                <Input
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={(formData as any).nicOrPassport || ""}
                  onChange={(e) => setFormData({ ...(formData as any), nicOrPassport: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Date of Birth (optional)</Label>
                <Input
                  type="date"
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={(formData as any).dateOfBirth || ""}
                  onChange={(e) => setFormData({ ...(formData as any), dateOfBirth: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Emergency Contact</Label>
                <Input
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={(formData as any).emergencyContact || ""}
                  onChange={(e) => setFormData({ ...(formData as any), emergencyContact: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Referral Source</Label>
                <Input
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={(formData as any).referralSource || ""}
                  onChange={(e) => setFormData({ ...(formData as any), referralSource: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Age <span className="font-normal text-black/60">(optional)</span></Label>
                <Input
                  type="number"
                  min={1}
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={(formData as any).age == null || (formData as any).age === 0 ? "" : String((formData as any).age)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setFormData({ ...(formData as any), age: null });
                      return;
                    }
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n)) setFormData({ ...(formData as any), age: n });
                  }}
                  data-testid="input-patient-age"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Status</Label>
                <Select
                  value={(formData as any).status}
                  onValueChange={(v) => setFormData({ ...(formData as any), status: v })}
                >
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-patient-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Active", "Inactive", "Completed", "Discharged", "Transferred"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-black">Address</Label>
              <Input
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={(formData as any).address}
                onChange={(e) => setFormData({ ...(formData as any), address: e.target.value })}
                placeholder="City or full address"
                data-testid="input-patient-address"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-black">Condition</Label>
              <Input
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={(formData as any).condition || ""}
                onChange={(e) => setFormData({ ...(formData as any), condition: e.target.value })}
                placeholder="e.g. Lower Back Pain"
                data-testid="input-patient-condition"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-black">Visit Type</Label>
              <Select
                value={(formData as any).defaultVisitType}
                onValueChange={(v) => setFormData({ ...(formData as any), defaultVisitType: v })}
              >
                <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-patient-visit-type">
                  <SelectValue placeholder="Select visit type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Clinic" data-testid="option-visit-type-clinic">Clinic Visit</SelectItem>
                  <SelectItem value="Home" data-testid="option-visit-type-home">Home Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-black">Branch</Label>
              <BranchSelectField
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={(formData as any).branch || defaultBranch}
                onChange={(v) => setFormData({ ...(formData as any), branch: v })}
                forRegistration
              />
            </div>
          </div>

          <div className="h-24" />
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white safe-area-bottom md:static md:z-auto md:mt-4 md:rounded-xl md:border md:shadow-sm">
          <div className="mx-auto flex max-w-[720px] gap-3 p-4 md:justify-end md:px-6 md:pt-6 md:pb-0">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 text-base md:h-10 md:flex-none md:min-w-[7rem] md:text-sm"
              onClick={handleCancel}
              data-testid="button-cancel-patient-edit"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 text-base font-semibold bg-primary hover:bg-primary/90 md:h-10 md:flex-none md:min-w-[9rem] md:text-sm"
              onClick={handleSave}
              disabled={createPatient.isPending || updatePatientMutation.isPending}
              data-testid="button-save-patient-edit"
            >
              {(createPatient.isPending || updatePatientMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEdit ? "Save Changes" : "Register Patient"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
