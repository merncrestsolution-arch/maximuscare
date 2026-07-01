import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { RoleProtectedRoute } from "@/components/auth/role-protected-route";
import { canViewReportsHub } from "@/lib/permissions";
import { useAuth } from "@/context/auth-context";
import { useBranch } from "@/context/branch-context";
import { useBranding } from "@/context/branding-context";
import {
  useSalaryReport,
  useSalaryReportHistory,
  useStaffDirectory,
  useAddSalaryAddition,
  useAddSalaryDecrement,
  useAddSalaryFine,
  useUpdateSalaryDecrement,
  useUpdateStaffDeduction,
} from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getDateRangeForPreset, formatMoney, type DatePreset } from "@/lib/reportDatePresets";
import { canManageFines } from "@/lib/permissions";
import { SaveStatus } from "@/components/ui/save-status";
import { useSavedIndicator } from "@/hooks/useSavedIndicator";
import { Plus, Loader2, Pencil } from "lucide-react";

const lkr = (n: number) => `LKR ${formatMoney(Number(n) || 0)}`;

type AdjustmentType = "addition" | "decrement" | "fine";

type ReportLine = {
  id: string;
  date: string;
  reason: string;
  amount: number;
  source?: "adjustment" | "deduction" | "fine";
  category?: string;
  remarks?: string | null;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function AdjustmentDialog({
  open,
  type,
  staffId,
  onClose,
}: {
  open: boolean;
  type: AdjustmentType;
  staffId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const addAddition = useAddSalaryAddition();
  const addDecrement = useAddSalaryDecrement();
  const addFine = useAddSalaryFine();

  const [date, setDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) {
      setDate(todayStr());
      setReason("");
      setAmount("");
    }
  }, [open]);

  const mutation =
    type === "addition" ? addAddition : type === "decrement" ? addDecrement : addFine;
  const saved = useSavedIndicator(mutation.isSuccess);

  const title =
    type === "addition" ? "Add Addition" : type === "decrement" ? "Add Decrement" : "Add Fine";

  const submit = async () => {
    const numeric = Number(amount);
    if (!date || !reason.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      toast({
        title: "Missing details",
        description: "Date, reason and a positive amount are all required.",
        variant: "destructive",
      });
      return;
    }
    try {
      await mutation.mutateAsync({ staffId, date, reason: reason.trim(), amount: numeric });
      toast({ title: `${title.replace("Add ", "")} recorded` });
      onClose();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="adj-date">Date</Label>
            <Input id="adj-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adj-reason">Reason</Label>
            <Input
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === "addition" ? "Performance bonus" : type === "fine" ? "Late arrival" : "Advance deduction"}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adj-amount">Amount (LKR)</Label>
            <Input
              id="adj-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter className="flex items-center gap-3 sm:justify-between">
          <SaveStatus isSaving={mutation.isPending} saved={saved} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDecrementDialog({
  open,
  staffId,
  line,
  onClose,
}: {
  open: boolean;
  staffId: string;
  line: ReportLine | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const updateAdjustment = useUpdateSalaryDecrement();
  const updateDeduction = useUpdateStaffDeduction();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  const isDeduction = line?.source === "deduction";

  useEffect(() => {
    if (open && line) {
      setDate(line.date);
      setReason(isDeduction ? (line.remarks ?? line.category ?? line.reason) : line.reason);
      setAmount(String(line.amount ?? ""));
    }
  }, [open, line, isDeduction]);

  const submit = async () => {
    const numeric = Number(amount);
    if (!line) return;
    if (!date || !reason.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      toast({
        title: "Missing details",
        description: "Date, reason and a positive amount are all required.",
        variant: "destructive",
      });
      return;
    }
    try {
      if (isDeduction) {
        await updateDeduction.mutateAsync({
          id: line.id,
          data: {
            deductionDate: date,
            remarks: reason.trim(),
            amount: numeric,
            ...(line.category ? { category: line.category } : {}),
          },
        });
      } else {
        await updateAdjustment.mutateAsync({
          staffId,
          adjustmentId: line.id,
          date,
          reason: reason.trim(),
          amount: numeric,
        });
      }
      toast({ title: "Decrement updated" });
      onClose();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update",
        variant: "destructive",
      });
    }
  };

  const pending = updateAdjustment.isPending || updateDeduction.isPending;
  const saved = useSavedIndicator(updateAdjustment.isSuccess || updateDeduction.isSuccess);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Decrement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edit-dec-date">Date</Label>
            <Input id="edit-dec-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-dec-reason">Reason</Label>
            <Input
              id="edit-dec-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Advance deduction"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-dec-amount">Amount (LKR)</Label>
            <Input
              id="edit-dec-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter className="flex items-center gap-3 sm:justify-between">
          <SaveStatus isSaving={pending} saved={saved} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LineSection({
  title,
  sign,
  lines,
  total,
  canManage,
  onAdd,
  addLabel,
  onEdit,
}: {
  title: string;
  sign: "+" | "-";
  lines: ReportLine[];
  total: number;
  canManage: boolean;
  onAdd: () => void;
  addLabel: string;
  onEdit?: (line: ReportLine) => void;
}) {
  return (
    <>
      <tr className="border-t border-border/60">
        <td className="pt-2 text-left font-semibold" colSpan={2}>
          {title} ({sign})
        </td>
      </tr>
      {lines.length === 0 ? (
        <tr>
          <td className="py-1 text-left text-muted-foreground" colSpan={2}>
            None recorded for this period.
          </td>
        </tr>
      ) : (
        lines.map((l) => (
          <tr key={l.id}>
            <td className="py-1 text-left text-muted-foreground">
              {l.date} · {l.reason}
            </td>
            <td className={`py-1 text-right whitespace-nowrap ${sign === "-" ? "text-red-600" : ""}`}>
              <div className="flex items-center justify-end gap-2">
                <span>
                  {sign === "-" ? "-" : ""}
                  {lkr(l.amount)}
                </span>
                {onEdit && canManage && (l.source === "adjustment" || l.source === "deduction") ? (
                  <Button variant="ghost" size="icon" onClick={() => onEdit(l)} aria-label="Edit decrement">
                    <Pencil className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </td>
          </tr>
        ))
      )}
      <tr>
        <td className="py-1 text-left font-medium">{title} Total</td>
        <td className={`py-1 text-right font-medium whitespace-nowrap ${sign === "-" ? "text-red-600" : ""}`}>
          {sign === "-" ? "-" : ""}
          {lkr(total)}
        </td>
      </tr>
      {canManage && (
        <tr>
          <td className="pb-1" colSpan={2}>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd}>
              <Plus className="h-3 w-3 mr-1" /> {addLabel}
            </Button>
          </td>
        </tr>
      )}
    </>
  );
}

function SalaryReportContent() {
  const { user } = useAuth();
  const { selectedBranchName } = useBranch();
  const { logoUri } = useBranding();
  const search = useSearch();

  // Staff / Physiotherapists only ever see their own report; the selector is hidden.
  const isSelfOnly = ["Staff", "Physiotherapist"].includes(user?.role ?? "");
  const canPickStaff = !isSelfOnly;
  const canManageAdjustments = ["Admin", "MD", "Nexus MD"].includes(user?.role ?? "");
  const canManageFinesRole = canManageFines(user?.role, user?.mdCapabilities);

  // Bug L: the staff profile links here pre-filtered with ?staffId=…
  const presetStaffId = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("staffId") ?? "";
  }, [search]);

  const [selectedStaffId, setSelectedStaffId] = useState(
    isSelfOnly ? user?.id ?? "" : presetStaffId
  );
  const [preset, setPreset] = useState<DatePreset>("currentMonth");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitted, setSubmitted] = useState<{ staffId: string; startDate: string; endDate: string } | null>(null);
  const [dialog, setDialog] = useState<AdjustmentType | null>(null);
  const [editLine, setEditLine] = useState<ReportLine | null>(null);

  useEffect(() => {
    const r = getDateRangeForPreset(preset, startDate, endDate);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  // Auto-generate when arriving with a pre-selected staff (from the profile link).
  useEffect(() => {
    if (presetStaffId && !isSelfOnly) setSelectedStaffId(presetStaffId);
  }, [presetStaffId, isSelfOnly]);

  // Clear report when switching branch so stale cross-branch data is not shown.
  useEffect(() => {
    if (!isSelfOnly) {
      setSelectedStaffId("");
      setSubmitted(null);
    }
  }, [selectedBranchName, isSelfOnly]);

  // Live sync: refresh report whenever staff or date range changes.
  useEffect(() => {
    const staffId = isSelfOnly ? user?.id ?? "" : selectedStaffId;
    if (!staffId || !startDate || !endDate) return;
    setSubmitted({ staffId, startDate, endDate });
  }, [selectedStaffId, startDate, endDate, isSelfOnly, user?.id]);

  const { data: staffList = [] } = useStaffDirectory(undefined, canPickStaff);

  const { data: report, isLoading, error } = useSalaryReport(
    submitted?.staffId ?? "",
    { startDate: submitted?.startDate ?? "", endDate: submitted?.endDate ?? "" },
    !!submitted?.staffId && !!submitted?.startDate && !!submitted?.endDate
  );

  const { data: history = [] } = useSalaryReportHistory(
    submitted?.staffId ?? "",
    6,
    !!submitted?.staffId
  );

  const handleGenerate = () => {
    const staffId = isSelfOnly ? user?.id ?? "" : selectedStaffId;
    if (!staffId || !startDate || !endDate) return;
    setSubmitted({ staffId, startDate, endDate });
  };

  const pdfRows = useMemo(() => {
    if (!report) return [];
    const rows: { item: string; amount: string }[] = [
      { item: "Basic Salary", amount: lkr(report.basicSalary) },
    ];
    for (const hv of report.homeVisits) {
      rows.push({
        item: `Home Visits — ${hv.branchName} (${hv.count} × ${formatMoney(hv.ratePerVisit)})`,
        amount: lkr(hv.total),
      });
    }
    rows.push({ item: "Home Visits Total", amount: lkr(report.homeVisitsTotal) });
    if (report.incentiveTotal > 0) {
      rows.push({ item: "Incentive", amount: lkr(report.incentiveTotal) });
    }
    rows.push({
      item: `OT Hours (${report.otHours} × ${formatMoney(report.otRatePerHour)})`,
      amount: lkr(report.otTotal),
    });
    for (const a of report.additions) rows.push({ item: `Addition — ${a.date} ${a.reason}`, amount: lkr(a.amount) });
    rows.push({ item: "Additions Total", amount: lkr(report.additionsTotal) });
    for (const f of report.fines) rows.push({ item: `Fine — ${f.date} ${f.reason}`, amount: `-${lkr(f.amount)}` });
    rows.push({ item: "Fines Total", amount: `-${lkr(report.finesTotal)}` });
    for (const d of report.decrements) rows.push({ item: `Decrement — ${d.date} ${d.reason}`, amount: `-${lkr(d.amount)}` });
    rows.push({ item: "Decrements Total", amount: `-${lkr(report.decrementsTotal)}` });
    if (report.extraHolidayDeduction > 0) {
      rows.push({ item: "Extra Holiday Deduction", amount: `-${lkr(report.extraHolidayDeduction)}` });
    }
    rows.push({ item: "FINAL SALARY", amount: lkr(report.finalSalary) });
    return rows;
  }, [report]);

  return (
    <ReportPageShell
      title="Salary Report"
      loading={isLoading}
      error={error as Error | null}
      filters={
        <div className="flex flex-col gap-3">
          {canPickStaff && (
            <div className="space-y-1">
              <Label>Staff</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {(staffList as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.role ? ` (${s.role})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <ReportDateFilters
            preset={preset}
            onPresetChange={setPreset}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <div>
            <Button
              onClick={handleGenerate}
              disabled={(!isSelfOnly && !selectedStaffId) || !startDate || !endDate}
              variant="outline"
            >
              Refresh Report
            </Button>
          </div>
        </div>
      }
      actions={
        report ? (
          <StructuredReportActions
            reportTitle={`Salary Report — ${report.staffName}`}
            fileBaseName={`salary-${report.staffId}-${submitted?.startDate ?? ""}`}
            columns={[
              { key: "item", label: "Description" },
              { key: "amount", label: "Amount (LKR)" },
            ]}
            rows={pdfRows}
            logoUri={logoUri}
            meta={[
              { label: "Staff", value: report.staffName },
              { label: "Branch", value: report.branch ?? "—" },
              { label: "Period", value: `${submitted?.startDate} to ${submitted?.endDate}` },
              { label: "Final Salary", value: lkr(report.finalSalary) },
            ]}
          />
        ) : null
      }
    >
      {report && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border/60 bg-white p-4">
            <div className="border-b-2 border-[#F58220] pb-3 mb-3">
              <div className="text-sm font-bold text-[#105691]">Salary Report — {report.staffName}</div>
              <div className="text-xs text-muted-foreground">
                {report.branch ?? "—"} · {submitted?.startDate} to {submitted?.endDate}
              </div>
            </div>
            <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "68%" }} />
                <col style={{ width: "32%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td className="py-1 text-left">Basic Salary</td>
                  <td className="py-1 text-right font-medium whitespace-nowrap">{lkr(report.basicSalary)}</td>
                </tr>

                <tr className="border-t border-border/60">
                  <td className="pt-2 text-left font-semibold" colSpan={2}>
                    Home Visits
                  </td>
                </tr>
                {report.homeVisits.length === 0 ? (
                  <tr>
                    <td className="py-1 text-left text-muted-foreground" colSpan={2}>
                      No home visits in this period.
                    </td>
                  </tr>
                ) : (
                  report.homeVisits.map((hv: any) => (
                    <tr key={hv.branchName}>
                      <td className="py-1 text-left text-muted-foreground">
                        {hv.branchName} — {hv.count} {hv.count === 1 ? "visit" : "visits"} × {formatMoney(hv.ratePerVisit)}
                      </td>
                      <td className="py-1 text-right whitespace-nowrap">{lkr(hv.total)}</td>
                    </tr>
                  ))
                )}
                <tr>
                  <td className="py-1 text-left font-medium">HV Total</td>
                  <td className="py-1 text-right font-medium whitespace-nowrap">{lkr(report.homeVisitsTotal)}</td>
                </tr>

                {report.incentiveTotal > 0 ? (
                  <tr className="border-t border-border/60">
                    <td className="pt-2 py-1 text-left">Incentive</td>
                    <td className="pt-2 py-1 text-right whitespace-nowrap">{lkr(report.incentiveTotal)}</td>
                  </tr>
                ) : null}

                <tr className="border-t border-border/60">
                  <td className="pt-2 py-1 text-left">
                    OT Hours ({report.otHours} × {formatMoney(report.otRatePerHour)})
                  </td>
                  <td className="pt-2 py-1 text-right whitespace-nowrap">{lkr(report.otTotal)}</td>
                </tr>

                <LineSection
                  title="Additions"
                  sign="+"
                  lines={report.additions}
                  total={report.additionsTotal}
                  canManage={canManageAdjustments}
                  onAdd={() => setDialog("addition")}
                  addLabel="Add"
                />
                <LineSection
                  title="Fines"
                  sign="-"
                  lines={report.fines}
                  total={report.finesTotal}
                  canManage={canManageFinesRole}
                  onAdd={() => setDialog("fine")}
                  addLabel="Add Fine"
                />
                <LineSection
                  title="Decrements"
                  sign="-"
                  lines={report.decrements}
                  total={report.decrementsTotal}
                  canManage={canManageAdjustments}
                  onAdd={() => setDialog("decrement")}
                  addLabel="Add Decrement"
                  onEdit={(line) => setEditLine(line)}
                />

                {report.extraHolidayDeduction > 0 ? (
                  <tr className="border-t border-border/60">
                    <td className="pt-2 py-1 text-left text-red-600">Extra Holiday Deduction</td>
                    <td className="pt-2 py-1 text-right text-red-600 whitespace-nowrap">-{lkr(report.extraHolidayDeduction)}</td>
                  </tr>
                ) : null}

                <tr className="border-t-2 border-[#105691]">
                  <td className="pt-2 text-left font-bold text-[#105691]">FINAL SALARY</td>
                  <td className="pt-2 text-right font-bold text-[#105691] whitespace-nowrap">{lkr(report.finalSalary)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-border/60 bg-white p-4">
            <div className="text-sm font-bold text-[#105691] mb-3">Salary History</div>
            {(history as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No history available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                      <th className="py-1 pr-3">Period</th>
                      <th className="py-1 px-3 text-right">Basic</th>
                      <th className="py-1 px-3 text-right">Total HV</th>
                      <th className="py-1 px-3 text-right">OT</th>
                      <th className="py-1 px-3 text-right">Decrements</th>
                      <th className="py-1 pl-3 text-right">Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(history as any[]).map((h) => (
                      <tr key={h.period} className="border-b border-border/40">
                        <td className="py-1 pr-3">{h.period}</td>
                        <td className="py-1 px-3 text-right whitespace-nowrap">{formatMoney(h.basicSalary)}</td>
                        <td className="py-1 px-3 text-right whitespace-nowrap">{formatMoney(h.homeVisitsTotal)}</td>
                        <td className="py-1 px-3 text-right whitespace-nowrap">{formatMoney(h.otTotal)}</td>
                        <td className="py-1 px-3 text-right whitespace-nowrap text-red-600">
                          {h.decrementsTotal > 0 ? `-${formatMoney(h.decrementsTotal)}` : formatMoney(0)}
                        </td>
                        <td className="py-1 pl-3 text-right font-medium whitespace-nowrap">{formatMoney(h.finalSalary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!report && !isLoading && (
        <p className="text-muted-foreground text-sm">
          Select {canPickStaff ? "a staff member and " : ""}a date range, then press “Generate Report”.
        </p>
      )}

      {submitted?.staffId && (
        <AdjustmentDialog
          open={dialog !== null}
          type={dialog ?? "addition"}
          staffId={submitted.staffId}
          onClose={() => setDialog(null)}
        />
      )}
      {submitted?.staffId && (
        <EditDecrementDialog
          open={!!editLine}
          staffId={submitted.staffId}
          line={editLine}
          onClose={() => setEditLine(null)}
        />
      )}
    </ReportPageShell>
  );
}

export default function SalaryReportPage() {
  return (
    <RoleProtectedRoute allowed={canViewReportsHub}>
      <SalaryReportContent />
    </RoleProtectedRoute>
  );
}
