import { describe, it, expect } from "vitest";
import {
  computeDailyIncentiveCount,
  computeDailyIncentiveAmount,
  computeMonthlyIncentiveAmount,
  computeHomeVisitIncome,
  computeHomeVisitBreakdown,
  computeOtAmount,
  computeExtraHolidayDeduction,
  computeFinalSalary,
  classifyHomeVisit,
  computeNextSessionNumber,
  validateBranch,
  getVisitCollectedRevenue,
  getVisitOutstandingBalance,
  DEFAULT_RATES,
} from "./calculationEngine";

const rates = {
  incentiveMinCount: 5,
  incentivePerCount: 100,
  homeColombo: 1000,
  homeBandaragama: 500,
  otPerHour: 250,
  extraHolidayDeduction: 1500,
  freeAbsentDays: 4,
};

describe("incentive engine", () => {
  it("example 01: 5 clinic + 2 IP = 6 count", () => {
    expect(computeDailyIncentiveCount(5, 2)).toBe(6);
    expect(computeDailyIncentiveAmount(6, rates)).toBe(600);
  });

  it("example 02: 4 clinic + 3 IP = 5 count", () => {
    expect(computeDailyIncentiveCount(4, 3)).toBe(5);
    expect(computeDailyIncentiveAmount(5, rates)).toBe(500);
  });

  it("example 03: 2 clinic + 1 IP = 2 count, no incentive", () => {
    expect(computeDailyIncentiveCount(2, 1)).toBe(2);
    expect(computeDailyIncentiveAmount(2, rates)).toBe(0);
  });

  it("business rule: 8 clinic visits + 6 IP sessions = 11 incentive count", () => {
    expect(computeDailyIncentiveCount(8, 6)).toBe(11);
  });

  it("monthly incentive sums daily amounts", () => {
    expect(computeMonthlyIncentiveAmount([500, 700, 0, 900])).toBe(2100);
  });
});

describe("home visit engine", () => {
  it("computes monthly home visit income (flat per-branch rate, no holiday)", () => {
    expect(computeHomeVisitIncome(5, 4, rates)).toBe(5 * 1000 + 4 * 500);
  });

  it("classifies home visits by branch tier only (Bug 7: no holiday case)", () => {
    expect(classifyHomeVisit("Dehiwala")).toBe("Colombo");
    expect(classifyHomeVisit("Bandaragama")).toBe("Bandaragama");
  });

  it("breakdown applies flat per-branch rate regardless of attendance (Bug 7)", () => {
    const breakdown = computeHomeVisitBreakdown(
      [
        { branch: "Colombo Home", visitDate: "2026-06-01" },
        { branch: "Bandaragama", visitDate: "2026-06-02" },
      ],
      rates
    );
    expect(breakdown.colomboVisits).toBe(1);
    expect(breakdown.bandaragamaVisits).toBe(1);
    expect(breakdown.income).toBe(1000 + 500);
  });
});

describe("OT and salary engine", () => {
  it("computes OT at Rs.250/hour", () => {
    expect(computeOtAmount(10, DEFAULT_RATES.otPerHour)).toBe(2500);
  });

  it("computes extra holiday deduction", () => {
    expect(computeExtraHolidayDeduction(3, 1500)).toBe(4500);
  });

  it("example salary calculation", () => {
    const result = computeFinalSalary({
      basicSalary: 50000,
      incentiveAmount: 4000,
      homeVisitIncome: 10000,
      otAmount: 2500,
      finesTotal: 500,
      extraHolidayDeduction: 1500,
      otherDeductions: 1000,
    });
    expect(result.finalSalary).toBe(63500);
  });
});

describe("revenue helpers", () => {
  it("counts partial payments by amount paid", () => {
    const visit = {
      paymentStatus: "Partially Paid",
      paymentAmount: "5000",
      amountPaid: "2000",
    } as any;
    expect(getVisitCollectedRevenue(visit)).toBe(2000);
    expect(getVisitOutstandingBalance(visit)).toBe(3000);
  });

  it("counts paid visits by full amount", () => {
    const visit = {
      paymentStatus: "Paid",
      paymentAmount: "3500",
      amountPaid: "3500",
    } as any;
    expect(getVisitCollectedRevenue(visit)).toBe(3500);
    expect(getVisitOutstandingBalance(visit)).toBe(0);
  });
});

describe("validation", () => {
  it("requires branch", () => {
    expect(validateBranch("").ok).toBe(false);
    expect(validateBranch("Colombo").ok).toBe(true);
  });

  it("auto-increments session numbers", () => {
    expect(computeNextSessionNumber(0)).toBe(1);
    expect(computeNextSessionNumber(3)).toBe(4);
    expect(computeNextSessionNumber([1, 2, 4])).toBe(5);
  });
});
