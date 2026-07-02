import { describe, expect, it } from "vitest";
import {
  collectReadmitChainPriorAdmissionIds,
  computeAdmissionBalanceSummary,
  computeAdmissionGrandTotal,
  computeAdmissionBalanceDue,
  computeBalanceDue,
  computeStayDays,
  computeTotalPendingBalance,
  applyLiveTransferCarriedForward,
  buildDischargeBillLines,
  computeAdmissionBillingBreakdown,
  computeBranchStaySegmentBilling,
  computeTransferStayPaymentAllocation,
  formatInpatientPaymentTimestamp,
  getPaymentsForCurrentStay,
  getPaymentsForPriorTransferStays,
  getSessionsForCurrentStay,
  getSessionsForPriorTransferStays,
  isCarriedForwardExpense,
  parseReadmitAdmissionSource,
  resolveDeductionSegmentIndex,
  splitReAdmissionPayments,
  sumCarriedForwardAmounts,
  sumPaymentAmounts,
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
      overpaymentCredit: 0,
    });
    expect(splitReAdmissionPayments(8000, 5000, 10000)).toEqual({
      priorBalancePaid: 8000,
      currentEpisodePaid: 0,
      priorBalanceDue: 2000,
      currentBalanceDue: 5000,
      overpaymentCredit: 0,
    });
    expect(splitReAdmissionPayments(12000, 5000, 10000)).toEqual({
      priorBalancePaid: 10000,
      currentEpisodePaid: 2000,
      priorBalanceDue: 0,
      currentBalanceDue: 3000,
      overpaymentCredit: 0,
    });
    expect(splitReAdmissionPayments(16000, 5000, 10000)).toEqual({
      priorBalancePaid: 10000,
      currentEpisodePaid: 5000,
      priorBalanceDue: 0,
      currentBalanceDue: 0,
      overpaymentCredit: 1000,
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

  it("excludes carried-forward balance from deduction and extra expense total", () => {
    const breakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-01",
      endDate: "2026-07-03",
      amountPerDay: 1000,
      careTakerRatePerDay: 0,
      deductionType: "percentage",
      deductionValue: 10,
      extraExpenses: [
        { description: "Previous admission balance carried forward", amount: "5000" },
        { description: "Food", amount: "200" },
      ],
    });
    expect(breakdown.extraExpenseTotal).toBe(200);
    expect(breakdown.carriedForwardTotal).toBe(5000);
    expect(breakdown.carriedForwardDebt).toBe(5000);
    expect(breakdown.carriedForwardCreditApplied).toBe(0);
    expect(breakdown.currentSubtotal).toBe(1000 * 3 + 200);
    expect(breakdown.deductionAmount).toBe(320);
    expect(breakdown.currentGrandTotal).toBe(2880);
    expect(breakdown.grandTotal).toBe(7880);
  });

  it("auto-deducts prior overpayment credit from current bill", () => {
    const breakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-01",
      endDate: "2026-07-03",
      amountPerDay: 1000,
      extraExpenses: [{ description: "Previous admission credit carried forward", amount: "-2000" }],
    });
    expect(breakdown.carriedForwardTotal).toBe(-2000);
    expect(breakdown.carriedForwardCreditApplied).toBe(2000);
    expect(breakdown.carriedForwardDebt).toBe(0);
    expect(breakdown.currentGrandTotal).toBe(3000);
    expect(breakdown.grandTotal).toBe(1000);

    const summary = computeAdmissionBalanceSummary(breakdown, 0);
    expect(summary.netBalanceDue).toBe(1000);
    expect(summary.hasCarriedForwardCredit).toBe(true);
    expect(summary.hasCarriedForwardBalance).toBe(false);
  });

  it("allocates payments when prior credit reduces the bill", () => {
    expect(splitReAdmissionPayments(500, 5000, -2000)).toEqual({
      priorBalancePaid: 0,
      currentEpisodePaid: 500,
      priorBalanceDue: 0,
      currentBalanceDue: 2500,
      overpaymentCredit: 0,
    });
    expect(splitReAdmissionPayments(4000, 5000, -2000)).toEqual({
      priorBalancePaid: 0,
      currentEpisodePaid: 3000,
      priorBalanceDue: 0,
      currentBalanceDue: -1000,
      overpaymentCredit: 1000,
    });
  });

  it("computes admission balance summary with payment split", () => {
    const breakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-01",
      endDate: "2026-07-03",
      amountPerDay: 1000,
      extraExpenses: [{ description: "Previous admission balance carried forward", amount: "10000" }],
    });
    const summary = computeAdmissionBalanceSummary(breakdown, 12000);
    expect(summary.priorBalancePaid).toBe(10000);
    expect(summary.currentEpisodePaid).toBe(2000);
    expect(summary.totalBalanceDue).toBe(1000);
    expect(summary.netBalanceDue).toBe(1000);
  });

  it("builds discharge bill lines with separate carried-forward row", () => {
    const breakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-01",
      endDate: "2026-07-03",
      amountPerDay: 1000,
      extraExpenses: [
        { description: "Previous admission balance carried forward", amount: "5000" },
        { description: "Food", amount: "200" },
      ],
    });
    const lines = buildDischargeBillLines(breakdown, { amountPerDay: 1000, careTakerRatePerDay: 0 });
    expect(lines.some((line) => line.description === "Previous Admission Balance")).toBe(true);
    expect(lines.some((line) => line.description === "Extra Expenses")).toBe(true);
    expect(lines.reduce((sum, line) => sum + line.amount, 0)).toBe(breakdown.grandTotal);
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

  it("attributes deduction to the closed branch segment when applied before transfer", () => {
    const transfers = [{ transferDate: "2026-06-10" }];
    expect(resolveDeductionSegmentIndex("2026-06-08", "2026-06-01", transfers)).toBe(0);
    expect(resolveDeductionSegmentIndex("2026-06-10", "2026-06-01", transfers)).toBe(0);
    expect(resolveDeductionSegmentIndex("2026-06-11", "2026-06-01", transfers)).toBe(0);
    expect(resolveDeductionSegmentIndex(null, "2026-06-01", transfers)).toBe(0);
    expect(resolveDeductionSegmentIndex("2026-06-08", "2026-06-01", [])).toBe("current");
  });

  it("applies deduction only to the owning transfer segment", () => {
    const breakdown = computeBranchStaySegmentBilling({
      admitDate: "2026-06-01",
      endDate: "2026-06-10",
      amountPerDay: 1000,
      careTakerRatePerDay: 0,
      deductionType: "fixed",
      deductionValue: 500,
    });
    expect(breakdown.stayDays).toBe(10);
    expect(breakdown.deductionAmount).toBe(500);
    expect(breakdown.grandTotal).toBe(10_000 - 500);

    const without = computeBranchStaySegmentBilling({
      admitDate: "2026-06-01",
      endDate: "2026-06-10",
      amountPerDay: 1000,
      careTakerRatePerDay: 0,
    });
    expect(without.deductionAmount).toBe(0);
    expect(without.grandTotal).toBe(10_000);
  });

  it("replaces stored transfer carry-forward with live prior pending", () => {
    const expenses = applyLiveTransferCarriedForward({
      expenses: [
        {
          description: "previous branch balance carried forward (transferred 2026-07-02 from Neuro)",
          amount: "2000",
          expenseDate: "2026-07-02",
        },
        { description: "Food", amount: "100", expenseDate: "2026-07-03" },
      ],
      transferLogs: [{ transferDate: "2026-07-02", fromBranchName: "Neuro Rehabilitation" }],
      priorTransferPendingBalance: 1000,
    });
    expect(expenses).toHaveLength(2);
    expect(expenses[1].description).toContain("previous branch balance carried forward");
    expect(expenses[1].amount).toBe("1000");
  });

  it("allocates payments to prior branch stays before the current stay", () => {
    const allocation = computeTransferStayPaymentAllocation({
      priorSegmentGrandTotals: [10_000],
      currentSegmentGrandTotal: 3000,
      paymentTotal: 5000,
    });
    expect(allocation.priorSegmentsPaid).toBe(5000);
    expect(allocation.currentSegmentPaid).toBe(0);
    expect(allocation.currentSegmentPending).toBe(3000);

    const fullyPaidPrior = computeTransferStayPaymentAllocation({
      priorSegmentGrandTotals: [10_000],
      currentSegmentGrandTotal: 3000,
      paymentTotal: 12_000,
    });
    expect(fullyPaidPrior.priorSegmentsPaid).toBe(10_000);
    expect(fullyPaidPrior.currentSegmentPaid).toBe(2000);
    expect(fullyPaidPrior.currentSegmentPending).toBe(1000);
  });

  it("splits payments by branch transfer using recorded timestamps", () => {
    const transferAt = "2026-07-02T10:00:00.000Z";
    const payments = [
      { paymentDate: "2026-07-02", createdAt: "2026-07-02T08:00:00.000Z", amount: "6000" },
      { paymentDate: "2026-07-02", createdAt: "2026-07-02T12:00:00.000Z", amount: "4000" },
    ];
    const transfers = [{ transferDate: "2026-07-02", createdAt: transferAt }];
    expect(getPaymentsForPriorTransferStays(payments, transfers)).toHaveLength(1);
    expect(getPaymentsForCurrentStay(payments, transfers)).toHaveLength(1);
    expect(sumPaymentAmounts(getPaymentsForCurrentStay(payments, transfers))).toBe(4000);
    expect(formatInpatientPaymentTimestamp(payments[0])).toContain("2026");
  });

  it("splits sessions by branch transfer using recorded timestamps", () => {
    const transferAt = "2026-07-02T10:00:00.000Z";
    const sessions = [
      { sessionDate: "2026-07-02", createdAt: "2026-07-02T08:00:00.000Z" },
      { sessionDate: "2026-07-02", createdAt: "2026-07-02T12:00:00.000Z" },
    ];
    const transfers = [{ transferDate: "2026-07-02", createdAt: transferAt }];
    expect(getSessionsForPriorTransferStays(sessions, transfers)).toHaveLength(1);
    expect(getSessionsForCurrentStay(sessions, transfers)).toHaveLength(1);
  });
});
