import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { useCreateExpense } from "@/hooks/useData";

const EXPENSE_CATEGORIES_ADMIN = ['Travel', 'Clinic things', 'Salary', 'Bill', 'Rent', 'Food', 'Patient expenses', 'Others'];
const EXPENSE_CATEGORIES_STAFF = ['Travel', 'Clinic things', 'Bill', 'Food', 'Patient expenses', 'Others'];
const PAYMENT_MODES = ['Cash', 'Online'];

export default function AddExpensePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const createExpense = useCreateExpense();

  const isManagement = user ? ['Admin', 'MD'].includes(user.role) : false;
  const categories = isManagement ? EXPENSE_CATEGORIES_ADMIN : EXPENSE_CATEGORIES_STAFF;

  const [form, setForm] = useState({
    expenseDate: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    paymentMode: 'Cash',
  });

  const handleSubmit = async () => {
    if (!form.category || !form.amount) {
      toast({ title: "Please fill category and amount", variant: "destructive" });
      return;
    }

    try {
      await createExpense.mutateAsync({
        expenseDate: form.expenseDate,
        category: form.category,
        description: form.description || null,
        amount: form.amount,
        paymentMode: form.paymentMode,
      });
      toast({ title: "Expense saved successfully" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: error?.message || "Failed to save expense", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3 z-10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold text-black">Add Expense</h1>
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
            {categories.map((cat) => (
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

        <div className="pt-4 space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={createExpense.isPending}
            className="w-full h-12 text-base font-medium bg-black text-white hover:bg-gray-800"
            data-testid="button-save-expense"
          >
            {createExpense.isPending ? "Saving..." : "Save Expense"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="w-full h-10 text-base text-gray-600"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
