import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { User } from "@/lib/types";
import { staffApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function ManageLoginSection({
  currentUser,
  targetUser,
  onSave,
}: {
  currentUser: User;
  targetUser: User;
  onSave: (updatedUser: User) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = useMemo(
    () => ["Admin", "MD"].includes(currentUser.role),
    [currentUser.role]
  );

  const [email, setEmail] = useState(targetUser.email);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(() => {
    return email.trim().toLowerCase() !== targetUser.email.trim().toLowerCase() || password.length > 0;
  }, [email, password.length, targetUser.email]);

  if (!canManage) return null;

  const handleGenerateTemp = () => {
    const next = generateTemporaryPassword();
    setPassword(next);
    setConfirm(next);
    setTempPassword(next);
  };

  const handleSave = async () => {
    const nextEmail = email.trim();
    if (!nextEmail) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }

    if (password.length > 0) {
      if (password.length < 4) {
        toast({ title: "Error", description: "Password must be at least 4 characters", variant: "destructive" });
        return;
      }
      if (password !== confirm) {
        toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
        return;
      }
    } else {
      toast({ title: "Error", description: "Please enter a new password", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updateData: { password: string; email?: string } = { password };
      if (nextEmail !== targetUser.email) {
        updateData.email = nextEmail;
      }
      
      await staffApi.updatePassword(targetUser.id, updateData);

      onSave({ ...targetUser, email: nextEmail });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staff-directory"] });

      toast({ title: "Success", description: "Login credentials updated successfully" });
      setPassword("");
      setConfirm("");
    } catch (e) {
      toast({ 
        title: "Error", 
        description: e instanceof Error ? e.message : "Could not update login credentials", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-white border border-border/60 shadow-sm" data-testid="card-manage-login">
      <CardHeader className="pb-3">
        <CardTitle className="text-base" data-testid="text-manage-login-title">Manage Login</CardTitle>
        <div className="text-sm text-muted-foreground" data-testid="text-manage-login-subtitle">
          Admin/MD can update login email and reset password.
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <Label className="text-base font-semibold text-foreground">Email (Login)</Label>
          <Input
            className="h-12 text-base bg-white border-border/70"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="input-manage-login-email"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold text-foreground">New Password</Label>
            <PasswordInput
              className="h-12 text-base bg-white border-border/70"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              data-testid="input-manage-login-password"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-base font-semibold text-foreground">Confirm Password</Label>
            <PasswordInput
              className="h-12 text-base bg-white border-border/70"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              data-testid="input-manage-login-confirm"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            onClick={handleGenerateTemp}
            data-testid="button-reset-password"
          >
            Generate Temporary Password
          </Button>

          <Button
            type="button"
            className="h-12 text-base font-semibold bg-primary hover:bg-primary/90"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            data-testid="button-save-login"
          >
            {saving ? "Saving..." : "Save Login Changes"}
          </Button>
        </div>

        {tempPassword && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            data-testid="status-temp-password"
          >
            Temporary password (shown once): <span className="font-semibold">{tempPassword}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
