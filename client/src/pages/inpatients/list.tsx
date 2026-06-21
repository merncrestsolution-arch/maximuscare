import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useInPatients, useDeleteInPatient } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [statusFilter, setStatusFilter] = useState<"Admitted" | "Discharged" | "all">("Admitted");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: inPatients, isLoading, error } = useInPatients(
    statusFilter === "all" ? undefined : statusFilter
  );

  const canAdd = user?.role === "Admin" || user?.role === "MD" || user?.role === "Receptionist";
  const canManage = isManagementRole(user?.role);

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

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-[720px] mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground" data-testid="page-title">In-Patients</h1>
          {canAdd && (
            <Button 
              size="sm" 
              onClick={() => setLocation("/inpatients/new")}
              data-testid="button-add-inpatient"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["Admitted", "Discharged", "all"] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              data-testid={`button-filter-${status.toLowerCase()}`}
            >
              {status === "all" ? "All" : status}
            </Button>
          ))}
        </div>

        {filteredPatients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-empty">
            No in-patients found
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPatients.map((patient: InPatientAdmission) => (
              <div
                key={patient.id}
                className="bg-white border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                data-testid={`card-inpatient-${patient.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0"
                    onClick={() => setLocation(`/inpatients/${patient.id}`)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground" data-testid={`text-name-${patient.id}`}>
                        {patient.patientName}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        patient.status === "Admitted" 
                          ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-800"
                      }`} data-testid={`badge-status-${patient.id}`}>
                        {patient.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1 min-w-0">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate" data-testid={`text-phone-${patient.id}`}>{patient.phone}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Calendar className="h-3 w-3" />
                        <span data-testid={`text-date-${patient.id}`}>
                          {format(new Date(patient.admitDate), "dd MMM yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Home className="h-3 w-3" />
                        <span data-testid={`text-package-${patient.id}`}>{patient.packageType}</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1" data-testid={`text-condition-${patient.id}`}>
                      {patient.condition}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
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
                    <div className="flex items-center pl-1">
                      <ChevronRight className="h-5 w-5 text-muted-foreground/40 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
