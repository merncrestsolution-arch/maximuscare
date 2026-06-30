import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useCreateInPatient, usePatientLookup, usePatient } from "@/hooks/useData";
import { useBranch } from "@/context/branch-context";
import { patientApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Patient } from "@/lib/types";

interface FormData {
  patientName: string;
  age: number;
  condition: string;
  careTakerName: string;
  careTakerRelationship: string;
  phone: string;
  address: string;
  patientIdNo: string;
  careTakerIdNo: string;
  packageType: "AC Room" | "Non-AC Room";
  admitDate: string;
  amountPerDay: string;
}

const DEFAULT_FORM: FormData = {
  patientName: "",
  age: 0,
  condition: "",
  careTakerName: "",
  careTakerRelationship: "",
  phone: "",
  address: "",
  patientIdNo: "",
  careTakerIdNo: "",
  packageType: "Non-AC Room",
  admitDate: format(new Date(), "yyyy-MM-dd"),
  amountPerDay: "",
};

export default function AddInPatientPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const prefillId = new URLSearchParams(search).get("patientId") || "";
  const { toast } = useToast();
  const { selectedBranchName } = useBranch();
  const createInPatient = useCreateInPatient();
  const lookup = usePatientLookup();
  const { data: prefillPatient } = usePatient(prefillId);

  const [formData, setFormData] = useState<FormData>({ ...DEFAULT_FORM });
  // The matched/linked existing patient (re-admission). When set, we reuse their
  // Patient ID instead of generating a new one.
  const [existing, setExisting] = useState<Patient | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const prefilledRef = useRef(false);

  const applyPatient = (p: Patient) => {
    setExisting(p);
    setFormData((prev) => ({
      ...prev,
      patientName: p.name ?? prev.patientName,
      age: typeof p.age === "number" && p.age > 0 ? p.age : prev.age,
      phone: p.phone ?? prev.phone,
      address: p.address ?? prev.address,
      patientIdNo: p.nicOrPassport ?? prev.patientIdNo,
      condition: p.condition ?? prev.condition,
    }));
  };

  // Pre-fill from a scanned patient (Quick Add → Scan QR → Add In-Patient).
  useEffect(() => {
    if (prefillPatient && !prefilledRef.current) {
      prefilledRef.current = true;
      applyPatient(prefillPatient as Patient);
    }
  }, [prefillPatient]);

  // Preview the auto-generated Patient ID for a brand-new patient.
  const refreshGeneratedCode = (admitDate: string) => {
    patientApi
      .nextId(admitDate, selectedBranchName || undefined)
      .then((r) => setGeneratedCode(r.patientCode))
      .catch(() => setGeneratedCode(""));
  };

  useEffect(() => {
    if (!existing) refreshGeneratedCode(formData.admitDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.admitDate, existing, selectedBranchName]);

  const runLookup = async () => {
    const phone = formData.phone.trim();
    const nic = formData.patientIdNo.trim();
    if (!phone && !nic) {
      setExisting(null);
      return;
    }
    try {
      const res = await lookup.mutateAsync({ phone, nic });
      if (res.patient) {
        applyPatient(res.patient as Patient);
      } else {
        setExisting(null);
      }
    } catch {
      /* lookup failures shouldn't block manual entry */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientName.trim()) {
      toast({ title: "Error", description: "Patient name is required", variant: "destructive" });
      return;
    }
    if (!formData.condition.trim()) {
      toast({ title: "Error", description: "Condition is required", variant: "destructive" });
      return;
    }
    if (!formData.amountPerDay || parseFloat(formData.amountPerDay) <= 0) {
      toast({ title: "Error", description: "Amount per day is required", variant: "destructive" });
      return;
    }

    try {
      await createInPatient.mutateAsync({
        ...formData,
        age: Number(formData.age),
        status: "Admitted",
        // Server reuses this patient's Patient ID and links the admission.
        patientId: existing?.id ?? null,
      });
      toast({ title: "Success", description: "In-patient admitted successfully" });
      setLocation("/inpatients");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to admit patient",
        variant: "destructive",
      });
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const displayedPatientId = existing?.patientCode ?? generatedCode;

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-[720px] mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/inpatients")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground" data-testid="page-title">Add In-Patient</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient ID — read-only, reused on re-admission or auto-generated for new patients */}
          <div className="space-y-2">
            <Label htmlFor="patientId">Patient ID</Label>
            <Input
              id="patientId"
              readOnly
              value={displayedPatientId}
              placeholder="Assigned automatically"
              className="h-12 font-mono bg-muted/40"
              data-testid="input-patient-code"
            />
            {existing ? (
              <Badge
                className="bg-success text-white gap-1.5"
                data-testid="badge-existing-patient"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Existing patient found — reusing Patient ID
              </Badge>
            ) : (
              <p className="text-xs text-muted-foreground">
                A new Patient ID is assigned automatically when you admit this patient.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="patientName">Patient Name *</Label>
            <Input
              id="patientName"
              value={formData.patientName}
              onChange={(e) => updateField("patientName", e.target.value)}
              placeholder="Enter patient name"
              className="h-12"
              data-testid="input-patient-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                type="number"
                value={formData.age || ""}
                onChange={(e) => updateField("age", parseInt(e.target.value) || 0)}
                placeholder="Age"
                className="h-12"
                data-testid="input-age"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                onBlur={runLookup}
                placeholder="Phone number"
                className="h-12"
                data-testid="input-phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Condition *</Label>
            <Textarea
              id="condition"
              value={formData.condition}
              onChange={(e) => updateField("condition", e.target.value)}
              placeholder="Patient condition"
              rows={2}
              data-testid="input-condition"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Patient address"
              rows={2}
              data-testid="input-address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="careTakerName">Caretaker Name</Label>
              <Input
                id="careTakerName"
                value={formData.careTakerName}
                onChange={(e) => updateField("careTakerName", e.target.value)}
                placeholder="Caretaker name"
                className="h-12"
                data-testid="input-caretaker-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="careTakerRelationship">Relationship</Label>
              <Input
                id="careTakerRelationship"
                value={formData.careTakerRelationship}
                onChange={(e) => updateField("careTakerRelationship", e.target.value)}
                placeholder="e.g., Son, Daughter"
                className="h-12"
                data-testid="input-caretaker-relationship"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patientIdNo">NIC / Passport No</Label>
              <Input
                id="patientIdNo"
                value={formData.patientIdNo}
                onChange={(e) => updateField("patientIdNo", e.target.value)}
                onBlur={runLookup}
                placeholder="NIC/Passport"
                className="h-12"
                data-testid="input-patient-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="careTakerIdNo">Caretaker ID No</Label>
              <Input
                id="careTakerIdNo"
                value={formData.careTakerIdNo}
                onChange={(e) => updateField("careTakerIdNo", e.target.value)}
                placeholder="NIC/Passport"
                className="h-12"
                data-testid="input-caretaker-id"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="packageType">Package Type *</Label>
              <Select
                value={formData.packageType}
                onValueChange={(v) => updateField("packageType", v as "AC Room" | "Non-AC Room")}
              >
                <SelectTrigger className="h-12" data-testid="select-package-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non-AC Room">Non-AC Room</SelectItem>
                  <SelectItem value="AC Room">AC Room</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admitDate">Admit Date *</Label>
              <Input
                id="admitDate"
                type="date"
                value={formData.admitDate}
                max={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => updateField("admitDate", e.target.value)}
                className="h-12"
                data-testid="input-admit-date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountPerDay">Amount Per Day (LKR) *</Label>
            <Input
              id="amountPerDay"
              type="number"
              value={formData.amountPerDay}
              onChange={(e) => updateField("amountPerDay", e.target.value)}
              placeholder="Enter amount per day"
              className="h-12"
              data-testid="input-amount-per-day"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setLocation("/inpatients")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12"
              disabled={createInPatient.isPending}
              data-testid="button-save"
            >
              {createInPatient.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Admit Patient
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
