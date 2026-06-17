import { useState } from "react";
import { Link } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canManageSalary } from "@/lib/permissions";
import { useStaffOtEntries, useStaff, useCreateStaffOt } from "@/hooks/useData";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import { ReportDataTable } from "@/components/reports/report-data-table";
import { formatLkr } from "@/lib/reportDatePresets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

function SalaryOtContent() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ staffId: "", otDate: "", hours: "", reason: "" });
  const { data: rows = [], isLoading, error } = useStaffOtEntries();
  const { data: staffList } = useStaff();
  const create = useCreateStaffOt();

  return (
    <ReportPageShell
      title="OT Management"
      loading={isLoading}
      error={error as Error | null}
      filters={
        <div className="flex gap-2 items-center">
          <Link href="/salary"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <Button onClick={() => setOpen(true)}>Add OT Entry</Button>
          <span className="text-sm text-muted-foreground">Rate: Rs.250/hour</span>
        </div>
      }
    >
      <ReportDataTable
        columns={[
          { key: "otDate", label: "Date" },
          { key: "staffName", label: "Staff" },
          { key: "hours", label: "Hours" },
          { key: "amount", label: "Amount", render: (r) => formatLkr(Number(r.amount)) },
          { key: "reason", label: "Reason" },
          { key: "approvedByName", label: "Approved By" },
        ]}
        rows={rows}
        searchKeys={["staffName"]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add OT Entry</DialogTitle></DialogHeader>
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
            <div><Label>Date</Label><Input type="date" value={form.otDate} onChange={(e) => setForm({ ...form, otDate: e.target.value })} /></div>
            <div><Label>Hours</Label><Input type="number" min="0" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
            <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            {form.hours && <p className="text-sm text-muted-foreground">Amount: {formatLkr(Number(form.hours) * 250)}</p>}
          </div>
          <DialogFooter>
            <Button onClick={() => {
              create.mutate(form, {
                onSuccess: () => { setOpen(false); toast({ title: "OT entry added" }); },
                onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
              });
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReportPageShell>
  );
}

export default function SalaryOtPage() {
  return (
    <RoleProtectedRoute allowed={canManageSalary}>
      <SalaryOtContent />
    </RoleProtectedRoute>
  );
}
