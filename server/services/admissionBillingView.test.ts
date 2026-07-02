import { describe, expect, it } from "vitest";
import { buildAdmissionBillingView } from "../../shared/admissionBillingView";
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
