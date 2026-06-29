import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useBranch } from "@/context/branch-context";
import { useStaffDirectory, useDeleteStaff, useUpdateStaff } from "@/hooks/useData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, MapPin, MoreVertical, Loader2, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { canViewStaffList, canManageStaff } from "@/lib/permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function StaffListPage() {
  const { user } = useAuth();
  const { selectedBranchName } = useBranch();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (selectedBranchName) {
      setBranchFilter(selectedBranchName);
    }
  }, [selectedBranchName]);

  const { data: staff = [], isLoading, error } = useStaffDirectory({
    includeInactive: true,
    search,
    ...(branchFilter ? { branch: branchFilter } : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });
  const deleteStaff = useDeleteStaff();
  const updateStaff = useUpdateStaff();
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const formatJoinDate = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (!user || !canViewStaffList(user.role)) return <div className="p-4">Unauthorized</div>;
  const canEditStaff = canManageStaff(user.role);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load staff: {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  const filteredStaff = staff;
  const branches = selectedBranchName ? [selectedBranchName] : Array.from(new Set(staff.map((s: any) => s.branch).filter(Boolean))) as string[];
  const roles = Array.from(new Set(staff.map((s: any) => s.role).filter(Boolean))) as string[];

  const handleDeleteStaff = async () => {
    if (!deleteId) return;
    try {
      await deleteStaff.mutateAsync(deleteId);
      toast({ title: "Staff removed", description: "The staff account was deleted." });
    } catch (e) {
      toast({
        title: "Could not delete staff",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  const toggleActive = async (member: any, nextActive: boolean) => {
    try {
      await updateStaff.mutateAsync({ id: member.id, data: { isActive: nextActive ? 1 : 0 } });
      toast({ title: nextActive ? "Staff activated" : "Staff deactivated" });
    } catch (e) {
      toast({
        title: "Could not update staff",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={branchFilter || "all"} onValueChange={(v) => setBranchFilter(v === "all" ? "" : v)} disabled={!!selectedBranchName}>
          <SelectTrigger className="bg-background"><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            {!selectedBranchName && <SelectItem value="all">All branches</SelectItem>}
            {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={roleFilter || "all"} onValueChange={(v) => setRoleFilter(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search ID, name, phone, role..." 
            className="pl-9 h-11 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEditStaff && (
          <Link href="/staff/new" className="shrink-0">
            <Button className="w-full sm:w-auto h-11 gap-2 shadow-sm" data-testid="button-add-staff">
              <UserPlus className="h-5 w-5" />
              Add Staff
            </Button>
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {filteredStaff.map((member: any) => (
          <Card key={member.id} className="bg-white border border-border/60 shadow-sm active:scale-[0.99] transition-transform">
            <CardContent className="p-4 flex items-center gap-4">
              {member.photoUri ? (
                <img src={member.photoUri} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center font-bold shrink-0">
                  {member.name?.charAt(0)}
                </div>
              )}
              <Link href={`/staff/${member.id}`} className="flex-1 min-w-0">
                <div>
                  <div className="text-xs text-muted-foreground">{member.employeeCode || member.id.slice(0, 8)}</div>
                  <div className="font-bold text-lg text-foreground truncate" data-testid={`text-staff-name-${member.id}`}>{member.name}</div>
                  <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-medium text-foreground" data-testid={`text-staff-role-${member.id}`}>{member.designation || member.role}</span>
                    {member.attendanceStatus && (
                      <span className="text-xs font-semibold text-blue-700">· {member.attendanceStatus} today</span>
                    )}
                    <span className={`text-xs font-semibold ${(member.isActive ?? 1) ? "text-emerald-700" : "text-red-600"}`}>
                      {(member.isActive ?? 1) ? "Active" : "Deactivated"}
                    </span>
                    {member.branch && (
                      <>
                        <span className="text-white/20">•</span>
                        <span className="flex items-center gap-1 text-xs" data-testid={`text-staff-branch-${member.id}`}>
                          <MapPin className="h-3 w-3" /> {String(member.branch).toLowerCase() === "both" ? "Dehiwala & Neuro Rehabilitation" : ["all", "all branches"].includes(String(member.branch).toLowerCase()) ? "All Branches" : member.branch}
                        </span>
                      </>
                    )}
                  </div>
                  {(formatJoinDate((member as any).joinDate || (member as any).createdAt) && canViewStaffList(user.role)) && (
                    <div className="text-xs text-muted-foreground mt-1" data-testid={`text-staff-join-date-${member.id}`}>
                      Joined: {formatJoinDate((member as any).joinDate || (member as any).createdAt)}
                    </div>
                  )}
                </div>
              </Link>
              
              {canEditStaff ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLocation(`/staff/${member.id}/edit`)}>
                      Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive(member, !Boolean(member.isActive ?? 1))}>
                      {Boolean(member.isActive ?? 1) ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={member.id === user?.id}
                      onClick={() => setDeleteId(member.id)}
                      data-testid={`menu-delete-staff-${member.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes their login and profile. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteStaff}
              disabled={deleteStaff.isPending}
            >
              {deleteStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
