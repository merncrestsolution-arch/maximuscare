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

export interface PatientDataHealthSummary {
  totalPatients: number;
  currentDataVersion: number;
  outdatedDataVersion: number;
  missingPatientCode: number;
  missingQrToken: number;
  missingIdCardCache: number;
}

export async function getPatientDataHealthSummary(storage: IStorage): Promise<PatientDataHealthSummary> {
  const all = await storage.getAllPatients();
  const active = all.filter((p) => !p.deletedAt);
  return {
    totalPatients: active.length,
    currentDataVersion: CURRENT_PATIENT_DATA_VERSION,
    outdatedDataVersion: active.filter(
      (p) => !p.dataVersion || p.dataVersion < CURRENT_PATIENT_DATA_VERSION,
    ).length,
    missingPatientCode: active.filter((p) => !String(p.patientCode ?? "").trim()).length,
    missingQrToken: active.filter((p) => !String(p.qrToken ?? "").trim()).length,
    missingIdCardCache: active.filter((p) => !String(p.idCardPdfKey ?? "").trim()).length,
  };
}

export interface PatientDataBackfillResult {
  processed: number;
  upgraded: number;
  skipped: number;
  errors: string[];
}

/** Idempotent batch upgrade for patients missing ID/QR or on an old data_version. */
export async function runPatientDataBackfill(
  storage: IStorage,
  options?: { batchSize?: number; limit?: number },
): Promise<PatientDataBackfillResult> {
  const batchSize = Math.min(500, Math.max(1, options?.batchSize ?? 100));
  const all = await storage.getAllPatients().then((rows) => rows.filter((p) => !p.deletedAt));
  const needsWork = all.filter((p) => {
    if (!p.dataVersion || p.dataVersion < CURRENT_PATIENT_DATA_VERSION) return true;
    if (!String(p.patientCode ?? "").trim()) return true;
    if (!String(p.qrToken ?? "").trim()) return true;
    return false;
  });
  const target = options?.limit ? needsWork.slice(0, options.limit) : needsWork;

  const result: PatientDataBackfillResult = {
    processed: 0,
    upgraded: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < target.length; i += batchSize) {
    const batch = target.slice(i, i + batchSize);
    for (const patient of batch) {
      result.processed += 1;
      try {
        const beforeCode = String(patient.patientCode ?? "").trim();
        const beforeVersion = patient.dataVersion ?? 0;
        const { patient: upgraded } = await ensurePatientDataVersion(storage, patient);
        const changed =
          String(upgraded.patientCode ?? "").trim() !== beforeCode ||
          (upgraded.dataVersion ?? 0) !== beforeVersion ||
          String(upgraded.qrToken ?? "").trim() !== String(patient.qrToken ?? "").trim();
        if (changed) result.upgraded += 1;
        else result.skipped += 1;
      } catch (err) {
        result.errors.push(`${patient.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return result;
}
