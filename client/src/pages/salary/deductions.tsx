import { useState } from "react";
import { Link } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canManageSalary } from "@/lib/permissions";
import { useStaffDeductions, useStaff, useCreateStaffDeduction } from "@/hooks/useData";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import { ReportDataTable } from "@/components/reports/report-data-table";
import { formatLkr } from "@/lib/reportDatePresets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SaveStatus } from "@/components/ui/save-status";
import { useSavedIndicator } from "@/hooks/useSavedIndicator";
import { ArrowLeft } from "lucide-react";

const CATEGORIES = ["Food Charges", "Accommodation Charges", "Transport Charges", "Advance Payments", "Other Deductions"];

function SalaryDeductionsContent() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ staffId: "", category: CATEGORIES[0], amount: "", deductionDate: "", remarks: "" });
  const { data: rows = [], isLoading, error } = useStaffDeductions();
  const { data: staffList } = useStaff();
  const create = useCreateStaffDeduction();
  const saved = useSavedIndicator(create.isSuccess);

  return (
    <ReportPageShell
      title="Deduction Management"
      loading={isLoading}
      error={error as Error | null}
      filters={
        <div className="flex gap-2">
          <Link href="/salary"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <Button onClick={() => setOpen(true)}>Add Deduction</Button>
        </div>
      }
    >
      <ReportDataTable
        columns={[
          { key: "deductionDate", label: "Date" },
          { key: "staffName", label: "Staff" },
          { key: "category", label: "Category" },
          { key: "amount", label: "Amount", render: (r) => formatLkr(Number(r.amount)) },
          { key: "remarks", label: "Remarks" },
          { key: "createdByName", label: "Created By" },
        ]}
        rows={rows}
        searchKeys={["staffName", "category"]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Deduction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Staff</Label>
              <Select value={form.staffId} onValueChange={(v) => setForm({ ...form, staffId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {(staffList ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount</Label><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={form.deductionDate} onChange={(e) => setForm({ ...form, deductionDate: e.target.value })} /></div>
            <div><Label>Remarks</Label><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-3">
            <SaveStatus isSaving={create.isPending} saved={saved} />
            <Button
              onClick={() => {
                create.mutate(form, {
                  onSuccess: () => { setOpen(false); toast({ title: "Deduction added" }); },
                  onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
                });
              }}
              disabled={create.isPending}
            >
              {create.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReportPageShell>
  );
}

export default function SalaryDeductionsPage() {
  return (
    <RoleProtectedRoute allowed={canManageSalary}>
      <SalaryDeductionsContent />
    </RoleProtectedRoute>
  );
}
