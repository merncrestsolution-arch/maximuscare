import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useInPatients, useDeleteInPatient, useBranches } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ListCard } from "@/components/ui/list-card";
import { PageShell } from "@/components/layout/page-shell";
import { Loader2, Search, Plus, ChevronRight, User, Phone, Calendar, Home, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { InPatientAdmission } from "@/lib/types";
import { isManagementRole } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
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

export default function InPatientsListPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const deleteInPatient = useDeleteInPatient();
  const [statusFilter, setStatusFilter] = useState<"active" | "Discharged" | "Transferred" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: inPatients, isLoading, error } = useInPatients(statusFilter);
  const { data: branchesData = [] } = useBranches();

  const canAdd = user?.role === "Admin" || user?.role === "MD" || user?.role === "Receptionist";
  const canManage = isManagementRole(user?.role);

  const branchNameById = useMemo(
    () => new Map((branchesData as any[]).map((b) => [String(b.id), b.branchName ?? b.name])),
    [branchesData]
  );

  const filteredPatients = useMemo(() => {
    if (!inPatients) return [];
    if (!searchQuery.trim()) return inPatients;
    
    const query = searchQuery.toLowerCase();
    return inPatients.filter((p: InPatientAdmission) => 
      p.patientName.toLowerCase().includes(query) ||
      p.phone.includes(query)
    );
  }, [inPatients, searchQuery]);

  const handleDeleteAdmission = async () => {
    if (!deleteId) return;
    try {
      await deleteInPatient.mutateAsync(deleteId);
      toast({ title: "Admission deleted", description: "The in-patient record was removed." });
    } catch (e) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="text-red-600" data-testid="error-message">
          Error loading in-patients: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  const statusBadgeClass = (status: string) =>
    status === "Admitted"
      ? "bg-green-100 text-green-800 hover:bg-green-100"
      : status === "Transferred"
      ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
      : "bg-gray-100 text-gray-800 hover:bg-gray-100";

  const statusTone = (status: string | undefined) => {
    const key = String(status || "").toLowerCase();
    if (key === "admitted" || key === "active") return { bg: "#F0FDF4", text: "#16A34A" };
    if (key === "discharged") return { bg: "#FEF2F2", text: "#DC2626" };
    if (key === "transferred") return { bg: "#FFF3ED", text: "#F45627" };
    return { bg: "#EEF5FB", text: "#105691" };
  };

  const resolveBranchName = (patient: InPatientAdmission) =>
    (patient.branchId ? branchNameById.get(String(patient.branchId)) : null) || "—";

  return (
    <PageShell
      title="In-Patients"
      className="space-y-4"
      actions={
        canAdd ? (
          <Button
            className="h-12 px-4 text-sm"
            onClick={() => setLocation("/inpatients/new")}
            data-testid="button-add-inpatient"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        ) : undefined
      }
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-12 bg-card border-border shadow-sm text-base"
          data-testid="input-search"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(
          [
            { value: "all", label: "All" },
            { value: "active", label: "Admitted" },
            { value: "Discharged", label: "Discharged" },
            { value: "Transferred", label: "Transferred" },
          ] as const
        ).map((status) => (
          <button
            key={status.value}
            type="button"
            onClick={() => setStatusFilter(status.value)}
            className={`h-12 px-4 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition ${
              statusFilter === status.value
                ? "bg-[#105691] text-white"
                : "bg-[#EEF5FB] text-[#105691]"
            }`}
            data-testid={`button-filter-${status.value.toLowerCase()}`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {filteredPatients.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg border border-dashed" data-testid="text-empty">
          No in-patients found
        </div>
      ) : (
        <>
          <div className="space-y-3 inpatient-card-view">
            {filteredPatients.map((patient: InPatientAdmission) => {
              const tone = statusTone(patient.status);
              return (
                <div
                  key={patient.id}
                  className="bg-white border border-[#D6E8F5] rounded-xl px-4 py-3 shadow-sm space-y-2 cursor-pointer"
                  onClick={() => setLocation(`/inpatients/${patient.id}`)}
                  data-testid={`card-inpatient-${patient.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[0.95rem] text-[#105691] truncate">
                      {patient.patientName}
                    </span>
                    <span
                      className="text-[0.72rem] font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: tone.bg, color: tone.text }}
                    >
                      {patient.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[0.78rem]">
                    <span className="font-mono text-[#6495B6] font-semibold truncate">
                      {patient.patientCode ?? "—"}
                    </span>
                    <span className="text-[#94A3B8] text-right truncate max-w-[55%]">
                      {patient.condition || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#EEF5FB] pt-2">
                    <div>
                      <div className="text-[0.7rem] text-[#94A3B8]">Admitted</div>
                      <div className="text-[0.82rem] font-semibold text-[#334155]">
                        {format(new Date(patient.admitDate), "dd MMM yyyy")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[0.7rem] text-[#94A3B8]">Branch</div>
                      <div className="text-[0.82rem] font-semibold text-[#334155]">
                        {resolveBranchName(patient)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 inpatient-table-view">
            {filteredPatients.map((patient: InPatientAdmission) => (
              <ListCard key={patient.id} data-testid={`card-inpatient-desktop-${patient.id}`}>
                <button
                  type="button"
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  onClick={() => setLocation(`/inpatients/${patient.id}`)}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-base text-foreground leading-tight truncate" data-testid={`text-name-${patient.id}`}>
                        {patient.patientName}
                      </span>
                    </div>
                    {patient.patientCode && (
                      <p className="text-[11px] font-mono text-muted-foreground">{patient.patientCode}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 min-w-0">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate" data-testid={`text-phone-${patient.id}`}>{patient.phone}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Calendar className="h-3.5 w-3.5" />
                        <span data-testid={`text-date-${patient.id}`}>
                          {format(new Date(patient.admitDate), "dd MMM yyyy")}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Home className="h-3.5 w-3.5" />
                        <span data-testid={`text-package-${patient.id}`}>{patient.packageType}</span>
                      </span>
                    </div>
                    {patient.condition && (
                      <div className="text-sm text-muted-foreground truncate" data-testid={`text-condition-${patient.id}`}>
                        {patient.condition}
                      </div>
                    )}
                  </div>
                </button>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge className={`${statusBadgeClass(patient.status)} font-semibold px-2.5`} data-testid={`badge-status-${patient.id}`}>
                    {patient.status}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          aria-label="Edit admission"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/inpatients/${patient.id}/edit`);
                          }}
                          data-testid={`button-edit-inpatient-${patient.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          aria-label="Delete admission"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(patient.id);
                          }}
                          data-testid={`button-delete-inpatient-${patient.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 pointer-events-none" />
                  </div>
                </div>
              </ListCard>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this admission?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the in-patient record. Only use if the entry was created by mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAdmission}
              disabled={deleteInPatient.isPending}
            >
              {deleteInPatient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
