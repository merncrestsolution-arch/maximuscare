import { describe, expect, it } from "vitest";
import {
  collectReadmitChainPriorAdmissionIds,
  computeAdmissionGrandTotal,
  computeTotalPendingBalance,
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

  it("allocates payments to the current episode before prior balance", () => {
    expect(splitReAdmissionPayments(3000, 5000, 10000)).toEqual({
      currentEpisodePaid: 3000,
      priorBalancePaid: 0,
      currentBalanceDue: 2000,
      priorBalanceDue: 10000,
    });
    expect(splitReAdmissionPayments(8000, 5000, 10000)).toEqual({
      currentEpisodePaid: 5000,
      priorBalancePaid: 3000,
      currentBalanceDue: 0,
      priorBalanceDue: 7000,
    });
    expect(splitReAdmissionPayments(16000, 5000, 10000)).toEqual({
      currentEpisodePaid: 5000,
      priorBalancePaid: 10000,
      currentBalanceDue: 0,
      priorBalanceDue: 0,
    });
  });

  it("totals current and prior pending balance", () => {
    expect(computeTotalPendingBalance(2000, 1000)).toBe(3000);
    expect(computeTotalPendingBalance(0, 0)).toBe(0);
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
