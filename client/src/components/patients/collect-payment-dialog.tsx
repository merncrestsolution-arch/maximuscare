import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollectVisitPayment } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { computeOutstanding, isPaidStatus } from "@/lib/paymentStatus";
import { formatLkr } from "@/lib/reportDatePresets";
import { Loader2 } from "lucide-react";

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online Payment", "Other"];

type VisitPaymentTarget = {
  id: string;
  paymentAmount: string | number;
  amountPaid?: string | number;
  paymentStatus?: string;
  patientName?: string;
};

type CollectPaymentDialogProps = {
  visit: VisitPaymentTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function CollectPaymentDialog({ visit, open, onOpenChange, onSuccess }: CollectPaymentDialogProps) {
  const { toast } = useToast();
  const collect = useCollectVisitPayment();
  const total = Number(visit?.paymentAmount ?? 0);
  const alreadyPaid = Number(visit?.amountPaid ?? 0);
  const outstanding = computeOutstanding(total, alreadyPaid);

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [remarks, setRemarks] = useState("");

  const resetForm = () => {
    setAmount(String(outstanding || ""));
    setPaymentMethod("Cash");
    setPaymentReference("");
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setRemarks("");
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && visit) {
      setAmount(String(computeOutstanding(Number(visit.paymentAmount), Number(visit.amountPaid ?? 0))));
    }
    onOpenChange(isOpen);
  };

  if (!visit) return null;

  const handleSubmit = () => {
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (payAmount > outstanding && total > 0) {
      toast({ title: `Amount exceeds outstanding ${formatLkr(outstanding)}`, variant: "destructive" });
      return;
    }
    collect.mutate(
      {
        visitId: visit.id,
        amount: payAmount,
        paymentMethod,
        paymentDate,
        paymentReference: paymentReference || undefined,
        remarks: remarks || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Payment recorded" });
          onOpenChange(false);
          resetForm();
          onSuccess?.();
        },
        onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
        </DialogHeader>
        {visit.patientName && <p className="text-sm text-muted-foreground">{visit.patientName}</p>}
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3">
            <div><div className="text-muted-foreground text-xs">Total</div><div className="font-semibold">{formatLkr(total)}</div></div>
            <div><div className="text-muted-foreground text-xs">Paid</div><div className="font-semibold">{formatLkr(alreadyPaid)}</div></div>
            <div><div className="text-muted-foreground text-xs">Outstanding</div><div className="font-semibold text-amber-700">{formatLkr(outstanding)}</div></div>
          </div>
          {isPaidStatus(visit.paymentStatus) ? (
            <p className="text-emerald-700 font-medium">This visit is fully paid.</p>
          ) : (
            <>
              <div>
                <Label>Amount to pay</Label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setAmount(String(outstanding))}>
                  Pay full outstanding
                </Button>
              </div>
              <div>
                <Label>Payment method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment date</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div>
                <Label>Reference (optional)</Label>
                <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
              </div>
              <div>
                <Label>Remarks (optional)</Label>
                <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!isPaidStatus(visit.paymentStatus) && (
            <Button onClick={handleSubmit} disabled={collect.isPending}>
              {collect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Payment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
