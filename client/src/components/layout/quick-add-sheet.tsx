import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, FileText, BedDouble, Stethoscope, LogOut } from "lucide-react";

export function QuickAddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const canAddPatient = useMemo(() => {
    if (!user) return false;
    return ["Admin", "MD", "Receptionist", "Physiotherapist", "Staff"].includes(user.role);
  }, [user]);

  const canAddVisit = useMemo(() => {
    if (!user) return false;
    return ["Admin", "MD", "Receptionist", "Physiotherapist", "Staff"].includes(user.role);
  }, [user]);

  const canAddInPatient = useMemo(() => {
    if (!user) return false;
    return ["Admin", "MD", "Receptionist", "Physiotherapist"].includes(user.role);
  }, [user]);

  const canAddInPatientSession = useMemo(() => {
    if (!user) return false;
    return ["Admin", "MD", "Receptionist", "Physiotherapist"].includes(user.role);
  }, [user]);

  const canDischargeInPatient = useMemo(() => {
    if (!user) return false;
    return ["Admin", "MD"].includes(user.role);
  }, [user]);

  const navigate = (path: string) => {
    onOpenChange(false);
    setLocation(path);
  };

  if (!user) return null;

  const content = (
    <>
      <div className="space-y-4">
        <section>
          <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">Out-Patient</p>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-white border-2 hover:bg-muted/50"
              onClick={() => navigate("/patients/new")}
              disabled={!canAddPatient}
              data-testid="button-quick-add-patient"
            >
              <UserPlus className="h-5 w-5" />
              Add Patient
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-white border-2 hover:bg-muted/50"
              onClick={() => navigate("/visits/new")}
              disabled={!canAddVisit}
              data-testid="button-quick-add-visit"
            >
              <FileText className="h-5 w-5" />
              Add Visit
            </Button>
          </div>
        </section>

        <section>
          <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">In-Patient</p>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-white border-2 hover:bg-muted/50"
              onClick={() => navigate("/inpatients/new")}
              disabled={!canAddInPatient}
              data-testid="button-quick-add-inpatient"
            >
              <BedDouble className="h-5 w-5" />
              Add In-Patient
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-white border-2 hover:bg-muted/50"
              onClick={() => navigate("/inpatients")}
              disabled={!canAddInPatientSession}
              data-testid="button-quick-add-inpatient-session"
            >
              <Stethoscope className="h-5 w-5" />
              Add In-Patient Session
            </Button>
            {canDischargeInPatient && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12 bg-white border-2 hover:bg-muted/50"
                onClick={() => navigate("/inpatients")}
                data-testid="button-quick-discharge-inpatient"
              >
                <LogOut className="h-5 w-5" />
                Discharge In-Patient
              </Button>
            )}
          </div>
        </section>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => onOpenChange(false)}
          data-testid="button-quick-add-close"
        >
          Close
        </Button>
      </div>
    </>
  );

  // Desktop: centered modal dialog
  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-sm !bg-white shadow-2xl border-2 border-border"
          data-testid="sheet-quick-add"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-quick-add-title">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" />
              </span>
              Quick Add
            </DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: bottom sheet
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        overlayClassName="bg-black/30"
        className="z-[60] rounded-t-2xl rounded-b-none border-2 border-t border-x border-border !bg-white shadow-2xl p-0 gap-0 max-h-[85vh] overflow-y-auto safe-area-bottom [&>button]:hidden"
        data-testid="sheet-quick-add"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>
        <SheetHeader className="px-5 pb-4">
          <SheetTitle className="text-lg font-bold flex items-center gap-2" data-testid="text-quick-add-title">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Plus className="h-4 w-4" />
            </span>
            Quick Add
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          {content}
        </div>
      </SheetContent>
    </Sheet>
  );
}
