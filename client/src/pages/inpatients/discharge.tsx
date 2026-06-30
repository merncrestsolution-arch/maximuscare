import { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useInPatient, useCreateInPatientDischarge, useInPatientPaymentTotal, useInPatientExtraExpenseTotal } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import type { OtherCharge } from "@/lib/types";

export default function DischargeInPatientPage() {
  const [, params] = useRoute("/inpatients/:id/discharge");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const admissionId = params?.id || "";

  const { data: patient, isLoading } = useInPatient(admissionId);
  const { data: paymentTotalData } = useInPatientPaymentTotal(admissionId);
  const { data: extraExpenseTotalData } = useInPatientExtraExpenseTotal(admissionId);
  const createDischarge = useCreateInPatientDischarge();

  const isAdminMD = user?.role === "Admin" || user?.role === "MD";

  const [dischargeDate, setDischargeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [daysCount, setDaysCount] = useState(1);
  const [amountPerDay, setAmountPerDay] = useState("");
  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([]);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Online">("Cash");
  const [notes, setNotes] = useState("");
  // Bug 3: deduction on the discharge bill. Pre-filled from any deduction already
  // applied on the admission so it carries over, but editable here before discharge.
  const [deductionType, setDeductionType] = useState<"fixed" | "percentage">("fixed");
  const [deductionValue, setDeductionValue] = useState("");
  const [deductionReason, setDeductionReason] = useState("");
  const [deductionPrefilled, setDeductionPrefilled] = useState(false);

  useEffect(() => {
    if (patient) {
      setAmountPerDay(patient.amountPerDay);
      const admitDate = new Date(patient.admitDate);
      const discharge = new Date(dischargeDate);
      const days = differenceInDays(discharge, admitDate) + 1;
      setDaysCount(Math.max(1, days));
    }
  }, [patient, dischargeDate]);

  useEffect(() => {
    if (patient && !deductionPrefilled) {
      const t = (patient as any).deductionType as "fixed" | "percentage" | null;
      const v = parseFloat((patient as any).deductionValue ?? "0") || 0;
      if (t && v > 0) {
        setDeductionType(t);
        setDeductionValue(String(v));
        setDeductionReason((patient as any).deductionReason || "");
      }
      setDeductionPrefilled(true);
    }
  }, [patient, deductionPrefilled]);

  useEffect(() => {
    if (paymentTotalData && !amountPaid) {
      setAmountPaid(String(paymentTotalData.total || 0));
    }
  }, [paymentTotalData, amountPaid]);

  const calculations = useMemo(() => {
    const perDay = parseFloat(amountPerDay) || 0;
    const stayAmount = perDay * daysCount;
    const caretakerRate = parseFloat(patient?.careTakerRatePerDay || "0") || 0;
    const caretakerDays = patient?.careTakerDaysOverride || daysCount;
    const caretakerTotal = caretakerRate * caretakerDays;
    const otherTotal = otherCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0) + (extraExpenseTotalData?.total || 0);
    const subtotal = stayAmount + caretakerTotal + otherTotal;
    const dValue = parseFloat(deductionValue) || 0;
    const deductionAmount =
      dValue > 0
        ? deductionType === "percentage"
          ? Math.min(subtotal, subtotal * (dValue / 100))
          : Math.min(subtotal, dValue)
        : 0;
    const grandTotal = subtotal - deductionAmount;
    const paid = parseFloat(amountPaid) || 0;
    const balance = grandTotal - paid;
    const paymentStatus = balance <= 0 ? "Paid" : "Unpaid";

    return { stayAmount, caretakerTotal, otherTotal, subtotal, deductionAmount, grandTotal, balance, paymentStatus };
  }, [amountPerDay, daysCount, otherCharges, amountPaid, patient, extraExpenseTotalData, deductionValue, deductionType]);

  const addOtherCharge = () => {
    setOtherCharges(prev => [...prev, { label: "", amount: 0 }]);
  };

  const updateOtherCharge = (index: number, field: keyof OtherCharge, value: string | number) => {
    setOtherCharges(prev => prev.map((charge, i) => 
      i === index ? { ...charge, [field]: value } : charge
    ));
  };

  const removeOtherCharge = (index: number) => {
    setOtherCharges(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patient) return;

    try {
      await createDischarge.mutateAsync({
        admissionId,
        data: {
          dischargeDate,
          daysCount,
          amountPerDay,
          stayAmount: calculations.stayAmount.toFixed(2),
          otherAmounts: JSON.stringify(otherCharges),
          otherTotal: calculations.otherTotal.toFixed(2),
          deductionType: calculations.deductionAmount > 0 ? deductionType : null,
          deductionValue: (parseFloat(deductionValue) || 0).toFixed(2),
          deductionAmount: calculations.deductionAmount.toFixed(2),
          deductionReason: calculations.deductionAmount > 0 ? (deductionReason.trim() || null) : null,
          grandTotal: calculations.grandTotal.toFixed(2),
          amountPaid: amountPaid || "0",
          balance: calculations.balance.toFixed(2),
          paymentStatus: calculations.paymentStatus as "Paid" | "Unpaid",
          paymentMode,
          notes: notes || undefined,
        },
      });
      toast({ title: "Success", description: "Patient discharged successfully" });
      setLocation(`/inpatients/${admissionId}`);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to discharge patient",
        variant: "destructive"
      });
    }
  };

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
            <h1 className="text-xl font-bold text-foreground" data-testid="page-title">Discharge Patient</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-patient-name">{patient.patientName}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Admitted:</span> {format(new Date(patient.admitDate), "dd MMM yyyy")}</div>
            <div><span className="text-muted-foreground">Package:</span> {patient.packageType}</div>
            <div><span className="text-muted-foreground">Original Rate:</span> LKR {patient.amountPerDay}/day</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dischargeDate">Discharge Date *</Label>
              <Input
                id="dischargeDate"
                type="date"
                value={dischargeDate}
                onChange={(e) => setDischargeDate(e.target.value)}
                className="h-12"
                data-testid="input-discharge-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daysCount">Days Count *</Label>
              <Input
                id="daysCount"
                type="number"
                min="1"
                value={daysCount}
                onChange={(e) => setDaysCount(parseInt(e.target.value) || 1)}
                className="h-12"
                data-testid="input-days-count"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountPerDay">Amount Per Day (LKR) *</Label>
            <Input
              id="amountPerDay"
              type="number"
              value={amountPerDay}
              onChange={(e) => setAmountPerDay(e.target.value)}
              className="h-12"
              disabled={!isAdminMD}
              data-testid="input-amount-per-day"
            />
            {!isAdminMD && (
              <p className="text-xs text-muted-foreground">Only Admin/MD can modify the rate</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Other Charges</Label>
              <Button type="button" variant="outline" size="sm" onClick={addOtherCharge} data-testid="button-add-charge">
                <Plus className="h-4 w-4 mr-1" />
                Add Charge
              </Button>
            </div>
            {otherCharges.map((charge, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Label (e.g., Medicine)"
                  value={charge.label}
                  onChange={(e) => updateOtherCharge(index, "label", e.target.value)}
                  className="flex-1 h-10"
                  data-testid={`input-charge-label-${index}`}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={charge.amount || ""}
                  onChange={(e) => updateOtherCharge(index, "amount", parseFloat(e.target.value) || 0)}
                  className="w-32 h-10"
                  data-testid={`input-charge-amount-${index}`}
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removeOtherCharge(index)}
                  data-testid={`button-remove-charge-${index}`}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>

          {/* Bug 3: deduction (discount/adjustment) applied against the bill subtotal. */}
          <div className="space-y-3 rounded-lg border border-border/60 p-4">
            <Label>Deduction (optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Type</span>
                <Select value={deductionType} onValueChange={(v) => setDeductionType(v as "fixed" | "percentage")}>
                  <SelectTrigger className="h-11" data-testid="select-deduction-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed amount (LKR)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {deductionType === "percentage" ? "Percentage (%)" : "Amount (LKR)"}
                </span>
                <Input
                  type="number"
                  min="0"
                  value={deductionValue}
                  onChange={(e) => setDeductionValue(e.target.value)}
                  placeholder={deductionType === "percentage" ? "e.g. 10" : "e.g. 500"}
                  className="h-11"
                  data-testid="input-deduction-value"
                />
              </div>
            </div>
            <Input
              value={deductionReason}
              onChange={(e) => setDeductionReason(e.target.value)}
              placeholder="Reason (optional, e.g. goodwill discount)"
              className="h-11"
              data-testid="input-deduction-reason"
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Stay Amount ({daysCount} days x LKR {amountPerDay}):</span>
              <span className="font-medium" data-testid="text-stay-amount">LKR {calculations.stayAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Caretaker Charges:</span>
              <span className="font-medium" data-testid="text-caretaker-total">LKR {calculations.caretakerTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Other Charges:</span>
              <span className="font-medium" data-testid="text-other-total">LKR {calculations.otherTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2 mt-2">
              <span>Subtotal:</span>
              <span className="font-medium" data-testid="text-subtotal">LKR {calculations.subtotal.toFixed(2)}</span>
            </div>
            {calculations.deductionAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span>
                  Deduction{deductionType === "percentage" ? ` (${parseFloat(deductionValue) || 0}%)` : ""}:
                </span>
                <span className="font-medium text-red-600" data-testid="text-deduction">- LKR {calculations.deductionAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2 mt-2">
              <span>Grand Total:</span>
              <span data-testid="text-grand-total">LKR {calculations.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountPaid">Amount Paid (LKR)</Label>
              <Input
                id="amountPaid"
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0"
                className="h-12"
                data-testid="input-amount-paid"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMode">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as "Cash" | "Online")}>
                <SelectTrigger className="h-12" data-testid="select-payment-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-gray-100 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span>Balance:</span>
              <span className={`font-bold ${calculations.balance > 0 ? "text-red-600" : "text-green-700"}`} data-testid="text-balance">
                LKR {calculations.balance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Payment Status:</span>
              <span className={`px-2 py-0.5 rounded text-sm ${
                calculations.paymentStatus === "Paid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`} data-testid="text-payment-status">
                {calculations.paymentStatus}
              </span>
            </div>
          </div>

          <div className="space-y-2">
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

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setLocation(`/inpatients/${admissionId}`)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12"
              disabled={createDischarge.isPending}
              data-testid="button-discharge"
            >
              {createDischarge.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Complete Discharge
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
