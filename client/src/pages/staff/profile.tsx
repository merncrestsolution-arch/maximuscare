import { useState } from "react";
import { Link, useRoute } from "wouter";
import { addDays, format, parseISO } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { useVisits, useAttendance, useStaffMember, usePatients, useInPatientSessionsForStaffRange, usePayrollReport, useStaffStats } from "@/hooks/useData";
import { staffApi } from "@/lib/api";
import { format as fmt, startOfMonth, endOfMonth } from "date-fns";
import { formatLkr } from "@/lib/reportDatePresets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit2, CalendarCheck, Stethoscope, Pencil } from "lucide-react";
import { isVisitForStaff } from "@/lib/visitAccess";
import { VisitStatsCards } from "@/components/dashboard/visit-stats-cards";
import { isPaidStatus, paymentStatusBadgeClass } from "@/lib/paymentStatus";

export default function StaffProfilePage() {
  const [match, params] = useRoute("/staff/:id");
  const { user: currentUser } = useAuth();
  const staffId = params?.id || "";
  const [ipSessionDate, setIpSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const ipDayEnd = format(addDays(parseISO(ipSessionDate), 1), "yyyy-MM-dd");
  const { data: ipSessions = [] } = useInPatientSessionsForStaffRange(
    { startDate: ipSessionDate, endDate: ipDayEnd, staffId },
    !!staffId
  );
  const { data: profileUser, isLoading: staffLoading, error: staffError } = useStaffMember(staffId);
  const { data: allVisits = [] } = useVisits();
  const { data: patients = [] } = usePatients();
  const { data: staffAttendance = [] } = useAttendance({ staffId });
  const monthStart = fmt(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = fmt(endOfMonth(new Date()), "yyyy-MM-dd");
  const { data: payrollReport } = usePayrollReport({ startDate: monthStart, endDate: monthEnd, staffId });
  const payrollSummary = payrollReport?.summaries?.[0];
  const { data: hrmStats } = useStaffStats(staffId, { startDate: monthStart, endDate: monthEnd }, !!staffId);
  const [photoUploading, setPhotoUploading] = useState(false);

  if (!match || !params || !currentUser) return null;

  const role = (currentUser.role || "").toLowerCase();
  const isManagement = role === "admin" || role === "md";
  if (!isManagement && currentUser.id !== params.id) {
    return <div>Unauthorized</div>;
  }

  if (staffLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-muted-foreground">Loading…</span>
      </div>
    );
  }

  if (staffError || !profileUser) {
    return <div className="p-4 text-muted-foreground">Staff member not found.</div>;
  }

  const staffVisits = allVisits
    .filter((v) => isVisitForStaff(v, profileUser))
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  const canEditVisitsOnProfile = isManagement || currentUser.id === profileUser.id;
  const recentAttendance = [...staffAttendance].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const patientNameById = new Map(patients.map((p) => [p.id, p.name]));
  const formatDateSafe = (value?: string | null, pattern = "dd MMM yyyy") => {
    if (!value) return "-";
    const d = parseISO(value);
    if (Number.isNaN(d.getTime())) return "-";
    return format(d, pattern);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href={isManagement ? "/staff" : "/profile"}>
          <Button variant="ghost" size="icon" className="-ml-2" data-testid="button-back-staff-profile">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Staff Profile</h1>
        <Link href={`/staff/${profileUser.id}/report`}>
          <Button variant="outline" size="sm" className="ml-auto mr-2">Full Report</Button>
        </Link>
        {isManagement && (
          <Link href={`/staff/${profileUser.id}/edit`}>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              data-testid="button-edit-staff-profile"
            >
              <Edit2 className="h-5 w-5 text-primary" />
            </Button>
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5" data-testid="card-staff-header">
        <div className="flex items-start gap-3 mb-3">
          {(profileUser as any).photoUri ? (
            <img src={(profileUser as any).photoUri} alt="Staff" className="h-20 w-20 rounded-xl object-cover border" />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold">{profileUser.name?.charAt(0)}</div>
          )}
          {isManagement && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-primary cursor-pointer underline">
                {photoUploading ? "Uploading…" : "Upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || file.size > 5 * 1024 * 1024) return;
                    setPhotoUploading(true);
                    try {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        await staffApi.uploadPhoto(profileUser.id, reader.result as string);
                        window.location.reload();
                      };
                      reader.readAsDataURL(file);
                    } finally {
                      setPhotoUploading(false);
                    }
                  }}
                />
              </label>
              {(profileUser as any).photoUri && (
                <button type="button" className="text-xs text-destructive text-left" onClick={() => staffApi.removePhoto(profileUser.id).then(() => window.location.reload())}>
                  Remove photo
                </button>
              )}
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground" data-testid="text-staff-header-label">Staff</div>
        <div className="mt-1 text-2xl font-bold text-foreground" data-testid="text-staff-name">{profileUser.name}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="px-3 py-1 rounded-full bg-black text-white text-xs font-semibold" data-testid="badge-staff-role">
            {profileUser.role}
          </div>
          <div className="px-3 py-1 rounded-full bg-muted/20 text-foreground text-xs font-semibold" data-testid="badge-staff-branch">
            {profileUser.branch || "Head Office"}
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${(profileUser as any).isActive !== false ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
            {(profileUser as any).isActive !== false ? "Active" : "Inactive"}
          </div>
        </div>
        <div className="mt-2 text-sm text-muted-foreground space-y-0.5">
          <div>Employee ID: {(profileUser as any).employeeCode || profileUser.id.slice(0, 8)}</div>
          <div>Phone: {profileUser.phone || "—"} · Email: {profileUser.email}</div>
          <div>NIC: {(profileUser as any).nic || "—"} · Joined: {formatDateSafe((profileUser as any).joiningDate ?? (profileUser as any).createdAt)}</div>
        </div>
      </div>

      {hrmStats && (
        <Card>
          <CardHeader><CardTitle className="text-base">Statistics (This Month)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Visits</span><div className="font-bold">{hrmStats.totalVisits}</div></div>
            <div><span className="text-muted-foreground">Sessions</span><div className="font-bold">{hrmStats.totalSessions}</div></div>
            <div><span className="text-muted-foreground">Incentives</span><div className="font-bold">{hrmStats.totalIncentiveCount} ({formatLkr(hrmStats.totalIncentiveEarnings)})</div></div>
            <div><span className="text-muted-foreground">OT Hours</span><div className="font-bold">{hrmStats.totalOtHours}</div></div>
            <div><span className="text-muted-foreground">Home Visits</span><div className="font-bold">{hrmStats.totalHomeVisits}</div></div>
            <div><span className="text-muted-foreground">Salary Earned</span><div className="font-bold">{formatLkr(hrmStats.totalSalaryEarned)}</div></div>
            <div><span className="text-muted-foreground">Task Completion</span><div className="font-bold">{hrmStats.taskCompletionPercent}%</div></div>
            <div><span className="text-muted-foreground">Attendance</span><div className="font-bold">{hrmStats.attendance.attendancePercent}%</div></div>
          </CardContent>
        </Card>
      )}

      {hrmStats && (
        <Card>
          <CardHeader><CardTitle className="text-base">Attendance Statistics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground">Present</span><div className="font-bold">{hrmStats.attendance.presentDays}</div></div>
            <div><span className="text-muted-foreground">Absent</span><div className="font-bold">{hrmStats.attendance.absentDays}</div></div>
            <div><span className="text-muted-foreground">Leave</span><div className="font-bold">{hrmStats.attendance.leaveDays}</div></div>
            <div><span className="text-muted-foreground">Holiday</span><div className="font-bold">{hrmStats.attendance.holidayDays}</div></div>
            <div><span className="text-muted-foreground">Extra Holidays</span><div className="font-bold">{hrmStats.attendance.extraHolidays}</div></div>
            <div><span className="text-muted-foreground">Attendance %</span><div className="font-bold">{hrmStats.attendance.attendancePercent}%</div></div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Performance Overview</h3>
        <VisitStatsCards visits={staffVisits} limitToBranch={profileUser.branch} />
      </div>

      {payrollSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Summary (This Month)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Basic</span><div className="font-semibold">{formatLkr(payrollSummary.basicSalary)}</div></div>
            <div><span className="text-muted-foreground">Incentives</span><div className="font-semibold">{formatLkr(payrollSummary.incentiveTotal)}</div></div>
            <div><span className="text-muted-foreground">Home Visits</span><div className="font-semibold">{formatLkr(payrollSummary.homeIncome)}</div></div>
            <div><span className="text-muted-foreground">OT</span><div className="font-semibold">{formatLkr(payrollSummary.otIncome)}</div></div>
            <div><span className="text-muted-foreground">Fines</span><div className="font-semibold">{formatLkr(payrollSummary.finesTotal)}</div></div>
            <div><span className="text-muted-foreground">Extra Holidays</span><div className="font-semibold">{formatLkr(payrollSummary.extraHolidayDeduction)}</div></div>
            <div className="col-span-2"><span className="text-muted-foreground">Final Salary</span><div className="font-bold text-lg">{formatLkr(payrollSummary.finalSalary)}</div></div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            Patient visits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-72 overflow-y-auto no-scrollbar">
          {staffVisits.length === 0 && (
            <p className="text-sm text-muted-foreground">No visits as treating staff yet.</p>
          )}
          {staffVisits.map((visit) => (
            <div
              key={visit.id}
              className="flex items-start justify-between gap-2 border rounded-lg p-3"
              data-testid={`card-staff-profile-visit-${visit.id}`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex justify-between text-sm font-semibold gap-2">
                  <span>Session #{visit.sessionNumber}</span>
                  <span className="shrink-0">{formatDateSafe(visit.visitDate)}</span>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">{visit.condition}</div>
                <div className="text-xs text-foreground/80">
                  Patient: {patientNameById.get(visit.patientId) || "Unknown"}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                  <span className="uppercase tracking-wide text-muted-foreground">
                    {visit.branch} · {visit.visitType}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${paymentStatusBadgeClass(visit.paymentStatus)}`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${isPaidStatus(visit.paymentStatus) ? "bg-emerald-600" : "bg-red-600"}`}
                      aria-hidden
                    />
                    {visit.paymentStatus}
                  </span>
                </div>
              </div>
              {canEditVisitsOnProfile ? (
                <Link href={`/visits/edit/${visit.id}`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    data-testid={`button-edit-staff-profile-visit-${visit.id}`}
                    aria-label="Edit visit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white border border-border/60 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            In-patient sessions
          </CardTitle>
          <input
            type="date"
            value={ipSessionDate}
            onChange={(e) => setIpSessionDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            data-testid="input-staff-ip-date"
          />
        </CardHeader>
        <CardContent>
          {ipSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No in-patient sessions on this date.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border text-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                    <th className="p-2">Patient</th>
                    <th className="p-2">Physio</th>
                    <th className="p-2">Session</th>
                    <th className="p-2 whitespace-nowrap">Date</th>
                    <th className="p-2 w-20">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {ipSessions.map((s: any) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-2">{s.patientName}</td>
                      <td className="p-2">{s.treatingStaffName}</td>
                      <td className="p-2 max-w-[200px]">
                        <span className="text-xs text-muted-foreground">#{s.sessionNumber}</span>{" "}
                        <span className="line-clamp-2">{s.treatmentProvided}</span>
                      </td>
                      <td className="p-2 whitespace-nowrap text-muted-foreground text-xs">
                        {s.sessionDate ? format(parseISO(s.sessionDate), "dd MMM yyyy") : "—"}
                      </td>
                      <td className="p-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/inpatients/${s.admissionId}`}>Edit</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{profileUser.email}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Phone</span>
            <span className="font-medium">{profileUser.phone || "-"}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">NIC</span>
            <span className="font-medium">{profileUser.nic || "-"}</span>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center border-b pb-2">
            <span className="text-muted-foreground">Address</span>
            <span className="font-medium text-right min-w-0 break-words sm:max-w-[60%]">{profileUser.address || "-"}</span>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
            <span className="text-muted-foreground">Degree</span>
            <span className="font-medium text-right min-w-0 break-words sm:max-w-[60%]">{profileUser.degree || "-"}</span>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
            <span className="text-muted-foreground">Join Date</span>
            <span className="font-medium text-right min-w-0 break-words sm:max-w-[60%]">
              {formatDateSafe((profileUser as any).joinDate || (profileUser as any).createdAt)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
            <span className="text-muted-foreground">Basic Salary</span>
            <span className="font-medium text-right min-w-0 break-words sm:max-w-[60%]">
              {Number((profileUser as any).basicSalary || 0).toLocaleString()} LKR
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Recent Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
          {recentAttendance.length === 0 && <p className="text-sm text-muted-foreground">No records.</p>}
          {recentAttendance.slice(0, 5).map((record) => (
            <div key={record.id} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
              <span className="text-sm font-medium">{formatDateSafe(record.date, "EEE, dd MMM")}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  record.status === "Present" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}
              >
                {record.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
