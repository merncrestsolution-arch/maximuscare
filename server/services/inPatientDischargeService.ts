import type { InPatientAdmission } from "@shared/schema";
import type { IStorage } from "../storage";
import { clinicDateString } from "../clinicTime";
import {
  buildDischargeBillLines,
  computeAdmissionBillingBreakdown,
  computeBalanceDue,
  computeStayDays,
  type DischargeBillLine,
} from "@shared/inpatientBilling";

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
};

function normalizePaymentMode(method?: string | null): string {
  const raw = String(method ?? "cash").trim().toLowerCase();
  if (raw === "cash") return "Cash";
  if (raw === "online") return "Online";
  if (raw === "card" || raw === "transfer" || raw === "bank transfer") return "Online";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function admissionDeductionFields(admission: InPatientAdmission) {
  return {
    deductionType: (admission as { deductionType?: "fixed" | "percentage" | null }).deductionType ?? null,
    deductionValue:
      parseFloat(String((admission as { deductionValue?: string | null }).deductionValue ?? 0)) || 0,
    deductionReason: (admission as { deductionReason?: string | null }).deductionReason ?? null,
  };
}

export async function buildInPatientDischargeSummary(
  storage: IStorage,
  admissionId: string,
  dischargeDate?: string,
): Promise<InPatientDischargeSummary | null> {
  const admission = await storage.getInPatientAdmission(admissionId);
  if (!admission) return null;

  const endDate = dischargeDate?.split("T")[0] || clinicDateString();
  const [extraExpenses, payments, branches] = await Promise.all([
    storage.getInPatientExtraExpensesByAdmission(admissionId),
    storage.getInPatientPaymentsByAdmission(admissionId),
    storage.getAllBranches(),
  ]);

  const deduction = admissionDeductionFields(admission);
  const breakdown = computeAdmissionBillingBreakdown({
    admitDate: admission.admitDate,
    endDate,
    amountPerDay: admission.amountPerDay,
    careTakerRatePerDay: admission.careTakerRatePerDay,
    careTakerDaysOverride: admission.careTakerDaysOverride,
    deductionType: deduction.deductionType,
    deductionValue: deduction.deductionValue,
    extraExpenses,
  });

  const amountPerDay = parseFloat(String(admission.amountPerDay)) || 0;
  const careTakerRatePerDay = parseFloat(String(admission.careTakerRatePerDay ?? 0)) || 0;
  const billLines = buildDischargeBillLines(breakdown, {
    amountPerDay,
    careTakerRatePerDay,
    packageType: admission.packageType,
    deductionType: deduction.deductionType,
    deductionValue: deduction.deductionValue,
  });

  const totalPaid = payments.reduce((sum, payment) => sum + (parseFloat(String(payment.amount)) || 0), 0);
  const branchName = admission.branchId
    ? (branches.find((branch) => branch.id === admission.branchId)?.name ?? null)
    : null;

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
    totalDays: breakdown.stayDays,
    totalBill: breakdown.grandTotal,
    subtotal: breakdown.subtotal,
    deductionAmount: breakdown.deductionAmount,
    payments: payments.map((payment) => ({
      id: payment.id,
      date: payment.paymentDate,
      method: payment.paymentMode,
      amount: parseFloat(String(payment.amount)) || 0,
      notes: payment.notes,
    })),
    totalPaid,
    due: computeBalanceDue(breakdown.grandTotal, totalPaid),
    stayAmount: breakdown.roomCharges,
    caretakerTotal: breakdown.caretakerCharges,
    extraExpenseTotal: breakdown.extraExpenseTotal,
    deductionType: deduction.deductionType,
    deductionValue: deduction.deductionValue,
    deductionReason: deduction.deductionReason,
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
  const balance = computeBalanceDue(summary.totalBill, totalPaidAfter);
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
