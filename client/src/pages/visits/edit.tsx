import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/auth-context";
import { useVisit, useUpdateVisit, usePatient, useStaff } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EDIT_PAGE_ROOT } from "@/lib/editPageShell";

export default function EditVisit() {
  const [match, params] = useRoute("/visits/edit/:id");
  const [location, setLocation] = useLocation();

  const { user } = useAuth();
  const { data: visit, isLoading: loadingVisit, error: visitError } = useVisit(params?.id || "");
  const { data: patient } = usePatient(visit?.patientId || "");
  const { data: staff = [] } = useStaff();
  const updateVisitMutation = useUpdateVisit();
  const { toast } = useToast();

  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (visit && !formData) {
      setFormData({ ...visit });
    }
  }, [visit]);

  const isManagement = ['Admin', 'MD'].includes(user?.role || '');

  const pageBleed = EDIT_PAGE_ROOT;

  if (loadingVisit) {
    return (
      <div className={`${pageBleed} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-black/40" />
      </div>
    );
  }

  if (visitError || !visit) {
    return (
      <div className={`${pageBleed} p-4 pt-6`}>
        <Alert variant="destructive">
          <AlertDescription>
            {visitError ? `Failed to load visit: ${visitError instanceof Error ? visitError.message : 'Unknown error'}` : 'Visit not found'}
          </AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => setLocation('/patients')} data-testid="button-back-patients">Back to Patients</Button>
      </div>
    );
  }

  const canEditVisit =
    !!user &&
    (isManagement ||
      visit.treatingStaffId === user.id ||
      visit.createdByStaffId === user.id);

  if (!canEditVisit) {
    return (
      <div className={`${pageBleed} p-8 text-center space-y-4`}>
        <h2 className="text-xl font-bold text-red-600" data-testid="text-access-denied">Access Denied</h2>
        <p className="text-black/80">You can only edit visits you created or are assigned as treating staff. Ask an Admin or MD for other changes.</p>
        <Button onClick={() => window.history.back()} data-testid="button-go-back">Go Back</Button>
      </div>
    );
  }

  if (!formData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const treatingStaff = staff.find(s => s.id === formData.treatingStaffId);

      await updateVisitMutation.mutateAsync({
        id: visit.id,
        data: {
          visitDate: formData.visitDate,
          treatingStaffId: formData.treatingStaffId,
          treatingStaffName: treatingStaff?.name || formData.treatingStaffName,
          sessionNumber: parseInt(formData.sessionNumber) || 1,
          condition: formData.condition,
          treatment: formData.treatment,
          improvements: formData.improvements?.trim() || null,
          visitType: formData.visitType,
          branch: formData.branch,
          status: formData.status,
          startTime: formData.startTime,
          endTime: formData.endTime,
          paymentAmount: formData.paymentAmount || "0",
          paymentStatus: formData.paymentStatus,
          paymentMode: formData.paymentMode,
          notes: formData.notes?.trim() || null,
        }
      });

      toast({
        title: "Visit Updated",
        description: "Changes saved successfully.",
      });

      setLocation(`/patients/${formData.patientId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update visit",
        variant: "destructive",
      });
    }
  };

  const patientName = patient?.name || visit.patientId;

  return (
    <div className={`${pageBleed} pb-28 md:pb-10`}>
      <div className="mx-auto max-w-[720px]">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white py-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="-ml-2 h-10 w-10" data-testid="button-back-edit-visit">
            <ArrowLeft className="h-6 w-6 text-black" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-black" data-testid="text-edit-visit-title">Edit Visit</h1>
            <div className="text-sm text-black/70 truncate" data-testid="text-edit-visit-patient">
              {patientName} &middot; {format(new Date(visit.visitDate), 'dd MMM yyyy')}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          <div className="space-y-5">
            <h3 className="text-base font-bold text-black border-b border-gray-200 pb-2">Visit Details</h3>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-black">Visit Date</Label>
              <Input
                type="date"
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={formData.visitDate}
                onChange={(e) => setFormData({...formData, visitDate: e.target.value})}
                data-testid="input-edit-visit-date"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-black">Treating Staff</Label>
              {isManagement ? (
                <Select
                  value={formData.treatingStaffId}
                  onValueChange={(v) => setFormData({ ...formData, treatingStaffId: v })}
                >
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-edit-visit-staff">
                    <SelectValue placeholder="Select Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="py-3 text-base" data-testid={`option-staff-${s.id}`}>
                        {s.name} ({s.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div
                  className="h-12 flex items-center px-3 rounded-md border border-gray-300 bg-white text-base text-black"
                  data-testid="text-edit-visit-staff-readonly"
                >
                  {formData.treatingStaffName || "—"}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Session #</Label>
                <Input
                  type="number"
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={formData.sessionNumber}
                  onChange={(e) => setFormData({...formData, sessionNumber: e.target.value})}
                  data-testid="input-edit-visit-session"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Visit Type</Label>
                <Select value={formData.visitType} onValueChange={(v) => setFormData({...formData, visitType: v})}>
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-edit-visit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Clinic">Clinic</SelectItem>
                    <SelectItem value="Home">Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-black">Branch</Label>
              <Select value={formData.branch} onValueChange={(v) => setFormData({...formData, branch: v})}>
                <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-edit-visit-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Colombo">Colombo</SelectItem>
                  <SelectItem value="Bandaragama">Bandaragama</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Start Time</Label>
                <Input
                  type="time"
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  data-testid="input-edit-visit-start"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">End Time</Label>
                <Input
                  type="time"
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  data-testid="input-edit-visit-end"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-black">Condition</Label>
              <Input
                className="h-12 text-base bg-white border-gray-300 text-black"
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
                data-testid="input-edit-visit-condition"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-black">Treatment Provided</Label>
              <Textarea
                value={formData.treatment}
                onChange={(e) => setFormData({...formData, treatment: e.target.value})}
                className="min-h-[100px] text-base bg-white border-gray-300 text-black p-3 leading-relaxed"
                data-testid="input-edit-visit-treatment"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-black">Improvements</Label>
              <Textarea
                placeholder="e.g. pain reduced, mobility improved..."
                value={formData.improvements || ""}
                onChange={(e) => setFormData({...formData, improvements: e.target.value})}
                className="min-h-[80px] text-base bg-white border-gray-300 text-black p-3 leading-relaxed"
                data-testid="input-edit-visit-improvements"
              />
            </div>
          </div>

          <div className="space-y-5">
            <h3 className="text-base font-bold text-black border-b border-gray-200 pb-2">Status & Payment</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-edit-visit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Finished">Finished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Amount (LKR)</Label>
                <Input
                  type="number"
                  className="h-12 text-base bg-white border-gray-300 text-black"
                  value={formData.paymentAmount}
                  onChange={(e) => setFormData({...formData, paymentAmount: e.target.value})}
                  data-testid="input-edit-visit-amount"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Payment</Label>
                <Select value={formData.paymentStatus} onValueChange={(v) => setFormData({...formData, paymentStatus: v})}>
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-edit-visit-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-black">Mode</Label>
                <Select value={formData.paymentMode} onValueChange={(v) => setFormData({...formData, paymentMode: v})}>
                  <SelectTrigger className="h-12 text-base bg-white border-gray-300 text-black" data-testid="select-edit-visit-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-black">Notes</Label>
              <Textarea
                placeholder="Optional notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="min-h-[80px] text-base bg-white border-gray-300 text-black p-3 leading-relaxed"
                data-testid="input-edit-visit-notes"
              />
            </div>
          </div>
        </form>

        <div
          className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:static md:z-auto md:mt-4 md:rounded-xl md:border md:shadow-sm"
        >
          <div className="mx-auto flex max-w-[720px] gap-3 p-4 md:justify-end md:px-5 md:pt-4 md:pb-0">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 border-gray-300 text-base font-semibold md:h-10 md:flex-none md:min-w-[7rem] md:text-sm"
              onClick={() => window.history.back()}
              data-testid="button-cancel-edit-visit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-12 flex-1 text-base font-semibold md:h-10 md:flex-none md:min-w-[8rem] md:text-sm"
              onClick={handleSubmit}
              disabled={updateVisitMutation.isPending}
              data-testid="button-save-edit-visit"
            >
              {updateVisitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
