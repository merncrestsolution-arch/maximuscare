import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Clinic operates in Sri Lanka (UTC+5:30). */
export const CLINIC_TIMEZONE = "Asia/Colombo";

/**
 * Today's date as 'YYYY-MM-DD' in the clinic's Sri Lanka timezone, independent of the
 * browser's local timezone. Mirrors the server's clinicDateString() so "today" filters
 * line up with how attendance/visit dates are stored (Bug 10).
 */
export function clinicTodayString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: CLINIC_TIMEZONE });
}

/** Create a Date anchored to the clinic day (midday in Sri Lanka). */
export function clinicDateFromString(dateString: string): Date {
  return new Date(`${dateString}T12:00:00+05:30`);
}

/** Date object representing "today" in the clinic timezone. */
export function clinicTodayDate(): Date {
  return clinicDateFromString(clinicTodayString());
}
