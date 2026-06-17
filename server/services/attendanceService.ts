import type { IStorage } from "../storage";
import { clinicDateString } from "../clinicTime";
import { summarizeAttendance, validateAttendanceStatus } from "./calculationEngine";

export interface AttendanceDashboard {
  date: string;
  present: { staffId: string; staffName: string; role: string; branch: string | null }[];
  absent: { staffId: string; staffName: string; role: string; branch: string | null }[];
  leave: { staffId: string; staffName: string; role: string; branch: string | null }[];
  holiday: { staffId: string; staffName: string; role: string; branch: string | null }[];
  attendancePercent: number;
  totalActive: number;
}

export function validateAttendanceEntry(params: {
  status: string;
  date: string;
  existingRecord?: { id: string } | null;
  isAdmin: boolean;
}): { ok: true; status: string } | { ok: false; message: string } {
  const statusCheck = validateAttendanceStatus(params.status);
  if (!statusCheck.ok) return statusCheck;

  const today = clinicDateString();
  if (params.date > today) {
    return { ok: false, message: "Cannot mark attendance for future dates" };
  }

  if (params.existingRecord && !params.isAdmin) {
    return { ok: false, message: "Attendance already marked for this day" };
  }

  return { ok: true, status: statusCheck.status };
}

export async function computeAttendanceDashboard(
  storage: IStorage,
  date: string = clinicDateString(),
): Promise<AttendanceDashboard> {
  const activeStaff = await storage.getActiveStaff();
  const records = await storage.getAttendanceByDateRange(date, date);
  const byStaffId = new Map(records.map((r) => [r.staffId, r]));

  const present: AttendanceDashboard["present"] = [];
  const absent: AttendanceDashboard["absent"] = [];
  const leave: AttendanceDashboard["leave"] = [];
  const holiday: AttendanceDashboard["holiday"] = [];

  for (const s of activeStaff) {
    const rec = byStaffId.get(s.id);
    const row = {
      staffId: s.id,
      staffName: s.name,
      role: s.role,
      branch: s.branch ?? null,
    };
    const status = rec?.status ?? "Absent";
    if (status === "Present") present.push(row);
    else if (status === "Leave") leave.push(row);
    else if (status === "Holiday") holiday.push(row);
    else absent.push(row);
  }

  const summary = summarizeAttendance(records);
  const totalMarked = summary.present + summary.absent + summary.leave + summary.holiday;
  const attendancePercent =
    totalMarked > 0 ? Math.round((summary.present / totalMarked) * 100) : 0;
  return {
    date,
    present,
    absent,
    leave,
    holiday,
    attendancePercent,
    totalActive: activeStaff.length,
  };
}
