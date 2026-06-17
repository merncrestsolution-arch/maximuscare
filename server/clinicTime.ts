/** Clinic operates in Sri Lanka (UTC+5:30). */
export const CLINIC_TIMEZONE = "Asia/Colombo";

/** Visit/session times use 24h "HH:mm". Returns true for times strictly before 12:00. */
export function isStrictlyBeforeNoon(time: string): boolean {
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return false;
  return h * 60 + min < 12 * 60;
}

/** YYYY-MM-DD in clinic local timezone. */
export function clinicDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: CLINIC_TIMEZONE });
}

/** Yesterday's date (YYYY-MM-DD) in clinic timezone. */
export function clinicYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return clinicDateString(d);
}

/** Offset date by N days in clinic timezone. */
export function clinicDateOffset(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return clinicDateString(d);
}

/** Current hour (0–23) and minute in clinic timezone. */
export function clinicLocalTimeParts(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

/** Run `fn` once per clinic day when local time hits 12:00 PM. */
export function scheduleClinicNoonJob(fn: () => void): void {
  scheduleClinicDailyJob(12, 0, fn, "noon");
}

/** Run `fn` once per clinic day at the given local hour:minute. */
export function scheduleClinicDailyJob(
  hour: number,
  minute: number,
  fn: () => void,
  jobKey = `${hour}:${minute}`,
): void {
  const lastRun: Record<string, string> = {};
  setInterval(() => {
    const parts = clinicLocalTimeParts();
    const today = clinicDateString();
    const key = jobKey;
    if (parts.hour === hour && parts.minute === minute && lastRun[key] !== today) {
      lastRun[key] = today;
      fn();
    }
  }, 60_000);
}
