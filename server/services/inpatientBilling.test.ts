import { describe, expect, it } from "vitest";
import {
  collectReadmitChainPriorAdmissionIds,
  computeAdmissionGrandTotal,
  computeAdmissionBalanceDue,
  computeBalanceDue,
  computeStayDays,
  computeTotalPendingBalance,
  buildDischargeBillLines,
  computeAdmissionBillingBreakdown,
  isCarriedForwardExpense,
  parseReadmitAdmissionSource,
  splitReAdmissionPayments,
  sumCarriedForwardAmounts,
} from "../../shared/inpatientBilling";

describe("inpatientBilling", () => {
  it("detects carried-forward expenses by description", () => {
    expect(
      isCarriedForwardExpense({
        description: "Previous admission balance carried forward (discharged 2026-01-15)",
      }),
    ).toBe(true);
    expect(isCarriedForwardExpense({ description: "Food supplies" })).toBe(false);
  });

  it("sums carried-forward expenses only", () => {
    const total = sumCarriedForwardAmounts([
      { description: "Previous admission balance carried forward", amount: "6500" },
      { description: "Nurse visit", amount: "1200" },
    ]);
    expect(total).toBe(6500);
  });

  it("allocates payments to previous due before the current episode", () => {
    expect(splitReAdmissionPayments(3000, 5000, 10000)).toEqual({
      priorBalancePaid: 3000,
      currentEpisodePaid: 0,
      priorBalanceDue: 7000,
      currentBalanceDue: 5000,
    });
    expect(splitReAdmissionPayments(8000, 5000, 10000)).toEqual({
      priorBalancePaid: 8000,
      currentEpisodePaid: 0,
      priorBalanceDue: 2000,
      currentBalanceDue: 5000,
    });
    expect(splitReAdmissionPayments(12000, 5000, 10000)).toEqual({
      priorBalancePaid: 10000,
      currentEpisodePaid: 2000,
      priorBalanceDue: 0,
      currentBalanceDue: 3000,
    });
    expect(splitReAdmissionPayments(16000, 5000, 10000)).toEqual({
      priorBalancePaid: 10000,
      currentEpisodePaid: 5000,
      priorBalanceDue: 0,
      currentBalanceDue: 0,
    });
  });

  it("allows negative balance when overpaid", () => {
    expect(computeAdmissionBalanceDue(10000, 12000)).toBe(-2000);
    expect(computeBalanceDue(5000, 8000)).toBe(-3000);
  });

  it("counts inclusive stay days in Sri Lanka timezone", () => {
    expect(computeStayDays("2026-06-25", "2026-06-29")).toBe(5);
    expect(computeStayDays("2026-07-01", "2026-07-01")).toBe(1);
    expect(computeStayDays("2026-07-01", "2026-07-03")).toBe(3);
  });

  it("totals current and prior pending balance including credit", () => {
    expect(computeTotalPendingBalance(2000, 1000)).toBe(3000);
    expect(computeTotalPendingBalance(0, 0)).toBe(0);
    expect(computeTotalPendingBalance(-500, 0)).toBe(-500);
  });

  it("computes live admission grand total", () => {
    const total = computeAdmissionGrandTotal({
      admitDate: "2026-07-01",
      endDate: "2026-07-03",
      amountPerDay: 1000,
      careTakerRatePerDay: 500,
      extraExpenses: [{ description: "Food", amount: "200" }],
    });
    expect(total).toBe(1000 * 3 + 500 * 3 + 200);
  });

  it("builds discharge bill lines", () => {
    const breakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-01",
      endDate: "2026-07-03",
      amountPerDay: 1000,
      careTakerRatePerDay: 500,
      extraExpenses: [{ description: "Food", amount: "200" }],
    });
    const lines = buildDischargeBillLines(breakdown, {
      amountPerDay: 1000,
      careTakerRatePerDay: 500,
      packageType: "AC Room",
    });
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(breakdown.grandTotal);
  });

  it("walks the readmit chain", () => {
    const related = new Map([
      ["a2", { admissionSource: "readmit:a1" }],
      ["a1", { admissionSource: null }],
    ]);
    expect(collectReadmitChainPriorAdmissionIds({ admissionSource: "readmit:a2" }, related)).toEqual([
      "a2",
      "a1",
    ]);
    expect(parseReadmitAdmissionSource("readmit:a1")).toBe("a1");
  });
});
