import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Patient } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface PatientDialogProps {
  patient?: Patient; // Optional for create mode
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: Patient | Omit<Patient, 'id'>) => void;
}

const DEFAULT_PATIENT: Omit<Patient, 'id'> = {
  name: "",
  phone: "",
  age: 0,
  gender: "Male",
  address: "",
  registeredDate: new Date().toISOString(),
  branch: "Colombo",
  status: "Active",
  defaultVisitType: "Clinic",
};

export function PatientDialog({ patient, isOpen, onClose, onSave }: PatientDialogProps) {
  const { toast } = useToast();
  // If patient is provided, use it (edit mode). Otherwise use default (create mode).
  const [formData, setFormData] = useState<Patient | Omit<Patient, 'id'>>(DEFAULT_PATIENT);

  useEffect(() => {
    if (isOpen) {
      if (patient) {
        setFormData({ ...patient });
      } else {
        setFormData({ ...DEFAULT_PATIENT, registeredDate: new Date().toISOString() });
      }
    }
  }, [patient, isOpen]);

  const handleSave = () => {
    const age = Number((formData as any).age);
    if (!Number.isFinite(age) || age < 1) {
      toast({ title: "Invalid age", description: "Please enter a valid age (1 or above).", variant: "destructive" });
      return;
    }
    onSave({ ...formData, age } as typeof formData);
    onClose();
  };

  const isEdit = !!patient;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full h-full max-w-full sm:max-w-2xl sm:h-auto sm:max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-background">
        <DialogHeader className="p-4 sm:p-6 border-b shrink-0 bg-background/95 backdrop-blur z-10">
          <DialogTitle className="text-xl sm:text-2xl text-primary font-bold">{isEdit ? "Edit Patient" : "Add New Patient"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{isEdit ? "Update patient demographics and details" : "Register a new patient to the system"}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold text-foreground">Full Name</Label>
              <Input 
                className="h-12 text-base bg-card border-input focus:ring-primary"
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Phone</Label>
                <Input 
                  className="h-12 text-base bg-card"
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="077..."
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Gender</Label>
                <Select 
                  value={formData.gender} 
                  onValueChange={(v) => setFormData({...formData, gender: v as any})}
                >
                  <SelectTrigger className="h-12 text-base bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Age</Label>
                <Input 
                  type="number"
                  min={1}
                  className="h-12 text-base bg-card"
                  value={formData.age === 0 ? "" : String(formData.age)} 
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") setFormData({ ...formData, age: 0 });
                    else {
                      const n = parseInt(raw, 10);
                      if (!Number.isNaN(n)) setFormData({ ...formData, age: n });
                    }
                  }}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({...formData, status: v as any})}
                >
                  <SelectTrigger className="h-12 text-base bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Discharged">Discharged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-foreground">Address</Label>
              <Input 
                className="h-12 text-base bg-card"
                value={formData.address} 
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="City or full address"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-foreground">Branch</Label>
              <Select 
                value={formData.branch} 
                onValueChange={(v) => setFormData({...formData, branch: v as any})}
              >
                <SelectTrigger className="h-12 text-base bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Colombo">Colombo</SelectItem>
                  <SelectItem value="Bandaragama">Bandaragama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="h-20 sm:h-0" /> {/* Spacer for mobile sticky footer */}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 flex-row justify-end gap-2 border-t bg-background p-4 safe-area-bottom sm:gap-2 sm:p-6">
          <Button variant="outline" className="h-11 flex-1 text-sm sm:h-10 sm:flex-none sm:min-w-[6.5rem]" onClick={onClose}>Cancel</Button>
          <Button className="h-11 flex-1 bg-primary text-sm text-primary-foreground shadow-md hover:bg-primary/90 sm:h-10 sm:flex-none sm:min-w-[8rem]" onClick={handleSave}>{isEdit ? "Save Changes" : "Register Patient"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
