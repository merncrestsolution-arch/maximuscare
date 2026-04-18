import type { DatabaseStorage } from "./storage";

/**
 * If staff is Present on `fineDate` but had no outpatient visit or in-patient session
 * starting before 12:00, ensure a 500 LKR auto fine exists (physio roles only).
 * Otherwise removes the auto fine for that day.
 */
export async function syncAutoFineForStaffDate(
  storage: DatabaseStorage,
  staffId: string,
  fineDate: string
): Promise<void> {
  const staff = await storage.getStaff(staffId);
  if (!staff || staff.role === "Admin" || staff.role === "MD") {
    await storage.deleteAutoFineForStaffDate(staffId, fineDate);
    return;
  }
  const att = await storage.getAttendanceByStaffAndDate(staffId, fineDate);
  if (!att || att.status !== "Present") {
    await storage.deleteAutoFineForStaffDate(staffId, fineDate);
    return;
  }
  const hasEarly = await storage.staffHasVisitOrIpSessionBeforeNoon(staffId, fineDate);
  if (hasEarly) {
    await storage.deleteAutoFineForStaffDate(staffId, fineDate);
    return;
  }
  await storage.ensureAutoFineForStaffDate(staffId, staff.name, fineDate);
}
