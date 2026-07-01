import type { Patient, UpdatePatient, InPatientAdmission, UpdateInPatientAdmission } from "@shared/schema";
import type { OrganizationId } from "@shared/branchAccess";
import type { IStorage } from "../storage";
import { organizationForBranch } from "@shared/branchAccess";
import { generateUniquePatientCode } from "./patientService";
import { signPatientQrToken, verifyPatientQrToken } from "./qrTokenService";

export const CURRENT_PATIENT_DATA_VERSION = 2;

function tokenExpiryDate(token: string): Date | null {
  const verified = verifyPatientQrToken(token);
  if (!verified.ok || !verified.payload?.exp) return null;
  return new Date(verified.payload.exp * 1000);
}

function isValidToken(
  token: string,
  patientId: string,
  organizationId: OrganizationId,
): boolean {
  const verified = verifyPatientQrToken(token);
  return (
    verified.ok &&
    verified.payload?.patientId === patientId &&
    verified.payload?.organizationId === organizationId
  );
}

export async function ensurePatientDataVersion(
  storage: IStorage,
  patient: Patient,
): Promise<{ patient: Patient; qrToken: string }> {
  const organizationId = organizationForBranch(patient.branch);
  const patch: UpdatePatient = {};

  if (!String(patient.patientCode ?? "").trim()) {
    patch.patientCode = await generateUniquePatientCode(
      storage,
      patient.branch,
      patient.registeredDate,
    );
  }

  let qrToken = String(patient.qrToken ?? "").trim();
  if (!qrToken || !isValidToken(qrToken, patient.id, organizationId)) {
    qrToken = signPatientQrToken({ patientId: patient.id, organizationId });
    patch.qrToken = qrToken;
    patch.qrTokenExpiresAt = tokenExpiryDate(qrToken);
  }

  if (!patient.dataVersion || patient.dataVersion < CURRENT_PATIENT_DATA_VERSION) {
    patch.dataVersion = CURRENT_PATIENT_DATA_VERSION;
    patch.dataMigratedAt = new Date();
  }

  if (!patch.dataMigratedAt && (patch.patientCode || patch.qrToken)) {
    patch.dataMigratedAt = new Date();
  }

  if (Object.keys(patch).length > 0) {
    const updated = await storage.updatePatient(patient.id, patch);
    return { patient: updated ?? patient, qrToken };
  }

  return { patient, qrToken };
}

export async function ensureAdmissionQrToken(
  storage: IStorage,
  admission: InPatientAdmission,
  organizationId: OrganizationId,
): Promise<{ admission: InPatientAdmission; qrToken: string }> {
  const patch: UpdateInPatientAdmission = {};
  let qrToken = String((admission as any).qrToken ?? "").trim();
  const expectedPatientId = admission.patientId ?? admission.id;
  if (!qrToken || !isValidToken(qrToken, expectedPatientId, organizationId)) {
    qrToken = signPatientQrToken({ patientId: expectedPatientId, organizationId });
    (patch as any).qrToken = qrToken;
    (patch as any).qrTokenExpiresAt = tokenExpiryDate(qrToken);
  }

  if (Object.keys(patch).length > 0) {
    const updated = await storage.updateInPatientAdmission(admission.id, patch);
    return { admission: updated ?? admission, qrToken };
  }

  return { admission, qrToken };
}
