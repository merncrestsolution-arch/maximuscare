import { useEffect, useState } from "react";
import { Link } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canManageSalary } from "@/lib/permissions";
import { useStaffFines, useStaff, useCreateStaffFine, useUpdateStaffFine, useDeleteStaffFine } from "@/hooks/useData";
import { salaryApi } from "@/lib/api";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import { ReportDataTable } from "@/components/reports/report-data-table";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import { formatLkr, getDateRangeForPreset, type DatePreset } from "@/lib/reportDatePresets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

const FINE_TYPES = ["Manual Fine", "Auto Fine", "Attendance Fine", "Disciplinary Fine", "Other Fine"];

const emptyForm = { staffId: "", fineDate: "", amount: "500", reason: "", fineType: "Manual Fine", remarks: "" };

function SalaryFinesContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<DatePreset>("currentMonth");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const r = getDateRangeForPreset(preset, startDate, endDate);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
  }, [preset]);

  const { data: rows = [], isLoading, error } = useStaffFines({ startDate, endDate });
  const { data: staffList } = useStaff();
  const createFine = useCreateStaffFine();
  const updateFine = useUpdateStaffFine();
  const deleteFine = useDeleteStaffFine();

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({
      staffId: row.staffId,
      fineDate: row.fineDate,
      amount: String(row.amount ?? "500"),
      reason: row.reason ?? "",
      fineType: row.fineType || "Manual Fine",
      remarks: row.remarks ?? "",
    });
    setOpen(true);
  };

  const saveFine = () => {
    if (!form.staffId || !form.fineDate || !form.reason.trim()) {
      toast({ title: "Missing fields", description: "Staff, date, and reason are required.", variant: "destructive" });
      return;
    }
    const staff = (staffList ?? []).find((s: any) => s.id === form.staffId);
    const payload = {
      ...form,
      staffName: staff?.name ?? "",
      reason: form.reason.trim(),
      source: "manual",
      fineType: form.fineType,
    };

    if (editingId) {
      updateFine.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            setOpen(false);
            toast({ title: "Fine updated" });
          },
          onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
        }
      );
      return;
    }

    createFine.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        toast({ title: "Fine created" });
      },
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  const waive = async (id: string) => {
    await salaryApi.waiveFine(id);
    qc.invalidateQueries({ queryKey: ["staff-fines"] });
    toast({ title: "Fine waived" });
  };

  const removeFine = (id: string) => {
    if (!confirm("Delete this fine record?")) return;
    deleteFine.mutate(id, {
      onSuccess: () => toast({ title: "Fine deleted" }),
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    });
  };

  return (
    <ReportPageShell
      title="Fine Management"
      loading={isLoading}
      error={error as Error | null}
      filters={
        <div className="space-y-3">
          <div className="flex gap-2">
            <Link href="/salary"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
            <Button onClick={openCreate}>Add Fine</Button>
          </div>
          <ReportDateFilters preset={preset} onPresetChange={setPreset} startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} />
        </div>
      }
    >
      <ReportDataTable
        columns={[
          { key: "fineDate", label: "Date" },
          { key: "staffName", label: "Staff" },
          { key: "fineType", label: "Type", render: (r) => r.fineType || (r.source === "auto_no_session" ? "Auto Fine" : "Manual Fine") },
          { key: "amount", label: "Amount", render: (r) => formatLkr(Number(r.amount)) },
          { key: "reason", label: "Reason" },
          { key: "createdByName", label: "Created By" },
          { key: "status", label: "Status", render: (r) => r.status || "active" },
          {
            key: "actions",
            label: "",
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.source !== "auto_no_session" && r.status !== "waived" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeFine(r.id)}>Delete</Button>
                  </>
                )}
                {r.status !== "waived" && (
                  <Button size="sm" variant="outline" onClick={() => waive(r.id)}>Waive</Button>
                )}
              </div>
            ),
          },
        ]}
        rows={rows}
        searchKeys={["staffName", "reason"]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Fine" : "Create Fine"}</DialogTitle></DialogHeader>
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
            <div><Label>Date</Label><Input type="date" value={form.fineDate} onChange={(e) => setForm({ ...form, fineDate: e.target.value })} /></div>
            <div><Label>Amount</Label><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.fineType} onValueChange={(v) => setForm({ ...form, fineType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FINE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <div><Label>Remarks</Label><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button
              onClick={saveFine}
              disabled={createFine.isPending || updateFine.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReportPageShell>
  );
}

export default function SalaryFinesPage() {
  return (
    <RoleProtectedRoute allowed={canManageSalary}>
      <SalaryFinesContent />
    </RoleProtectedRoute>
  );
}
