import type { IStorage } from "../storage";
import { clinicDateString } from "../clinicTime";
import {
  buildDischargeBillLines,
  computeStayDays,
  type DischargeBillLine,
} from "@shared/inpatientBilling";
import { calculateAdmissionBilling } from "./inPatientBillingService";

export type DischargeSummaryPayment = {
  id: string;
  date: string;
  method: string;
  amount: number;
  notes?: string | null;
};

export type InPatientDischargeSummary = {
  inpatient: {
    id: string;
    name: string;
    patientCode: string | null;
    admitDate: string;
    branchId: string | null;
    branchName: string | null;
    condition: string;
    packageType: string;
    amountPerDay: number;
  };
  dischargeDate: string;
  billLines: DischargeBillLine[];
  totalDays: number;
  totalBill: number;
  subtotal: number;
  deductionAmount: number;
  payments: DischargeSummaryPayment[];
  totalPaid: number;
  due: number;
  stayAmount: number;
  caretakerTotal: number;
  extraExpenseTotal: number;
  deductionType: "fixed" | "percentage" | null;
  deductionValue: number;
  deductionReason: string | null;
  previousPendingTotal: number;
  previousDeductionTotal: number;
  currentChargesTotal: number;
  priorBalancePaid: number;
  currentBalancePaid: number;
  priorBalanceRemaining: number;
  currentBalanceRemaining: number;
};

function normalizePaymentMode(method?: string | null): string {
  const raw = String(method ?? "cash").trim().toLowerCase();
  if (raw === "cash") return "Cash";
  if (raw === "online") return "Online";
  if (raw === "card" || raw === "transfer" || raw === "bank transfer") return "Online";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export async function buildInPatientDischargeSummary(
  storage: IStorage,
  admissionId: string,
  dischargeDate?: string,
): Promise<InPatientDischargeSummary | null> {
  const endDate = dischargeDate?.split("T")[0] || clinicDateString();
  const billing = await calculateAdmissionBilling(storage, admissionId, { asOfDate: endDate });
  if (!billing) return null;

  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return null;

  const branches = await storage.getAllBranches();
  const amountPerDay = parseFloat(String(admission.amountPerDay)) || 0;
  const careTakerRatePerDay = parseFloat(String(admission.careTakerRatePerDay ?? 0)) || 0;
  const branchName = admission.branchId
    ? (branches.find((branch) => branch.id === admission.branchId)?.name ?? null)
    : null;

  const billLines = buildDischargeBillLines(billing.currentBreakdown, {
    amountPerDay,
    careTakerRatePerDay,
    packageType: admission.packageType,
    deductionType: billing.currentBilling.deductionType,
    deductionValue: billing.currentBilling.deductionValue,
  });

  if (billing.previousBilling.totalPending > 0) {
    billLines.splice(billLines.findIndex((line) => line.description === "Extra Expenses") >= 0
      ? billLines.findIndex((line) => line.description === "Extra Expenses")
      : billLines.length, 0, {
      description: "Previous Stay Balance Due",
      quantity: "-",
      rate: null,
      amount: billing.previousBilling.totalPending,
    });
  } else if (billing.previousBilling.totalPending < 0) {
    billLines.push({
      description: "Previous Overpayment Credit Applied",
      quantity: "-",
      rate: null,
      amount: billing.previousBilling.totalPending,
    });
  }

  return {
    inpatient: {
      id: admission.id,
      name: admission.patientName,
      patientCode: admission.patientCode ?? null,
      admitDate: admission.admitDate,
      branchId: admission.branchId ?? null,
      branchName,
      condition: admission.condition,
      packageType: admission.packageType,
      amountPerDay,
    },
    dischargeDate: endDate,
    billLines,
    totalDays: billing.currentBilling.stayDays,
    totalBill: billing.totals.totalBill,
    subtotal: billing.currentBilling.subtotal + billing.previousBilling.totalPending,
    deductionAmount: billing.currentBilling.deductionAmount,
    payments: billing.currentBilling.payments.map((payment) => ({
      id: payment.id,
      date: payment.paymentDate,
      method: payment.paymentMode,
      amount: payment.amount,
      notes: payment.notes,
    })),
    totalPaid: billing.totals.totalPaid,
    due: billing.totals.totalBalanceDue,
    stayAmount: billing.currentBilling.roomCharges,
    caretakerTotal: billing.currentBilling.caretakerCharges,
    extraExpenseTotal: billing.currentBilling.otherCharges,
    deductionType: billing.currentBilling.deductionType,
    deductionValue: billing.currentBilling.deductionValue ?? 0,
    deductionReason: billing.currentBilling.deductionReason,
    previousPendingTotal: billing.previousBilling.totalPending,
    previousDeductionTotal: billing.previousBilling.totalDeduction,
    currentChargesTotal: billing.currentBilling.chargesTotal,
    priorBalancePaid: billing.totals.priorBalancePaid,
    currentBalancePaid: billing.totals.currentBalancePaid,
    priorBalanceRemaining: billing.totals.priorBalanceRemaining,
    currentBalanceRemaining: billing.totals.currentBalanceRemaining,
  };
}

export type ProcessDischargeInput = {
  dischargeDate?: string;
  nowPaying?: number | string;
  paymentMethod?: string;
  paymentDate?: string;
  notes?: string;
};

export async function processInPatientDischarge(
  storage: IStorage,
  admissionId: string,
  input: ProcessDischargeInput,
  actor: { staffId: string; name?: string | null },
) {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) throw new Error("Admission not found");
  if (admission.status === "Discharged") throw new Error("Patient already discharged");

  const dischargeDate = input.dischargeDate?.split("T")[0] || clinicDateString();
  const nowPaying = parseFloat(String(input.nowPaying ?? 0)) || 0;

  if (nowPaying > 0) {
    const paymentDate = input.paymentDate?.split("T")[0] || dischargeDate;
    await storage.createInPatientPayment({
      admissionId,
      paymentDate,
      amount: nowPaying.toFixed(2),
      paymentMode: normalizePaymentMode(input.paymentMethod),
      notes: input.notes?.trim() || "Final payment at discharge",
      createdByStaffId: actor.staffId,
      createdByName: actor.name || "System",
    } as any);
  }

  const summary = await buildInPatientDischargeSummary(storage, admissionId, dischargeDate);
  if (!summary) throw new Error("Admission not found");

  const totalPaidAfter = summary.totalPaid;
  const balance = summary.due;
  const paymentStatus = balance <= 0 ? "Paid" : "Unpaid";

  const discharge = await storage.createInPatientDischarge({
    admissionId,
    patientName: admission.patientName,
    dischargeDate,
    daysCount: computeStayDays(admission.admitDate, dischargeDate),
    amountPerDay: String(admission.amountPerDay),
    stayAmount: summary.stayAmount.toFixed(2),
    otherAmounts: null,
    otherTotal: (summary.caretakerTotal + summary.extraExpenseTotal).toFixed(2),
    deductionType: summary.deductionAmount > 0 ? summary.deductionType : null,
    deductionValue: summary.deductionValue.toFixed(2),
    deductionAmount: summary.deductionAmount.toFixed(2),
    deductionReason: summary.deductionReason,
    grandTotal: summary.totalBill.toFixed(2),
    amountPaid: totalPaidAfter.toFixed(2),
    balance: balance.toFixed(2),
    paymentStatus,
    paymentMode: normalizePaymentMode(input.paymentMethod),
    notes: input.notes?.trim() || null,
  } as any);

  await storage.updateInPatientAdmission(admissionId, { status: "Discharged" });
  if (admission.patientId) {
    await storage.updatePatient(admission.patientId, { status: "Discharged" });
  }

  return { discharge, summary, balance };
}
