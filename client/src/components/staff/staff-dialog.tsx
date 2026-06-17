import { useState, useEffect } from "react";
import { User, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBranchOptions } from "@/hooks/use-branch-options";

interface StaffDialogProps {
  staff?: User; // Optional for create mode
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedStaff: User) => void;
  onDelete?: (staffId: string) => void;
}

const DEFAULT_STAFF: User = {
  id: "", // Will be generated on save
  name: "",
  email: "",
  role: "Staff",
  branch: "",
  address: "",
  phone: "",
  nic: "",
  passportNo: "",
  degree: "",
  avatar: ""
};

export function StaffDialog({ staff, isOpen, onClose, onSave, onDelete }: StaffDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { options: branchOptions, defaultValue: defaultBranch } = useBranchOptions();
  
  const [formData, setFormData] = useState<User>({ ...DEFAULT_STAFF });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (staff) {
        setFormData({ ...staff });
      } else {
        setFormData({ ...DEFAULT_STAFF, id: `u${Date.now()}`, avatar: "" });
      }
    }
  }, [staff, isOpen]);

  if (!user) return null;

  const isEdit = !!staff;
  const canEditSensitive = ['Admin', 'MD'].includes(user.role);
  const isEditingSelf = staff?.id === user.id;

  const handleSave = () => {
    onSave(formData);
    toast({ title: isEdit ? "Staff updated" : "Staff created", description: "Changes have been saved successfully." });
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && staff && !isEditingSelf) {
      onDelete(staff.id);
      toast({ title: "Staff deleted", description: "The staff member has been removed." });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        setConfirmDelete(false);
      }
    }}>
      <DialogContent className="w-full h-full max-w-full sm:max-w-2xl sm:h-auto sm:max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-background">
        <DialogHeader className="p-4 sm:p-6 border-b shrink-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            {/* Small avatar in header instead of large overlay */}
            {isEdit && (
              <div className="w-10 h-10 rounded-full border border-border/60 bg-muted/30 flex items-center justify-center text-primary font-bold">
                {staff?.name?.charAt(0)}
              </div>
            )}
            <div>
               <DialogTitle className="text-xl sm:text-2xl text-primary font-bold">{isEdit ? "Edit Staff Profile" : "Add New Staff"}</DialogTitle>
               <DialogDescription className="text-muted-foreground">{isEdit ? `Update details for ${staff?.name}` : "Create a new staff account"}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Name</Label>
                <Input 
                  className="h-12 text-base bg-card"
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  disabled={isEdit && !canEditSensitive}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Role</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(v) => setFormData({...formData, role: v as Role})}
                  disabled={isEdit && !canEditSensitive}
                >
                  <SelectTrigger className="h-12 text-base bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="MD">Managing Director</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Physiotherapist">Physiotherapist</SelectItem>
                    <SelectItem value="Receptionist">Receptionist</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Email (Login)</Label>
              <Input 
                className="h-12 text-base bg-card"
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                disabled={isEdit && !canEditSensitive}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
               <div className="space-y-3">
                <Label className="text-base font-semibold">Branch</Label>
                <Select 
                  value={formData.branch} 
                  onValueChange={(v) => setFormData({...formData, branch: v as any})}
                  disabled={isEdit && !canEditSensitive}
                >
                  <SelectTrigger className="h-12 text-base bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((b) => (
                      <SelectItem key={b.id} value={b.value}>{b.label}</SelectItem>
                    ))}
                    <SelectItem value="Both">All Branches</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Phone</Label>
                <Input 
                  className="h-12 text-base bg-card"
                  value={formData.phone || ''} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  disabled={isEdit && !canEditSensitive}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Address</Label>
              <Input 
                className="h-12 text-base bg-card"
                value={formData.address || ''} 
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                disabled={isEdit && !canEditSensitive}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold">NIC</Label>
                <Input 
                  className="h-12 text-base bg-card"
                  value={formData.nic || ''} 
                  onChange={(e) => setFormData({...formData, nic: e.target.value})}
                  disabled={isEdit && !canEditSensitive}
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Passport</Label>
                <Input 
                  className="h-12 text-base bg-card"
                  value={formData.passportNo || ''} 
                  onChange={(e) => setFormData({...formData, passportNo: e.target.value})}
                  disabled={isEdit && !canEditSensitive}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Qualifications / Degree</Label>
              <Input 
                className="h-12 text-base bg-card"
                value={formData.degree || ''} 
                onChange={(e) => setFormData({...formData, degree: e.target.value})}
                disabled={isEdit && !canEditSensitive}
              />
            </div>
            
            {isEdit && canEditSensitive && onDelete && !isEditingSelf && (
              <div className="pt-6 border-t mt-4">
                {!confirmDelete ? (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-12 text-base text-destructive border-destructive hover:bg-destructive/10 gap-2"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-5 w-5" /> Delete Staff Member
                  </Button>
                ) : (
                  <div className="space-y-4 bg-destructive/5 p-4 rounded-lg border border-destructive/20">
                    <div className="text-base font-medium text-destructive text-center">Are you sure? This cannot be undone.</div>
                    <div className="flex gap-3">
                      <Button 
                        type="button" 
                        variant="destructive" 
                        className="flex-1 h-11"
                        onClick={handleDelete}
                      >
                        Confirm Delete
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1 h-11"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="h-20 sm:h-0" /> {/* Spacer for mobile sticky footer */}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 sm:p-6 border-t bg-background shrink-0 flex-row gap-2 sm:gap-2 justify-end safe-area-bottom">
          <Button variant="outline" className="flex-1 sm:flex-none h-12 text-base" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 sm:flex-none h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md" onClick={handleSave}>{isEdit ? "Save Changes" : "Create Staff"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
