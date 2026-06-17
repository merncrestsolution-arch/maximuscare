import { scheduleClinicDailyJob, scheduleClinicNoonJob } from "../clinicTime";
import { storage } from "../storage";
import { runMorningAttendanceReminder, runAfternoonActivityReminder, runAppointmentReminders } from "../services/notificationService";
import { runTaskReminders } from "../services/taskService";
import { computeDashboardKpis } from "../services/dashboardService";
import { clinicDateString, clinicDateOffset } from "../clinicTime";

type SweepFn = () => Promise<void>;

let autoFineNoonSweep: SweepFn = async () => {};
let autoFineRecentSweep: SweepFn = async () => {};

export function registerAutoFineJobs(noon: SweepFn, recent: SweepFn) {
  autoFineNoonSweep = noon;
  autoFineRecentSweep = recent;
}

export function startScheduledJobs() {
  scheduleClinicDailyJob(7, 0, () => {
    void runAppointmentReminders(storage).catch((e) =>
      console.error("[jobs] appointment reminders failed:", e),
    );
  }, "appointment-reminders");

  scheduleClinicDailyJob(8, 0, () => {
    void runMorningAttendanceReminder(storage).catch((e) =>
      console.error("[jobs] morning attendance reminder failed:", e),
    );
  }, "attendance-morning");

  scheduleClinicDailyJob(11, 30, () => {
    void runAfternoonActivityReminder(storage).catch((e) =>
      console.error("[jobs] afternoon activity reminder failed:", e),
    );
  }, "activity-afternoon");

  scheduleClinicNoonJob(() => {
    void autoFineNoonSweep().catch((e) => console.error("[jobs] noon auto-fine failed:", e));
  });

  scheduleClinicDailyJob(9, 0, () => {
    void runTaskReminders(storage).catch((e) => console.error("[jobs] task reminders failed:", e));
  }, "task-reminders");

  scheduleClinicDailyJob(23, 59, () => {
    void runDailyStatisticsUpdate().catch((e) =>
      console.error("[jobs] daily statistics update failed:", e),
    );
  }, "daily-stats");

  const DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    void autoFineRecentSweep().catch((e) => console.error("[jobs] auto-fine sweep failed:", e));
  }, DAY_MS);

  // Monthly jobs — 1st of month at 06:00 clinic time
  scheduleClinicDailyJob(6, 0, () => {
    const today = clinicDateString();
    if (!today.endsWith("-01")) return;
    void runMonthlyJobs().catch((e) => console.error("[jobs] monthly jobs failed:", e));
  }, "monthly-jobs");

  console.log("[jobs] Scheduled jobs registered (7:00, 8:00, 9:00, 11:30, 12:00, 23:59, daily/monthly)");
}

async function runDailyStatisticsUpdate() {
  const today = clinicDateString();
  const kpis = await computeDashboardKpis(storage, today, today);
  const att = kpis.todayAttendance;
  console.log(
    `[jobs] Daily stats snapshot ${today}: visits=${kpis.todayVisits}, present=${att.present}, revenue=${kpis.todayRevenue}`,
  );
}

async function runMonthlyJobs() {
  const end = clinicDateString();
  const start = clinicDateOffset(-30);
  const kpis = await computeDashboardKpis(storage, start, end);
  console.log(
    `[jobs] Monthly summary ${start}→${end}: revenue=${kpis.revenue.total}, visits=${kpis.todayVisits}`,
  );
  console.log("[jobs] Monthly backup preparation — run external backup script (see docs/backup-strategy.md)");
}
