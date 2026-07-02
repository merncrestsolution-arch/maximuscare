import { describe, expect, it } from "vitest";
import {
  buildDischargeBillLines,
  computeAdmissionBillingBreakdown,
} from "../../shared/inpatientBilling";
import { buildInPatientDischargeSummary } from "./inPatientDischargeService";

describe("inPatientDischargeService", () => {
  it("builds discharge bill lines from admission breakdown", () => {
    const breakdown = computeAdmissionBillingBreakdown({
      admitDate: "2026-07-01",
      endDate: "2026-07-05",
      amountPerDay: 2000,
      careTakerRatePerDay: 500,
      extraExpenses: [{ description: "Food", amount: "300" }],
    });
    const lines = buildDischargeBillLines(breakdown, {
      amountPerDay: 2000,
      careTakerRatePerDay: 500,
      packageType: "AC Room",
    });
    expect(lines.some((line) => line.description.includes("Room Charges"))).toBe(true);
    expect(lines.some((line) => line.description === "Extra Expenses")).toBe(true);
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    expect(total).toBe(breakdown.grandTotal);
  });

  it("returns discharge summary with payment history and unclamped due", async () => {
    const storage = {
      getInPatientAdmission: async () => ({
        id: "a1",
        patientName: "Test Patient",
        patientCode: "P001",
        admitDate: "2026-07-01",
        branchId: "b1",
        condition: "Back pain",
        packageType: "Non-AC Room",
        amountPerDay: "1000",
        careTakerRatePerDay: "0",
        careTakerDaysOverride: null,
        deductionType: null,
        deductionValue: "0",
        deductionReason: null,
      }),
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientPaymentsByAdmission: async () => [
        {
          id: "p1",
          paymentDate: "2026-07-02",
          amount: "15000",
          paymentMode: "Cash",
          notes: null,
        },
      ],
      getAllBranches: async () => [{ id: "b1", name: "Dehiwala" }],
      getPatientTransferLogsByAdmission: async () => [],
      getInPatientDischargeByAdmission: async () => null,
      getAllInPatientAdmissions: async () => [
        {
          id: "a1",
          patientCode: "P001",
          branchId: "b1",
          admitDate: "2026-07-01",
          status: "Admitted",
          amountPerDay: "1000",
        },
      ],
      getInPatientAdmissionsForPatient: async () => [],
      getPaymentTotalByAdmission: async () => 0,
      getInPatientSessionsByAdmission: async () => [],
      getInPatientPriorBillingExclusionsByAdmission: async () => [],
    };

    const summary = await buildInPatientDischargeSummary(storage as any, "a1", "2026-07-03");
    expect(summary?.totalPaid).toBe(15000);
    expect(summary?.payments).toHaveLength(1);
    expect(summary?.due).toBe((summary?.totalBill ?? 0) - 15000);
    expect(summary?.inpatient.branchName).toBe("Dehiwala");
  });

  it("separates previous stay balance on discharge bill lines", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) => {
        if (id === "a2") {
          return {
            id: "a2",
            patientName: "Re-admit Patient",
            patientCode: "P002",
            patientId: "p2",
            admitDate: "2026-07-05",
            branchId: "b1",
            condition: "Stroke",
            packageType: "Non-AC Room",
            amountPerDay: "1000",
            careTakerRatePerDay: "0",
            careTakerDaysOverride: null,
            deductionType: null,
            deductionValue: "0",
            deductionReason: null,
            admissionSource: "readmit:prior",
          };
        }
        if (id === "prior") {
          return {
            id: "prior",
            patientName: "Re-admit Patient",
            patientCode: "P002",
            patientId: "p2",
            admitDate: "2026-07-01",
            branchId: "b1",
            status: "Discharged",
            amountPerDay: "1000",
            careTakerRatePerDay: "0",
            careTakerDaysOverride: null,
            deductionType: null,
            deductionValue: "0",
          };
        }
        return undefined;
      },
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientPaymentsByAdmission: async () => [
        { id: "p1", paymentDate: "2026-07-06", amount: "5000", paymentMode: "Cash", notes: null },
      ],
      getAllBranches: async () => [{ id: "b1", name: "Dehiwala" }],
      getPatientTransferLogsByAdmission: async () => [],
      getInPatientDischargeByAdmission: async (id: string) =>
        id === "prior" ? ({ dischargeDate: "2026-07-04" } as any) : null,
      getAllInPatientAdmissions: async () => [
        {
          id: "prior",
          patientCode: "P002",
          patientId: "p2",
          branchId: "b1",
          admitDate: "2026-07-01",
          status: "Discharged",
          amountPerDay: "1000",
        },
        {
          id: "a2",
          patientCode: "P002",
          patientId: "p2",
          branchId: "b1",
          admitDate: "2026-07-05",
          status: "Admitted",
          amountPerDay: "1000",
          admissionSource: "readmit:prior",
        },
      ],
      getInPatientAdmissionsForPatient: async () => [
        {
          id: "prior",
          patientCode: "P002",
          patientId: "p2",
          branchId: "b1",
          admitDate: "2026-07-01",
          status: "Discharged",
          amountPerDay: "1000",
        },
        {
          id: "a2",
          patientCode: "P002",
          patientId: "p2",
          branchId: "b1",
          admitDate: "2026-07-05",
          status: "Admitted",
          amountPerDay: "1000",
          admissionSource: "readmit:prior",
        },
      ],
      getPaymentTotalByAdmission: async (id: string) => (id === "prior" ? 0 : 0),
      getInPatientSessionsByAdmission: async () => [],
      getInPatientPriorBillingExclusionsByAdmission: async () => [],
    };

    const summary = await buildInPatientDischargeSummary(storage as any, "a2", "2026-07-07");
    expect(summary?.billLines.some((line) => line.description === "Previous Stay Balance Due")).toBe(true);
    expect(summary?.totalBill).toBe(1000 * 3 + 4000);
    expect(summary?.due).toBe(2000);
    expect(summary?.priorBalancePaid).toBe(4000);
    expect(summary?.currentBalancePaid).toBe(1000);
  });
});
