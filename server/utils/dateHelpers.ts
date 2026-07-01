import { CLINIC_TIMEZONE } from "../clinicTime";

export function getSriLankaTodayRange(date: Date = new Date()): {
  startOfDay: Date;
  endOfDay: Date;
  dateString: string;
} {
  const dateString = date.toLocaleDateString("en-CA", { timeZone: CLINIC_TIMEZONE });
  return {
    dateString,
    startOfDay: new Date(`${dateString}T00:00:00+05:30`),
    endOfDay: new Date(`${dateString}T23:59:59+05:30`),
  };
}
