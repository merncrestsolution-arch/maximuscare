import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { useAttendance, useCreateAttendance, useUpdateAttendance, useDeleteAttendance, useStaff } from "@/hooks/useData";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, Loader2, UserPlus, Trash2, Pencil, Calendar as CalendarIcon, Search } from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MonthlyAttendanceSummary } from "@/components/attendance/monthly-summary";
import { AttendanceEditDateTime } from "@/components/attendance/attendance-edit-datetime";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { canManageAttendance } from "@/lib/permissions";

function isoToDatetimeLocal(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Approx row height (px) used to cap the scroll area at ~15 visible rows. */
const ATTENDANCE_ROW_HEIGHT = 44;
const ATTENDANCE_MAX_VISIBLE_ROWS = 15;

function AttendanceReportTable({
  records,
  title,
  scrollable,
  searchable,
  showActions,
  isManagement,
  onEdit,
  onDelete,
}: {
  records: Array<any>;
  title: string;
  scrollable?: boolean;
  searchable?: boolean;
  showActions?: boolean;
  isManagement?: boolean;
  onEdit?: (record: any) => void;
  onDelete?: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredRecords = useMemo(() => {
    if (!searchable) return records;
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const name = String(r.staffName ?? "").toLowerCase();
      const branch = String(r.branch ?? "").toLowerCase();
      const status = String(r.status ?? "").toLowerCase();
      const date = format(new Date(r.date), "dd MMM yyyy").toLowerCase();
      return name.includes(q) || branch.includes(q) || status.includes(q) || date.includes(q);
    });
  }, [records, search, searchable]);

  const canActOnRows = Boolean(showActions && isManagement && onEdit && onDelete);

  // Cap the scroll area so roughly 15 rows are visible, then scroll for the rest.
  const cappedScroll = scrollable || (filteredRecords.length > ATTENDANCE_MAX_VISIBLE_ROWS);
  const maxHeightStyle = cappedScroll
    ? { maxHeight: `${ATTENDANCE_ROW_HEIGHT * (ATTENDANCE_MAX_VISIBLE_ROWS + 1)}px` }
    : undefined;

  const headerCols = canActOnRows ? "grid-cols-7" : "grid-cols-6";
  const rowCols = canActOnRows ? "grid-cols-7" : "grid-cols-6";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {searchable && (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff, status, date…"
              className="h-9 pl-8"
              data-testid="input-attendance-search"
            />
          </div>
        )}
      </div>
      {filteredRecords.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {searchable && search.trim() ? "No matching records." : "No records found for this report."}
        </div>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div
            className={`space-y-3 md:hidden ${cappedScroll ? "overflow-y-auto overscroll-contain pr-1" : ""}`}
            style={cappedScroll ? { maxHeight: "26rem" } : undefined}
          >
            {filteredRecords.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground">{r.staffName}</div>
                    <div className="text-sm text-muted-foreground">{format(new Date(r.date), "dd MMM yyyy")}</div>
                  </div>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${r.status === "Present" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {r.status}
                  </span>
                </div>
                {r.role && <div className="text-xs text-muted-foreground">Role: {r.role}</div>}
                <div className="text-sm text-muted-foreground">
                  In: {r.checkInTime ? format(new Date(r.checkInTime), "hh:mm a") : "—"}
                  {r.checkOutTime ? ` · Out: ${format(new Date(r.checkOutTime), "hh:mm a")}` : ""}
                </div>
                {r.branch && <div className="text-xs text-muted-foreground">Branch: {r.branch}</div>}
                <div className="text-sm">OT: <strong>{Number(r.overtimeHours || 0).toFixed(1)}h</strong></div>
                {canActOnRows && (
                  <div className="flex justify-end gap-1 border-t pt-2">
                    <Button variant="ghost" size="sm" onClick={() => onEdit!(r)} data-testid={`button-edit-report-attendance-${r.id}`}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => onDelete!(r.id)} data-testid={`button-delete-report-attendance-${r.id}`}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div
            className="hidden md:block rounded-lg border border-border/60 overflow-x-auto overflow-y-auto overscroll-contain"
            style={maxHeightStyle}
          >
          <div className={`grid ${headerCols} gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase min-w-[760px] sticky top-0 z-10 bg-muted shadow-sm`}>
            <div>Date</div>
            <div>Staff</div>
            <div>Role</div>
            <div>Status</div>
            <div>Check In/Out</div>
            <div className="text-right">OT</div>
            {canActOnRows && <div className="text-right">Actions</div>}
          </div>
          {filteredRecords.map((r) => (
            <div key={r.id} className={`grid ${rowCols} gap-2 px-3 py-2.5 text-sm border-t border-border/40 min-w-[760px] items-center`}>
              <div>{format(new Date(r.date), "dd MMM yyyy")}</div>
              <div className="truncate">{r.staffName}</div>
              <div className="truncate text-xs text-muted-foreground">{r.role || "—"}</div>
              <div className={r.status === "Present" ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                {r.status}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.checkInTime ? format(new Date(r.checkInTime), "hh:mm a") : "-"}
                {r.checkOutTime ? ` / ${format(new Date(r.checkOutTime), "hh:mm a")}` : ""}
              </div>
              <div className="text-right">{Number(r.overtimeHours || 0).toFixed(1)}</div>
              {canActOnRows && (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit!(r)} data-testid={`button-edit-report-attendance-${r.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => onDelete!(r.id)} data-testid={`button-delete-report-attendance-${r.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  );
}

const ATTENDANCE_PAGE_SIZE = 50;

function moduleFormatOt(val: any): number | null {
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

/**
 * History list with client-side pagination so very large attendance datasets
 * (team history / intern history) render smoothly without breaking layout.
 */
function PaginatedAttendanceList({
  records,
  showActions,
  isManagement,
  onEdit,
  onDelete,
}: {
  records: Array<any>;
  showActions?: boolean;
  isManagement: boolean;
  onEdit: (record: any) => void;
  onDelete: (id: string) => void;
}) {
  const [visible, setVisible] = useState(ATTENDANCE_PAGE_SIZE);
  const shown = records.slice(0, visible);
  const remaining = records.length - visible;

  return (
    <div className="space-y-3 pt-4">
      {records.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">No records found.</div>
      ) : (
        <>
          {shown.map((record) => (
            <Card key={record.id} data-testid={`card-attendance-${record.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-muted-foreground">{format(new Date(record.date), 'EEE, dd MMM yyyy')}</div>
                    <div className="font-semibold text-base mt-0.5">{record.staffName}</div>
                    {record.checkInTime && (
                      <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            In: {format(new Date(record.checkInTime), 'hh:mm a')}
                            {record.checkOutTime && ` | Out: ${format(new Date(record.checkOutTime), 'hh:mm a')}`}
                          </span>
                        </div>
                        {moduleFormatOt(record.overtimeHours) !== null && (
                          <div className="text-xs text-muted-foreground" data-testid={`text-attendance-ot-${record.id}`}>
                            OT: {moduleFormatOt(record.overtimeHours)} hours
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 ${record.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {record.status === 'Present' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {record.status}
                    </div>
                  </div>
                </div>
                {showActions && isManagement && (
                  <div className="flex justify-end flex-wrap gap-1 mt-2 border-t pt-2">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(record)} data-testid={`button-edit-attendance-${record.id}`}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => onDelete(record.id)} data-testid={`button-delete-attendance-${record.id}`}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {remaining > 0 && (
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => setVisible((v) => v + ATTENDANCE_PAGE_SIZE)}
              data-testid="button-attendance-load-more"
            >
              Load more ({remaining} remaining)
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { logoUri } = useBranding();
  const { data: attendance = [], isLoading, error } = useAttendance();
  const { data: allStaff = [] } = useStaff();
  const createAttendance = useCreateAttendance();
  const updateAttendanceMutation = useUpdateAttendance();
  const deleteAttendanceMutation = useDeleteAttendance();
  const { toast } = useToast();

  const today = format(new Date(), 'yyyy-MM-dd');
  const userId = user?.id ?? "";
  const isManagement = canManageAttendance(user?.role);

  const [otInput, setOtInput] = useState("");
  const [markingStatus, setMarkingStatus] = useState<string | null>(null);

  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  /** Month shown in the popover calendar (commits to selectedMonth when popover closes or a day is picked). */
  const [calendarViewMonth, setCalendarViewMonth] = useState(() => new Date());
  const [summaryStatusFilter, setSummaryStatusFilter] = useState<"all" | "Present" | "Absent">("all");

  const [adminMarkStaffId, setAdminMarkStaffId] = useState("");
  const [adminMarkDate, setAdminMarkDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [adminMarkLoading, setAdminMarkLoading] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  const [editRecord, setEditRecord] = useState<(typeof attendance)[number] | null>(null);
  const [editStatus, setEditStatus] = useState<"Present" | "Absent">("Present");
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editOt, setEditOt] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (userId && !selectedStaffId) setSelectedStaffId(userId);
  }, [userId, selectedStaffId]);

  const staffOptions = useMemo(() => {
    if (!user) return [];
    if (!isManagement) return [{ id: user.id, name: user.name }];
    const map = new Map<string, string>();
    for (const s of allStaff) {
      map.set(s.id, s.name);
    }
    if (!map.has(user.id)) map.set(user.id, user.name);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allStaff, isManagement, user]);

  const { year, monthIndex, monthLabel } = useMemo(() => {
    const [y, m] = selectedMonth.split('-');
    const yy = parseInt(y);
    const mm = parseInt(m) - 1;
    const label = format(new Date(yy, mm, 1), 'MMM yyyy');
    return { year: yy, monthIndex: mm, monthLabel: label };
  }, [selectedMonth]);

  const selectedRecords = useMemo(() => {
    return attendance.filter((r) => r.staffId === (isManagement ? selectedStaffId : userId));
  }, [attendance, isManagement, selectedStaffId, userId]);

  const selectedMonthRecords = useMemo(() => {
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
    return selectedRecords.filter((r) => r.date.startsWith(prefix));
  }, [monthIndex, selectedRecords, year]);

  const filteredMonthRecords = useMemo(() => {
    if (summaryStatusFilter === "all") return selectedMonthRecords;
    return selectedMonthRecords.filter((r) => r.status === summaryStatusFilter);
  }, [selectedMonthRecords, summaryStatusFilter]);

  const calendarMonthDate = useMemo(() => new Date(year, monthIndex, 1), [year, monthIndex]);

  useEffect(() => {
    if (monthMenuOpen) {
      setCalendarViewMonth(calendarMonthDate);
    }
  }, [monthMenuOpen, calendarMonthDate]);

  const calendarWeekStartsOn = useMemo((): 0 | 1 | 2 | 3 | 4 | 5 | 6 => {
    if (typeof Intl === "undefined" || typeof navigator === "undefined") return 0;
    try {
      const loc = new Intl.Locale(navigator.language);
      const wi = (loc as { weekInfo?: { firstDay?: number } }).weekInfo;
      if (wi?.firstDay != null && wi.firstDay >= 1 && wi.firstDay <= 7) {
        return (wi.firstDay === 7 ? 0 : wi.firstDay) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      }
    } catch {
      /* ignore */
    }
    return 0;
  }, []);

  const todayRecord = user ? attendance.find((a) => a.staffId === user.id && a.date === today) : undefined;
  const myHistory = user ? attendance.filter((a) => a.staffId === user.id) : [];
  const allHistory = attendance;

  const markAttendance = async (status: 'Present' | 'Absent') => {
    if (!user) return;
    if (todayRecord || markingStatus) return;

    setMarkingStatus(status);
    try {
      await createAttendance.mutateAsync({
        staffId: user.id,
        staffName: user.name,
        role: user.role,
        date: today,
        status,
        checkInTime: status === 'Present' ? new Date().toISOString() : undefined,
      });
      toast({
        title: "Attendance Marked",
        description: `You have been marked ${status.toLowerCase()} for today.`,
      });
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("already") || msg.includes("409") || msg.includes("Contact Admin")) {
        toast({
          title: "Already Marked",
          description: "Attendance already marked for today. Contact Admin/MD to edit.",
        });
      } else {
        toast({
          title: "Error",
          description: msg || "Failed to mark attendance",
          variant: "destructive",
        });
      }
    } finally {
      setMarkingStatus(null);
    }
  };

  const checkoutAttendance = async () => {
    if (!todayRecord) return;

    try {
      await updateAttendanceMutation.mutateAsync({
        id: todayRecord.id,
        data: {
          checkOutTime: new Date().toISOString(),
        }
      });
      toast({
        title: "Checkout Recorded",
        description: "Your out time has been recorded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record checkout",
        variant: "destructive",
      });
    }
  };

  const saveOvertimeHours = async (hours: number) => {
    if (!todayRecord) return;
    if (isNaN(hours) || hours < 0) {
      toast({ title: "Enter valid OT hours", variant: "destructive" });
      return;
    }

    try {
      await updateAttendanceMutation.mutateAsync({
        id: todayRecord.id,
        data: {
          overtimeHours: hours.toString(),
        }
      });
      toast({
        title: "OT Saved",
        description: `Overtime hours (${hours}) saved successfully.`,
      });
      setOtInput("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save overtime hours",
        variant: "destructive",
      });
    }
  };

  const adminMarkAttendance = async (status: 'Present' | 'Absent') => {
    if (!adminMarkStaffId || !adminMarkDate) {
      toast({
        title: "Missing Information",
        description: "Please select a staff member and date.",
        variant: "destructive",
      });
      return;
    }

    setAdminMarkLoading(true);
    try {
      const isToday = adminMarkDate === today;
      await createAttendance.mutateAsync({
        staffId: adminMarkStaffId,
        date: adminMarkDate,
        status,
        checkInTime: status === 'Present' && isToday ? new Date().toISOString() : undefined,
      });
      toast({
        title: "Attendance Marked",
        description: `Staff marked as ${status.toLowerCase()} for ${format(new Date(adminMarkDate), 'dd MMM yyyy')}.`,
      });
      setSelectedStaffId(adminMarkStaffId);
      setSelectedMonth(adminMarkDate.slice(0, 7));
      setAdminMarkStaffId("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark attendance",
        variant: "destructive",
      });
    } finally {
      setAdminMarkLoading(false);
    }
  };

  const handleDeleteAttendance = async () => {
    if (!deletingRecordId) return;
    try {
      await deleteAttendanceMutation.mutateAsync(deletingRecordId);
      toast({ title: "Attendance Deleted" });
      setDeleteConfirmOpen(false);
      setDeletingRecordId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to delete", variant: "destructive" });
    }
  };

  const formatOt = (val: any) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
  };

  useEffect(() => {
    if (!editRecord) return;
    setEditStatus(editRecord.status);
    setEditCheckIn(isoToDatetimeLocal(editRecord.checkInTime));
    setEditCheckOut(isoToDatetimeLocal(editRecord.checkOutTime));
    const o = formatOt(editRecord.overtimeHours);
    setEditOt(o !== null ? String(o) : "");
    setEditReason("");
  }, [editRecord]);

  useEffect(() => {
    if (!isManagement || staffOptions.length === 0) return;
    const ids = new Set(staffOptions.map((s) => s.id));
    if (!ids.has(selectedStaffId)) {
      setSelectedStaffId(staffOptions[0].id);
    }
  }, [isManagement, staffOptions, selectedStaffId]);

  const saveEditedAttendance = async () => {
    if (!editRecord) return;
    if (editStatus === "Present" && !editCheckIn.trim()) {
      toast({ title: "Check-in required", description: "Set check-in time when status is Present.", variant: "destructive" });
      return;
    }
    const otRaw = editOt.trim();
    if (editStatus === "Present" && otRaw !== "") {
      const n = Number(otRaw);
      if (!Number.isFinite(n) || n < 0) {
        toast({ title: "Invalid OT hours", variant: "destructive" });
        return;
      }
    }

    if (!editReason.trim()) {
      toast({ title: "Reason required", description: "Provide a reason for editing attendance.", variant: "destructive" });
      return;
    }
    setEditSaving(true);
    try {
      const data: Record<string, unknown> = { status: editStatus, editReason: editReason.trim() };
      if (editStatus === "Present") {
        data.checkInTime = new Date(editCheckIn).toISOString();
        data.checkOutTime = editCheckOut.trim() ? new Date(editCheckOut).toISOString() : null;
        data.overtimeHours = otRaw === "" ? "0" : String(Number(otRaw));
      } else {
        data.checkInTime = null;
        data.checkOutTime = null;
        data.overtimeHours = "0";
      }

      await updateAttendanceMutation.mutateAsync({ id: editRecord.id, data });
      toast({ title: "Attendance updated", description: `${editRecord.staffName} — ${format(new Date(editRecord.date), "dd MMM yyyy")}` });
      setEditRecord(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update attendance",
        variant: "destructive",
      });
    } finally {
      setEditSaving(false);
    }
  };

  const savedOt = formatOt(todayRecord?.overtimeHours);
  const reportGeneratedAt = format(new Date(), "dd MMM yyyy hh:mm a");
  const attendanceColumns = [
    { key: "date", label: "Date" },
    { key: "staff", label: "Staff" },
    { key: "status", label: "Status" },
    { key: "checkIn", label: "Check In" },
    { key: "checkOut", label: "Check Out" },
    { key: "ot", label: "OT Hours" },
  ];
  const toAttendanceRows = (records: Array<any>) =>
    records.map((r) => ({
      date: format(new Date(r.date), "yyyy-MM-dd"),
      staff: r.staffName,
      status: r.status,
      checkIn: r.checkInTime ? format(new Date(r.checkInTime), "hh:mm a") : "",
      checkOut: r.checkOutTime ? format(new Date(r.checkOutTime), "hh:mm a") : "",
      ot: Number(r.overtimeHours || 0).toFixed(1),
    }));

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading attendance…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Failed to load attendance: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">Mark your status for today and view history.</p>
      </div>

      <Card className="bg-white border border-border/60 shadow-sm">
        <CardContent className="py-5 space-y-4">
          {!todayRecord && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please mark your attendance for today before using the app.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold"
                  onClick={() => markAttendance('Present')}
                  disabled={!!markingStatus}
                  data-testid="button-attendance-present"
                >
                  {markingStatus === 'Present' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Present
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-destructive text-destructive hover:bg-destructive/10 h-12 text-base font-semibold"
                  onClick={() => markAttendance('Absent')}
                  disabled={!!markingStatus}
                  data-testid="button-attendance-absent"
                >
                  {markingStatus === 'Absent' ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />} Absent
                </Button>
              </div>
            </div>
          )}

          {todayRecord && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Today's status</p>
                  <p className="text-base font-bold mt-0.5" data-testid="text-attendance-status">
                    {todayRecord.status}
                  </p>
                  {todayRecord.checkInTime && (
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-attendance-times">
                      In: {format(new Date(todayRecord.checkInTime), 'hh:mm a')}
                      {todayRecord.checkOutTime && ` | Out: ${format(new Date(todayRecord.checkOutTime), 'hh:mm a')}`}
                    </p>
                  )}
                </div>

                <div className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5 ${todayRecord.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                  data-testid="badge-attendance-today"
                >
                  {todayRecord.status === 'Present' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {todayRecord.status}
                </div>
              </div>

              {!isManagement && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2" data-testid="text-attendance-locked">
                  Attendance marked for today. Contact Admin/MD to change status.
                </div>
              )}

              {todayRecord.status === 'Present' && !todayRecord.checkOutTime && (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2 h-12 text-base font-semibold"
                  onClick={checkoutAttendance}
                  data-testid="button-checkout"
                >
                  <Clock className="h-5 w-5" /> Record Out Time
                </Button>
              )}

              {todayRecord.status === 'Present' && todayRecord.checkOutTime && (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground" data-testid="text-checkout-done">
                    Out time recorded: {format(new Date(todayRecord.checkOutTime), 'hh:mm a')}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-white p-3" data-testid="card-overtime">
                    <div className="text-sm font-semibold text-foreground" data-testid="text-overtime-label">Overtime (Extra hours)</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        inputMode="decimal"
                        placeholder="e.g. 2 or 1.5"
                        value={otInput}
                        onChange={(e) => setOtInput(e.target.value)}
                        className="h-11"
                        data-testid="input-overtime-hours"
                      />
                      <Button
                        type="button"
                        className="h-11 bg-black text-white hover:bg-black/90"
                        onClick={() => {
                          const raw = otInput.trim();
                          const val = raw === "" ? NaN : Number(raw);
                          if (Number.isFinite(val) && val >= 0) {
                            saveOvertimeHours(val);
                          }
                        }}
                        data-testid="button-save-ot"
                      >
                        Save OT
                      </Button>
                    </div>

                    {savedOt !== null && (
                      <div className="mt-2 text-xs text-muted-foreground" data-testid="text-overtime-saved">
                        Saved OT: {savedOt} hours
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="my-summary" data-testid="tabs-attendance">
        <TabsList className="w-full flex-nowrap h-auto gap-1 overflow-x-auto no-scrollbar justify-start sm:flex-wrap sm:justify-center" data-testid="tabslist-attendance">
          <TabsTrigger value="my-summary" className="shrink-0 min-w-[5.25rem] flex-1 sm:min-w-[5.5rem]" data-testid="tab-attendance-summary">Summary</TabsTrigger>
          <TabsTrigger value="my-history" className="shrink-0 min-w-[5.25rem] flex-1 sm:min-w-[5.5rem]" data-testid="tab-attendance-history">My History</TabsTrigger>
          {isManagement && (
            <TabsTrigger value="team-history" className="shrink-0 min-w-[5.25rem] flex-1 sm:min-w-[5.5rem]" data-testid="tab-attendance-team-history">
              Team History
            </TabsTrigger>
          )}
          {isManagement && (
            <TabsTrigger value="all-staff" className="shrink-0 min-w-[5.25rem] flex-1 sm:min-w-[5.5rem]" data-testid="tab-attendance-all">
              All Staff
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-summary" data-testid="tabcontent-attendance-summary">
          <Card className="bg-white border border-border/60 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground" data-testid="text-attendance-summary-title">
                    Month Summary
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-attendance-summary-subtitle">
                    {isManagement ? 'Select staff & month' : 'Your attendance by month'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground" data-testid="label-attendance-staff">
                    Staff
                  </div>
                  <Select
                    value={isManagement ? selectedStaffId : user.id}
                    onValueChange={(v) => isManagement && setSelectedStaffId(v)}
                    disabled={!isManagement}
                  >
                    <SelectTrigger className="h-11 bg-white" data-testid="select-attendance-staff">
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id} data-testid={`option-attendance-staff-${s.id}`}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground" data-testid="label-attendance-month">
                    Month
                  </div>
                  <Popover
                    open={monthMenuOpen}
                    onOpenChange={(open) => {
                      if (!open) {
                        setSelectedMonth(format(calendarViewMonth, "yyyy-MM"));
                      }
                      setMonthMenuOpen(open);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full justify-start gap-2 border-border/60 bg-white font-normal text-foreground [color-scheme:light] dark:[color-scheme:dark]"
                        data-testid="input-attendance-month"
                      >
                        <CalendarIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                        <span className="truncate">{format(calendarMonthDate, "MMMM yyyy")}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto border-gray-200 bg-white p-0 shadow-lg" align="start">
                      <CalendarPicker
                        mode="single"
                        month={calendarViewMonth}
                        onMonthChange={setCalendarViewMonth}
                        selected={calendarViewMonth}
                        onSelect={(d) => {
                          if (d) {
                            const y = d.getFullYear();
                            const m = d.getMonth();
                            setSelectedMonth(format(d, "yyyy-MM"));
                            setCalendarViewMonth(new Date(y, m, 1));
                            setMonthMenuOpen(false);
                          }
                        }}
                        captionLayout="dropdown"
                        startMonth={new Date(2020, 0)}
                        endMonth={new Date(2036, 11)}
                        weekStartsOn={calendarWeekStartsOn}
                        className="rounded-lg border-0"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground" data-testid="label-attendance-status-filter">
                    Status
                  </div>
                  <Select
                    value={summaryStatusFilter}
                    onValueChange={(v) => setSummaryStatusFilter(v as "all" | "Present" | "Absent")}
                  >
                    <SelectTrigger className="h-11 bg-white" data-testid="select-attendance-summary-status">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-summary-status-all">
                        All records
                      </SelectItem>
                      <SelectItem value="Present" data-testid="option-summary-status-present">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Present only
                        </span>
                      </SelectItem>
                      <SelectItem value="Absent" data-testid="option-summary-status-absent">
                        <span className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Absent only
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <StructuredReportActions
                reportTitle="Monthly Attendance Summary"
                fileBaseName={`attendance-summary-data-${selectedMonth}`}
                columns={attendanceColumns}
                rows={toAttendanceRows(filteredMonthRecords)}
                logoUri={logoUri}
                themeColor="#2D9D8B"
                meta={[
                  { label: "Month", value: monthLabel },
                  { label: "Staff", value: staffOptions.find((s) => s.id === (isManagement ? selectedStaffId : user.id))?.name ?? user.name },
                  { label: "Generated", value: reportGeneratedAt },
                  { label: "Prepared By", value: user.name },
                ]}
              />
              <div id="attendance-monthly-report" className="space-y-4 rounded-xl border border-border/60 bg-white p-4">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    <img src={logoUri} alt="Clinic logo" className="h-10 w-10 rounded-md object-contain" />
                    <div>
                      <div className="text-sm font-bold text-foreground">Maximus Care</div>
                      <div className="text-xs text-muted-foreground">Monthly Attendance Summary</div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{monthLabel}</div>
                    <div>Generated: {reportGeneratedAt}</div>
                    <div>Prepared by: {user.name}</div>
                  </div>
                </div>
                <MonthlyAttendanceSummary
                  staffName={staffOptions.find((s) => s.id === (isManagement ? selectedStaffId : user.id))?.name ?? user.name}
                  monthLabel={monthLabel}
                  year={year}
                  monthIndex={monthIndex}
                  records={filteredMonthRecords}
                  dataTestIdPrefix="attendance-monthly"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-history" data-testid="tabcontent-attendance-history">
          <StructuredReportActions
            reportTitle="My Attendance History"
            fileBaseName={`attendance-my-history-data-${user.id}`}
            columns={attendanceColumns}
            rows={toAttendanceRows(myHistory)}
            logoUri={logoUri}
            themeColor="#2D9D8B"
            meta={[
              { label: "Staff", value: user.name },
              { label: "Generated", value: reportGeneratedAt },
              { label: "Prepared By", value: user.name },
            ]}
          />
          <div id="attendance-my-history-report" className="space-y-4 rounded-xl border border-border/60 bg-white p-4 mb-4">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <img src={logoUri} alt="Clinic logo" className="h-10 w-10 rounded-md object-contain" />
                <div>
                  <div className="text-sm font-bold text-foreground">Maximus Care</div>
                  <div className="text-xs text-muted-foreground">Attendance History Report</div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>Generated: {reportGeneratedAt}</div>
                <div>Prepared by: {user.name}</div>
              </div>
            </div>
            <AttendanceReportTable records={myHistory} title="My Attendance Records" scrollable />
          </div>
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-white px-3 pb-3">
            <PaginatedAttendanceList
              records={myHistory}
              showActions={isManagement}
              isManagement={isManagement}
              onEdit={setEditRecord}
              onDelete={(id) => { setDeletingRecordId(id); setDeleteConfirmOpen(true); }}
            />
          </div>
        </TabsContent>

        {isManagement && (
          <TabsContent value="team-history" data-testid="tabcontent-attendance-team-history">
            <StructuredReportActions
              reportTitle="Team Attendance History"
              fileBaseName={`attendance-team-history-data-${selectedMonth}`}
              columns={attendanceColumns}
              rows={toAttendanceRows(allHistory)}
              logoUri={logoUri}
              themeColor="#2D9D8B"
              meta={[
                { label: "Month", value: selectedMonth },
                { label: "Generated", value: reportGeneratedAt },
                { label: "Prepared By", value: user.name },
              ]}
            />
            <div id="attendance-team-history-report" className="space-y-4 rounded-xl border border-border/60 bg-white p-4 mb-4">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <img src={logoUri} alt="Clinic logo" className="h-10 w-10 rounded-md object-contain" />
                  <div>
                    <div className="text-sm font-bold text-foreground">Maximus Care</div>
                    <div className="text-xs text-muted-foreground">Team Attendance Report</div>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Generated: {reportGeneratedAt}</div>
                  <div>Prepared by: {user.name}</div>
                </div>
              </div>
              <AttendanceReportTable
                records={allHistory}
                title="All Staff Attendance Records"
                scrollable
                searchable
                showActions
                isManagement={isManagement}
                onEdit={setEditRecord}
                onDelete={(id) => { setDeletingRecordId(id); setDeleteConfirmOpen(true); }}
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-white px-3 pb-3">
              <PaginatedAttendanceList
                records={allHistory}
                showActions={true}
                isManagement={isManagement}
                onEdit={setEditRecord}
                onDelete={(id) => { setDeletingRecordId(id); setDeleteConfirmOpen(true); }}
              />
            </div>
          </TabsContent>
        )}

        {isManagement && (
          <TabsContent value="all-staff" data-testid="tabcontent-attendance-all">
            <Card className="bg-white border border-border/60 shadow-sm mb-4">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm font-semibold text-foreground">Mark Staff Attendance</div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">Staff Member</div>
                    <Select
                      value={adminMarkStaffId}
                      onValueChange={setAdminMarkStaffId}
                    >
                      <SelectTrigger className="h-11 bg-white" data-testid="select-admin-mark-staff">
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent>
                        {allStaff.map((s) => (
                          <SelectItem key={s.id} value={s.id} data-testid={`option-admin-staff-${s.id}`}>
                            {s.name} ({s.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">Date</div>
                    <input
                      type="date"
                      value={adminMarkDate}
                      onChange={(e) => setAdminMarkDate(e.target.value)}
                      className="h-11 w-full rounded-md border border-border/60 bg-white px-3 text-base md:text-sm"
                      data-testid="input-admin-mark-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-11 font-semibold"
                    onClick={() => adminMarkAttendance('Present')}
                    disabled={adminMarkLoading || !adminMarkStaffId}
                    data-testid="button-admin-mark-present"
                  >
                    {adminMarkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Present
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-destructive text-destructive hover:bg-destructive/10 h-11 font-semibold"
                    onClick={() => adminMarkAttendance('Absent')}
                    disabled={adminMarkLoading || !adminMarkStaffId}
                    data-testid="button-admin-mark-absent"
                  >
                    {adminMarkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Absent
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit attendance (Admin / MD) */}
      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent
          data-testid="modal-edit-attendance"
          className="max-w-md bg-white border-gray-200 text-black"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-black">Edit attendance</DialogTitle>
          </DialogHeader>
          {editRecord && (
            <div className="space-y-4">
              <div className="text-sm text-black/80">
                <span className="font-semibold text-black">{editRecord.staffName}</span>
                {" · "}
                {format(new Date(editRecord.date), "EEE, dd MMM yyyy")}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-black">Status</Label>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Attendance status">
                  <Button
                    type="button"
                    variant={editStatus === "Present" ? "default" : "outline"}
                    className={
                      editStatus === "Present"
                        ? "h-12 gap-2 bg-[#2D9D8B] text-white hover:bg-[#268a7a]"
                        : "h-12 gap-2 border-slate-300 bg-white text-black hover:bg-slate-50"
                    }
                    onClick={() => setEditStatus("Present")}
                    data-testid="button-edit-status-present"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    Present
                  </Button>
                  <Button
                    type="button"
                    variant={editStatus === "Absent" ? "destructive" : "outline"}
                    className={
                      editStatus === "Absent"
                        ? "h-12 gap-2"
                        : "h-12 gap-2 border-slate-300 bg-white text-black hover:bg-slate-50"
                    }
                    onClick={() => setEditStatus("Absent")}
                    data-testid="button-edit-status-absent"
                  >
                    <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                    Absent
                  </Button>
                </div>
              </div>

              {editStatus === "Present" && (
                <>
                  <div className="space-y-4">
                    <AttendanceEditDateTime
                      label="Check-in"
                      value={editCheckIn}
                      onChange={setEditCheckIn}
                      testIdPrefix="edit-attendance-checkin"
                      weekStartsOn={calendarWeekStartsOn}
                    />
                    <AttendanceEditDateTime
                      label="Check-out"
                      value={editCheckOut}
                      onChange={setEditCheckOut}
                      optional
                      anchorDateYmd={editRecord.date}
                      testIdPrefix="edit-attendance-checkout"
                      weekStartsOn={calendarWeekStartsOn}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-black">Overtime hours</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="e.g. 0 or 1.5"
                      value={editOt}
                      onChange={(e) => setEditOt(e.target.value)}
                      className="h-11 border-gray-300 bg-white text-black placeholder:text-black/40"
                      data-testid="input-edit-attendance-ot"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-black">Edit reason (required)</Label>
                <Input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Why is this attendance being changed?"
                  className="h-11 border-gray-300 bg-white text-black"
                  data-testid="input-edit-attendance-reason"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditRecord(null)} className="h-11 px-5" disabled={editSaving} data-testid="button-cancel-edit-attendance">
                  Cancel
                </Button>
                <Button onClick={saveEditedAttendance} disabled={editSaving} className="h-11 px-5 bg-black text-white hover:bg-black/90" data-testid="button-save-edit-attendance">
                  {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} modal={true}>
        <DialogContent data-testid="modal-delete-attendance">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Delete Attendance Record?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 leading-relaxed">
            Are you sure you want to delete this attendance record?
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setDeletingRecordId(null); }} className="h-11 px-5 border-gray-300" data-testid="button-cancel-delete-attendance">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAttendance} disabled={deleteAttendanceMutation.isPending} className="h-11 px-5" data-testid="button-confirm-delete-attendance">
              {deleteAttendanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
