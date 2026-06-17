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
import { useBranchOptions } from "@/hooks/use-branch-options";

interface EditStaffDialogProps {
  staff: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedStaff: User) => void;
  onDelete?: (staffId: string) => void;
}

export function EditStaffDialog({ staff, isOpen, onClose, onSave, onDelete }: EditStaffDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { options: branchOptions } = useBranchOptions();

  const [formData, setFormData] = useState<User>({ ...staff });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...staff });
      setConfirmDelete(false);
    }
  }, [isOpen, staff]);

  if (!user) return null;

  const canEditSensitive = ["Admin", "MD"].includes(user.role);
  const isEditingSelf = user.id === staff.id;

  const handleSave = () => {
    onSave(formData);
    toast({ title: "Staff updated", description: "Changes have been saved successfully." });
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && !isEditingSelf) {
      onDelete(staff.id);
      toast({ title: "Staff deleted", description: "The staff member has been removed." });
      onClose();
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setConfirmDelete(false);
        }
      }}
    >
      <DialogContent className="w-full h-[100svh] max-w-full sm:max-w-2xl sm:h-auto sm:max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-white border border-border/70 shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 border-b shrink-0 bg-white/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-border/60 bg-muted/30 flex items-center justify-center text-primary font-bold">
              {staff.name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl sm:text-2xl text-foreground font-bold">Edit Staff Profile</DialogTitle>
              <DialogDescription className="text-muted-foreground">Update details for {staff.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Name</Label>
                <Input
                  className="h-12 text-base bg-white border-border/70"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!canEditSensitive}
                  data-testid="input-staff-name"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData({ ...formData, role: v as Role })}
                  disabled={!canEditSensitive}
                >
                  <SelectTrigger className="h-12 text-base bg-white border-border/70" data-testid="select-staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="MD">Managing Director</SelectItem>
                    <SelectItem value="Physiotherapist">Physiotherapist</SelectItem>
                    <SelectItem value="Receptionist">Receptionist</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-foreground">Email (Login)</Label>
              <Input
                className="h-12 text-base bg-white border-border/70"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!canEditSensitive}
                data-testid="input-staff-email"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Branch</Label>
                <Select
                  value={formData.branch}
                  onValueChange={(v) => setFormData({ ...formData, branch: v as any })}
                  disabled={!canEditSensitive}
                >
                  <SelectTrigger className="h-12 text-base bg-white border-border/70" data-testid="select-staff-branch">
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
                <Label className="text-base font-semibold text-foreground">Phone</Label>
                <Input
                  className="h-12 text-base bg-white border-border/70"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!canEditSensitive}
                  data-testid="input-staff-phone"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-foreground">Address</Label>
              <Input
                className="h-12 text-base bg-white border-border/70"
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!canEditSensitive}
                data-testid="input-staff-address"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">NIC</Label>
                <Input
                  className="h-12 text-base bg-white border-border/70"
                  value={formData.nic || ""}
                  onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
                  disabled={!canEditSensitive}
                  data-testid="input-staff-nic"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Passport</Label>
                <Input
                  className="h-12 text-base bg-white border-border/70"
                  value={formData.passportNo || ""}
                  onChange={(e) => setFormData({ ...formData, passportNo: e.target.value })}
                  disabled={!canEditSensitive}
                  data-testid="input-staff-passport"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-foreground">Qualifications / Degree</Label>
              <Input
                className="h-12 text-base bg-white border-border/70"
                value={formData.degree || ""}
                onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                disabled={!canEditSensitive}
                data-testid="input-staff-degree"
              />
            </div>

            {canEditSensitive && onDelete && !isEditingSelf && (
              <div className="pt-6 border-t mt-4">
                {!confirmDelete ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 text-base text-destructive border-destructive hover:bg-destructive/10 gap-2"
                    onClick={() => setConfirmDelete(true)}
                    data-testid="button-staff-delete"
                  >
                    <Trash2 className="h-5 w-5" /> Delete Staff Member
                  </Button>
                ) : (
                  <div className="space-y-4 bg-destructive/5 p-4 rounded-lg border border-destructive/20">
                    <div className="text-base font-medium text-destructive text-center">Are you sure? This cannot be undone.</div>
                    <div className="flex gap-3">
                      <Button type="button" variant="destructive" className="flex-1 h-11" onClick={handleDelete} data-testid="button-staff-confirm-delete">
                        Confirm Delete
                      </Button>
                      <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setConfirmDelete(false)} data-testid="button-staff-cancel-delete">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="h-20 sm:h-0" />
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 border-t bg-white shrink-0 flex-row gap-2 sm:gap-2 justify-end safe-area-bottom">
          <Button variant="outline" className="flex-1 sm:flex-none h-12 text-base" onClick={onClose} data-testid="button-staff-cancel">
            Cancel
          </Button>
          <Button className="flex-1 sm:flex-none h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md" onClick={handleSave} data-testid="button-staff-save">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
