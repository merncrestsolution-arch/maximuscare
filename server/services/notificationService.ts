import type { IStorage } from "../storage";
import type { InsertNotification } from "@shared/schema";
import { clinicDateString } from "../clinicTime";

export async function sendNotification(
  storage: IStorage,
  data: InsertNotification,
): Promise<void> {
  const staff = await storage.getStaff(data.staffId);
  if (!staff || staff.isActive === false || (staff.isActive as unknown) === 0) return;
  await storage.createNotification({
    ...data,
    sentAt: new Date(),
  } as InsertNotification);
}

export async function broadcastToActiveStaff(
  storage: IStorage,
  payload: Omit<InsertNotification, "staffId">,
  filter?: (staffId: string) => boolean | Promise<boolean>,
): Promise<number> {
  const active = await storage.getActiveStaff();
  let count = 0;
  for (const s of active) {
    if (filter) {
      const ok = await filter(s.id);
      if (!ok) continue;
    }
    await storage.createNotification({
      ...payload,
      staffId: s.id,
      sentAt: new Date(),
    } as InsertNotification);
    count++;
  }
  return count;
}

/** Daily 8:00 AM — remind active staff to mark attendance. */
export async function runMorningAttendanceReminder(storage: IStorage): Promise<number> {
  const today = clinicDateString();
  return broadcastToActiveStaff(
    storage,
    {
      title: "Attendance Reminder",
      message: "Please mark your attendance for today.",
      type: "attendance_reminder",
    },
    async (staffId) => {
      const existing = await storage.getAttendanceByStaffAndDate(staffId, today);
      return !existing;
    },
  );
}

/** Daily 7:00 AM — remind treating staff of today's scheduled appointments. */
export async function runAppointmentReminders(storage: IStorage): Promise<number> {
  const today = clinicDateString();
  const appts = await storage.getAppointmentsByDate(today);
  let count = 0;
  for (const appt of appts) {
    if (appt.reminderSent) continue;
    if (appt.status && appt.status !== "Scheduled") continue;
    await sendNotification(storage, {
      staffId: appt.treatingStaffId,
      title: "Appointment Today",
      message: `${appt.patientName} at ${appt.appointmentTime}${appt.branch ? ` (${appt.branch})` : ""}`,
      type: "appointment_reminder",
    });
    await storage.updateAppointment(appt.id, { reminderSent: true as unknown as number });
    count++;
  }
  return count;
}

/** Daily 11:30 AM — remind present staff to update visits/sessions. */
export async function runAfternoonActivityReminder(storage: IStorage): Promise<number> {
  const today = clinicDateString();
  const attendance = await storage.getAttendanceByDateRange(today, today);
  const presentIds = new Set(
    attendance.filter((a) => a.status === "Present").map((a) => a.staffId),
  );
  let count = 0;
  for (const staffId of Array.from(presentIds)) {
    await sendNotification(storage, {
      staffId,
      title: "Activity Reminder",
      message: "Please update today's visits and session records before 12 PM.",
      type: "attendance_reminder",
    });
    count++;
  }
  return count;
}
