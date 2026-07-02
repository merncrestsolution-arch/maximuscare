import { describe, expect, it } from "vitest";
import {
  allocatePriorPaymentsAcrossLines,
  buildAdmissionBillingView,
} from "../../shared/admissionBillingView";
import { computeAdmissionBillingBreakdown } from "../../shared/inpatientBilling";

describe("admissionBillingView", () => {
  it("combines live previous pending with current charges and allocates payments prior-first", () => {
    const currentBreakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-03",
      endDate: "2026-07-03",
      amountPerDay: 7000,
      careTakerRatePerDay: 0,
      deductionType: "fixed",
      deductionValue: 500,
    });

    const view = buildAdmissionBillingView({
      previousLines: [
        {
          sourceId: "transfer:t1",
          sourceLabel: "Nexus Physio stay",
          episodeType: "transfer",
          admitDate: "2026-07-01",
          dischargeDate: "2026-07-02",
          branchName: "Nexus Physio",
          grandTotal: 12_000,
          amountPaid: 10_000,
          deductionAmount: 2000,
          deductionReason: "no food",
          pendingBalance: 2000,
          appliedFromCurrentPayments: 0,
          remainingPending: 2000,
        },
      ],
      currentBreakdown,
      currentPayments: [
        {
          id: "p1",
          paymentDate: "2026-07-02",
          createdAt: "2026-07-02T12:47:00.000Z",
          paymentMode: "Cash",
          amount: 5000,
        },
      ],
      paymentsTotalForAllocation: 5000,
    });

    expect(view.previousBilling.totalPending).toBe(2000);
    expect(view.currentBilling.chargesTotal).toBe(6500);
    expect(view.totals.totalBill).toBe(8500);
    expect(view.totals.priorBalancePaid).toBe(2000);
    expect(view.totals.currentBalancePaid).toBe(3000);
    expect(view.totals.totalBalanceDue).toBe(3500);
    expect(view.totals.overpaymentCredit).toBe(0);
    expect(view.previousBilling.lines[0].appliedFromCurrentPayments).toBe(2000);
    expect(view.previousBilling.lines[0].remainingPending).toBe(0);
    expect(view.previousBilling.totalPendingRemaining).toBe(0);
  });

  it("sums pending across multiple prior readmit admissions", () => {
    const currentBreakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-10",
      endDate: "2026-07-10",
      amountPerDay: 5000,
      careTakerRatePerDay: 0,
    });

    const view = buildAdmissionBillingView({
      previousLines: [
        {
          sourceId: "a1",
          sourceLabel: "Admission 2026-06-01",
          episodeType: "readmit",
          admitDate: "2026-06-01",
          dischargeDate: "2026-06-15",
          branchName: null,
          grandTotal: 8000,
          amountPaid: 6000,
          deductionAmount: 0,
          deductionReason: null,
          pendingBalance: 2000,
          appliedFromCurrentPayments: 0,
          remainingPending: 2000,
        },
        {
          sourceId: "a2",
          sourceLabel: "Admission 2026-07-01",
          episodeType: "readmit",
          admitDate: "2026-07-01",
          dischargeDate: "2026-07-05",
          branchName: null,
          grandTotal: 4000,
          amountPaid: 3000,
          deductionAmount: 0,
          deductionReason: null,
          pendingBalance: 1000,
          appliedFromCurrentPayments: 0,
          remainingPending: 1000,
        },
      ],
      currentBreakdown,
      currentPayments: [],
      paymentsTotalForAllocation: 0,
    });

    expect(view.previousBilling.totalPending).toBe(3000);
    expect(view.totals.totalBill).toBe(8000);
    expect(view.totals.totalBalanceDue).toBe(8000);
  });

  it("handles first-time patient with no previous billing", () => {
    const currentBreakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-01",
      endDate: "2026-07-03",
      amountPerDay: 7000,
      careTakerRatePerDay: 0,
    });

    const view = buildAdmissionBillingView({
      previousLines: [],
      currentBreakdown,
      currentPayments: [{ id: "p1", paymentDate: "2026-07-02", createdAt: null, paymentMode: "Cash", amount: 5000 }],
      paymentsTotalForAllocation: 5000,
    });

    expect(view.previousBilling.applicable).toBe(false);
    expect(view.previousBilling.totalPending).toBe(0);
    expect(view.totals.totalBill).toBe(21_000);
    expect(view.totals.totalBalanceDue).toBe(16_000);
  });
});

describe("allocatePriorPaymentsAcrossLines", () => {
  it("applies current-bill payments to oldest prior lines first", () => {
    const lines = allocatePriorPaymentsAcrossLines(
      [
        {
          sourceId: "a1",
          sourceLabel: "Older",
          episodeType: "readmit",
          admitDate: "2026-06-01",
          dischargeDate: "2026-06-10",
          branchName: null,
          grandTotal: 5000,
          amountPaid: 3000,
          deductionAmount: 0,
          deductionReason: null,
          pendingBalance: 2000,
          appliedFromCurrentPayments: 0,
          remainingPending: 2000,
        },
        {
          sourceId: "a2",
          sourceLabel: "Newer",
          episodeType: "readmit",
          admitDate: "2026-07-01",
          dischargeDate: "2026-07-05",
          branchName: null,
          grandTotal: 3000,
          amountPaid: 2000,
          deductionAmount: 0,
          deductionReason: null,
          pendingBalance: 1000,
          appliedFromCurrentPayments: 0,
          remainingPending: 1000,
        },
      ],
      2500,
    );

    expect(lines[0].appliedFromCurrentPayments).toBe(2000);
    expect(lines[0].remainingPending).toBe(0);
    expect(lines[1].appliedFromCurrentPayments).toBe(500);
    expect(lines[1].remainingPending).toBe(500);
  });
});

describe("payment auto-deduction from previous pending", () => {
  it("reduces previous pending when patient pays on current bill", () => {
    const currentBreakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-05",
      endDate: "2026-07-05",
      amountPerDay: 5000,
      careTakerRatePerDay: 0,
    });

    const view = buildAdmissionBillingView({
      previousLines: [
        {
          sourceId: "prior",
          sourceLabel: "Prior stay",
          episodeType: "readmit",
          admitDate: "2026-07-01",
          dischargeDate: "2026-07-04",
          branchName: null,
          grandTotal: 4000,
          amountPaid: 2000,
          deductionAmount: 0,
          deductionReason: null,
          pendingBalance: 2000,
          appliedFromCurrentPayments: 0,
          remainingPending: 2000,
        },
      ],
      currentBreakdown,
      currentPayments: [
        {
          id: "p1",
          paymentDate: "2026-07-05",
          createdAt: null,
          paymentMode: "Cash",
          amount: 500,
        },
      ],
      paymentsTotalForAllocation: 500,
    });

    expect(view.totals.priorBalancePaid).toBe(500);
    expect(view.totals.priorBalanceRemaining).toBe(1500);
    expect(view.previousBilling.lines[0].remainingPending).toBe(1500);
  });
});
