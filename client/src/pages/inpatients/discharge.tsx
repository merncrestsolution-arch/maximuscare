import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useInPatient, useCreateInPatientDischarge, useInPatientDischargeSummary } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { clinicTodayString } from "@/lib/utils";
import { getDueDisplay } from "@/lib/paymentStatus";

function formatLkr(amount: number) {
  return amount.toLocaleString("en-LK", { minimumFractionDigits: 2 });
}

export default function DischargeInPatientPage() {
  const [, params] = useRoute("/inpatients/:id/discharge");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const admissionId = params?.id || "";

  const { data: patient, isLoading: patientLoading } = useInPatient(admissionId);
  const [dischargeDate, setDischargeDate] = useState(clinicTodayString());
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useInPatientDischargeSummary(
    admissionId,
    dischargeDate,
  );
  const createDischarge = useCreateInPatientDischarge();

  const isAdminMD = user?.role === "Admin" || user?.role === "MD";

  const [nowPaying, setNowPaying] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(clinicTodayString());
  const [notes, setNotes] = useState("");

  const dueDisplay = getDueDisplay(summary?.due ?? 0);
  const finalDue = (summary?.due ?? 0) - (parseFloat(nowPaying) || 0);
  const finalDueDisplay = getDueDisplay(finalDue);

  const handleDischarge = async () => {
    if (!patient) return;

    try {
      await createDischarge.mutateAsync({
        admissionId,
        data: {
          dischargeDate,
          nowPaying: parseFloat(nowPaying) || 0,
          paymentMethod,
          paymentDate,
          notes: notes.trim() || undefined,
        },
      });
      toast({ title: "Success", description: "Patient discharged successfully" });
      setLocation(`/inpatients/${admissionId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to discharge patient",
        variant: "destructive",
      });
    }
  };

  const isLoading = patientLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="text-red-600" data-testid="error-message">Patient not found</div>
        <Button className="mt-4" onClick={() => setLocation("/inpatients")}>Back</Button>
      </div>
    );
  }

  if (patient.status === "Discharged") {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-[720px] mx-auto">
          <div className="text-red-600 mb-4" data-testid="error-message">
            Patient has already been discharged.
          </div>
          <Button onClick={() => setLocation(`/inpatients/${admissionId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </div>
      </div>
    );
  }

  if (!isAdminMD) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-[720px] mx-auto">
          <div className="text-red-600 mb-4" data-testid="error-message">
            Only Admin or MD can discharge patients.
          </div>
          <Button onClick={() => setLocation(`/inpatients/${admissionId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-[720px] mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/inpatients/${admissionId}`)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-[#105691]" data-testid="page-title">Discharge Summary</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-patient-name">{patient.patientName}</p>
          </div>
        </div>

        <div className="bg-[#EEF5FB] rounded-lg p-4 mb-6 text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">Admitted:</span>{" "}
            {format(new Date(patient.admitDate), "dd MMM yyyy")}
          </div>
          <div>
            <span className="text-muted-foreground">Package:</span> {patient.packageType}
          </div>
          <div>
            <span className="text-muted-foreground">Rate:</span> LKR {patient.amountPerDay}/day
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="dischargeDate">Discharge Date *</Label>
            <Input
              id="dischargeDate"
              type="date"
              value={dischargeDate}
              onChange={(e) => {
                setDischargeDate(e.target.value);
                void refetchSummary();
              }}
              className="h-12"
              data-testid="input-discharge-date"
            />
          </div>
          <div className="space-y-2">
            <Label>Stay Days</Label>
            <Input
              readOnly
              value={summary?.totalDays ?? 1}
              className="h-12 bg-muted"
              data-testid="input-days-count"
            />
          </div>
        </div>

        {/* Bill Breakdown */}
        <section className="mb-6">
          <h3 className="text-[#105691] text-sm font-bold border-b-2 border-[#EEF5FB] pb-2 mb-3">
            Bill Breakdown
          </h3>
          <div className="overflow-x-auto rounded-lg border border-[#EEF5FB]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#105691] text-white">
                  <th className="p-2.5 text-left">Description</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Rate</th>
                  <th className="p-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.billLines ?? []).map((line: any, index: number) => (
                  <tr key={index} className="border-b border-[#EEF5FB]">
                    <td className="p-2.5 text-slate-700">{line.description}</td>
                    <td className="p-2.5 text-center text-slate-400">{line.quantity}</td>
                    <td className="p-2.5 text-right text-slate-400">
                      {line.rate != null ? formatLkr(Number(line.rate)) : "-"}
                    </td>
                    <td
                      className={`p-2.5 text-right font-semibold ${
                        line.amount < 0 ? "text-red-600" : "text-[#105691]"
                      }`}
                    >
                      {line.amount < 0 ? "-" : ""}LKR {formatLkr(Math.abs(line.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#EEF5FB]">
                  <td colSpan={3} className="p-2.5 text-right font-bold text-[#105691]">
                    Total Bill
                  </td>
                  <td className="p-2.5 text-right font-extrabold text-[#105691]" data-testid="text-grand-total">
                    LKR {formatLkr(summary?.totalBill ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400" data-testid="text-stay-summary">
            Stay: {format(new Date(patient.admitDate), "dd MMM yyyy")} → Today ({summary?.totalDays ?? 0} days)
          </p>
        </section>

        {/* Payment History */}
        <section className="mb-6">
          <h3 className="text-[#105691] text-sm font-bold border-b-2 border-[#EEF5FB] pb-2 mb-3">
            Payment History
          </h3>
          {(summary?.payments ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No payments recorded yet.</p>
          ) : (
            <>
              {(summary?.payments ?? []).map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex justify-between items-center py-2 border-b border-[#EEF5FB]"
                  data-testid={`payment-history-${payment.id}`}
                >
                  <div>
                    <span className="text-sm text-slate-700">{format(new Date(payment.date), "dd MMM yyyy")}</span>
                    <span className="text-xs text-slate-400 ml-2">{payment.method}</span>
                  </div>
                  <span className="font-bold text-[#16A34A] text-sm tabular-nums">
                    + LKR {formatLkr(payment.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-[#EEF5FB]">
                <span className="font-bold text-[#16A34A]">Total Paid</span>
                <span className="font-extrabold text-[#16A34A] text-base tabular-nums" data-testid="text-total-paid">
                  LKR {formatLkr(summary?.totalPaid ?? 0)}
                </span>
              </div>
            </>
          )}

          <div
            className="flex justify-between items-center rounded-lg border px-4 py-3 mt-3"
            style={{ backgroundColor: dueDisplay.bgColour, borderColor: dueDisplay.colour }}
          >
            <span className="font-semibold text-slate-700">{dueDisplay.label}</span>
            <span className="font-extrabold text-base tabular-nums" style={{ color: dueDisplay.colour }}>
              {dueDisplay.value}
            </span>
          </div>
        </section>

        {/* Final Payment */}
        <section className="mb-6 rounded-xl border border-[#D6E8F5] bg-[#F8FBFE] p-4">
          <h3 className="text-[#105691] text-sm font-bold mb-4">Final Payment at Discharge</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nowPaying">Now Paying (LKR)</Label>
              <Input
                id="nowPaying"
                type="number"
                min="0"
                value={nowPaying}
                onChange={(e) => setNowPaying(e.target.value)}
                placeholder="Enter amount..."
                className="h-12 font-semibold text-[#105691]"
                data-testid="input-now-paying"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-12" data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-12"
                data-testid="input-payment-date"
              />
            </div>
          </div>

          {nowPaying && Number(nowPaying) > 0 && (
            <div
              className="flex justify-between items-center rounded-lg border px-4 py-3 mt-3"
              style={{ backgroundColor: finalDueDisplay.bgColour, borderColor: finalDueDisplay.colour }}
            >
              <span className="text-sm text-slate-700">Balance after this payment</span>
              <span className="font-extrabold tabular-nums" style={{ color: finalDueDisplay.colour }}>
                {finalDueDisplay.value}
              </span>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              data-testid="input-notes"
            />
          </div>
        </section>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 border-2 border-[#105691] text-[#105691]"
            onClick={() => setLocation(`/inpatients/${admissionId}`)}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 h-12 bg-[#F45627] hover:bg-[#F45627]/90 text-white font-bold"
            disabled={createDischarge.isPending}
            onClick={handleDischarge}
            data-testid="button-discharge"
          >
            {createDischarge.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Process Payment & Discharge
          </Button>
        </div>
      </div>
    </div>
  );
}
