import type { Patient, UpdatePatient, InPatientAdmission, UpdateInPatientAdmission } from "@shared/schema";
import type { OrganizationId } from "@shared/branchAccess";
import type { IStorage } from "../storage";
import { organizationForBranch } from "@shared/branchAccess";
import {
  formatPatientCode,
  isCurrentPatientCode,
  patientBranchCode,
  patientIdDayMonth,
} from "@shared/patientId";
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
  /** Patient IDs not in the current MC/&lt;BRANCH&gt;/&lt;DDMM&gt;/&lt;SEQ&gt; format (legacy/custom). */
  nonStandardPatientCodes: number;
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
    nonStandardPatientCodes: active.filter(
      (p) => !isCurrentPatientCode(String(p.patientCode ?? "").trim()),
    ).length,
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

export interface RegenerateAllPatientCodesResult {
  processed: number;
  regenerated: number;
  admissionsUpdated: number;
  errors: string[];
  samples: Array<{ patientId: string; name: string; oldCode: string; newCode: string }>;
}

/**
 * Replaces every active patient's display ID (patientCode) with a fresh
 * MC/&lt;BRANCH&gt;/&lt;DDMM&gt;/&lt;SEQ&gt; code based on branch + registration date.
 * Legacy/custom IDs are discarded. QR tokens and ID card cache are refreshed.
 */
export async function regenerateAllPatientCodes(
  storage: IStorage,
): Promise<RegenerateAllPatientCodesResult> {
  const active = (await storage.getAllPatients())
    .filter((p) => !p.deletedAt)
    .sort((a, b) => {
      const dateCmp = String(a.registeredDate).localeCompare(String(b.registeredDate));
      if (dateCmp !== 0) return dateCmp;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aCreated - bCreated;
    });

  const maxSeq = new Map<string, number>();
  const codeByPatientId = new Map<string, string>();
  const result: RegenerateAllPatientCodesResult = {
    processed: 0,
    regenerated: 0,
    admissionsUpdated: 0,
    errors: [],
    samples: [],
  };

  for (const patient of active) {
    result.processed += 1;
    const oldCode = String(patient.patientCode ?? "").trim();
    try {
      const branchCode = patientBranchCode(patient.branch);
      const ddmm = patientIdDayMonth(patient.registeredDate);
      const key = `${branchCode}/${ddmm}`;
      let nextSeq = (maxSeq.get(key) ?? 0) + 1;
      let newCode = formatPatientCode(branchCode, ddmm, nextSeq);
      while ([...codeByPatientId.values()].includes(newCode)) {
        nextSeq += 1;
        newCode = formatPatientCode(branchCode, ddmm, nextSeq);
      }
      maxSeq.set(key, nextSeq);

      const organizationId = organizationForBranch(patient.branch);
      const qrToken = signPatientQrToken({ patientId: patient.id, organizationId });

      await storage.updatePatient(patient.id, {
        patientCode: newCode,
        qrToken,
        qrTokenExpiresAt: tokenExpiryDate(qrToken),
        dataVersion: CURRENT_PATIENT_DATA_VERSION,
        dataMigratedAt: new Date(),
        idCardPdfKey: null,
        idCardQrToken: null,
        idCardGeneratedAt: null,
      } as UpdatePatient);

      codeByPatientId.set(patient.id, newCode);
      if (oldCode !== newCode) {
        result.regenerated += 1;
        if (result.samples.length < 15) {
          result.samples.push({
            patientId: patient.id,
            name: patient.name,
            oldCode: oldCode || "(none)",
            newCode,
          });
        }
      }
    } catch (err) {
      result.errors.push(`${patient.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const admissions = await storage.getAllInPatientAdmissions();
  for (const admission of admissions) {
    const linkedId = admission.patientId ?? null;
    if (!linkedId) continue;
    const newCode = codeByPatientId.get(linkedId);
    if (!newCode) continue;
    const current = String((admission as { patientCode?: string | null }).patientCode ?? "").trim();
    if (current === newCode) continue;
    try {
      await storage.updateInPatientAdmission(admission.id, {
        patientCode: newCode,
      } as UpdateInPatientAdmission);
      result.admissionsUpdated += 1;
    } catch (err) {
      result.errors.push(
        `admission ${admission.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
