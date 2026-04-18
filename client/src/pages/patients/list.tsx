import { useState } from "react";
import { usePatients, useDeletePatient } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Phone, MapPin, ChevronRight, Loader2, BedDouble, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { isManagementRole } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function PatientsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: patients = [], isLoading, error } = usePatients();
  const deletePatient = useDeletePatient();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const canManage = isManagementRole(user?.role);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.phone.includes(search)
  );

  const handleConfirmDeletePatient = async () => {
    if (!deleteId) return;
    try {
      await deletePatient.mutateAsync(deleteId);
      toast({ title: "Patient deleted", description: "The patient record and related data were removed." });
    } catch (e) {
      toast({
        title: "Could not delete patient",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

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
          Failed to load patients: {error instanceof Error ? error.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        className="w-full h-14 justify-start gap-3 bg-white border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
        onClick={() => setLocation("/inpatients")}
        data-testid="button-inpatients"
      >
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <BedDouble className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-foreground">In-Patients</div>
          <div className="text-xs text-muted-foreground">View admitted patients</div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
      </Button>

      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search patients..." 
            className="pl-9 h-11 bg-card border-border shadow-sm text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Link href="/patients/new">
          <Button size="icon" className="shrink-0 h-11 w-11 shadow-sm" data-testid="button-add-patient">
            <UserPlus className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3 pb-24">
        {filteredPatients.map(patient => (
          <Card
            key={patient.id}
            className="bg-white border border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 active:scale-[0.99] transition-all"
          >
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <Link href={`/patients/${patient.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-12 w-12 shrink-0 border-2 border-background shadow-sm bg-secondary/10 text-secondary-foreground">
                  <AvatarFallback className="font-bold text-lg text-primary">{patient.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="font-bold text-lg text-foreground leading-tight truncate">{patient.name}</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <Phone className="h-3.5 w-3.5" /> {patient.phone}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 px-2 font-medium bg-muted/30 border-border text-foreground/80"
                      data-testid={`badge-patient-branch-${patient.id}`}
                    >
                      {patient.branch}
                    </Badge>
                    {patient.defaultVisitType && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 px-2 font-semibold bg-black text-white"
                        data-testid={`badge-patient-visit-type-${patient.id}`}
                      >
                        {patient.defaultVisitType === 'Clinic' ? 'Clinic Visit' : 'Home Visit'}
                      </Badge>
                    )}
                    {patient.condition && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-5 px-2 font-semibold bg-muted/20 text-foreground"
                        data-testid={`badge-patient-condition-${patient.id}`}
                      >
                        {patient.condition}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <Badge className={`${patient.status === 'Active' ? 'bg-success hover:bg-success/90' : 'bg-muted hover:bg-muted/90'} text-white font-semibold px-2.5`}>
                    {patient.status}
                  </Badge>
                </div>
                {canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        aria-label="Patient actions"
                        onClick={(e) => e.preventDefault()}
                        data-testid={`button-patient-menu-${patient.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocation(`/patients/${patient.id}/edit`)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(patient.id)}
                        data-testid={`menu-delete-patient-${patient.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link href={`/patients/${patient.id}`}>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredPatients.length === 0 && (
           <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
             No patients found matching your search.
           </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this patient?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the patient record, visit history, and linked appointments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeletePatient}
              disabled={deletePatient.isPending}
            >
              {deletePatient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
