import type { IStorage } from "../storage";
import type { Visit, VisitPayment } from "@shared/schema";
import { VISIT_PAYMENT_METHODS } from "@shared/schema";
import { derivePaymentStatus, computeOutstandingBalance, validateNonNegative } from "./calculationEngine";

export async function recordVisitPayment(
  storage: IStorage,
  visitId: string,
  data: {
    amount: number | string;
    paymentMethod: string;
    paymentReference?: string;
    paymentDate: string;
    remarks?: string;
    createdByStaffId: string;
    createdByName: string;
  }
): Promise<{ visit: Visit; payment: VisitPayment }> {
  const visit = await storage.getVisit(visitId);
  if (!visit) throw new Error("Visit not found");

  const amount = Number(data.amount);
  const neg = validateNonNegative(amount, "Payment amount");
  if (neg) throw new Error(neg);
  if (!VISIT_PAYMENT_METHODS.includes(data.paymentMethod as (typeof VISIT_PAYMENT_METHODS)[number])) {
    throw new Error("Invalid payment method");
  }

  const totalAmount = Number(visit.paymentAmount) || 0;
  const currentPaid = Number((visit as { amountPaid?: string }).amountPaid ?? 0) || 0;
  const newPaid = currentPaid + amount;
  if (newPaid > totalAmount && totalAmount > 0) {
    throw new Error(`Payment exceeds outstanding balance of Rs.${computeOutstandingBalance(totalAmount, currentPaid)}`);
  }

  const payment = await storage.createVisitPayment({
    visitId,
    amount: String(amount),
    paymentMethod: data.paymentMethod,
    paymentReference: data.paymentReference ?? null,
    paymentDate: data.paymentDate,
    remarks: data.remarks ?? null,
    createdByStaffId: data.createdByStaffId,
    createdByName: data.createdByName,
  } as any);

  const paymentStatus = derivePaymentStatus(totalAmount, newPaid);
  const updated = await storage.updateVisit(visitId, {
    amountPaid: String(newPaid),
    paymentStatus,
    paymentMode: data.paymentMethod,
  } as any);

  if (!updated) throw new Error("Failed to update visit payment status");
  return { visit: updated, payment };
}

export function enrichVisitWithBalance(visit: Visit) {
  const total = Number(visit.paymentAmount) || 0;
  const paid = Number((visit as { amountPaid?: string }).amountPaid ?? 0) || 0;
  return {
    ...visit,
    outstandingBalance: computeOutstandingBalance(total, paid),
  };
}
