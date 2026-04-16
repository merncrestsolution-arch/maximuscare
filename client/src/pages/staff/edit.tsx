import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useStaffMember, useCreateStaff, useUpdateStaff, useDeleteStaff } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import type { Role, User } from "@/lib/types";
import { ManageLoginSection } from "@/components/staff/manage-login-section";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EDIT_PAGE_ROOT } from "@/lib/editPageShell";

const DEFAULT_STAFF: User = {
  id: "",
  name: "",
  email: "",
  role: "Physiotherapist",
  branch: "Colombo",
  address: "",
  phone: "",
  nic: "",
  passportNo: "",
  degree: "",
  avatar: "",
};

interface FormDataWithPassword extends User {
  password?: string;
  confirmPassword?: string;
}

export default function StaffEditPage() {
  const [match, params] = useRoute("/staff/:id/edit");
  const [, setLocation] = useLocation();
  const { user: currentUser, refreshStaff } = useAuth();
  const { toast } = useToast();

  if (!currentUser) return null;

  const staffId = match ? params?.id : undefined;
  const isEdit = !!staffId && staffId !== "new";

  const canEditSensitive = ["Admin", "MD"].includes(currentUser.role);

  const { data: existing, isLoading, error } = useStaffMember(staffId || "");
  const createStaff = useCreateStaff();
  const updateStaffMutation = useUpdateStaff();
  const deleteStaffMutation = useDeleteStaff();

  const [formData, setFormData] = useState<FormDataWithPassword>(
    isEdit && existing ? { ...existing } : { ...DEFAULT_STAFF, password: "", confirmPassword: "" }
  );

  useEffect(() => {
    if (isEdit) {
      if (!existing) return;
      setFormData({ ...existing });
    } else {
      setFormData({ ...DEFAULT_STAFF, password: "", confirmPassword: "" });
    }
  }, [isEdit, existing]);

  if (!canEditSensitive) {
    return (
      <div className={EDIT_PAGE_ROOT}>
        <div className="max-w-[720px] mx-auto p-4">
          <div className="text-base font-semibold text-black">Unauthorized.</div>
          <Button className="mt-4 h-12" onClick={() => setLocation("/staff")}>Back</Button>
        </div>
      </div>
    );
  }

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
        <div className="max-w-[720px] mx-auto p-4">
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load staff member: {error instanceof Error ? error.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
          <Button className="mt-4 h-12" onClick={() => setLocation("/staff")}>Back</Button>
        </div>
      </div>
    );
  }

  if (isEdit && !existing) {
    return (
      <div className={EDIT_PAGE_ROOT}>
        <div className="max-w-[720px] mx-auto p-4">
          <div className="text-base font-semibold text-black">Staff member not found.</div>
          <Button className="mt-4 h-12" onClick={() => setLocation("/staff")}>Back</Button>
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    if (isEdit) setLocation(`/staff/${staffId}`);
    else setLocation("/staff");
  };

  const handleSave = async () => {
    try {
      if (isEdit) {
        const { password, confirmPassword, ...updateData } = formData;
        await updateStaffMutation.mutateAsync({ 
          id: staffId!, 
          data: { ...updateData, avatar: "" } 
        });
        await refreshStaff();
        toast({
          title: "Success",
          description: "Staff member updated successfully",
        });
        setLocation(`/staff/${staffId}`);
      } else {
        if (!formData.name.trim()) {
          toast({ title: "Error", description: "Name is required", variant: "destructive" });
          return;
        }
        if (!formData.email.trim()) {
          toast({ title: "Error", description: "Email is required", variant: "destructive" });
          return;
        }
        if (!formData.password || formData.password.length < 4) {
          toast({ title: "Error", description: "Password must be at least 4 characters", variant: "destructive" });
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
          return;
        }

        const { confirmPassword, ...createData } = formData;
        await createStaff.mutateAsync(createData);
        await refreshStaff();
        toast({
          title: "Success",
          description: "Staff member created successfully",
        });
        setLocation("/staff");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save staff member",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    
    try {
      await deleteStaffMutation.mutateAsync(staffId!);
      await refreshStaff();
      toast({
        title: "Success",
        description: "Staff member deleted successfully",
      });
      setLocation("/staff");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete staff member",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={`${EDIT_PAGE_ROOT} pb-28 md:pb-8`}>
      <div className="max-w-[720px] mx-auto">
        <div className="flex items-center gap-2 sticky top-0 bg-white z-20 py-3 px-4 border-b border-gray-200 safe-top">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="-ml-2 h-11 w-11"
            data-testid="button-back-staff-edit"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-black truncate" data-testid="text-title-staff-edit">
              {isEdit ? "Edit Staff" : "Add New Staff"}
            </h1>
            <p className="text-sm text-black/70" data-testid="text-subtitle-staff-edit">
              {isEdit ? "Update staff profile details" : "Create a new staff account"}
            </p>
          </div>
          {isEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive h-11 w-11"
              onClick={handleDelete}
              data-testid="button-delete-staff"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-8">
          <div className="space-y-6">
            <h3 className="text-base font-bold text-black" data-testid="text-section-staff-details">Staff Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Name</Label>
                <Input
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-staff-name"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v as Role })}>
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-staff-role">
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
              <Label className="text-base font-semibold text-black">Email (Login)</Label>
              <Input
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-staff-email"
                disabled={isEdit}
              />
              {isEdit && (
                <div className="text-xs text-black/70" data-testid="text-login-email-hint">
                  Login email is managed in the Manage Login section below.
                </div>
              )}
            </div>

            {!isEdit && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-black">Password</Label>
                  <PasswordInput
                    className="h-12 text-base bg-white border-gray-300 text-black"
                    value={formData.password || ""}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 4 characters"
                    data-testid="input-staff-password"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-black">Confirm Password</Label>
                  <PasswordInput
                    className="h-12 text-base bg-white border-gray-300 text-black"
                    value={formData.confirmPassword || ""}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    data-testid="input-staff-confirm-password"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Branch</Label>
                <Select value={formData.branch} onValueChange={(v) => setFormData({ ...formData, branch: v as any })}>
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-staff-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Colombo">Colombo</SelectItem>
                    <SelectItem value="Bandaragama">Bandaragama</SelectItem>
                    <SelectItem value="Both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Phone</Label>
                <Input
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="input-staff-phone"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-black">Address</Label>
              <Input
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                data-testid="input-staff-address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">NIC</Label>
                <Input
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={formData.nic || ""}
                  onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
                  data-testid="input-staff-nic"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-semibold text-black">Passport</Label>
                <Input
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={formData.passportNo || ""}
                  onChange={(e) => setFormData({ ...formData, passportNo: e.target.value })}
                  data-testid="input-staff-passport"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold text-black">Qualifications / Degree</Label>
              <Input
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={formData.degree || ""}
                onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                data-testid="input-staff-degree"
              />
            </div>

            {isEdit && (
              <ManageLoginSection
                currentUser={currentUser}
                targetUser={formData}
                onSave={(updatedUser) => setFormData(updatedUser)}
              />
            )}

            <div className="h-24" />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white safe-area-bottom md:static md:z-auto md:border-0 md:bg-white">
          <div className="mx-auto flex max-w-[720px] gap-3 p-4 md:justify-end md:px-6 md:pt-6 md:pb-0">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 text-base md:h-10 md:flex-none md:min-w-[7rem] md:text-sm"
              onClick={handleCancel}
              data-testid="button-cancel-staff-edit"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 text-base font-semibold bg-primary hover:bg-primary/90 md:h-10 md:flex-none md:min-w-[9rem] md:text-sm"
              onClick={handleSave}
              disabled={createStaff.isPending || updateStaffMutation.isPending}
              data-testid="button-save-staff-edit"
            >
              {(createStaff.isPending || updateStaffMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEdit ? "Save Changes" : "Create Staff"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
