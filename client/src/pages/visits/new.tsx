import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useBranch } from "@/context/branch-context";
import { usePatients, useCreateVisit } from "@/hooks/useData";
import { useTreatingStaff } from "@/hooks/useData";
import { patientApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, UploadCloud, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BranchSelectField } from "@/components/branch/branch-select-field";
import { TreatingStaffCombobox, getClinicalStaff } from "@/components/staff/treating-staff-combobox";

export default function NewVisit() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const preselectedPatientId = searchParams.get("patientId");

  const { user } = useAuth();
  const { selectedBranchName } = useBranch();
  const { data: patients = [], isLoading: loadingPatients, error: patientsError } = usePatients();
  const { data: staff = [], isLoading: loadingStaff } = useTreatingStaff();
  const createVisit = useCreateVisit();
  const { toast } = useToast();

  const preselectedPatient = patients.find((p) => p.id === preselectedPatientId);

  const [formData, setFormData] = useState({
    patientId: preselectedPatientId || "",
    sessionNumber: "1",
    condition: preselectedPatient?.condition || "",
    treatment: "",
    visitDate: format(new Date(), "yyyy-MM-dd"),
    startTime: format(new Date(), "HH:mm"),
    endTime: format(new Date(new Date().setHours(new Date().getHours() + 1)), "HH:mm"),
    branch: selectedBranchName ?? (user?.branch === "Both" ? "" : (user?.branch || "")),
    visitType: "Clinic",
    status: "Follow-up",
    paymentAmount: "0",
    paymentStatus: "Unpaid",
    paymentMode: "Cash",
    notes: "",
    improvements: "",
    treatingStaffId: user?.id || "", // Default to self
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ treatment?: string }>({});
  // Keep the branch field aligned with the active branch context until the user
  // changes it manually (the active branch can load after this form mounts).
  const branchTouchedRef = useRef(false);
  useEffect(() => {
    if (!branchTouchedRef.current && selectedBranchName) {
      setFormData((prev) =>
        prev.branch === selectedBranchName ? prev : { ...prev, branch: selectedBranchName }
      );
    }
  }, [selectedBranchName]);
  // Fetch the authoritative next session number from the server (max+1 over ALL
  // of the patient's visits). Computing it client-side from the visit list is
  // unreliable: non-admins only receive visits they treated, and counting can
  // diverge from the stored value after deletions.
  useEffect(() => {
    const patientId = formData.patientId;
    if (!patientId) return;
    let cancelled = false;
    patientApi
      .nextSessionNumber(patientId)
      .then((res) => {
        if (!cancelled) {
          setFormData((prev) =>
            prev.patientId === patientId
              ? { ...prev, sessionNumber: String(res.nextSessionNumber) }
              : prev
          );
        }
      })
      .catch(() => {
        /* leave the existing value; server recomputes on submit */
      });
    return () => {
      cancelled = true;
    };
  }, [formData.patientId]);

  useEffect(() => {
    const patientId = formData.patientId;
    if (!patientId) return;
    let active = true;
    patientApi
      .getOne(patientId)
      .then((patient) => {
        if (!active) return;
        const condition = (patient as any)?.condition;
        if (condition) {
          setFormData((prev) => ({
            ...prev,
            condition: condition || prev.condition,
          }));
        }
      })
      .catch(() => {
        /* ignore prefill errors */
      });
    return () => {
      active = false;
    };
  }, [formData.patientId]);

  const clinicalStaff = useMemo(() => getClinicalStaff(staff as any[]), [staff]);

  useEffect(() => {
    if (!staff.length || !user) return;
    setFormData((prev) => {
      if (staff.some((s) => s.id === prev.treatingStaffId)) return prev;
      // Prefer the current user if they're a clinician, else the first clinical staff.
      const userIsClinical = clinicalStaff.some((s) => s.id === user.id);
      const fallback = userIsClinical ? user.id : clinicalStaff[0]?.id ?? staff[0].id;
      return { ...prev, treatingStaffId: fallback };
    });
  }, [staff, user, clinicalStaff]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (!formData.branch) {
        toast({ title: "Branch is required", variant: "destructive" });
        return;
      }
      // Bug 3: "Treatment provided" is mandatory.
      if (!formData.treatment || formData.treatment.trim() === "") {
        setErrors((prev) => ({ ...prev, treatment: "Treatment provided is required" }));
        toast({ title: "Treatment provided is required", variant: "destructive" });
        return;
      }
      // Find name for selected treating staff ID
      const treatingStaff = staff.find(s => s.id === formData.treatingStaffId) || user;

      await createVisit.mutateAsync({
        patientId: formData.patientId,
        sessionNumber: Number(formData.sessionNumber) || 1,
        condition: formData.condition,
        treatment: formData.treatment,
        visitDate: formData.visitDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        branch: formData.branch,
        visitType: formData.visitType,
        status: formData.status,
        paymentAmount: formData.paymentAmount || "0",
        paymentStatus: formData.paymentStatus,
        paymentMode: formData.paymentMode,
        notes: formData.notes?.trim() || null,
        improvements: formData.improvements?.trim() || null,
        reportImageUri: imagePreview || null,
        createdByStaffId: user.id,
        createdByName: user.name,
        treatingStaffId: formData.treatingStaffId,
        treatingStaffName: treatingStaff.name,
      });

      toast({
        title: "Visit Recorded",
        description: "The patient visit has been successfully saved.",
      });

      setLocation(preselectedPatientId ? `/patients/${preselectedPatientId}` : "/patients");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create visit",
        variant: "destructive",
      });
    }
  };

  if (loadingPatients || loadingStaff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (patientsError) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load patients: {patientsError instanceof Error ? patientsError.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <div className="max-w-[720px] mx-auto bg-background">
        <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur z-20 py-3 px-4 border-b safe-top">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="-ml-2 h-10 w-10" data-testid="button-back-new-visit">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">New Visit Record</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-8">
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-primary/80 border-b pb-2">Visit Details</h3>
            
            <div className="space-y-3">
              <Label className="text-base font-semibold">Patient</Label>
              <Select 
                value={formData.patientId} 
                onValueChange={(v) => {
                  const selected = patients.find((p) => p.id === v);
                  setFormData({
                    ...formData,
                    patientId: v,
                    condition: selected?.condition && !(formData.condition || "").trim() ? selected.condition : formData.condition,
                  });
                }}
                disabled={!!preselectedPatientId}
              >
                <SelectTrigger className="h-14 text-base bg-card border-input">
                  <SelectValue placeholder="Select Patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.id} value={p.id} className="py-3 text-base">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Treating Staff</Label>
              <TreatingStaffCombobox
                staff={staff as any[]}
                value={formData.treatingStaffId}
                onChange={(v) => setFormData({ ...formData, treatingStaffId: v })}
                placeholder="Select treating staff"
                className="h-14 text-base bg-card border-input"
                data-testid="select-treating-staff"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Session #</Label>
                <Input 
                  type="number" 
                  className="h-14 text-base bg-card"
                  value={formData.sessionNumber}
                  readOnly
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Date</Label>
                <Input 
                  type="date" 
                  className="h-14 text-base bg-card"
                  value={formData.visitDate}
                  onChange={(e) => setFormData({...formData, visitDate: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Start Time</Label>
                <Input 
                  type="time" 
                  className="h-14 text-base bg-card"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">End Time</Label>
                <Input 
                  type="time" 
                  className="h-14 text-base bg-card"
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Condition</Label>
              <Input 
                className="h-14 text-base bg-card"
                placeholder="e.g. Lower Back Pain"
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Treatment Provided <span className="text-red-500">*</span></Label>
              <Textarea 
                placeholder="Details of therapy..."
                value={formData.treatment}
                onChange={(e) => {
                  setFormData({...formData, treatment: e.target.value});
                  if (errors.treatment) setErrors((prev) => ({ ...prev, treatment: undefined }));
                }}
                className="min-h-[120px] text-base bg-card p-4 leading-relaxed"
                style={{ borderColor: errors.treatment ? "red" : undefined }}
                aria-invalid={!!errors.treatment}
              />
              {errors.treatment && (
                <p style={{ color: "red", fontSize: "0.75rem", marginTop: "4px" }}>{errors.treatment}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Improvements (if any)</Label>
              <Textarea 
                placeholder="e.g. pain reduced, mobility improved..."
                value={formData.improvements}
                onChange={(e) => setFormData({...formData, improvements: e.target.value})}
                className="min-h-[80px] text-base bg-card p-4 leading-relaxed"
              />
            </div>

             <div className="space-y-3">
              <Label className="text-base font-semibold">Attach Report / Photo</Label>
              <div className="flex items-center gap-4">
                <Button type="button" variant="outline" className="w-full relative overflow-hidden h-14 border-dashed text-base text-muted-foreground hover:text-primary hover:border-primary/50 bg-card" onClick={() => document.getElementById('file-upload-new')?.click()}>
                  <Camera className="mr-3 h-5 w-5" />
                  {imagePreview ? 'Change Photo' : 'Take Photo'}
                  <input 
                    id="file-upload-new" 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleImageUpload}
                  />
                </Button>
              </div>
              {imagePreview && (
                <div className="mt-4 relative rounded-xl overflow-hidden border aspect-video bg-muted shadow-sm">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 pt-2">
             <h3 className="text-lg font-semibold text-primary/80 border-b pb-2">Status & Payment</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger className="h-14 text-base bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Finished">Finished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Visit Type</Label>
                <Select value={formData.visitType} onValueChange={(v) => setFormData({...formData, visitType: v})}>
                  <SelectTrigger className="h-14 text-base bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Clinic">Clinic</SelectItem>
                    <SelectItem value="Home">Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Branch</Label>
                <BranchSelectField
                  className="h-14 text-base bg-card"
                  value={formData.branch}
                  onChange={(v) => {
                    branchTouchedRef.current = true;
                    setFormData({ ...formData, branch: v as typeof formData.branch });
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Amount (LKR)</Label>
                <Input 
                  type="number"
                  className="h-14 text-base bg-card"
                  value={formData.paymentAmount}
                  onChange={(e) => setFormData({...formData, paymentAmount: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:contents">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Payment</Label>
                  <Select value={formData.paymentStatus} onValueChange={(v) => setFormData({...formData, paymentStatus: v})}>
                    <SelectTrigger className="h-14 text-base bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Mode</Label>
                  <Select value={formData.paymentMode} onValueChange={(v) => setFormData({...formData, paymentMode: v})}>
                    <SelectTrigger className="h-14 text-base bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white safe-area-bottom shadow-[0_-2px_12px_rgba(0,0,0,0.06)] md:static md:z-auto md:border-0 md:bg-transparent md:shadow-none">
           <div className="mx-auto flex max-w-[720px] p-4 md:px-6 md:pt-6 md:pb-0 md:justify-end">
             <Button type="submit" className="h-12 w-full text-base font-semibold shadow-md md:h-10 md:w-auto md:min-w-[10rem] md:text-sm" onClick={handleSubmit} data-testid="button-save-visit">
               Save Visit Record
             </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
