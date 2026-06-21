import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useInPatient, useUpdateInPatient } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EDIT_PAGE_ROOT } from "@/lib/editPageShell";

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
  amountPerDay: string;
}

export default function EditInPatientPage() {
  const [, params] = useRoute("/inpatients/:id/edit");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const patientId = params?.id || "";

  const { data: patient, isLoading, error } = useInPatient(patientId);
  const updateInPatient = useUpdateInPatient();

  const [formData, setFormData] = useState<FormData | null>(null);

  const isAdminMD = user?.role === "Admin" || user?.role === "MD";

  useEffect(() => {
    if (patient) {
      setFormData({
        patientName: patient.patientName,
        age: patient.age,
        condition: patient.condition,
        careTakerName: patient.careTakerName,
        careTakerRelationship: patient.careTakerRelationship,
        phone: patient.phone,
        address: patient.address,
        patientIdNo: patient.patientIdNo || "",
        careTakerIdNo: patient.careTakerIdNo || "",
        packageType: patient.packageType as "AC Room" | "Non-AC Room",
        amountPerDay: patient.amountPerDay,
      });
    }
  }, [patient]);

  if (!isAdminMD) {
    return (
      <div className={`${EDIT_PAGE_ROOT} flex items-center justify-center p-4`}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-destructive mb-2">Access Denied</h2>
          <p className="text-black/80 mb-4">Only Admin and Managing Director can edit admission details.</p>
          <Button onClick={() => setLocation(`/inpatients/${patientId}`)}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${EDIT_PAGE_ROOT} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-black/40" />
      </div>
    );
  }

  if (error || !patient || !formData) {
    return (
      <div className={`${EDIT_PAGE_ROOT} p-4`}>
        <div className="max-w-[720px] mx-auto">
          <div className="text-red-600 mb-4">
            {error instanceof Error ? error.message : "Patient not found"}
          </div>
          <Button onClick={() => setLocation("/inpatients")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientName.trim()) {
      toast({ title: "Error", description: "Patient name is required", variant: "destructive" });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ title: "Error", description: "Phone number is required", variant: "destructive" });
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
      await updateInPatient.mutateAsync({
        id: patientId,
        data: {
          ...formData,
          age: Number(formData.age),
        },
      });
      toast({ title: "Success", description: "Admission details updated successfully" });
      setLocation(`/inpatients/${patientId}`);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to update",
        variant: "destructive"
      });
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <div className={`${EDIT_PAGE_ROOT} pb-20`}>
      <div className="max-w-[720px] mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation(`/inpatients/${patientId}`)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 text-black" />
          </Button>
          <h1 className="text-xl font-bold text-black" data-testid="page-title">Edit Admission Details</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patientName">Patient Name *</Label>
            <Input
              id="patientName"
              value={formData.patientName}
              onChange={(e) => updateField("patientName", e.target.value)}
              placeholder="Enter patient name"
              className="h-12 bg-white border-gray-300 text-black"
              data-testid="input-patient-name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age *</Label>
              <Input
                id="age"
                type="number"
                value={formData.age || ""}
                onChange={(e) => updateField("age", parseInt(e.target.value) || 0)}
                placeholder="Age"
                className="h-12 bg-white border-gray-300 text-black"
                data-testid="input-age"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="Phone number"
                className="h-12 bg-white border-gray-300 text-black"
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
              className="bg-white border-gray-300 text-black"
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
              className="bg-white border-gray-300 text-black"
              data-testid="input-address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="careTakerName">Caretaker Name *</Label>
              <Input
                id="careTakerName"
                value={formData.careTakerName}
                onChange={(e) => updateField("careTakerName", e.target.value)}
                placeholder="Caretaker name"
                className="h-12 bg-white border-gray-300 text-black"
                data-testid="input-caretaker-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="careTakerRelationship">Relationship *</Label>
              <Input
                id="careTakerRelationship"
                value={formData.careTakerRelationship}
                onChange={(e) => updateField("careTakerRelationship", e.target.value)}
                placeholder="e.g., Son, Daughter"
                className="h-12 bg-white border-gray-300 text-black"
                data-testid="input-caretaker-relationship"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patientIdNo">Patient ID No</Label>
              <Input
                id="patientIdNo"
                value={formData.patientIdNo}
                onChange={(e) => updateField("patientIdNo", e.target.value)}
                placeholder="NIC/Passport"
                className="h-12 bg-white border-gray-300 text-black"
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
                className="h-12 bg-white border-gray-300 text-black"
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
                <SelectTrigger className="h-12 bg-white border-gray-300 text-black [&_svg]:text-black" data-testid="select-package-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Non-AC Room">Non-AC Room</SelectItem>
                  <SelectItem value="AC Room">AC Room</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountPerDay">Amount Per Day (LKR) *</Label>
              <Input
                id="amountPerDay"
                type="number"
                value={formData.amountPerDay}
                onChange={(e) => updateField("amountPerDay", e.target.value)}
                placeholder="Enter amount per day"
                className="h-12 bg-white border-gray-300 text-black"
                data-testid="input-amount-per-day"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setLocation(`/inpatients/${patientId}`)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12"
              disabled={updateInPatient.isPending}
              data-testid="button-save"
            >
              {updateInPatient.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
