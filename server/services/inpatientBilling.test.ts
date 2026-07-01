import { describe, expect, it } from "vitest";
import {
  isCarriedForwardExpense,
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
});
