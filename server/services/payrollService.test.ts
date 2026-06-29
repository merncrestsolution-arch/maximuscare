import { describe, it, expect } from "vitest";
import { computePayrollForStaff, PAYROLL_RATES } from "./payrollService";
import type { Staff, Visit, Attendance, InPatientSession, StaffFine } from "@shared/schema";

const staff = {
  id: "s1",
  name: "Test Physio",
  role: "Physiotherapist",
  basicSalary: "10000",
  otherAdjustments: "0",
} as Staff;

const settings = {
  incentiveEnabled: true,
  incentiveMinCount: 5,
  incentivePerCount: 100,
  clinicLocationScope: "Colombo",
  autoFineAmount: 500,
  homeColombo: PAYROLL_RATES.homeColombo,
  homeBandaragama: PAYROLL_RATES.homeBandaragama,
  otPerHour: PAYROLL_RATES.otPerHour,
  extraHolidayDeduction: PAYROLL_RATES.extraHolidayDeduction,
  freeAbsentDays: 4,
};

describe("computePayrollForStaff", () => {
  it("applies incentive when daily clinic count meets threshold", () => {
    const visits: Visit[] = Array.from({ length: 5 }, (_, i) => ({
      id: `v${i}`,
      treatingStaffId: "s1",
      treatingStaffName: "Test Physio",
      patientId: `p${i}`,
      visitDate: "2026-06-01",
      branch: "Colombo",
      visitType: "Clinic",
    })) as Visit[];

    const result = computePayrollForStaff(
      staff,
      visits,
      [] as Attendance[],
      [] as InPatientSession[],
      [] as StaffFine[],
      "2026-06-01",
      "2026-06-30",
      settings
    );

    expect(result.incentiveTotal).toBe(500);
    expect(result.finalSalary).toBeGreaterThan(10000);
  });

  it("skips incentive when disabled in settings", () => {
    const visits: Visit[] = Array.from({ length: 5 }, (_, i) => ({
      id: `v${i}`,
      treatingStaffId: "s1",
      treatingStaffName: "Test Physio",
      patientId: `p${i}`,
      visitDate: "2026-06-01",
      branch: "Colombo",
      visitType: "Clinic",
    })) as Visit[];

    const result = computePayrollForStaff(
      staff,
      visits,
      [] as Attendance[],
      [] as InPatientSession[],
      [] as StaffFine[],
      "2026-06-01",
      "2026-06-30",
      { ...settings, incentiveEnabled: false }
    );

    expect(result.incentiveTotal).toBe(0);
  });
});
