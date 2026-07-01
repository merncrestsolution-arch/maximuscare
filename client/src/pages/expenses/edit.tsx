import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { useExpense, useUpdateExpense } from "@/hooks/useData";
import { EDIT_PAGE_ROOT } from "@/lib/editPageShell";
import { SaveStatus } from "@/components/ui/save-status";
import { useSavedIndicator } from "@/hooks/useSavedIndicator";

const EXPENSE_CATEGORIES_ADMIN = ['Travel', 'Clinic things', 'Salary', 'Bill', 'Rent', 'Food', 'Patient expenses', 'Others'];
const PAYMENT_MODES = ['Cash', 'Online'];

export default function EditExpensePage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: expense, isLoading } = useExpense(params.id || '', true);
  const updateExpense = useUpdateExpense();
  const saved = useSavedIndicator(updateExpense.isSuccess);

  const isManagement = user ? ['Admin', 'MD'].includes(user.role) : false;

  const [form, setForm] = useState({
    expenseDate: '',
    category: '',
    description: '',
    amount: '',
    paymentMode: 'Cash',
  });

  useEffect(() => {
    if (expense) {
      setForm({
        expenseDate: expense.expenseDate || '',
        category: expense.category || '',
        description: expense.description || '',
        amount: expense.amount || '',
        paymentMode: expense.paymentMode || 'Cash',
      });
    }
  }, [expense]);

  if (!isManagement) {
    return (
      <div className={`${EDIT_PAGE_ROOT} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-black">Access Denied</h2>
          <p className="text-black/70 mt-2">Only Admin and MD can edit expenses.</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${EDIT_PAGE_ROOT} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-black/40" />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className={`${EDIT_PAGE_ROOT} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-black">Expense Not Found</h2>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!form.category || !form.amount) {
      toast({ title: "Please fill category and amount", variant: "destructive" });
      return;
    }

    try {
      await updateExpense.mutateAsync({
        id: params.id!,
        data: {
          expenseDate: form.expenseDate,
          category: form.category,
          description: form.description || null,
          amount: form.amount,
          paymentMode: form.paymentMode,
        },
      });
      toast({ title: "Expense updated successfully" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: error?.message || "Failed to update expense", variant: "destructive" });
    }
  };

  return (
    <div className={EDIT_PAGE_ROOT}>
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5 text-black" />
        </Button>
        <h1 className="text-xl font-semibold text-black">Edit Expense</h1>
      </div>

      <div className="p-4 space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-black">Date</Label>
          <Input
            type="date"
            value={form.expenseDate}
            onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
            className="w-full h-12 text-base bg-white border-gray-300"
            data-testid="input-expense-date"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-black">Category</Label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full h-12 px-3 text-base bg-white border border-gray-300 rounded-md"
            data-testid="select-expense-category"
          >
            <option value="">Select category</option>
            {EXPENSE_CATEGORIES_ADMIN.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-black">Description (optional)</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Enter description"
            className="w-full min-h-[100px] text-base bg-white border-gray-300"
            data-testid="input-expense-description"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-black">Amount (LKR)</Label>
          <Input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="Enter amount"
            className="w-full h-12 text-lg font-medium bg-white border-gray-300"
            data-testid="input-expense-amount"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-black">Payment Mode</Label>
          <div className="flex gap-2">
            {PAYMENT_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setForm({ ...form, paymentMode: mode })}
                className={`flex-1 h-12 rounded-md border text-base font-medium transition-colors ${
                  form.paymentMode === mode
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-gray-300'
                }`}
                data-testid={`button-payment-${mode.toLowerCase()}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 space-y-2 z-10">
        <SaveStatus isSaving={updateExpense.isPending} saved={saved} />
        <Button
          onClick={handleSubmit}
          disabled={updateExpense.isPending}
          className="w-full h-12 text-base font-medium"
          data-testid="button-save-expense"
        >
          {updateExpense.isPending ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="w-full h-10 text-base text-black/70"
          data-testid="button-cancel"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
